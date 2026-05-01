import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lookupCrew } from "@/lib/crew-lookup";
import type { ApiError } from "@/types";

const RequestSchema = z.object({
  sport: z.string(),
  gameId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = RequestSchema.safeParse({
      sport: searchParams.get("sport"),
      gameId: searchParams.get("gameId") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json<ApiError>(
        { error: "Invalid query parameters", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const crew = await lookupCrew(parsed.data.sport, parsed.data.gameId);

    if (!crew) {
      return NextResponse.json<ApiError>(
        { error: "Crew data unavailable", code: "CREW_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(crew);
  } catch (err) {
    console.error("[/api/crew] Error:", err);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
