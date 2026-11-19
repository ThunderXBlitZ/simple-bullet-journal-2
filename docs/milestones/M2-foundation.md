# M2 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Checkbox steps. **Never commit** (user does). Don't run test suites; run only the listed verify commands.

**Goal:** Reproducible static build on Cloudflare Pages, correct repo hygiene/docs, and shadcn tooling ready for icon installs.

**Architecture:** No server code exists, so `output: 'export'` produces `out/`, served by Cloudflare Pages Git integration. Security headers ship through `public/_headers`. Docs follow the user's tiered architecture.

**Tech Stack:** Next 16 static export, Cloudflare Pages, shadcn CLI.

**Spec:** `docs/milestones/00-design-decisions.md` (D2, D10)

## Global Constraints
- Static export only: no API routes, no `next/server`, no Node-only APIs (keeps Capacitor option open).
- Docs budgets: `CLAUDE.md` ≤120 lines, `docs/STATE.md` ≤120, `docs/ROADMAP.md` ≤60. Check with `wc -l`.
- Deploy is Cloudflare dashboard Git integration; build var `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (set in M1).

## Review Focus
- A strict CSP can silently break Google sign-in (popup/script) or Next's inline hydration scripts → check console for violations.
- SPA fallback: a hard refresh on any path must still load the app (single page, so `/` only; but unknown paths must not 404 into a blank page).
- Removing `*.md` from `.gitignore` will expose previously ignored md files (`GOOGLE_SYNC_GUIDE.md`, `USER_STORIES.md`) → intended, but confirm nothing sensitive in them.
- `output: 'export'` fails the build if any dynamic server feature is used → build must pass.

---

### Task 1: Repo hygiene and docs

**Files:** Modify `.gitignore`, `package.json`, `CLAUDE.md`; Create `docs/STATE.md`, `docs/CHANGELOG.md`

- [ ] **Step 1:** `.gitignore`: delete the `*.md` line; append `out`. Keep `.env*` and `!.env.example`.
- [ ] **Step 2:** `package.json`: set `"name": "bullet-journal"`; replace the broken `"lint": "eslint ."` (no eslint installed) with `"typecheck": "tsc --noEmit"`.
- [ ] **Step 3:** Replace `CLAUDE.md` entirely (current content is a pasted chat summary) with:
```markdown
# Bullet Journal

Local-first bullet journal (Next.js 16 static export, React 19, Zustand, Tailwind 4). Hosted on Cloudflare Workers
(static assets). Data lives in IndexedDB; optional sync to Google Drive appDataFolder. Capacitor may come later.

## Rules
- Client-only: no API routes, no server secrets. Only `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (see `.env.example`).
- Never commit secrets or `.env*` (except `.env.example`).
- No block fills for status/tag/mood color: colored **outlines** on muted paper tokens; icons via `components/icons` (lucide-animated) or lucide-react.
- Sync is per-record merge (`id` + `updatedAt`, deletions in `tombstones`). Never overwrite whole-journal snapshots.
- Source files ≤400 lines soft cap, 600 hard.
- Design + decisions: `docs/milestones/00-design-decisions.md`. State: `docs/STATE.md`. Plan: `docs/ROADMAP.md`.

## File map
- `app/page.tsx` — bootstrap, view switching.  `app/globals.css` — theme tokens.
- `lib/journal-store.ts` — Zustand store + persist.  `lib/types.ts` — data types.
- `lib/storage/` — IndexedDB provider + Zustand adapter.
- `lib/google/` — GIS auth + Drive transport.
- `components/journal/` — feature views/modals.  `components/ui/` — shadcn primitives.
```
- [ ] **Step 4:** Create `docs/STATE.md`:
```markdown
# State
Updated: <date at completion>
- Milestone in progress: M2 complete → next M3 (see docs/ROADMAP.md)
- Sync: existing snapshot sync still active until M3/M6 rewrite it
- Deploy: Cloudflare dashboard Git integration; build var NEXT_PUBLIC_GOOGLE_CLIENT_ID
```
- [ ] **Step 5:** Create `docs/CHANGELOG.md` with one line `# Changelog (append-only)` then `- M1 security: secret revoked/untracked, tokens out of persisted state`.
- [ ] **Verify:** `wc -l CLAUDE.md docs/*.md` all under budget; `git status --short | head` shows `docs/` and old `.md` files now visible (untracked).

### Task 2: Static export + Pages headers

**Files:** Modify `next.config.ts`, `package.json`, `app/layout.tsx`; Create `public/_headers`

- [ ] **Step 1:** `next.config.ts`:
```ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
}

export default nextConfig
```
- [ ] **Step 2:** Remove Vercel analytics (no-op on Cloudflare, sends data to a third party): `grep -n "vercel" app/layout.tsx` → delete the import and `<Analytics />`; then `npm uninstall @vercel/analytics`.
- [ ] **Step 3:** Add the `typecheck` script (`tsc --noEmit`) and remove unused Vercel analytics.
- [ ] **Step 4:** Create `public/_headers`:
```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com; img-src 'self' data: https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://www.googleapis.com https://accounts.google.com; frame-src https://accounts.google.com; base-uri 'self'; form-action 'self'; object-src 'none'
```
(No COOP header: GIS popup needs `window.opener`.) If `layout.tsx` loads fonts from `fonts.googleapis.com` at runtime (`grep -n "fonts.g" app/layout.tsx app/globals.css`), either keep `next/font` (self-hosted at build) or add `https://fonts.googleapis.com`/`https://fonts.gstatic.com` to `style-src`/`font-src`.
- [ ] **Step 6:** `npm run typecheck && npm run build 2>&1 | tail -n 20` → success, `out/index.html` exists.
- [ ] **Verify:** `npm run typecheck && npm run build` succeeds and `out/index.html` exists. In Pages, configure Framework preset `Next.js (Static HTML Export)`, build command `npm run build`, output directory `out`; confirm the deployed URL serves the app and headers.

### Task 3: shadcn config for icon installs

**Files:** Create `components.json`

- [ ] **Step 1:** Create `components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
```
- [ ] **Step 2 (smoke):** `npx shadcn@latest add "https://lucide-animated.com/r/activity.json" --yes 2>&1 | tail -n 10` → creates `components/icons/activity.tsx`, adds `motion` to deps. Then delete `components/icons/activity.tsx` (unused) — keep `motion`.
- [ ] **Verify:** `grep -n '"motion"' package.json` present; `npm run typecheck` passes.

## Outcome
_(filled in at completion)_
