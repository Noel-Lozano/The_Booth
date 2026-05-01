"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { upload } from "@vercel/blob/client";
import { useAnalysisStore } from "@/store/useAnalysisStore";
import type { AnalysisResult } from "@/types";

const MAX_SIZE = 500 * 1024 * 1024;
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

  const onDrop = useCallback(
    async (accepted: File[], rejected: import("react-dropzone").FileRejection[]) => {
      if (rejected.length > 0) {
        const code = rejected[0].errors[0].code;
        if (code === "file-too-large") {
          setUploadError("File exceeds 500MB limit.");
        } else if (code === "file-invalid-type") {
          setUploadError("Unsupported format. Use MP4, MOV, or WebM.");
        } else {
          setUploadError("Invalid file.");
        }
        return;
      }

      if (accepted.length === 0) return;

      const file = accepted[0];
      setPreview((currentPreview) => {
        if (currentPreview) URL.revokeObjectURL(currentPreview);
        return URL.createObjectURL(file);
      });
      setUploadError(null);
      setUploadStatus("uploading");

      try {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/upload-token",
        });

        setUploadStatus("analyzing");
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blobUrl: blob.url }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Upload failed");
        }

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
            controls
          />
        )}

        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-white/70 text-sm">
              {uploadStatus === "uploading"
                ? "Uploading video..."
                : "Uploading to Gemini and checking the play..."}
            </p>
          </div>
        ) : (
          <>
            <div className="text-5xl mb-4" aria-hidden="true">
              VIDEO
            </div>
            <p className="text-white font-medium text-lg mb-1">
              {isDragActive ? "Drop it here" : "Drop your clip here"}
            </p>
            <p className="text-white/50 text-sm">MP4, MOV, or WebM - Max 500MB</p>
          </>
        )}
      </div>

      {uploadError && <p className="mt-3 text-red-400 text-sm text-center">{uploadError}</p>}

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
