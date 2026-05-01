import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type { Sport, AnalysisVerdict } from "@/types";

// Fail fast if key is missing
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error(
    "GOOGLE_GENERATIVE_AI_API_KEY is not set. Check your .env.local file."
  );
}

const genAI = new GoogleGenerativeAI(apiKey);

// Zod schema for Gemini response validation
export const VerdictSchema = z.object({
  verdict: z.enum(["FAIR", "BAD", "INCONCLUSIVE"]),
  confidence: z.number().min(0).max(100),
  rule_citations: z.array(z.string()),
  reasoning: z.string(),
});

const SPORTS: Sport[] = ["basketball", "soccer", "baseball", "football", "hockey"];

// Pass 1 — Sport detection
export async function detectSport(videoUrl: string): Promise<Sport> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Watch this sports video clip and identify which sport is being played.
Respond with ONLY one of these exact words (lowercase): basketball, soccer, baseball, football, hockey
Do not include any other text.`;

  const result = await model.generateContent([
    { text: prompt },
    {
      fileData: {
        mimeType: "video/mp4",
        fileUri: videoUrl,
      },
    },
  ]);

  const raw = result.response.text().trim().toLowerCase();
  const detected = SPORTS.find((s) => raw.includes(s));

  if (!detected) {
    throw new Error(`Could not detect sport from video. Model returned: ${raw}`);
  }

  return detected;
}

// Pass 2 — Full rule-grounded analysis
export async function analyzeCall(
  videoUrl: string,
  sport: Sport,
  originalCall?: string
): Promise<AnalysisVerdict> {
  // Dynamically import sport-specific rulebook prompt
  const { systemPrompt } = await import(`@/lib/prompts/${sport}`);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
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
    {
      fileData: {
        mimeType: "video/mp4",
        fileUri: videoUrl,
      },
    },
  ]);

  const raw = result.response.text().trim();

  // Strip markdown code fences if model includes them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

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

// Two-pass pipeline — main entry point
export async function runAnalysisPipeline(
  videoUrl: string,
  originalCall?: string
): Promise<{
  sport: Sport;
  verdict: AnalysisVerdict;
}> {
  const sport = await detectSport(videoUrl);
  const verdict = await analyzeCall(videoUrl, sport, originalCall);
  return { sport, verdict };
}
