import { create } from "zustand";
import type { AnalysisResult, Sport } from "@/types";

interface AnalysisState {
  // Upload state
  uploadStatus: "idle" | "uploading" | "analyzing" | "done" | "error";
  uploadError: string | null;

  // Detection state
  detectedSport: Sport | null;

  // Result state
  result: AnalysisResult | null;

  // Actions
  setUploadStatus: (status: AnalysisState["uploadStatus"]) => void;
  setUploadError: (error: string | null) => void;
  setDetectedSport: (sport: Sport | null) => void;
  setResult: (result: AnalysisResult | null) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  uploadStatus: "idle",
  uploadError: null,
  detectedSport: null,
  result: null,

  setUploadStatus: (status) => set({ uploadStatus: status }),
  setUploadError: (error) => set({ uploadError: error }),
  setDetectedSport: (sport) => set({ detectedSport: sport }),
  setResult: (result) => set({ result }),
  reset: () =>
    set({
      uploadStatus: "idle",
      uploadError: null,
      detectedSport: null,
      result: null,
    }),
}));
