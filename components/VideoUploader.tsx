"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useAnalysisStore } from "@/store/useAnalysisStore";
import type { AnalysisResult } from "@/types";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
};

interface VideoUploaderProps {
  onResult: (result: AnalysisResult) => void;
}

export function VideoUploader({ onResult }: VideoUploaderProps) {
  const { uploadStatus, uploadError, setUploadStatus, setUploadError, setDetectedSport, reset } =
    useAnalysisStore();
  const [preview, setPreview] = useState<string | null>(null);
  const [originalCall, setOriginalCall] = useState("");

  const onDrop = useCallback(
    async (accepted: File[], rejected: import("react-dropzone").FileRejection[]) => {
      if (rejected.length > 0) {
        const code = rejected[0].errors[0].code;
        if (code === "file-too-large") {
          setUploadError("File exceeds 50MB limit.");
        } else if (code === "file-invalid-type") {
          setUploadError("Unsupported format. Use MP4, MOV, or WebM.");
        } else {
          setUploadError("Invalid file.");
        }
        return;
      }

      if (accepted.length === 0) return;

      const file = accepted[0];
      setPreview(URL.createObjectURL(file));
      setUploadError(null);
      setUploadStatus("uploading");

      try {
        const formData = new FormData();
        formData.append("video", file);
        if (originalCall.trim()) {
          formData.append("originalCall", originalCall.trim());
        }

        const res = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errorMessages: Record<string, string> = {
            SPORT_DETECTION_FAILED: "Sport could not be detected — try a clearer clip.",
            INVALID_MODEL_OUTPUT: "Analysis failed — the model returned an unexpected response. Try again.",
            FILE_TOO_LARGE: "File exceeds 50MB — try a shorter or compressed clip.",
            INVALID_FORMAT: "Unsupported format. Use MP4, MOV, or WebM.",
            MISSING_FILE: "No video file found — try again.",
            SERVER_ERROR: "Something went wrong on our end — try again.",
          };
          if (res.status === 413) {
            throw new Error("File too large for the server — try a shorter or compressed clip.");
          }
          let err: { code?: string; error?: string } = {};
          try { err = await res.json(); } catch { /* non-JSON error response */ }
          throw new Error(errorMessages[err.code ?? ""] ?? err.error ?? "Upload failed.");
        }

        setUploadStatus("analyzing");
        const result: AnalysisResult = await res.json();
        setDetectedSport(result.sport);
        setUploadStatus("done");
        onResult(result);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Something went wrong.");
        setUploadStatus("error");
      }
    },
    [setUploadStatus, setUploadError, setDetectedSport, onResult]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    maxFiles: 1,
    disabled: uploadStatus === "uploading" || uploadStatus === "analyzing",
  });

  const isLoading = uploadStatus === "uploading" || uploadStatus === "analyzing";

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? "border-yellow-400 bg-yellow-400/5" : "border-white/20 hover:border-white/40"}
          ${isLoading ? "opacity-60 cursor-not-allowed" : ""}
        `}
      >
        <input {...getInputProps()} />

        {preview && (
          <video
            src={preview}
            className="mx-auto mb-6 max-h-48 rounded-xl object-cover"
            muted
            playsInline
          />
        )}

        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <div className={`w-10 h-10 border-2 border-t-transparent rounded-full animate-spin ${
              uploadStatus === "uploading" ? "border-white/40" : "border-yellow-400"
            }`} />
            <p className="text-white font-medium text-sm">
              {uploadStatus === "uploading" ? "Uploading video..." : "Analyzing with Gemini..."}
            </p>
            <p className="text-white/40 text-xs">
              {uploadStatus === "uploading" ? "Sending to Vercel Blob" : "This takes around 30 seconds"}
            </p>
          </div>
        ) : (
          <>
            <div className="text-5xl mb-4">🎬</div>
            <p className="text-white font-medium text-lg mb-1">
              {isDragActive ? "Drop it here" : "Drop your clip here"}
            </p>
            <p className="text-white/50 text-sm">
              MP4, MOV, or WebM · Max 50MB
            </p>
          </>
        )}
      </div>

      {/* Original call input */}
      {!isLoading && (
        <div className="mt-4">
          <input
            type="text"
            value={originalCall}
            onChange={(e) => setOriginalCall(e.target.value)}
            placeholder="Original referee call (optional) — e.g. Blocking foul"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      )}

      {uploadError && (
        <p className="mt-3 text-red-400 text-sm text-center">{uploadError}</p>
      )}

      {uploadStatus === "error" && (
        <button
          onClick={reset}
          className="mt-4 w-full py-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
