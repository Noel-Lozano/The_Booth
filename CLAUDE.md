# CLAUDE.md — RefCheck AI
## AI Assistant Entry Point

> Read this file completely before writing any code, suggesting changes, or answering questions.
> This is the single source of truth for AI behavior on this project.

---

## What This Project Is

**RefCheck AI** is an AI-powered sports officiating analysis tool built for the GDG BorderHack hackathon (due May 1).

Users upload a short video clip of a sports play → the app analyzes it using multimodal AI → returns a **FAIR CALL** or **BAD CALL** verdict with rule-based reasoning grounded in the sport's official rulebook.

Supported sports: basketball, soccer, baseball, football, hockey (extensible post-hackathon).

---

## Document Index

### Core Reference

| File | Purpose |
|------|---------|
| `CLAUDE.md` | ⚡ This file — AI entry point, rules, and workflow |
| `docs/01_TECH_STACK.md` | Approved technologies — check before adding anything |
| `docs/02_ARCHITECTURE.md` | Folder structure, layer rules, naming conventions |
| `docs/03_AI_PIPELINE.md` | Gemini two-pass pipeline, prompt schema, structured output |
| `docs/04_CODING_STANDARDS.md` | Code style, TypeScript rules, async patterns |
| `docs/05_ENV_AND_INFRA.md` | Environment variables, Vercel, storage, rate limiting |
| `docs/06_HACKATHON_REQUIREMENTS.md` | Hard requirements from the bounty brief |

---

## Always Read Before Writing Code

1. **`docs/01_TECH_STACK.md`** — if a technology is not listed, do not introduce it.
2. **`lib/prompts/`** — sport-specific Gemini prompt files. Never hardcode rules in route handlers.
3. **`.env.example`** — all required environment variables. Never commit real keys.

---

## Hard Rules (Non-Negotiable)

- **Framework:** Next.js 14 App Router only. All routes under `app/`. No Pages Router.
- **Language:** TypeScript strict mode. No `any` without an explicit comment explaining why.
- **Package manager:** `pnpm` only. Never `npm install` or `yarn`.
- **Styling:** Tailwind CSS only. No CSS Modules, no styled-components, no inline `style={{}}` except for computed dynamic values.
- **UI primitives:** shadcn/ui. Do not reinvent components shadcn already provides.
- **State:** Zustand for global state. No Redux, Jotai, Recoil, or any other state library.
- **AI calls:** All Gemini logic in `lib/gemini.ts`. Route handlers import from there — never instantiate the SDK directly in routes or components.
- **Validation:** Zod on every API request body and every Gemini response before touching the frontend.
- **Pipeline:** The two-pass Gemini pipeline must be preserved. Never collapse it into a single call.
- **Rules source:** Rules must come from `lib/prompts/` files — not from the model's parametric memory.

---

## What NOT to Do

- ❌ Do not use the Pages Router (`pages/` directory)
- ❌ Do not use `npm` or `yarn`
- ❌ Do not introduce dependencies not in `docs/01_TECH_STACK.md`
- ❌ Do not call Gemini from components — always via `lib/gemini.ts`
- ❌ Do not store videos in the repo or `/public/`
- ❌ Do not hardcode sport rules in route handlers — use `lib/prompts/`
- ❌ Do not skip Zod validation on API inputs or Gemini outputs
- ❌ Do not commit `.env.local` or real API keys
- ❌ Do not use `any` types
- ❌ Do not use CSS Modules or styled-components
- ❌ Do not bypass or collapse the two-pass Gemini pipeline

---

## Extending the Project

### Adding a new sport
1. Create `lib/prompts/{sport}.ts` — export a `systemPrompt` string with relevant rulebook context.
2. Add the sport to the `Sport` type in `types/index.ts`.
3. Update the sport detection prompt in `lib/gemini.ts` to include the new sport.
4. No changes needed to API routes — the pipeline is sport-agnostic.

### Adding a new API route
1. Create `app/api/{name}/route.ts`.
2. Add Zod validation for the request body.
3. Add rate limiting if the route calls an external service.
4. Document the route in `docs/02_ARCHITECTURE.md`.

---

## Current Status

<!-- Update this block as the project progresses -->
- **Last updated:** —
- **Active branch:** —
- **Blocking issues:** —
- **Next priority:** —

---

## License

MIT. All code must be open source and committed to the public GitHub repo during the hackathon.
