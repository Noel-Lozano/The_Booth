export interface CrewMember {
  id: string;
  name: string;
  role: string;
}

export interface CrewInfo {
  sport: string;
  gameId?: string;
  crew: CrewMember[];
}

export async function lookupCrew(sport: string, gameId?: string): Promise<CrewInfo | null> {
  const apiKey = process.env.SPORTRADAR_API_KEY;

  if (!apiKey) {
    console.error(
      `[crew-lookup] SPORTRADAR_API_KEY is not set - skipping ${sport} crew lookup for ${
        gameId ?? "unknown game"
      }`
    );
    return null;
  }

  try {
    // Sportradar endpoints vary by sport. Keep this as a documented fallback for the demo.
    console.info(`[crew-lookup] Crew lookup not implemented yet for ${sport}/${gameId ?? "unknown"}`);
    return null;
  } catch (err) {
    console.error("[crew-lookup] Failed to fetch crew:", err);
    return null;
  }
}
