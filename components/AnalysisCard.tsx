import { RuleCitation } from "@/components/RuleCitation";
import type { AnalysisResult } from "@/types";

interface AnalysisCardProps {
  result: AnalysisResult;
}

const SPORT_EMOJI: Record<string, string> = {
  basketball: "🏀",
  soccer: "⚽",
  baseball: "⚾",
  football: "🏈",
  hockey: "🏒",
};

export function AnalysisCard({ result }: AnalysisCardProps) {
  const { verdict, sport } = result;
  const isFair = verdict.verdict === "FAIR";

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm">
      {/* Verdict banner */}
      <div
        className={`px-8 py-6 flex items-center justify-between ${
          isFair ? "bg-green-500/20 border-b border-green-500/30" : "bg-red-500/20 border-b border-red-500/30"
        }`}
      >
        <div>
          <p className="text-white/50 text-xs uppercase tracking-widest mb-1">
            {SPORT_EMOJI[sport]} {sport.charAt(0).toUpperCase() + sport.slice(1)}
          </p>
          <h2
            className={`text-4xl font-black tracking-tight ${
              isFair ? "text-green-400" : "text-red-400"
            }`}
          >
            {isFair ? "✓ FAIR CALL" : "✗ BAD CALL"}
          </h2>
        </div>

        {/* Confidence dial */}
        <div className="text-right">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Confidence</p>
          <p className="text-3xl font-bold text-white">{verdict.confidence}%</p>
        </div>
      </div>

      {/* Reasoning */}
      <div className="px-8 py-6 border-b border-white/10">
        <h3 className="text-white/40 text-xs uppercase tracking-widest mb-3">Analysis</h3>
        <p className="text-white/80 leading-relaxed">{verdict.reasoning}</p>
      </div>

      {/* Rule citations */}
      {verdict.rule_citations.length > 0 && (
        <div className="px-8 py-6">
          <h3 className="text-white/40 text-xs uppercase tracking-widest mb-3">
            Rule Citations
          </h3>
          <ul className="space-y-2">
            {verdict.rule_citations.map((citation, i) => (
              <RuleCitation key={i} citation={citation} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
