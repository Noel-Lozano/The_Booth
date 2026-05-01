export type Sport = "basketball" | "soccer" | "baseball" | "football" | "hockey";

export interface AnalysisVerdict {
  verdict: "FAIR" | "BAD" | "INCONCLUSIVE";
  confidence: number; // 0-100
  rule_citations: string[]; // e.g. ["NBA Rule 12, Section II(a)"]
  reasoning: string; // plain English explanation
}

export interface AnalysisResult {
  id: string;
  sport: Sport;
  verdict: AnalysisVerdict;
  blobUrl: string;
  createdAt: string;
}

export interface ApiError {
  error: string;
  code: string;
}
