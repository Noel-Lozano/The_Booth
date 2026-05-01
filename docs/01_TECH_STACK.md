# 01 — Tech Stack
## Authoritative Stack & Usage Policy — RefCheck AI

---

## Governance Rule

Only the technologies explicitly listed in this document are permitted.

No library, framework, or service may be introduced without explicit human approval.
If a tool is not listed here, it is not allowed.

---

## Frontend

### Next.js 14 (App Router)

Purpose: routing, layout management, server/client boundary control, API routes.

Rules:
- File-based routing under `app/` only
- `layout.tsx` for shared UI structure
- No Pages Router (`pages/` directory is forbidden)
- No custom routing systems

---

### TypeScript (strict mode)

Purpose: type safety, explicit contracts, domain modeling.

Rules:
- `"strict": true` in `tsconfig.json`
- No `any` — use `unknown` and narrow with Zod or type guards
- Explicit interfaces for all component props and domain entities
- No implicit `any`

---

### Tailwind CSS

Purpose: all styling.

Rules:
- Utility-first, no CSS Modules, no styled-components
- No inline `style={{}}` except for dynamic/computed values that cannot be expressed in Tailwind
- Custom design tokens go in `tailwind.config.ts` — not scattered across components

---

### shadcn/ui

Purpose: accessible, composable UI primitives (buttons, cards, dialogs, etc.).

Rules:
- Use for any component shadcn already provides
- Do not reinvent shadcn components

---

### Zustand

Purpose: global state (upload status, analysis results, sport detection).

Rules:
- Store lives in `store/useAnalysisStore.ts`
- React `useState`/`useReducer` is fine for purely local component state
- Do not introduce Redux, Jotai, Recoil, or any other state library

---

### react-dropzone

Purpose: drag-and-drop video upload UI.

Rules:
- Used exclusively in `components/VideoUploader.tsx`
- Client-side file size and format validation before upload

---

### React Player / native `<video>`

Purpose: preview uploaded clip before analysis.

---

## Backend / API

### Next.js Route Handlers (`app/api/`)

Purpose: serverless API layer, edge-compatible.

Routes:
- `app/api/analyze/route.ts` — receives video blob URL, runs two-pass Gemini pipeline, returns verdict JSON
- `app/api/crew/route.ts` — optional crew lookup via Sportradar or box score metadata

Rules:
- All API logic in `app/api/` — no separate backend service
- Zod validation on every request body
- Consistent error shape: `{ error: string; code: string }`
- Async routes must always handle errors with try/catch and return appropriate HTTP status codes (400 bad input, 500 server error)

---

### Google Gemini 1.5 Pro (`@google/generative-ai` SDK)

Purpose: multimodal video + text analysis — sport detection and call analysis.

Rules:
- **Production model:** `gemini-2.5-pro`
- **Dev/testing only:** `gemini-2.5-flash` (never in production paths)
- Use the official `@google/generative-ai` SDK — do not call the REST API directly
- All Gemini logic lives in `lib/gemini.ts` only — route handlers import from there
- See `docs/03_AI_PIPELINE.md` for the full pipeline spec

---

### Zod

Purpose: runtime schema validation for all API inputs and Gemini outputs.

Rules:
- Validate every request body in API routes
- Validate every Gemini response before passing data to the frontend
- No unvalidated data crosses the API boundary

---

### Vercel Blob (`@vercel/blob`)

Purpose: temporary video file storage.

Rules:
- All uploaded videos go to Vercel Blob — never in the repo or `/public/`
- TTL: 24 hours on every upload — always set this
- Max file size: 50MB — validate client-side before upload and again in the API route
- Accepted formats: `video/mp4`, `video/quicktime`, `video/webm`

---

### Vercel KV (Redis)

Purpose: rate limiting on `/api/analyze`.

Rules:
- Apply rate limiting to `/api/analyze` only
- Optional for other routes unless they call external services

---

### Sportradar API

Purpose: officiating crew lookup (optional feature).

Rules:
- Logic lives in `lib/crew-lookup.ts`
- Route: `app/api/crew/route.ts`
- Requires `SPORTRADAR_API_KEY` in environment

---

## Hosting & Infrastructure

| Service | Purpose |
|---------|---------|
| **Vercel** | Frontend + API hosting (serverless, global CDN) — only allowed deploy target |
| **Vercel Blob** | Temporary video storage (24h TTL) |
| **Vercel KV** | Rate limiting, optional result caching |
| **GitHub Actions** | CI/CD — lint + type-check must pass before merge to `main` |

Rules:
- `main` branch auto-deploys to production on Vercel
- Feature branches deploy as Vercel preview URLs
- No other hosting targets

---

## Development Tooling

| Tool | Purpose |
|------|---------|
| `pnpm` | Only allowed package manager — never `npm` or `yarn` |
| `ESLint` + `Prettier` | Linting and formatting |
| `Husky` + `lint-staged` | Pre-commit hooks |
| `Vitest` | Unit tests for utility functions and prompt logic |

---

## Novel Technical Approaches (for hackathon IP documentation)

1. **Two-pass sport detection + rule injection:** First prompt auto-detects sport from video, second injects the relevant official rulebook section as system context before analysis. Prevents hallucinated rules.
2. **Officiating crew linkage:** Matches uploaded clips to box score data via game date/team metadata to surface the responsible official — enabling longitudinal "ref stats" over time.
3. **Structured verdict schema:** Enforces `{ verdict, confidence, rule_citations, reasoning }` JSON output via Gemini's structured output mode for consistent, parseable results.

---

## Dependency Policy

Before introducing any dependency, verify:
- Is it listed in this document?
- If not — stop and get explicit human approval before adding it.

Stack expansion requires justification. Simplicity is the default.
