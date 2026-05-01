"use client";

import { useState } from "react";
import { AnalysisCard } from "@/components/AnalysisCard";
import { VideoUploader } from "@/components/VideoUploader";
import { useAnalysisStore } from "@/store/useAnalysisStore";
import type { AnalysisResult } from "@/types";

const SUPPORTED_SPORTS = ["Basketball", "Soccer", "Baseball", "Football", "Hockey"];

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { reset } = useAnalysisStore();

  const handleReset = () => {
    setResult(null);
    reset();
  };

  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-black text-white tracking-tight mb-3">The Booth</h1>
        <p className="text-white/50 text-lg max-w-xl mx-auto">
          Upload a sports clip and Gemini will check whether the play looks legal or illegal under
          the supported rule context.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {SUPPORTED_SPORTS.map((sport) => (
          <span
            key={sport}
            className="rounded-md border border-white/10 px-3 py-1 text-xs uppercase tracking-wider text-white/50"
          >
            {sport}
          </span>
        ))}
      </div>

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
        <VideoUploader onResult={setResult} />
      )}

      <p className="mt-16 text-white/20 text-xs">
        GDG BorderHack - Built with Gemini - MIT License
      </p>
    </main>
  );
}
