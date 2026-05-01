import { RuleCitation } from "@/components/RuleCitation";
import type { AnalysisResult } from "@/types";

interface AnalysisCardProps {
  result: AnalysisResult;
}

const SPORT_LABEL: Record<string, string> = {
  basketball: "Basketball",
  soccer: "Soccer",
  baseball: "Baseball",
  football: "Football",
  hockey: "Hockey",
};

export function AnalysisCard({ result }: AnalysisCardProps) {
  const { verdict, sport } = result;
  const v = verdict.verdict;

  const headerClass =
    v === "FAIR"
      ? "bg-green-500/20 border-b border-green-500/30"
      : v === "BAD"
        ? "bg-red-500/20 border-b border-red-500/30"
        : "bg-yellow-500/20 border-b border-yellow-500/30";

  const textClass =
    v === "FAIR" ? "text-green-400" : v === "BAD" ? "text-red-400" : "text-yellow-400";

  const label =
    v === "FAIR" ? "Correct Call" : v === "BAD" ? "Incorrect Call" : "Inconclusive Call";

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm">
      <div
        className={`px-8 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${headerClass}`}
      >
        <div>
          <p className="text-white/50 text-xs uppercase tracking-widest mb-1">
            {SPORT_LABEL[sport] ?? sport}
          </p>
          <h2 className={`text-3xl sm:text-4xl font-black tracking-tight ${textClass}`}>
            {label}
          </h2>
        </div>

        <div className="sm:text-right">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Confidence</p>
          <p className="text-3xl font-bold text-white">{verdict.confidence}%</p>
        </div>
      </div>

      <div className="px-8 py-6 border-b border-white/10">
        <h3 className="text-white/40 text-xs uppercase tracking-widest mb-3">Analysis</h3>
        <p className="text-white/80 leading-relaxed">{verdict.reasoning}</p>
      </div>

      {verdict.rule_citations.length > 0 && (
        <div className="px-8 py-6">
          <h3 className="text-white/40 text-xs uppercase tracking-widest mb-3">
            Rule Citations
          </h3>
          <ul className="space-y-2">
            {verdict.rule_citations.map((citation, index) => (
              <RuleCitation key={`${citation}-${index}`} citation={citation} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}