import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";
import { runAnalysisPipeline, runAnalysisPipelineForFile } from "@/lib/gemini";
import type { ApiError } from "@/types";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const CONFIDENCE_THRESHOLD = 80;

const RequestSchema = z.object({
  blobUrl: z.string().url(),
});

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    let blobUrl = "";
    let analysisInput: { type: "file"; file: File } | { type: "url"; url: string };

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("video") as File | null;

      if (!file) {
        return NextResponse.json<ApiError>(
          { error: "No video file provided", code: "MISSING_FILE" },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json<ApiError>(
          { error: "File exceeds 50MB limit", code: "FILE_TOO_LARGE" },
          { status: 400 }
        );
      }

      if (!ACCEPTED_TYPES.includes(file.type)) {
        return NextResponse.json<ApiError>(
          {
            error: "Unsupported format. Use MP4, MOV, or WebM",
            code: "INVALID_FORMAT",
          },
          { status: 400 }
        );
      }

      analysisInput = { type: "file", file };

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const blob = await put(file.name, file, {
          access: "public",
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24,
        });

        blobUrl = blob.url;
      }
    } else {
      const body = await req.json();
      const parsed = RequestSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json<ApiError>(
          { error: "Invalid request body", code: "INVALID_REQUEST" },
          { status: 400 }
        );
      }

      blobUrl = parsed.data.blobUrl;
      analysisInput = { type: "url", url: blobUrl };
    }

    let { sport, verdict } =
      analysisInput.type === "file"
        ? await runAnalysisPipelineForFile(analysisInput.file)
        : await runAnalysisPipeline(analysisInput.url);

    if (verdict.confidence < CONFIDENCE_THRESHOLD && verdict.verdict !== "INCONCLUSIVE") {
      verdict = {
        ...verdict,
        verdict: "INCONCLUSIVE",
        reasoning: `${verdict.reasoning} (Model was leaning ${verdict.verdict} but confidence was too low to call definitively.)`,
      };
    }

    return NextResponse.json({
      id: crypto.randomUUID(),
      sport,
      verdict,
      blobUrl,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/analyze] Error:", err);

    const message = err instanceof Error ? err.message : "Unknown error";

    if (message.includes("GOOGLE_GENERATIVE_AI_API_KEY")) {
      return NextResponse.json<ApiError>(
        { error: message, code: "MISSING_GEMINI_KEY" },
        { status: 500 }
      );
    }

    if (message.includes("Could not detect sport")) {
      return NextResponse.json<ApiError>(
        { error: message, code: "SPORT_DETECTION_FAILED" },
        { status: 422 }
      );
    }

    if (message.includes("invalid JSON") || message.includes("schema")) {
      return NextResponse.json<ApiError>(
        { error: "Analysis failed - invalid model response", code: "INVALID_MODEL_OUTPUT" },
        { status: 502 }
      );
    }

    if (message.includes("Gemini")) {
      return NextResponse.json<ApiError>(
        { error: message, code: "GEMINI_ERROR" },
        { status: 502 }
      );
    }

    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}