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

export const VerdictSchema = z.object({
  verdict: z.enum(["FAIR", "BAD", "INCONCLUSIVE"]),
  confidence: z.number().min(0).max(100),
  rule_citations: z.array(z.string()),
  reasoning: z.string(),
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
- "FAIR" — the call was correct based on the rules
- "BAD" — the call was incorrect based on the rules
- "INCONCLUSIVE" — the video angle, quality, or available information is insufficient to make a confident judgment

Return ONLY a valid JSON object matching the required schema. No markdown, no preamble.`;

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

  return validated.data;
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
