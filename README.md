# Beacon Health System Credential Management

A complete local proof of concept for Beacon Health System manager credential follow-up. It imports **only worksheet four (`RNS`)**, verifies **Michigan Registered Nurse licenses only**, and connects a real streaming OpenAI assistant to approved database and verification tools.

## Run locally

Use Node.js 24 LTS (tested with 24.21.0) and npm.

```bash
npm install
npx playwright install chromium
cp -n .env.example .env.local
```

The copy command preserves an existing `.env.local`. Your key is already configured in this workspace; restarting does not require copying the file again.

In **`.env.local`**, set:

```dotenv
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-5.5
DATABASE_URL="file:./beacon.db"
PLAYWRIGHT_HEADLESS=true
APP_TIMEZONE=America/Indiana/Indianapolis
```

Leave `OPENAI_MODEL` blank to use the centralized default in `lib/openai.ts`. Choose another model supported by your account and the Responses API if desired. Restart the development server after changing AI configuration. The SDK and key stay on the server; the browser calls this application's `/api/ask` route. Without a key, credential verification and the dashboard still work, and Ask Beacon answers from a built-in rule engine over the same data and says so.

The supplied workbook has been copied to the ignored local `data/` directory in this workspace. For a fresh checkout, put your workbook there or import it with the explicit path below.

```bash
npm run setup
npm run dev
```

Open **http://127.0.0.1:3000/dashboard**. The dedicated assistant is **http://127.0.0.1:3000/ask** (Ask Beacon); the old `/assistant` URL redirects there, and the **Ask Beacon** button in the top bar opens a docked version that stays open while you navigate.

The development server binds to loopback. Keep it running during verification, especially during a sequential roster check.

### Import from the original file

```bash
npm run db:generate
npm run db:migrate
npm run import -- "/Users/aydin/Downloads/Credentialing List - KZO.xlsx"
```

Or, after copying the file to `data/Credentialing List - KZO.xlsx`, use `npm run import`. Import is idempotent and preserves verification history. It trims surrounding whitespace but does not fix spelling. An existing workbook row whose first/last name changes is rejected to avoid assigning an old license to a different person; removed rows are not automatically deleted.

The supplied fourth sheet has **17 employees**, including **Tatyanna Rosa**, with managers **Kimblery Gjeltema** and **Christianna Davison**, exactly as written in Excel. No other worksheet is imported. Data files, SQLite databases, debug screenshots, and `.env.local` are ignored by Git. A fresh database starts entirely unverified; the current local database contains Kathryn's real, successfully checked record.

### Add employees from a CSV

**Add employees** on the Dashboard and Employees pages opens a dialog that takes a CSV of new hires. It is a demo stand-in: in production Beacon would receive new hires automatically from the HR system, and the dialog says so. Drop a file or click to browse, keep **Verify after import** checked, and press **Import and verify**.

- Columns: `First name`, `Last name`, and optionally `Manager`. Common aliases are recognised (`FIRST NAME`, `Surname`, `Supervisor`); extra columns are ignored; the delimiter may be a comma, semicolon or tab. A template lives at `public/templates/new-hires-template.csv` (also linked from the dialog).
- Names are trimmed but otherwise kept exactly as written. People already on the roster (same first and last name, ignoring case and accents) are left untouched; duplicate rows in the file and rows without a first or last name are skipped. The toast after the import reports those counts.
- **Verify after import** starts the same sequential roster check as **Verify selected** for the new people only: real Michigan MILARA lookups, one browser at a time, shown in the banner with **Stop after this one**. The checkbox is disabled while another roster check is running.
- Limits: 500 people and 1 MB per file. The route is `POST /api/employees/import` (multipart `file` plus `verify`). Each import gets its own `sourceSheet` (`csv:<file>:<timestamp>`), so ids never collide with the workbook roster or with a second import of the same file.
- The demo clock never assigns simulated expiration dates to CSV-imported people: they stay **Not yet verified** until their real check runs.

### Production-style local demo

```bash
npm run build
npm start
```

## Two-minute judge demo

Have the server running and your OpenAI key configured before beginning. Open the dashboard at a normal laptop resolution.

| Time      | Action                                                                                            | What it demonstrates                                                                          |
| --------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 0:00–0:20 | Show the 17-person roster and the KPI row. Search `Kathryn`.                              | Fourth-sheet import, manager monitoring, honest unknown states.                               |
| 0:20–0:40 | Open Kathryn, click **Verify now**, then **Watch the browser** while it runs.                             | Deterministic live state lookup, Active RN status, expiration, license number, and timestamp. |
| 0:40–0:50 | Show Verification history, press **Replay**, and the **View on Michigan MILARA** link.                                             | An auditable state-source result rather than a fabricated dashboard value.                    |
| 0:50–1:15 | Open **Ask Beacon**. Ask **Tell me about Kathryn Cell.** Then **When does she expire?** | Real database tool calling, streamed answers, and multi-turn context.                         |
| 1:15–1:35 | Ask **Who expires in the next 30 days?** Then **Who needs attention?**                            | Date calculations and coverage-qualified monitoring answers.                                  |
| 1:35–2:00 | Ask **Verify Kathryn Cell.** Show tool activity and the updated timestamp.                        | AI invokes an approved deterministic browser tool, then reports its actual result.            |

For the tested live record, Michigan MILARA returned Registered Nurse, license **4704214941**, **Active**, issued **March 4, 1998**, expiring **March 4, 2028**, county **Kalamazoo**. These values are stored only after a successful lookup, never seeded from the request. The state site can update them. With just Kathryn checked, most of the roster still has unknown expiration dates; zero recorded alerts does not imply everyone is current.

Optional: ask **Who reports to Christianna Davison?**, followed by **Do any of them expire soon?** To demonstrate bulk progress, ask **Can you start verification for everyone please?** or select people on the dashboard and click **Verify selected** (or **Verify all on this page**). That starts a sequential background job; it need not finish during a two-minute demo.

## Implemented product

- Front end ported from the team's hackathon app: shadcn/ui (radix-nova) with IBM Plex Sans, a dashboard KPI row with the 30/14/7-day runway, a searchable and filterable employee table that becomes a card list on phones, an employee page with the current credential, guidance and verification history, and alert tabs (All, Expired, 7, 14, 30 days, Verification issues) with resolve and reminder actions persisted in the `AlertAction` table.
- Employee detail keeps the source license status separate from the calculated expiration status and shows the license number, issue and expiration dates, county, manager, last successful check, last attempt, the server's last error, and the full audit history with a replay for every recorded check.
- Ask Beacon: a docked mini chat that survives navigation plus a full `/ask` page with previous chats, streaming the same tool-calling assistant over `POST /api/ask` with Markdown, visible tool steps, employee chips under each answer, a stop button, and suggested prompts. Threads live in the browser (localStorage) and the recent turns are sent with each question.
- SQLite with Prisma migrations, validated fourth-sheet ExcelJS import, and a replaceable `CredentialProvider` interface.
- Closed registry of ten strict JSON-schema and Zod-validated tools. No arbitrary SQL, shell, URLs, browser commands, deletes, or direct database editing are exposed to the model.
- Real official OpenAI JavaScript SDK **Responses API** with streaming, repeated function-call execution, matching `function_call_output` items, all response output items preserved within the turn, and a bounded 12-round loop. No Assistants Threads/Runs or Chat Completions.
- Same-origin checks on every mutating route and one active response per conversation thread. The earlier cookie-session chat routes (`/api/chat`, `/api/chat/session`) remain for the integration tests, but the UI no longer uses them.
- Sequential/low-concurrency verification, truthful roster progress, error screenshots under `debug/`, state-source provenance, and an audit record for each completed attempt.

### Front end

Routes live under `app/(app)/`: `/dashboard`, `/employees`, `/employees/[id]`, `/alerts` and `/ask` (`/reports` and `/assistant` redirect). `app/(app)/layout.tsx` calls `loadWorkspace()` once per request and hands the snapshot to `CredentialStoreProvider`, which polls `GET /api/workspace` every 4 seconds (and immediately after a verification, a demo-clock change, or an assistant verification) and announces server-side changes as toasts. `lib/data/beacon-adapter.ts` is the single mapping from the Prisma records (`EmployeeRecord`, `VerificationAudit`) to the front end's view model (`Employee`, `Credential`, `VerificationRecord`, `VerificationOutcome`): backend `UNVERIFIED` rows surface as **Not yet verified**, `NEEDS_REVIEW` and `NOT_FOUND` as needs review with a reason, and `ERROR` as verification failed. The top bar holds the **Demo clock** control, and a roster-check banner appears on every page while a sequential batch runs.

### Approved assistant tools

`get_employee_by_name`, `search_employees`, `get_credentials_expiring_within_days`, `get_expired_credentials`, `get_employees_by_manager`, `get_unverified_employees`, `get_attention_needed`, `get_credential_summary`, `verify_employee_credential`, `verify_all_credentials`.

Partial names return candidates instead of guessing. Expiration queries exclude already expired licenses. Manager matching uses exact spelling first and reports ambiguous partial matches. Verification tool calls run directly without keyword checks on the user’s wording.

### State-source verification

The provider opens the fixed Michigan MILARA URL, fills first/last name, leaves unrelated fields blank, submits Search, and reads observed stable detail IDs or the observed license-results table. Accessible labels are attempted first; the state site's unusual `aria-label` values require the stable-ID fallback. Invisible characters in source text are removed, dates are validated and normalized, and first/last names must match while allowing middle names/initials.

One exact, complete RN match is `VERIFIED`. No results are `NOT_FOUND`. Multiple matches, incomplete fields, unrecognized matches, or paginated results are `NEEDS_REVIEW`. Browser/network/site failures are `ERROR`, with a saved debug screenshot where possible. A transient HTTP 5xx on the initial page is retried once. The provider does not bypass CAPTCHA or authentication.

Failed rechecks retain older successful license values and timestamps as historical data, visibly paired with the new failure state. Source `Active` and calculated `ACTIVE` are independent: an Active source status does not override a past expiration date.

Date-only calculations use the configured Indiana timezone and inclusive 7/14/30-day windows. The expiration day itself is in the 7-day window, and dates before today are expired. Cumulative summary windows intentionally overlap. Missing dates are `UNKNOWN`.

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` uses a separate temporary SQLite database (on Node 22, where `node:sqlite` is still behind a flag, run `node --experimental-sqlite --import tsx --test tests/*.test.ts` instead). It covers expiration boundaries/timezone, fourth-sheet-only import/spelling/row validation, database searches, name ambiguity, eight read tools, strict tool validation, mutation gates, source parsing, not-found/review handling, complete multi-round Responses orchestration, streaming deltas, conversation context, interrupted streams, audited persistence, failed recheck retention, backend routes, and sequential batch progress.

With the app running:

```bash
npm run test:ui
npm run verify:kathryn
npm run ai:smoke
npm run ai:smoke -- --verify
npm run test:live-ui
npm run test:provider
```

`test:ui` drives the running app in headless Chromium: the workspace payload, dashboard, employee detail, employees, alerts, Ask Beacon, the legacy redirects, a demo clock round trip (restored afterwards), the phone layout and one assistant question (`SKIP_AI=1` skips it). It never starts a verification. It targets `TEST_BASE_URL` (default `http://127.0.0.1:3000`); to run it beside your own `npm run dev`, start a second server in its own build directory, since Next.js allows one dev server per `.next`:

```bash
NEXT_DIST_DIR=.next/ui-check npx next dev --hostname 127.0.0.1 --port 3105
TEST_BASE_URL=http://127.0.0.1:3105 npm run test:ui
```

`test:workspace`, `test:live-ui`, `test:viewer`, `scripts/testBatchPreview.mjs` and `tests/httpIntegration.mjs` still target the previous front end's pages and selectors and have not been updated for the ported UI.

`ai:smoke` uses your actual OpenAI key, requires database tools for each credential question, and prints streamed chunks. `--verify` additionally performs a live AI-triggered Kathryn lookup and requires a successful source result. `--only-verify` tests that action alone. `test:live-ui` checks the dashboard Verify button, real browser chat, follow-up context, persistence after reload, and AI-triggered verification. These live checks use OpenAI credits and contact the public state website.

After `npm run build`, you can also run:

```bash
npm run test:integration
```

That test uses a clearly labeled **local Responses API fixture**, an isolated database, and a separate production server on port 3107. It exercises the installed OpenAI SDK, real chat route, SSE wire protocol, database tool, persisted multi-turn messages, and browser Markdown without calling a live model or changing the local demo database. Fixture behavior is confined to test code; the application always uses the actual SDK and configured provider.

Screenshots from browser checks are saved locally in the ignored `debug/` directory. No debug files are publicly served.

## API routes

| Route                            | Behavior                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /api/dashboard`             | Employees, counts, managers, current date, key-configured boolean, and batch progress.                |
| `GET /api/employees`             | Roster with optional `q`, `manager`, `state`, and `attention=true` filters.                           |
| `GET /api/employees/:id`         | Employee details and up to 25 recent source audits.                                                   |
| `POST /api/employees/:id/verify` | One deterministic live lookup and audited database update; responds with `{ employee, auditId }`.     |
| `POST /api/verify-all`           | Starts or returns the running sequential job; optional `employeeIds` limits it to selected employees. |
| `GET /api/verify-all`            | Current progress.                                                                                     |
| `DELETE /api/verify-all`         | Stops a running roster check after the current employee finishes.                                     |
| `GET /api/chat/session`          | Creates/resumes the browser's conversation and loads history.                                         |
| `POST /api/chat/session`         | Creates a fresh conversation.                                                                         |
| `POST /api/chat`                 | Validates a message and streams assistant/tool/text/completion/error events.                          |
| `GET /api/workspace`             | The front end's whole snapshot: employees, credentials, history, alert actions, batch, demo clock.     |
| `POST /api/ask`                  | Streams the assistant (SSE) for `{ question, history, threadId }`; a JSON rule-based answer without a key. |

## Deploy to Fly.io

The app needs a real Chromium (Playwright) and a writable SQLite file, so it runs as one container with a persistent volume rather than on serverless hosts. The `Dockerfile` starts from the official Playwright image (its tag must match the `playwright` version in `package.json`), `fly.toml` mounts a volume at `/app/data` for the database, recordings and demo clock, and `scripts/docker-entrypoint.sh` seeds an empty volume from a snapshot, applies migrations and starts the server.

```bash
brew install flyctl && fly auth signup        # or fly auth login
npm run demo:snapshot -- pristine             # the state the demo should open with
deploy/prepare-seed.sh pristine               # copies it to deploy/seed/beacon.db (ignored by git, baked into the image)
fly launch --copy-config --no-deploy --ha=false   # choose an app name and a region; keep the generated settings
fly secrets set OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-5.4-mini
fly deploy --ha=false
fly open /dashboard
```

The first deploy builds the image on Fly's remote builder (several minutes: it installs dependencies, runs `next build` and downloads IBM Plex Sans). The app URL is `https://<app-name>.fly.dev`. One machine with 2 GB of memory is configured; Chromium does not fit in the 256 MB default. The machine is kept running (`auto_stop_machines = "off"`): roster checks run inside the web process, and letting Fly stop an idle machine would kill a check mid-batch as soon as every browser tab closed.

Operating it:

- `fly logs` shows the same `[Playwright]`, `[AI]` and `[Credential Verification]` lines as the dev server.
- `fly ssh console -C "npm run demo:reset -- --keep 'Kathryn Cell'"` resets the hosted roster before a demo; `demo:snapshot` works there too. `demo:restore` does not, because the server holds the database open; redeploy with a new seed instead, after `fly volumes destroy` if the volume already has data (the entrypoint only seeds an empty volume).
- The deploy uploads your local checkout (respecting `.dockerignore`, not `.gitignore`), which is how the seed database and nothing else from `data/` reaches the image. The repository stays free of employee data.
- Costs: check Fly's current pricing; a single shared-CPU machine with 2 GB that stays running is roughly ten dollars a month while it exists, plus a 1 GB volume, and a payment method is required. Destroy the app after the demo.

Railway works the same way: install the Railway CLI, `railway init`, add a volume mounted at `/app/data` and the `OPENAI_API_KEY` variable in the dashboard, set the service memory to 2 GB, then `railway up` (add a `.railwayignore` that does not exclude `deploy/seed`). Vercel and other serverless hosts cannot run this app: no browser, no writable disk.

## Practical limits

This is a local hackathon workspace: no enterprise authentication, SSO, production notification delivery, or scheduled verification. The attention center implements visual 30/14/7-day follow-up. Batch progress is in memory and requires the server to keep running. Paginated state results are conservatively sent to human review rather than automatically selecting a license. The public source sometimes returns HTTP 502; such failures are shown honestly, retain historical results, and can be retried.

Rosters come from worksheet four of the workbook or from a CSV of first and last names; only Michigan RNs are verified. Workbook re-import does not reconcile removals or arbitrary row moves, and the CSV import never updates or removes existing people. Ask Beacon sends the latest 12 turns of the open thread with each question; threads are stored in the browser, so clearing site data removes them. Stopping a chat response can cancel generation; a credential action already started may still finish. Demo mode overlays clearly labeled simulated expiration dates; the original source dates and audit history stay unchanged.

Production dependency audit passed with zero reported vulnerabilities after compatible dependency fixes. The development lint toolchain still inherits the published `braces` stack-exhaustion advisory; no patched compatible version was available during this build. It does not ship in the production dependency set.

Official API references used for implementation: [Responses function calling](https://developers.openai.com/api/docs/guides/function-calling) and [Responses streaming](https://developers.openai.com/api/docs/guides/streaming-responses). Installed SDK types were inspected before selecting method names and event shapes.

### Rehearse, then reset for the demo

Every verification writes to the database and the recordings folder, so rehearse with a saved state you can return to:

```bash
npm run demo:snapshot -- pristine        # works while the dev server runs (consistent SQLite copy)
# ... click Verify now, Verify selected, Verify all on this page, ask the assistant to verify ...
# Ctrl+C the dev server, then:
npm run demo:restore -- pristine
npm run dev
```

A snapshot holds `prisma/beacon.db` (employees, audits, alert actions), `data/verification-runs/` (browser recordings) and `data/demo-settings.json` (demo clock) under the ignored `data/snapshots/<name>/`. `npm run demo:list` shows what exists. Restoring refuses to run while a server has the database open, because it swaps the files underneath it.

To start from a clean roster instead, `npm run demo:reset` puts every employee back to **Not yet verified** and deletes audits, alert actions, recordings and the demo clock; `npm run demo:reset -- --keep "Kathryn Cell"` keeps one person's real record so the demo opens with a single verified nurse. Reset works with the server running (the dashboard picks it up on the next poll); restart the server if the demo clock was on. Ask Beacon threads live in the browser; delete them from the `/ask` page if a clean chat matters.

To show new hires arriving and being verified live, take a few real nurses off the roster first:

```bash
npm run demo:remove -- "Kathryn Cell" "Dawn Vadan"   # removes them and writes data/reimport-<stamp>.csv
```

During the demo, open **Add employees**, drop that CSV, keep **Verify after import** checked, and watch the banner check them against Michigan MILARA. Do not run `npm run import` or `npm run setup` afterwards: the workbook importer would create the removed people again under their old rows. `npm run demo:restore -- pristine` puts everything back.

### Watch a verification

Click **Verify now** on an employee page (or in a table row's menu), or ask the assistant to verify someone. While the check runs, **Watch the browser** opens the viewer with real Michigan MILARA screenshots, recorded target highlights, cursor movement, action captions, and the saved result; it is opt-in rather than automatic, and closing it lets the check continue. Every recorded check gets a **Replay** button in Verification history.

Roster-wide checks (**Verify selected**, **Verify all on this page**, or the assistant's bulk tool) run on the server and show a progress banner on every page with a **Stop after this one** button; their recordings are replayable from history too.

Playback controls let you pause, scrub, select an activity, or replay from the beginning. In employee details, press the replay icon on a Verification history row. Older audits created before this feature have no recording. Each new audit stores a recording ID; JPEG frames and an atomic JSON manifest persist in the ignored `data/verification-runs/` directory, so replay survives server restarts. Back up that directory alongside the database. Recordings are step snapshots, not continuous video; the cursor is an animated overlay at the actual element coordinates. Reduced-motion settings disable animation.

The app polls activity every 900 ms. This initial local version shares the existing single-process verification queue; production deployments would need shared job storage and access controls for recordings. No recording is exposed through an arbitrary filesystem path. The previous `npm run test:viewer` script targets the old panel and has not been updated.

### Workspace and demo alerts

The sidebar provides Dashboard, Employees, Alerts, and Ask Beacon. The credential store loads one server snapshot and polls `/api/workspace` every four seconds across page navigation, so checks started by the assistant or another tab appear without a reload. Search (name, manager, license number), group, source and status filters, row selection, **Verify selected** and **Verify all on this page** use the same roster and sequential verification service. Verification start, completion, and failure notifications appear as toasts.

Alert tabs cover expired credentials, the 7-, 14-, and 30-day renewal windows, and verification issues (including never-verified people, labelled **Not yet verified**). Each card offers **Verify now** or **Reverify**, **Mark resolved** (with undo), **Reopen**, and, for renewal warnings, **Send reminder**; resolve and reminder actions are stored in the `AlertAction` table and survive reloads.

Open the **Demo clock** in the top bar and choose **Enable demo data** to populate renewal windows predictably. Expirations are seeded relative to the saved seed date; moving the clock with the date input or **+7 days** and **+30 days** changes alert categories without moving those seeded dates. **Reset clock** returns to the seed date, and **Use live dates** restores source expirations. An amber **Demo clock on** chip and **Demo** tags next to dates distinguish simulated values, the employee page shows the source's own expiration, and the assistant receives the same demo context. Settings persist in ignored `data/demo-settings.json`; no employee source dates or audit records are overwritten.

The Michigan scraper selects **Registered Nurse** before searching and falls back to labeled detail fields if stable source element IDs are unavailable. Exact RN profession matching still applies to parsed records.

With the dev server running, `npm run test:ui` covers the ported UI (see Validation). `npm run test:scraper` checks RN filtering and fallback extraction against local HTML fixtures. `npm run test:workspace` and `npm run test:viewer` still target the previous UI.
