# 06 — Hackathon Requirements
## GDG BorderHack — Hard Requirements Checklist

---

## Deadline

**May 1** — the app must be deployed and publicly accessible before this date.

---

## Hard Requirements

These are non-negotiable requirements from the bounty brief.
Every change to the codebase must not break any of these.

- [ ] App is deployed and accessible from any browser (Vercel URL, not localhost)
- [ ] Accepts video upload and returns a fair/bad call determination with rule-based reasoning
- [ ] Supports multiple sports (not hardcoded to one sport)
- [ ] Architecture is extensible to add new sports post-hackathon
- [ ] Where feasible, identifies the officiating crew for the play
- [ ] Public GitHub repo with MIT license
- [ ] Novel technical approaches are documented (see `docs/01_TECH_STACK.md` → Novel Approaches)

---

## Supported Sports (Launch)

- Basketball
- Soccer
- Baseball
- Football
- Hockey

---

## Verdict Output Requirements

Every analysis must return all four fields:

| Field | Type | Description |
|-------|------|-------------|
| `verdict` | `"FAIR" \| "BAD"` | The call determination |
| `confidence` | `number` (0–100) | Model's confidence in the verdict |
| `rule_citations` | `string[]` | Specific rule references (e.g. "NBA Rule 12, Section II(a)") |
| `reasoning` | `string` | Plain English explanation of the verdict |

Rule citations must reference actual rules from `lib/prompts/` — not hallucinated ones.

---

## Extensibility Requirement

The architecture must allow adding a new sport without modifying API routes or core pipeline logic.

The current design satisfies this:
1. Create `lib/prompts/{sport}.ts`
2. Add sport to `types/index.ts`
3. Update sport detection in `lib/gemini.ts`
4. No changes needed to `app/api/analyze/route.ts`

---

## Novel Approaches (must be documented for IP)

Three novel approaches to highlight in the README and any submission materials:

1. **Two-pass sport detection + rule injection** — auto-detects sport first, then injects the relevant official rulebook as system context to prevent hallucinated rule citations.
2. **Officiating crew linkage** — matches uploaded clips to box score data via game metadata to surface the responsible official.
3. **Structured verdict schema** — enforces `{ verdict, confidence, rule_citations, reasoning }` JSON output via Gemini's structured output mode for consistent, parseable results.

---

## Pre-Launch Checklist

Before submitting:

- [ ] Vercel deployment URL is live and public
- [ ] All five sports have prompt files in `lib/prompts/`
- [ ] Video upload, analysis, and results pages are functional end-to-end
- [ ] `.env.example` is committed with all required keys (no real values)
- [ ] `.env.local` is in `.gitignore` and NOT committed
- [ ] `LICENSE` file is MIT
- [ ] GitHub repo is public
- [ ] README documents the novel approaches
- [ ] Crew lookup is implemented or has a documented fallback
