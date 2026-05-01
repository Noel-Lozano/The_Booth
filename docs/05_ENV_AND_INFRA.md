# 05 — Environment & Infrastructure
## Environment Variables, Storage, Rate Limiting — RefCheck AI

---

## Environment Variables

All secrets live in `.env.local` (never committed). See `.env.example` for the full list.

```env
# AI — Required
GOOGLE_GENERATIVE_AI_API_KEY=       # Get from Google AI Studio

# Storage — Required
BLOB_READ_WRITE_TOKEN=              # Vercel Blob token

# Officiating crew lookup — Optional
SPORTRADAR_API_KEY=

# Rate limiting — Optional but recommended
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

### Fail-fast rule

If a required env var is missing at runtime, the app must fail fast with a clear error message — not silently produce wrong results.

```ts
// lib/gemini.ts — validate on module load
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set. Check your .env.local file.");
}
```

---

## Video Storage (Vercel Blob)

- All uploaded videos go to Vercel Blob via `@vercel/blob`
- Never store videos in the repo or `/public/`
- **TTL: 24 hours** — must be set on every upload
- **Max file size: 50MB** — validate client-side (before upload) AND in the API route
- **Accepted formats:** `video/mp4`, `video/quicktime`, `video/webm`

```ts
// Client-side validation in VideoUploader.tsx
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

if (file.size > MAX_SIZE_BYTES) {
  setError("File exceeds 50MB limit.");
  return;
}
if (!ACCEPTED_TYPES.includes(file.type)) {
  setError("Unsupported format. Please upload MP4, MOV, or WebM.");
  return;
}
```

---

## Rate Limiting (Vercel KV)

- Apply rate limiting to `/api/analyze` only
- Use Vercel KV (Redis) for the rate limit counter
- Recommended: sliding window, per IP, reasonable limit for hackathon (e.g. 10 requests/hour)
- Return `429 Too Many Requests` with `{ error: "Rate limit exceeded", code: "RATE_LIMITED" }` when exceeded

---

## Hosting & Deployment

| Target | Service |
|--------|---------|
| Production | Vercel (auto-deploy from `main`) |
| Preview | Vercel preview URLs (from feature branches) |
| CI/CD | GitHub Actions — lint + type-check before merge |

Rules:
- Vercel is the only allowed deployment target
- `main` branch auto-deploys to production
- Feature branches get Vercel preview URLs
- CI must pass (lint + type-check) before merging to `main`

### GitHub Actions (minimum CI)

```yaml
# .github/workflows/ci.yml
- name: Type check
  run: pnpm tsc --noEmit

- name: Lint
  run: pnpm eslint .
```

---

## Vercel Configuration Notes

- Serverless functions are used for API routes — no persistent server
- Keep API routes within Vercel's execution time limits (default 10s, max 60s on Pro)
- Gemini video analysis may take time — consider streaming responses or polling if needed for UX
