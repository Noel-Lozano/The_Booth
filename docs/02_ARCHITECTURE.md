# 02 — Architecture & Folder Structure
## Definitive Structure — RefCheck AI

---

## Canonical Project Structure

```
refcheck-ai/
├── app/
│   ├── page.tsx                    # Landing page + video upload UI
│   ├── results/[id]/page.tsx       # Analysis results page
│   └── api/
│       ├── analyze/route.ts        # Main AI analysis endpoint
│       └── crew/route.ts           # Officiating crew lookup
├── components/
│   ├── VideoUploader.tsx           # react-dropzone upload component
│   ├── AnalysisCard.tsx            # Displays verdict + confidence + reasoning
│   └── RuleCitation.tsx            # Renders individual rule citations
├── lib/
│   ├── gemini.ts                   # Gemini SDK wrapper (ALL AI logic here)
│   ├── prompts/                    # Sport-specific system prompts + rule context
│   │   ├── basketball.ts
│   │   ├── soccer.ts
│   │   ├── baseball.ts
│   │   ├── football.ts
│   │   └── hockey.ts
│   └── crew-lookup.ts              # Officiating crew resolver
├── store/
│   └── useAnalysisStore.ts         # Zustand store
├── types/
│   └── index.ts                    # Shared TypeScript types (Sport enum, verdict schema)
├── .env.example
├── CLAUDE.md
├── docs/
│   ├── 01_TECH_STACK.md
│   ├── 02_ARCHITECTURE.md          # This file
│   ├── 03_AI_PIPELINE.md
│   ├── 04_CODING_STANDARDS.md
│   ├── 05_ENV_AND_INFRA.md
│   └── 06_HACKATHON_REQUIREMENTS.md
├── LICENSE
└── README.md
```

Do not create files or directories outside this structure without documenting the reason here.

---

## Layer Rules

### `app/`
- Routes, layouts, pages only
- No business logic in page components
- API routes handle request/response only — delegate logic to `lib/`

### `components/`
- Reusable UI components only
- No business logic — presentation and UI behavior only
- All props must be explicitly typed with TypeScript interfaces
- Keep components under ~150 lines; extract sub-components if they grow larger

### `lib/`
- All shared logic, integrations, and utilities
- `gemini.ts` is the only place Gemini SDK is instantiated
- `prompts/` contains one file per sport — never inline rules elsewhere
- Named exports only — no default exports from `lib/`

### `store/`
- Zustand global state only
- Manages: upload status, analysis results, sport detection state

### `types/`
- Shared TypeScript types and enums used across the project
- `Sport` enum/type must be defined here — never hardcode sport name strings elsewhere
- Verdict schema type must be defined here

---

## Naming Conventions

### Files
- PascalCase for React components: `VideoUploader.tsx`, `AnalysisCard.tsx`
- camelCase for utilities and lib files: `gemini.ts`, `crew-lookup.ts`
- camelCase for store files: `useAnalysisStore.ts`

### Variables & Functions
- camelCase

### Constants
- UPPER_SNAKE_CASE

### Types & Interfaces
- PascalCase

### Sport Names
- Always use the `Sport` type from `types/index.ts`
- Never use raw strings like `"basketball"` — use the enum

---

## API Routes

### `POST /api/analyze`
- Receives: `{ blobUrl: string }`
- Validates request with Zod
- Runs two-pass Gemini pipeline (see `docs/03_AI_PIPELINE.md`)
- Validates Gemini response with Zod
- Returns: verdict JSON or `{ error: string; code: string }`
- Rate limited via Vercel KV

### `GET /api/crew`
- Optional route for officiating crew lookup
- Logic delegated to `lib/crew-lookup.ts`
- Returns crew data or error shape

---

## Component Interfaces

All components that accept props must have explicit TypeScript interfaces defined above the component. No inline prop types.

```ts
// ✅ Correct
interface AnalysisCardProps {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  ruleCitations: string[];
}

export function AnalysisCard({ verdict, confidence, reasoning, ruleCitations }: AnalysisCardProps) { ... }

// ❌ Wrong
export function AnalysisCard({ verdict, confidence }: { verdict: string; confidence: number }) { ... }
```
