import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { put } from "@vercel/blob";
import { runAnalysisPipeline } from "@/lib/gemini";
import type { ApiError } from "@/types";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

const RequestSchema = z.object({
  blobUrl: z.string().url(),
});

export async function POST(req: NextRequest) {
  try {
    // Check Content-Type to handle both JSON (blob URL) and FormData (direct upload)
    const contentType = req.headers.get("content-type") ?? "";

    let blobUrl: string;

    if (contentType.includes("multipart/form-data")) {
      // Handle direct file upload
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

      const blob = await put(file.name, file, {
        access: "public",
        addRandomSuffix: true,
        // TTL: 24 hours
        cacheControlMaxAge: 60 * 60 * 24,
      });

      blobUrl = blob.url;
    } else {
      // Handle pre-uploaded blob URL
      const body = await req.json();
      const parsed = RequestSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json<ApiError>(
          { error: "Invalid request body", code: "INVALID_REQUEST" },
          { status: 400 }
        );
      }

      blobUrl = parsed.data.blobUrl;
    }

    // Run two-pass Gemini pipeline
    const { sport, verdict } = await runAnalysisPipeline(blobUrl);

    const id = crypto.randomUUID();

    return NextResponse.json({
      id,
      sport,
      verdict,
      blobUrl,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/analyze] Error:", err);

    const message = err instanceof Error ? err.message : "Unknown error";

    if (message.includes("Could not detect sport")) {
      return NextResponse.json<ApiError>(
        { error: message, code: "SPORT_DETECTION_FAILED" },
        { status: 422 }
      );
    }

    if (message.includes("invalid JSON") || message.includes("schema")) {
      return NextResponse.json<ApiError>(
        { error: "Analysis failed — invalid model response", code: "INVALID_MODEL_OUTPUT" },
        { status: 502 }
      );
    }

    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
