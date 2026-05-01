"use client";

import { useEffect, useRef, useState } from "react";
import { RuleCitation } from "@/components/RuleCitation";
import type { AnalysisResult, AnalysisVerdict } from "@/types";

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

type VerdictConfig = Record<
  AnalysisVerdict["verdict"],
  {
    banner: string;
    text: string;
    icon: string;
    label: string;
    glowClass: string;
    barColor: string;
    flashColor: string;
    bgAccent: string;
  }
>;

const VERDICT_CONFIG: VerdictConfig = {
  FAIR: {
    banner: "bg-green-950/60 border-b border-green-500/20",
    text: "text-green-400",
    icon: "✓",
    label: "FAIR CALL",
    glowClass: "glow-green",
    barColor: "#22c55e",
    flashColor: "rgba(34,197,94,0.25)",
    bgAccent: "radial-gradient(ellipse 90% 60% at 50% 30%, #001a08 0%, #000000 70%)",
  },
  BAD: {
    banner: "bg-red-950/60 border-b border-red-500/20",
    text: "text-red-400",
    icon: "✗",
    label: "BAD CALL",
    glowClass: "glow-red",
    barColor: "#ef4444",
    flashColor: "rgba(239,68,68,0.25)",
    bgAccent: "radial-gradient(ellipse 90% 60% at 50% 30%, #1a0000 0%, #000000 70%)",
  },
  INCONCLUSIVE: {
    banner: "bg-yellow-950/60 border-b border-yellow-500/20",
    text: "text-yellow-400",
    icon: "~",
    label: "INCONCLUSIVE",
    glowClass: "glow-yellow",
    barColor: "#eab308",
    flashColor: "rgba(234,179,8,0.22)",
    bgAccent: "radial-gradient(ellipse 90% 60% at 50% 30%, #0f0a00 0%, #000000 70%)",
  },
};

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function useTypingEffect(text: string, delay = 300, speed = 14) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, delay, speed]);
  return displayed;
}

export function AnalysisCard({ result }: AnalysisCardProps) {
  const { verdict, sport, originalCall } = result;
  const config = VERDICT_CONFIG[verdict.verdict];
  const confidencePct = Math.min(100, Math.max(0, verdict.confidence));
  const displayedConf = useCountUp(confidencePct, 900);
  const displayedReasoning = useTypingEffect(verdict.reasoning, 600, 14);

  return (
    <div
      className={`w-full rounded-2xl overflow-hidden border border-white/10 bg-black/80 backdrop-blur-md relative ${config.glowClass}`}
    >
      {/* Flash sweep overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-20 animate-flash-sweep rounded-2xl"
        style={{ background: config.flashColor }}
      />

      {/* Verdict banner */}
      <div className={`px-8 pt-8 pb-6 ${config.banner}`}>
        <div className="grid grid-cols-2 gap-x-4">

          {/* Left col — Sport label */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`text-xs uppercase tracking-widest font-medium opacity-50 ${config.text}`}>
              {SPORT_LABEL[sport] ?? sport}
            </span>
            {originalCall && (
              <>
                <span className="text-white/20 text-xs">·</span>
                <span className="text-white/30 text-xs">
                  Original call:{" "}
                  <span className="text-white/55 font-medium">{originalCall}</span>
                </span>
              </>
            )}
          </div>

          {/* Right col — Confidence label */}
          <div className="mb-3 text-right">
            <p className={`text-xs uppercase tracking-widest opacity-50 ${config.text}`}>Confidence</p>
          </div>

          {/* Left col — Verdict text with icon pop */}
          <h2
            className={`font-black tracking-tighter leading-none whitespace-nowrap ${config.text} flex items-center gap-3`}
            style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)" }}
          >
            <span className="inline-block animate-icon-pop">{config.icon}</span>
            {config.label}
          </h2>

          {/* Right col — Percentage + bar */}
          <div className="text-right flex flex-col items-end">
            <p
              className="font-black leading-none mb-2"
              style={{ fontSize: "clamp(2rem, 5vw, 3rem)", color: config.barColor }}
            >
              {displayedConf}%
            </p>
            <div className="w-24 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${confidencePct}%`,
                  background: config.barColor,
                  boxShadow: `0 0 8px ${config.barColor}`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <div className="px-8 py-6 border-b border-white/8">
        <h3 className="text-white/30 text-xs uppercase tracking-widest mb-3 font-semibold">
          Analysis
        </h3>
        <p className="text-white/70 leading-relaxed text-[15px] min-h-[4rem]">
          {displayedReasoning}
          {displayedReasoning.length < verdict.reasoning.length && (
            <span className="inline-block w-0.5 h-4 bg-white/40 ml-0.5 animate-pulse align-middle" />
          )}
        </p>
      </div>

      {/* Rule citations */}
      {verdict.rule_citations.length > 0 && (
        <div className="px-8 py-6">
          <h3 className="text-white/30 text-xs uppercase tracking-widest mb-4 font-semibold">
            Rule Citations
          </h3>
          <ul className="space-y-2.5">
            {verdict.rule_citations.map((citation, index) => (
              <RuleCitation key={`${citation}-${index}`} citation={citation} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
