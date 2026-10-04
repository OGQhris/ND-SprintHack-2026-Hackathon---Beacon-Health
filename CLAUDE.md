@AGENTS.md

# Beacon credential monitor: how we work in this repo

## Project
- **Idea:** Beacon Health credential monitoring: one place where a manager sees every employee's license status, verifies it against the licensing source with one click, and gets 30/14/7-day warnings before access lapses.
- **Demo path (the one flow judges will see):** Dashboard -> search a nurse -> Verify now (watch the browser) -> status, expiration, last checked and history update -> Alerts -> Ask Beacon "Who needs attention this month?" -> Add employees (a CSV upload that stands in for the HR feed) with "Verify after import" checked -> the banner shows the new people being checked.
- **Stack:** Next.js 16 App Router + TypeScript + Tailwind v4 + shadcn/ui (radix-nova style, `cn` package, monolithic `radix-ui`); Prisma 6 + SQLite (`prisma/beacon.db`); Playwright verification against Michigan MILARA (server-side only, `services/credentialProviders/`); OpenAI tool-calling assistant (`lib/ai/`); npm.
- **Run:** `npm run dev` (127.0.0.1:3000) | **Check:** `npm run typecheck && npm run lint && npm run build` | **Tests:** `npm test` (on Node 22: `node --experimental-sqlite --import tsx --test tests/*.test.ts`) | **Browser smoke:** `npm run test:ui` against a server that is NOT the real database (`TEST_BASE_URL`, `NEXT_DIST_DIR`, absolute `DATABASE_URL`) | **Demo state:** `npm run demo:reset -- --keep "Kathryn Cell"`, `npm run demo:snapshot -- <name>`, `npm run demo:remove -- "First Last"` (see README).

## Hackathon Mode: Priorities
We have a hard deadline. A working demo beats clean architecture.
1. **Get the demo path working end to end first.** Build one thin vertical slice (UI -> logic -> data -> UI) before adding any second feature. Stub or hardcode whatever is off the demo path.
2. **KISS / YAGNI.** Pick the simplest thing that works. No speculative abstractions, no config systems, no premature optimization.
3. **Use existing libraries and templates** instead of hand-rolling utilities. Check the docs for the version actually installed before using an API (Next 16 docs live in `node_modules/next/dist/docs/`).
4. **Don't gold-plate.** No exhaustive test suites, CI, or refactors unless asked. Only add tests for logic that's tricky and on the demo path.

## How to Work
- **Plan briefly, then build.** For anything spanning 3+ files, give a short numbered plan first. Keep it to a few lines.
- **Verify after every change.** Run the build/dev server and check that it actually works before saying it's done. Report errors honestly with the output.
- **Fix build errors one at a time.** Read the error, make the smallest fix, re-run. Don't rewrite large sections to make an error go away.
- **Small files.** Keep files focused (under ~300 lines). Organize by feature.
- **Checkpoint with git.** After each working milestone, commit, so we can roll back if the next change breaks things.
- **Parallelize research.** Use subagents for independent lookups (docs, API questions) so the main context stays clean. Give them the goal, not just the query.

## Guardrails
- **Secrets go in `.env.local`, never in code.** `.env*`, `*.db`, `data/`, `debug/` and `deploy/seed/` are ignored; keep them that way. Fail with a clear message if a required key is missing.
- Validate user input at the boundary (forms, API routes). Handle errors with a visible message in the UI. Never swallow them silently.
- Verification drives a real browser against a state website: never trigger it from automated tests or smoke scripts, and never point tests at the real database.
- Don't kill or restart the user's dev server on port 3000; ask instead. Don't delete or overwrite files outside this project.
- No emojis in code. No `console.log` left in finished UI features (server-side `[Tag]` logs are fine).

## UI / Demo Polish (last ~25% of the time)
- Clean, consistent layout; one accent color; readable font sizes; loading and empty states on the demo path.
- Honest states: never show "verified" or a date the source did not give; "Not yet verified" is a first-class state.
- Make sure the demo works from a fresh load (no reliance on state from earlier testing): `npm run demo:reset` before rehearsing.

## Skills
Installed in `.claude/skills/` (shared with everyone via git). Before any UI work, load the relevant skills below. They overlap, so use them in this order:
1. **Direction:** `ui-ux-pro-max` to pick a style, palette, and font pairing (run its `--design-system` search from the repo root). This product already has a direction: IBM Plex Sans, the `paper` / `folder` / `ink` / `seal` tokens in `app/globals.css`, status colors per credential state. Stay inside it.
2. **Building:** `shadcn` for components (use shadcn/ui instead of hand-rolling; the installed style is radix-nova). `interface-design` for app screens (dashboards, forms, settings). `frontend-design` and `design-taste-frontend` (in `taste-skill/`) for anything that should not look templated.
3. **Verify:** `webapp-testing` (Playwright) to click through the demo path and screenshot it before calling UI work done; `scripts/checkUi.mjs` is the repo's own version of that.

The `claude-api` skill was not brought over: this app's assistant talks to OpenAI (`lib/openai.ts`).

Sources: [anthropics/skills](https://github.com/anthropics/skills) | [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | [taste-skill](https://github.com/Leonxlnx/taste-skill) | [interface-design](https://github.com/Dammyjay93/interface-design) | [shadcn/ui](https://github.com/shadcn-ui/ui) ([docs](https://ui.shadcn.com/docs/skills))
