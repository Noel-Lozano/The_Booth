"use client";

import { useState } from "react";
import { VideoUploader } from "@/components/VideoUploader";
import { AnalysisCard } from "@/components/AnalysisCard";
import { useAnalysisStore } from "@/store/useAnalysisStore";
import type { AnalysisResult } from "@/types";

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { reset } = useAnalysisStore();

  const handleResult = (data: AnalysisResult) => {
    setResult(data);
  };

  const handleReset = () => {
    setResult(null);
    reset();
  };

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black text-white tracking-tight mb-3">
          The Booth
        </h1>
        <p className="text-white/50 text-lg max-w-md mx-auto">
          Upload a sports clip. Get an instant AI-powered officiating verdict grounded in official rules.
        </p>
      </div>

      {/* Supported sports */}
      <div className="flex gap-3 mb-10 text-2xl">
        {["🏀", "⚽", "⚾", "🏈", "🏒"].map((emoji) => (
          <span key={emoji} className="opacity-60 hover:opacity-100 transition-opacity">
            {emoji}
          </span>
        ))}
      </div>

      {/* Upload or Result */}
      {result ? (
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <AnalysisCard result={result} />
          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all text-sm"
          >
            Analyze another clip
          </button>
        </div>
      ) : (
        <VideoUploader onResult={handleResult} />
      )}

      {/* Footer */}
      <p className="mt-16 text-white/20 text-xs">
        GDG BorderHack · Built with Gemini 2.0 Flash · MIT License
      </p>
    </main>
  );
}
