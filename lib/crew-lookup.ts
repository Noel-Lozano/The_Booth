// Officiating crew lookup
// Resolves referee/umpire crew from game metadata using Sportradar API

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

export async function lookupCrew(
  sport: string,
  gameId?: string
): Promise<CrewInfo | null> {
  const apiKey = process.env.SPORTRADAR_API_KEY;

  if (!apiKey) {
    console.error("[crew-lookup] SPORTRADAR_API_KEY is not set — skipping crew lookup");
    return null;
  }

  // Sportradar endpoints vary by sport — extend per sport as needed
  // This is a stub implementation for the hackathon
  // Full implementation would query: https://api.sportradar.com/{sport}/trial/v8/en/games/{gameId}/boxscore.json
  try {
    // TODO: implement per-sport Sportradar API calls
    return null;
  } catch (err) {
    console.error("[crew-lookup] Failed to fetch crew:", err);
    return null;
  }
}
