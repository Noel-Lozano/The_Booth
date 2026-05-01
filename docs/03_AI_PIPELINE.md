# 03 — AI Pipeline
## Gemini Two-Pass Analysis Pipeline — RefCheck AI

---

## Pipeline Overview

```
Video Upload (Vercel Blob URL)
    ↓
Pass 1 — Sport Detection
  Model: gemini-1.5-pro
  Input: video
  Output: detected Sport (enum value)
    ↓
Rule Retrieval
  Load: lib/prompts/{sport}.ts → systemPrompt string
    ↓
Pass 2 — Full Call Analysis
  Model: gemini-1.5-pro
  Input: video + rulebook system prompt
  Output: structured JSON verdict
    ↓
Zod Validation of Gemini Response
    ↓
Return to Frontend
```

The two-pass pipeline must never be collapsed into a single call. The separation is intentional:
- Pass 1 is fast and cheap — minimal tokens, no rulebook context
- Pass 2 is accurate — full rulebook injected as system context, preventing hallucinated rules

---

## Model Configuration

| Setting | Value |
|---------|-------|
| Production model | `gemini-1.5-pro` |
| Dev/testing model | `gemini-1.5-flash` (never in production paths) |
| SDK | `@google/generative-ai` (official) |
| SDK location | `lib/gemini.ts` only |

Do not instantiate the Gemini SDK anywhere except `lib/gemini.ts`.
Do not call the REST API directly.

---

## Structured Output Schema

Every Gemini call in Pass 2 must request structured JSON output matching this schema exactly:

```ts
// Defined in types/index.ts
interface AnalysisVerdict {
  verdict: "FAIR" | "BAD";
  confidence: number;        // 0–100
  rule_citations: string[];  // e.g. ["NBA Rule 12, Section II(a)"]
  reasoning: string;         // plain English explanation
}
```

The Zod schema for validation:

```ts
import { z } from "zod";

export const VerdictSchema = z.object({
  verdict: z.enum(["FAIR", "BAD"]),
  confidence: z.number().min(0).max(100),
  rule_citations: z.array(z.string()),
  reasoning: z.string(),
});

export type AnalysisVerdict = z.infer<typeof VerdictSchema>;
```

---

## Prompts

### Pass 1 — Sport Detection Prompt

Located in: `lib/gemini.ts` (inline, since it is sport-agnostic).

Goal: identify the sport being played in the video.
Output: one of the values in the `Sport` enum.
Must be fast and minimal — no rulebook context injected.

### Pass 2 — Analysis Prompt

Located in: `lib/prompts/{sport}.ts` — one file per sport.

Each file exports:

```ts
export const systemPrompt: string = `...`; // Full rulebook context for this sport
```

The system prompt must:
- Contain the relevant rulebook sections (not summarized — actual rule text where possible)
- Instruct the model to cite specific rules in its output
- Instruct the model to return only valid JSON matching the verdict schema
- Explicitly prohibit hallucinating rules not present in the provided context

---

## Sport Prompt Files

| Sport | File | Status |
|-------|------|--------|
| Basketball | `lib/prompts/basketball.ts` | Required |
| Soccer | `lib/prompts/soccer.ts` | Required |
| Baseball | `lib/prompts/baseball.ts` | Required |
| Football | `lib/prompts/football.ts` | Required |
| Hockey | `lib/prompts/hockey.ts` | Required |

To add a new sport, see the "Extending the Project" section in `CLAUDE.md`.

---

## Error Handling

If Gemini returns a response that fails Zod validation:
- Log the raw response with `console.error`
- Return `{ error: "Analysis failed — invalid model response", code: "INVALID_MODEL_OUTPUT" }` to the frontend
- Do not pass unvalidated data downstream

If Pass 1 cannot detect a sport:
- Return `{ error: "Could not detect sport from video", code: "SPORT_DETECTION_FAILED" }`
- Do not proceed to Pass 2

---

## Rule Sourcing Policy

Rules must come from the files in `lib/prompts/` — not from the model's parametric memory alone.

The system prompt must explicitly instruct the model:
- Only cite rules provided in this context
- Do not infer or recall rules from training data
- If a specific rule is not present in the provided context, acknowledge uncertainty

This is the core mechanism that prevents hallucinated rule citations.
