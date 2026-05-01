"use client";

import { useState } from "react";
import { AnalysisCard } from "@/components/AnalysisCard";
import { VideoUploader } from "@/components/VideoUploader";
import { useAnalysisStore } from "@/store/useAnalysisStore";
import type { AnalysisResult } from "@/types";

const VERDICT_BG: Record<string, string> = {
  FAIR: "radial-gradient(ellipse 90% 60% at 50% 30%, #001a08 0%, #000000 70%)",
  BAD:  "radial-gradient(ellipse 90% 60% at 50% 30%, #1a0000 0%, #000000 70%)",
  INCONCLUSIVE: "radial-gradient(ellipse 90% 60% at 50% 30%, #0f0a00 0%, #000000 70%)",
};

const SPORTS = [
  { label: "Basketball" },
  { label: "Soccer" },
  { label: "Baseball" },
  { label: "Football" },
  { label: "Hockey" },
];

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { reset } = useAnalysisStore();

  const handleReset = () => {
    setResult(null);
    reset();
  };

  const videoSrc = result?.previewUrl || result?.blobUrl || null;

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden"
      style={{
        background: result
          ? VERDICT_BG[result.verdict.verdict]
          : "radial-gradient(ellipse 90% 60% at 50% 30%, #100800 0%, #000000 70%)",
        transition: "background 0.8s ease",
      }}
    >
      {/* Subtle grid lines */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Hero — fades out when result arrives */}
      <div
        className="text-center relative z-10 overflow-hidden transition-all duration-500 ease-in-out"
        style={{
          opacity: result ? 0 : 1,
          maxHeight: result ? "0px" : "600px",
          marginBottom: result ? "0px" : "3rem",
          pointerEvents: result ? "none" : "auto",
        }}
      >
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-yellow-400 text-xs font-semibold uppercase tracking-widest">
            AI-Powered · GDG BorderHack 2026
          </span>
        </div>

        {/* Title */}
        <h1
          className="font-black tracking-tighter text-white mb-4 leading-none animate-fade-in-up"
          style={{ fontSize: "clamp(4rem, 12vw, 9rem)" }}
        >
          THE{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #ffffff 0%, #fbbf24 60%, #f59e0b 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            BOOTH
          </span>
        </h1>

        <p className="text-white/40 text-lg max-w-lg mx-auto leading-relaxed">
          Drop a sports clip. Get an instant{" "}
          <span className="text-green-400/80 font-medium">FAIR CALL</span>,{" "}
          <span className="text-red-400/80 font-medium">BAD CALL</span>, or{" "}
          <span className="text-yellow-400/80 font-medium">INCONCLUSIVE</span>{" "}
          verdict grounded in the official rulebook.
        </p>
      </div>

      {/* Sport badges — also fade out with hero */}
      <div
        className="flex flex-wrap justify-center gap-2 animate-fade-in relative z-10 overflow-hidden transition-all duration-500 ease-in-out"
        style={{
          animationDelay: "0.15s",
          opacity: result ? 0 : undefined,
          maxHeight: result ? "0px" : "80px",
          marginBottom: result ? "0px" : "2.5rem",
          pointerEvents: result ? "none" : "auto",
        }}
      >
        {SPORTS.map((s) => (
          <span
            key={s.label}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/50 uppercase tracking-wider font-medium hover:border-white/20 hover:text-white/70 transition-all"
          >
            {s.label}
          </span>
        ))}
      </div>

      {/* Main content */}
      <div className="w-full max-w-3xl relative z-10">
        {result ? (
          <div className="flex flex-col gap-6 animate-fade-in-up">
            {/* Video player — lives at the top when result is shown */}
            {videoSrc && (
              <video
                src={videoSrc}
                className="w-full rounded-2xl border border-white/10 max-h-72 object-cover"
                autoPlay
                muted
                playsInline
                controls
              />
            )}

            <AnalysisCard result={result} />

            <button
              onClick={handleReset}
              className="w-full py-3 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition-all text-sm tracking-wide"
            >
              Analyze another clip
            </button>
          </div>
        ) : (
          <VideoUploader onResult={setResult} />
        )}
      </div>

      {/* Footer */}
      <p className="mt-16 text-white/15 text-xs tracking-widest uppercase relative z-10">
        Built with Gemini 2.5 Flash · Vercel · MIT License
      </p>
    </main>
  );
}
