import { randomUUID } from "crypto";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { z } from "zod";
import type { AnalysisVerdict, Sport } from "@/types";

function getClients() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set. Check your .env file.");
  }
  return {
    genAI: new GoogleGenerativeAI(apiKey),
    fileManager: new GoogleAIFileManager(apiKey),
  };
}

interface GeminiVideoFile {
  uri: string;
  mimeType: string;
}

interface GeminiUploadedFile {
  name: string;
  uri: string;
  mimeType?: string;
  state?: string;
}

const EvidenceReviewSchema = z.object({
  incident_start_seconds: z.number().min(0),
  incident_end_seconds: z.number().min(0),
  suspicious_timestamps: z.array(
    z.object({
      time_seconds: z.number().min(0),
      explanation: z.string(),
      confidence: z.number().min(0).max(100),
    })
  ),
});

export const VerdictSchema = z.object({
  verdict: z.enum(["FAIR", "BAD", "INCONCLUSIVE"]),
  confidence: z.number().min(0).max(100),
  rule_citations: z.array(z.string()),
  reasoning: z.string(),
  evidence_review: EvidenceReviewSchema.optional(),
});

const SPORTS: Sport[] = ["basketball", "soccer", "baseball", "football", "hockey"];

const PROMPT_LOADERS: Record<Sport, () => Promise<{ systemPrompt: string }>> = {
  basketball: () => import("@/lib/prompts/basketball"),
  soccer: () => import("@/lib/prompts/soccer"),
  baseball: () => import("@/lib/prompts/baseball"),
  football: () => import("@/lib/prompts/football"),
  hockey: () => import("@/lib/prompts/hockey"),
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getModelName() {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

function evidenceLooksPinnedToStart(evidence: AnalysisVerdict["evidence_review"]) {
  if (!evidence) return false;

  const latestTimestamp = Math.max(
    evidence.incident_end_seconds,
    ...evidence.suspicious_timestamps.map((timestamp) => timestamp.time_seconds)
  );

  return evidence.incident_start_seconds <= 0.25 && latestTimestamp <= 2.5;
}

async function waitForGeminiFile(uploadedFile: GeminiUploadedFile): Promise<GeminiVideoFile> {
  let file = uploadedFile;
  let attempts = 0;
  const maxAttempts = 40; // 40 × 1.5s = 60s max

  while (file.state === "PROCESSING") {
    if (attempts >= maxAttempts) {
      throw new Error("Gemini video processing timed out after 60 seconds");
    }
    await sleep(1500);
    attempts++;
    file = (await getClients().fileManager.getFile(file.name)) as GeminiUploadedFile;
  }

  if (file.state === "FAILED") {
    throw new Error("Gemini failed to process the uploaded video");
  }

  return {
    uri: file.uri,
    mimeType: file.mimeType ?? uploadedFile.mimeType ?? "video/mp4",
  };
}

async function uploadVideoToGemini(
  bytes: ArrayBuffer,
  mimeType: string,
  displayName: string
): Promise<GeminiVideoFile> {
  const extension = mimeType.split("/")[1]?.replace("quicktime", "mov") ?? "mp4";
  const tempPath = path.join(tmpdir(), `refcheck-${randomUUID()}.${extension}`);

  await writeFile(tempPath, Buffer.from(bytes));

  try {
    const { fileManager } = getClients();
    const uploadResult = await fileManager.uploadFile(tempPath, {
      mimeType,
      displayName,
    });
    return await waitForGeminiFile(uploadResult.file as GeminiUploadedFile);
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

async function uploadBrowserFileToGemini(file: File): Promise<GeminiVideoFile> {
  return uploadVideoToGemini(await file.arrayBuffer(), file.type || "video/mp4", file.name);
}

async function uploadUrlToGemini(videoUrl: string): Promise<GeminiVideoFile> {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch video URL for Gemini upload: ${response.status}`);
  }
  const mimeType = response.headers.get("content-type") ?? "video/mp4";
  return uploadVideoToGemini(await response.arrayBuffer(), mimeType, "uploaded-video");
}

export async function detectSport(videoFile: GeminiVideoFile): Promise<Sport> {
  const { genAI } = getClients();
  const model = genAI.getGenerativeModel({ model: getModelName() });

  const prompt = `Watch this sports video clip and identify which sport is being played.
Respond with ONLY one of these exact words (lowercase): basketball, soccer, baseball, football, hockey
Do not include any other text.`;

  const result = await model.generateContent([
    { text: prompt },
    { fileData: { mimeType: videoFile.mimeType, fileUri: videoFile.uri } },
  ]);

  const raw = result.response.text().trim().toLowerCase();
  const detected = SPORTS.find((sport) => raw.includes(sport));

  if (!detected) {
    throw new Error(`Could not detect sport from video. Model returned: ${raw}`);
  }

  return detected;
}

export async function analyzeCall(
  videoFile: GeminiVideoFile,
  sport: Sport,
  originalCall?: string
): Promise<AnalysisVerdict> {
  const { systemPrompt } = await PROMPT_LOADERS[sport]();
  const { genAI } = getClients();
  const model = genAI.getGenerativeModel({
    model: getModelName(),
    systemInstruction: systemPrompt,
  });

  const callContext = originalCall
    ? `The original referee call was: "${originalCall}". Evaluate whether this call was correct.`
    : "No original call was provided. Evaluate whether any call made (or not made) appears correct.";

  const userPrompt = `Analyze this ${sport} video clip and determine if the officiating decision was correct.

${callContext}

Return your verdict as one of exactly three options:
- "FAIR" - the call was correct based on the rules
- "BAD" - the call was incorrect based on the rules
- "INCONCLUSIVE" - the video angle, quality, or available information is insufficient to make a confident judgment

You must also identify the exact video segment where the key action happens.

Return ONLY a valid JSON object with this shape:
{
  "verdict": "FAIR" | "BAD" | "INCONCLUSIVE",
  "confidence": <number from 0 to 100>,
  "rule_citations": ["<specific rule reference>", "..."],
  "reasoning": "<plain English explanation>",
  "evidence_review": {
    "incident_start_seconds": <number>,
    "incident_end_seconds": <number>,
    "suspicious_timestamps": [
      {
        "time_seconds": <number>,
        "explanation": "<what visible evidence at this exact time supports the decision>",
        "confidence": <number from 0 to 100>
      }
    ]
  }
}

Evidence review rules:
- Watch the full clip first, then choose the shortest useful incident window around the contact, violation, missed call, or unclear evidence.
- Timestamps must be absolute seconds from the beginning of the uploaded clip, not relative to your selected incident window.
- incident_start_seconds must be when the key action begins, not always 0.
- incident_end_seconds must be when the key action is resolved.
- Do not use 0.00 seconds unless the actual key action is visible in the first frame of the uploaded clip.
- If the first frame shows the aftermath after the whistle, a player already on the floor, players standing around, or a replay after the contact, that is NOT the start of the incident. Search later or earlier in the clip for the actual contact/action frame.
- If the clip contains a replay or angle change, choose the angle where the foul/action is most visible and use timestamps from that visible segment.
- suspicious_timestamps must include only the necessary moments: usually 3 to 5 timestamps, never filler.
- Each suspicious timestamp must be at least 0.35 seconds apart unless the entire incident is shorter than 1 second.
- Each suspicious timestamp explanation must describe a different visible detail. Do not repeat the same explanation.
- For BAD, timestamps must show the exact frames where the foul, violation, or wrong call becomes visible: before contact/position, moment of contact or violation, and aftermath if useful.
- For FAIR, timestamps must show why the play remains legal: position before action, contact/no-contact moment, and continuation.
- For INCONCLUSIVE, timestamps must show the specific frames where angle, blur, occlusion, or missing contact prevents a confident decision.
- Do not guess wildly. If timing is approximate, choose the best visible moment and lower confidence.
- Return JSON only. No markdown, no preamble.`;

  const result = await model.generateContent([
    { text: userPrompt },
    { fileData: { mimeType: videoFile.mimeType, fileUri: videoFile.uri } },
  ]);

  const raw = result.response.text().trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const cleaned = jsonMatch
    ? jsonMatch[0]
    : raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[analyzeCall] Failed to parse Gemini response:", raw);
    throw new Error("Model returned invalid JSON");
  }

  const validated = VerdictSchema.safeParse(parsed);
  if (!validated.success) {
    console.error("[analyzeCall] Zod validation failed:", validated.error.issues);
    throw new Error("Model response did not match expected schema");
  }

  if (evidenceLooksPinnedToStart(validated.data.evidence_review)) {
    const repairedEvidence = await relocalizeIncident(videoFile, sport, validated.data);

    if (repairedEvidence && !evidenceLooksPinnedToStart(repairedEvidence)) {
      return {
        ...validated.data,
        evidence_review: repairedEvidence,
      };
    }
  }

  return validated.data;
}

async function relocalizeIncident(
  videoFile: GeminiVideoFile,
  sport: Sport,
  verdict: AnalysisVerdict
): Promise<AnalysisVerdict["evidence_review"] | null> {
  const { genAI } = getClients();
  const model = genAI.getGenerativeModel({ model: getModelName() });

  const prompt = `The previous analysis appears to have placed the incident at 0:00, but that may be wrong.

Re-watch the full ${sport} video and ONLY locate the key evidence window for this verdict:
- Verdict: ${verdict.verdict}
- Reasoning: ${verdict.reasoning}

Return absolute timestamps in seconds from the beginning of the uploaded clip.

Important:
- Do not return 0.00 unless the actual foul/contact/violation is visible in the first frame.
- If 0:00 shows aftermath, players already on the floor, replay aftermath, or dead-ball action, search the full clip for the actual live-action incident.
- Prefer the camera angle where the suspected contact or rule issue is most visible.
- Return 3 to 5 necessary timestamps only, with different explanations for each.

Return strict JSON only:
{
  "incident_start_seconds": <number>,
  "incident_end_seconds": <number>,
  "suspicious_timestamps": [
    {
      "time_seconds": <number>,
      "explanation": "<visible evidence at this exact time>",
      "confidence": <number from 0 to 100>
    }
  ]
}`;

  const result = await model.generateContent([
    { text: prompt },
    { fileData: { mimeType: videoFile.mimeType, fileUri: videoFile.uri } },
  ]);

  const raw = result.response.text().trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const cleaned = jsonMatch
    ? jsonMatch[0]
    : raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const validated = EvidenceReviewSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    console.error("[relocalizeIncident] Failed to parse Gemini response:", raw);
    return null;
  }
}

export async function runAnalysisPipelineForFile(
  file: File,
  originalCall?: string
): Promise<{ sport: Sport; verdict: AnalysisVerdict }> {
  const videoFile = await uploadBrowserFileToGemini(file);
  const sport = await detectSport(videoFile);
  const verdict = await analyzeCall(videoFile, sport, originalCall);
  return { sport, verdict };
}

export async function runAnalysisPipeline(
  videoUrl: string,
  originalCall?: string
): Promise<{ sport: Sport; verdict: AnalysisVerdict }> {
  const videoFile = await uploadUrlToGemini(videoUrl);
  const sport = await detectSport(videoFile);
  const verdict = await analyzeCall(videoFile, sport, originalCall);
  return { sport, verdict };
}
