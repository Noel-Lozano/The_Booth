# The Booth — AI Sports Officiating Analysis

> GDG BorderHack Hackathon Project · May 2026

Upload a short sports video clip → get an instant **FAIR CALL** or **BAD CALL** verdict with rule-based reasoning grounded in official rulebooks. **Inconclusive** may also be returned if the model cannot confidently determine whether the call is legal or illegal.

**Supported sports:** Basketball · Soccer · Baseball · Football · Hockey

---

## How It Works

Two-pass Gemini pipeline:
1. **Sport Detection** — Gemini auto-detects the sport from the video
2. **Rule Injection** — The relevant official rulebook is injected as system context
3. **Analysis** — Full call analysis with specific rule citations returned as structured JSON

---

## Tech Stack

Next.js 14 · Gemini 2.0 Flash · Vercel Blob · Zustand · Zod · Tailwind CSS · Vercel

---

## Getting Started

```bash
pnpm install
cp .env.example .env.local
# Fill in your API keys
pnpm dev
```

---

## License

MIT
