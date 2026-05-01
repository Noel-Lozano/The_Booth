# 04 — Coding Standards
## Code Style, TypeScript Rules & Async Patterns — RefCheck AI

---

## General Principles

1. **No `any`** — use `unknown` and narrow with Zod or type guards. If `any` is truly unavoidable, add an explicit comment explaining why.
2. **No default exports from `lib/`** — named exports only for all utility functions.
3. **No `console.log` in production code** — use `console.error` only for caught errors in API routes. Strip all others.
4. **No hardcoded sport name strings** — always use the `Sport` enum/type from `types/index.ts`.
5. **No inline prop types** — all component props must have an explicit named TypeScript interface.
6. **No business logic in components** — UI components handle presentation only.

---

## TypeScript Rules

```ts
// ✅ Use unknown + Zod to narrow
const parsed = VerdictSchema.safeParse(raw);
if (!parsed.success) { /* handle */ }

// ❌ Never
const result: any = await gemini.analyze(video);

// ✅ Named exports from lib/
export function analyzeVideo(...) { ... }
export function detectSport(...) { ... }

// ❌ No default exports from lib/
export default function analyzeVideo(...) { ... }

// ✅ Explicit prop interfaces
interface RuleCitationProps {
  citation: string;
  ruleNumber: string;
}

// ❌ No inline prop types
function RuleCitation({ citation }: { citation: string }) { ... }
```

---

## Async Patterns

All async operations must explicitly model `loading` and `error` states.

### Standard async state shape

```ts
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}
```

### Standard async handler pattern

```ts
const [state, setState] = useState<AsyncState<AnalysisVerdict>>({
  data: null,
  loading: false,
  error: null,
});

const handleAnalyze = async (blobUrl: string) => {
  setState({ data: null, loading: true, error: null });
  try {
    const result = await analyzeVideo(blobUrl);
    setState({ data: result, loading: false, error: null });
  } catch (err) {
    setState({ data: null, loading: false, error: "Analysis failed. Please try again." });
  }
};
```

Rules:
- Disable UI interactions while `loading` is true
- Show minimal feedback (spinner, disabled button, error message)
- Always reset `loading` in `catch` or `finally`
- Never leave `loading: true` as a terminal state

---

## API Route Pattern

```ts
// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeVideo } from "@/lib/gemini";

const RequestSchema = z.object({
  blobUrl: z.string().url(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_REQUEST" },
        { status: 400 }
      );
    }

    const verdict = await analyzeVideo(parsed.data.blobUrl);
    return NextResponse.json(verdict);
  } catch (err) {
    console.error("[analyze] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
```

Rules:
- Always validate with Zod before processing
- Always return consistent error shape: `{ error: string; code: string }`
- 400 for bad input, 500 for server errors
- Always wrap in try/catch

---

## Component Size

- Keep components under ~150 lines
- If a component grows beyond that, extract sub-components
- Each component has a single responsibility

---

## Styling

```tsx
// ✅ Tailwind utility classes
<button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
  Analyze
</button>

// ✅ Computed dynamic values where Tailwind can't express them
<div style={{ width: `${progress}%` }} className="h-2 bg-green-500" />

// ❌ Arbitrary inline styles for non-dynamic values
<button style={{ backgroundColor: "blue", padding: "8px 16px" }}>Analyze</button>

// ❌ CSS Modules
import styles from "./Button.module.css";

// ❌ styled-components
const Button = styled.button`background: blue;`;
```
