"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { AnalysisCard } from "@/components/AnalysisCard";
import { VideoEvidenceReview } from "@/components/VideoEvidenceReview";
import { VideoUploader } from "@/components/VideoUploader";
import { useAnalysisStore } from "@/store/useAnalysisStore";
import type { AnalysisResult, AnalysisVerdict } from "@/types";

interface VantaEffect {
  destroy: () => void;
}

interface VantaCellsOptions {
  el: HTMLElement;
  mouseControls: boolean;
  touchControls: boolean;
  gyroControls: boolean;
  minHeight: number;
  minWidth: number;
  scale: number;
  color1: number;
  color2: number;
  size: number;
  speed: number;
}

declare global {
  interface Window {
    VANTA?: {
      CELLS: (options: VantaCellsOptions) => VantaEffect;
    };
  }
}

const SPORTS = [
  { label: "Basketball" },
  { label: "Soccer" },
  { label: "Baseball" },
  { label: "Football" },
  { label: "Hockey" },
];

const CONFETTI_PIECES = Array.from({ length: 34 }, (_, index) => index);

const CELEBRATION_CONFIG: Record<
  AnalysisVerdict["verdict"],
  {
    className: string;
    title: string;
    subtitle: string;
    cardLabel?: string;
  }
> = {
  FAIR: {
    className: "celebration-fair",
    title: "Fair Call",
    subtitle: "The ruling holds up.",
  },
  BAD: {
    className: "celebration-bad",
    title: "Bad Call",
    subtitle: "Illegal play detected.",
    cardLabel: "RED CARD",
  },
  INCONCLUSIVE: {
    className: "celebration-inconclusive",
    title: "Inconclusive",
    subtitle: "The evidence is not clear enough.",
    cardLabel: "YELLOW CARD",
  },
};

function normalizeCelebrationVerdict(verdict: string): AnalysisVerdict["verdict"] {
  const normalized = verdict.trim().toUpperCase().replace(/[\s_-]+CALL$/, "");

  if (normalized.includes("BAD") || normalized.includes("ILLEGAL")) {
    return "BAD";
  }

  if (normalized.includes("INCONCLUSIVE") || normalized.includes("UNCLEAR")) {
    return "INCONCLUSIVE";
  }

  return "FAIR";
}

function ResultCelebration({ verdict }: { verdict: string }) {
  const normalizedVerdict = normalizeCelebrationVerdict(verdict);
  const config = CELEBRATION_CONFIG[normalizedVerdict];
  const showCard = normalizedVerdict !== "FAIR";

  return (
    <div className={`result-celebration ${config.className}`} aria-hidden="true">
      <div className="celebration-confetti">
        {CONFETTI_PIECES.map((piece) => (
          <span
            key={piece}
            className="confetti-piece"
            style={
              {
                "--piece-x": `${(piece * 37) % 100}vw`,
                "--piece-delay": `${(piece % 9) * 90}ms`,
                "--piece-drift": `${piece % 2 === 0 ? 1 : -1}`,
                "--piece-rotate": `${(piece * 29) % 180}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="celebration-center">
        {showCard ? (
          <div className="ref-card-scene">
            <div className="ref-card" />
            <div className="ref-hand" />
            <div className="ref-wrist" />
          </div>
        ) : (
          <div className="fair-burst">
            <span>✓</span>
          </div>
        )}

        <p className="celebration-kicker">{config.cardLabel ?? "CONFIRMED"}</p>
        <h2>{config.title}</h2>
        <p>{config.subtitle}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [threeLoaded, setThreeLoaded] = useState(false);
  const [vantaLoaded, setVantaLoaded] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const vantaRef = useRef<HTMLElement | null>(null);
  const vantaEffectRef = useRef<VantaEffect | null>(null);
  const { reset } = useAnalysisStore();

  useEffect(() => {
    if (!threeLoaded || !vantaLoaded || !window.VANTA || !vantaRef.current) {
      return;
    }

    if (vantaEffectRef.current) {
      return;
    }

    vantaEffectRef.current = window.VANTA.CELLS({
      el: vantaRef.current,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      scale: 1,
      color1: 0x0,
      color2: 0x692305,
      size: 0.4,
      speed: 1.1,
    });

    return () => {
      vantaEffectRef.current?.destroy();
      vantaEffectRef.current = null;
    };
  }, [threeLoaded, vantaLoaded]);

  useEffect(() => {
    if (!result) {
      setShowCelebration(false);
      return;
    }

    setShowCelebration(false);
    setCelebrationKey((current) => current + 1);

    const startTimeout = window.setTimeout(() => setShowCelebration(true), 50);
    const timeout = window.setTimeout(() => setShowCelebration(false), 4200);

    return () => {
      window.clearTimeout(startTimeout);
      window.clearTimeout(timeout);
    };
  }, [result]);

  const handleReset = () => {
    setResult(null);
    reset();
  };

  const videoSrc = result?.previewUrl || result?.blobUrl || null;

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/three@0.134.0/build/three.min.js"
        strategy="afterInteractive"
        onLoad={() => setThreeLoaded(true)}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.cells.min.js"
        strategy="afterInteractive"
        onLoad={() => setVantaLoaded(true)}
      />

      <main
        ref={vantaRef}
        className="vanta-page min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden bg-black"
      >
        <div className="pointer-events-none fixed inset-0 z-[1] bg-black/35" />
        {result && showCelebration && (
          <ResultCelebration
            key={`${result.id}-${result.verdict.verdict}-${celebrationKey}`}
            verdict={result.verdict.verdict}
          />
        )}

        <div
          className="text-center relative z-10 overflow-hidden transition-all duration-500 ease-in-out"
          style={{
            opacity: result ? 0 : 1,
            maxHeight: result ? "0px" : "600px",
            marginBottom: result ? "0px" : "3rem",
            pointerEvents: result ? "none" : "auto",
          }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-400 text-xs font-semibold uppercase tracking-widest">
              AI-Powered - GDG BorderHack 2026
            </span>
          </div>

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

          <p className="text-white/45 text-lg max-w-lg mx-auto leading-relaxed">
            Drop a sports clip. Get an instant{" "}
            <span className="text-green-400/90 font-medium">FAIR CALL</span>,{" "}
            <span className="text-red-400/90 font-medium">BAD CALL</span>, or{" "}
            <span className="text-yellow-400/90 font-medium">INCONCLUSIVE</span> verdict grounded
            in the official rulebook.
          </p>
        </div>

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
          {SPORTS.map((sport) => (
            <span
              key={sport.label}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/50 uppercase tracking-wider font-medium hover:border-white/20 hover:text-white/70 transition-all"
            >
              {sport.label}
            </span>
          ))}
        </div>

        <div className={`w-full relative z-10 ${result ? "max-w-5xl" : "max-w-3xl"}`}>
          {result ? (
            <div className="flex flex-col gap-6 animate-fade-in-up">
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

              {videoSrc && <VideoEvidenceReview result={result} videoSrc={videoSrc} />}

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

        <p className="mt-16 text-white/15 text-xs tracking-widest uppercase relative z-10">
          Built with Gemini 2.5 Flash - Vercel - MIT License
        </p>
      </main>
    </>
  );
}
