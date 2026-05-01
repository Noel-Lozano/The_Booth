"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisResult } from "@/types";

type ReviewMode = "original" | "slow" | "frames";

interface VideoEvidenceReviewProps {
  result: AnalysisResult;
  videoSrc: string;
}

interface ClipWindow {
  start: number;
  end: number;
  source: "gemini" | "fallback";
  warning?: string;
}

interface EvidenceFrame {
  id: string;
  time: number;
  image: string;
  suspicious: boolean;
  explanation: string;
  confidence?: number;
}

const CONTEXT_FRAME_COUNT = 5;
const MIN_FRAME_SPACING_SECONDS = 0.35;
const SUSPICIOUS_TOLERANCE_SECONDS = 0.18;

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = Math.floor(safeSeconds % 60);
  const hundredths = Math.floor((safeSeconds % 1) * 100);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}.${hundredths
    .toString()
    .padStart(2, "0")}`;
}

function clampTime(value: number, duration: number) {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, value);
  return Math.min(Math.max(0, value), duration);
}

function getClipWindow(result: AnalysisResult, duration: number): ClipWindow {
  const evidence = result.verdict.evidence_review;

  if (evidence) {
    const start = clampTime(evidence.incident_start_seconds - 0.6, duration);
    const end = clampTime(evidence.incident_end_seconds + 0.6, duration);
    const timestamps = evidence.suspicious_timestamps.map((timestamp) => timestamp.time_seconds);
    const latestTimestamp = Math.max(evidence.incident_end_seconds, ...timestamps);
    const looksPinnedToStart =
      Number.isFinite(duration) &&
      duration >= 6 &&
      evidence.incident_start_seconds <= 0.25 &&
      latestTimestamp <= Math.min(2.5, duration * 0.25);

    if (end > start && !looksPinnedToStart) {
      return { start, end, source: "gemini" };
    }

    if (looksPinnedToStart) {
      return {
        ...getFallbackClipWindow(duration),
        warning:
          "Gemini returned timestamps pinned to the start of the clip, so this view is using a centered review window instead.",
      };
    }
  }

  return getFallbackClipWindow(duration);
}

function getFallbackClipWindow(duration: number): ClipWindow {
  if (!Number.isFinite(duration) || duration <= 0) {
    return { start: 0, end: 6, source: "fallback" };
  }

  const clipLength = Math.min(8, Math.max(4, duration * 0.24));
  const midpoint = duration * 0.5;
  const start = Math.max(0, midpoint - clipLength / 2);
  const end = Math.min(duration, start + clipLength);

  return { start, end, source: "fallback" };
}

function getSuspiciousTimestamp(result: AnalysisResult, time: number) {
  const timestamps = result.verdict.evidence_review?.suspicious_timestamps ?? [];
  const closest = timestamps
    .map((timestamp) => ({
      timestamp,
      distance: Math.abs(timestamp.time_seconds - time),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  return closest?.distance <= SUSPICIOUS_TOLERANCE_SECONDS ? closest.timestamp : undefined;
}

function buildFrameExplanation(result: AnalysisResult, time: number) {
  const suspiciousTimestamp = getSuspiciousTimestamp(result, time);

  if (suspiciousTimestamp) {
    return `${suspiciousTimestamp.explanation} Timestamp ${formatTime(time)}. Frame confidence: ${suspiciousTimestamp.confidence}%.`;
  }

  const verdict = result.verdict.verdict;
  const callText =
    verdict === "BAD"
      ? "This frame is marked because it sits near the suspected illegal-contact window."
      : verdict === "INCONCLUSIVE"
        ? "This frame is marked because the evidence may depend on angle, timing, or visibility."
        : "This frame is included to verify that the play remains legal through the key sequence.";

  return `${callText} Timestamp ${formatTime(time)}. Gemini reasoning: ${result.verdict.reasoning}`;
}

function dedupeTimes(times: number[]) {
  return times
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b)
    .reduce<number[]>((deduped, time) => {
      const previous = deduped[deduped.length - 1];
      if (previous === undefined || Math.abs(time - previous) >= MIN_FRAME_SPACING_SECONDS) {
        deduped.push(time);
      }
      return deduped;
    }, []);
}

function getFrameTimes(result: AnalysisResult, clipWindow: ClipWindow) {
  if (clipWindow.source === "fallback") {
    const span = Math.max(clipWindow.end - clipWindow.start, 1);
    return Array.from({ length: CONTEXT_FRAME_COUNT }, (_, index) => {
      const progress = index / (CONTEXT_FRAME_COUNT - 1);
      return clipWindow.start + span * progress;
    });
  }

  const suspiciousTimes = dedupeTimes(
    (result.verdict.evidence_review?.suspicious_timestamps ?? [])
      .map((timestamp) => timestamp.time_seconds)
      .filter((time) => time >= clipWindow.start && time <= clipWindow.end)
  );

  if (suspiciousTimes.length > 0) {
    const contextTimes = [
      clipWindow.start,
      Math.max(clipWindow.start, suspiciousTimes[0] - 0.25),
      ...suspiciousTimes,
      Math.min(clipWindow.end, suspiciousTimes[suspiciousTimes.length - 1] + 0.25),
      clipWindow.end,
    ];

    return dedupeTimes(contextTimes).slice(0, 8);
  }

  const span = Math.max(clipWindow.end - clipWindow.start, 1);
  return Array.from({ length: CONTEXT_FRAME_COUNT }, (_, index) => {
    const progress = index / (CONTEXT_FRAME_COUNT - 1);
    return clipWindow.start + span * progress;
  });
}

async function captureFrame(videoSrc: string, time: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      reject(new Error("Canvas is unavailable"));
      return;
    }

    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = videoSrc;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(Math.max(time, 0), Math.max(video.duration - 0.1, 0));
    });

    video.addEventListener("seeked", () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.78);
      cleanup();
      resolve(image);
    });

    video.addEventListener("error", () => {
      cleanup();
      reject(new Error("Could not capture frame"));
    });
  });
}

export function VideoEvidenceReview({ result, videoSrc }: VideoEvidenceReviewProps) {
  const [mode, setMode] = useState<ReviewMode>("original");
  const [duration, setDuration] = useState(0);
  const [frames, setFrames] = useState<EvidenceFrame[]>([]);
  const [activeFrame, setActiveFrame] = useState<EvidenceFrame | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const clipWindow = useMemo(() => getClipWindow(result, duration), [duration, result]);
  const evidenceTimestamps = useMemo(
    () =>
      dedupeTimes(
        (result.verdict.evidence_review?.suspicious_timestamps ?? [])
          .map((timestamp) => timestamp.time_seconds)
          .filter((time) => time >= clipWindow.start && time <= clipWindow.end)
      ),
    [clipWindow.end, clipWindow.start, result.verdict.evidence_review]
  );
  const isSlowMode = mode === "slow";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = isSlowMode ? 0.35 : 1;
  }, [isSlowMode, mode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || mode === "frames") return;

    video.currentTime = clipWindow.start;
  }, [clipWindow.start, mode]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime >= clipWindow.end) {
      video.currentTime = clipWindow.start;
      void video.play();
    }
  };

  useEffect(() => {
    if (!duration || !videoSrc) return;

    let cancelled = false;

    async function buildFrames() {
      setFrameError(null);
      const times = getFrameTimes(result, clipWindow);

      try {
        const capturedFrames = await Promise.all(
          times.map(async (time, index) => {
            const suspiciousTimestamp = getSuspiciousTimestamp(result, time);
            const fallbackFocus =
              clipWindow.source === "fallback" && index === Math.floor(times.length / 2);
            return {
              id: `${result.id}-${index}`,
              time,
              image: await captureFrame(videoSrc, time),
              suspicious: Boolean(suspiciousTimestamp) || fallbackFocus,
              explanation: buildFrameExplanation(result, time),
              confidence: suspiciousTimestamp?.confidence,
            };
          })
        );

        if (!cancelled) {
          setFrames(capturedFrames);
        }
      } catch {
        if (!cancelled) {
          setFrames([]);
          setFrameError("Frames are unavailable for this clip source.");
        }
      }
    }

    void buildFrames();

    return () => {
      cancelled = true;
    };
  }, [clipWindow, duration, evidenceTimestamps, result, videoSrc]);

  const primaryFrame = frames.find((frame) => frame.suspicious) ?? frames[0];
  const supportingFrames = frames.filter((frame) => frame.id !== primaryFrame?.id);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/75 backdrop-blur-md overflow-hidden">
      <div className="px-6 py-5 border-b border-white/10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-white/35 text-xs uppercase tracking-widest font-semibold mb-2">
            Evidence Review
          </p>
          <h3 className="text-white text-2xl font-black tracking-tight">Key Clip Window</h3>
          <p className="text-white/45 text-sm mt-1">
            {formatTime(clipWindow.start)} - {formatTime(clipWindow.end)}
          </p>
          <p className="text-white/35 text-xs mt-2">
            {clipWindow.source === "gemini"
              ? `${evidenceTimestamps.length} Gemini-selected evidence frame${
                  evidenceTimestamps.length === 1 ? "" : "s"
                }.`
              : clipWindow.warning ?? "Using automatic centered review window."}
          </p>
        </div>

        <div className="grid grid-cols-3 rounded-xl border border-white/10 bg-white/5 p-1">
          {(["original", "slow", "frames"] as ReviewMode[]).map((option) => (
            <button
              key={option}
              onClick={() => setMode(option)}
              className={`rounded-lg px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
                mode === option ? "bg-white text-black" : "text-white/50 hover:text-white"
              }`}
            >
              {option === "slow" ? "Slow" : option}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {mode === "frames" ? (
          <div>
            {frameError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {frameError}
              </div>
            ) : (
              <div className="space-y-4">
                {primaryFrame && (
                  <button
                    onClick={() => setActiveFrame(primaryFrame)}
                    className={`group grid overflow-hidden rounded-2xl border bg-white/[0.04] text-left transition-all hover:-translate-y-0.5 md:grid-cols-[1.35fr_0.65fr] ${
                      primaryFrame.suspicious
                        ? "border-red-500/80 shadow-[0_0_42px_rgba(239,68,68,0.2)]"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <div className="relative aspect-video bg-black md:aspect-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={primaryFrame.image}
                        alt={`Primary frame at ${formatTime(primaryFrame.time)}`}
                        className="h-full min-h-72 w-full object-cover opacity-95 transition-opacity group-hover:opacity-100"
                      />
                      {primaryFrame.suspicious && (
                        <>
                          <span className="absolute inset-3 rounded-xl border-2 border-red-500" />
                          <span className="absolute left-4 top-4 rounded-full bg-red-500 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                            Key foul frame
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col justify-between p-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-red-300">
                          Primary Evidence
                        </p>
                        <h4 className="mt-2 text-3xl font-black text-white">
                          {formatTime(primaryFrame.time)}
                        </h4>
                        <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-white/65">
                          {primaryFrame.explanation}
                        </p>
                      </div>
                      {primaryFrame.confidence !== undefined && (
                        <p className="mt-4 text-xs text-white/35">
                          Frame confidence:{" "}
                          <span className="text-red-300">{primaryFrame.confidence}%</span>
                        </p>
                      )}
                    </div>
                  </button>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {supportingFrames.map((frame, index) => (
                    <button
                      key={frame.id}
                      onClick={() => setActiveFrame(frame)}
                      className={`group overflow-hidden rounded-xl border bg-white/5 text-left transition-all hover:-translate-y-0.5 ${
                        frame.suspicious
                          ? "border-red-500/70 shadow-[0_0_30px_rgba(239,68,68,0.18)]"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      <div className="relative aspect-video bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={frame.image}
                          alt={`Frame ${index + 1} at ${formatTime(frame.time)}`}
                          className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                        />
                        {frame.suspicious && (
                          <>
                            <span className="absolute inset-2 rounded-lg border-2 border-red-500" />
                            <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                              Suspicious
                            </span>
                          </>
                        )}
                      </div>
                      <div className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white/70">
                            Frame {index + 2}
                          </span>
                          <span
                            className={`text-[11px] ${
                              frame.suspicious ? "text-red-300" : "text-white/35"
                            }`}
                          >
                            {formatTime(frame.time)}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/45">
                          {frame.explanation}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
            <video
              ref={videoRef}
              src={videoSrc}
              className="aspect-video w-full object-contain"
              controls
              muted
              playsInline
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>
        )}
      </div>

      {activeFrame && (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
              <div className="bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeFrame.image}
                  alt={`Selected frame at ${formatTime(activeFrame.time)}`}
                  className="h-full min-h-72 w-full object-contain"
                />
              </div>
              <div className="p-6">
                <p
                  className={`mb-2 text-xs font-bold uppercase tracking-widest ${
                    activeFrame.suspicious ? "text-red-300" : "text-white/35"
                  }`}
                >
                  {activeFrame.suspicious ? "Suspicious Frame" : "Reference Frame"}
                </p>
                <h4 className="text-2xl font-black text-white">
                  {formatTime(activeFrame.time)}
                </h4>
                <p className="mt-4 text-sm leading-relaxed text-white/65">
                  {activeFrame.explanation}
                </p>
                <button
                  onClick={() => setActiveFrame(null)}
                  className="mt-6 w-full rounded-xl border border-white/10 py-3 text-sm text-white/60 transition-colors hover:border-white/30 hover:text-white"
                >
                  Close frame
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
