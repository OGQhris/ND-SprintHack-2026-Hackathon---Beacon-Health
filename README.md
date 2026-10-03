# Beacon Credential Intelligence

A complete local proof of concept for Beacon Health manager credential follow-up. It imports **only worksheet four (`RNS`)**, verifies **Michigan Registered Nurse licenses only**, and connects a real streaming OpenAI assistant to approved database and verification tools.

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

Leave `OPENAI_MODEL` blank to use the centralized default in `lib/openai.ts`. Choose another model supported by your account and the Responses API if desired. Restart the development server after changing AI configuration. The SDK and key stay on the server; the browser calls this application's `/api/chat` route. Without a key, credential verification and the dashboard still work, and the assistant shows setup guidance.

The supplied workbook has been copied to the ignored local `data/` directory in this workspace. For a fresh checkout, put your workbook there or import it with the explicit path below.

```bash
npm run setup
npm run dev
```

Open **http://127.0.0.1:3000/dashboard**. The dedicated assistant is **http://127.0.0.1:3000/assistant**; the dashboard's **Ask Beacon** button opens a compact version.

The development server binds to loopback. Keep it running during verification, especially during a sequential roster check.

### Import from the original file

```bash
npm run db:generate
npm run db:migrate
npm run import -- "/Users/aydin/Downloads/Credentialing List - KZO.xlsx"
```

Or, after copying the file to `data/Credentialing List - KZO.xlsx`, use `npm run import`. Import is idempotent and preserves verification history. It trims surrounding whitespace but does not fix spelling. An existing workbook row whose first/last name changes is rejected to avoid assigning an old license to a different person; removed rows are not automatically deleted.

The supplied fourth sheet has **17 employees**, including **Tatyanna Rosa**, with managers **Kimblery Gjeltema** and **Christianna Davison**, exactly as written in Excel. No other worksheet is imported. Data files, SQLite databases, debug screenshots, and `.env.local` are ignored by Git. A fresh database starts entirely unverified; the current local database contains Kathryn's real, successfully checked record.

### Production-style local demo

```bash
npm run build
npm start
```

## Two-minute judge demo

Have the server running and your OpenAI key configured before beginning. Open the dashboard at a normal laptop resolution.

| Time      | Action                                                                                            | What it demonstrates                                                                          |
| --------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 0:00–0:20 | Show the 17-person roster and credential coverage. Search `Kathryn`.                              | Fourth-sheet import, manager monitoring, honest unknown states.                               |
| 0:20–0:40 | Click Kathryn's shield/Verify action; open her details when finished.                             | Deterministic live state lookup, Active RN status, expiration, license number, and timestamp. |
| 0:40–0:50 | Expand verification history and show the source link.                                             | An auditable state-source result rather than a fabricated dashboard value.                    |
| 0:50–1:15 | Open **Credential assistant**. Ask **Tell me about Kathryn Cell.** Then **When does she expire?** | Real database tool calling, streamed answers, and multi-turn context.                         |
| 1:15–1:35 | Ask **Who expires in the next 30 days?** Then **Who needs attention?**                            | Date calculations and coverage-qualified monitoring answers.                                  |
| 1:35–2:00 | Ask **Verify Kathryn Cell.** Show tool activity and the updated timestamp.                        | AI invokes an approved deterministic browser tool, then reports its actual result.            |

For the tested live record, Michigan MILARA returned Registered Nurse, license **4704214941**, **Active**, issued **March 4, 1998**, expiring **March 4, 2028**, county **Kalamazoo**. These values are stored only after a successful lookup, never seeded from the request. The state site can update them. With just Kathryn checked, most of the roster still has unknown expiration dates; zero recorded alerts does not imply everyone is current.

Optional: ask **Who reports to Christianna Davison?**, followed by **Do any of them expire soon?** To demonstrate bulk progress, explicitly ask **Verify everybody** or click **Verify all credentials**. That starts a sequential background job; it need not finish during a two-minute demo.

## Implemented product

- Calm dashboard, metrics, coverage ring, searchable roster, manager filter, attention categories, responsive layouts, and accessible employee-detail dialogs.
- Employee detail includes source license status separately from calculated expiration category, license number, issue/expiration dates, county, manager, successful-check timestamp, most recent attempt, errors, workbook provenance, and audit history.
- Dedicated assistant plus dashboard drawer, Markdown, streamed chunks, multi-turn history in SQLite, sticky composer, Enter/Shift+Enter behavior, stop action, suggested prompts, subtle activity shimmer, readable tool rows, and concise error states.
- SQLite with Prisma migrations, validated fourth-sheet ExcelJS import, and a replaceable `CredentialProvider` interface.
- Closed registry of ten strict JSON-schema and Zod-validated tools. No arbitrary SQL, shell, URLs, browser commands, deletes, or direct database editing are exposed to the model.
- Real official OpenAI JavaScript SDK **Responses API** with streaming, repeated function-call execution, matching `function_call_output` items, all response output items preserved within the turn, and a bounded 12-round loop. No Assistants Threads/Runs or Chat Completions.
- Per-browser HttpOnly session cookie, persisted conversation messages, same-origin write checks, and one active response per conversation.
- Sequential/low-concurrency verification, truthful roster progress, error screenshots under `debug/`, state-source provenance, and an audit record for each completed attempt.

### Approved assistant tools

`get_employee_by_name`, `search_employees`, `get_credentials_expiring_within_days`, `get_expired_credentials`, `get_employees_by_manager`, `get_unverified_employees`, `get_attention_needed`, `get_credential_summary`, `verify_employee_credential`, `verify_all_credentials`.

Partial names return candidates instead of guessing. Expiration queries exclude already expired licenses. Manager matching uses exact spelling first and reports ambiguous partial matches. Bulk verification requires an explicit request in the latest user message, enforced both in the system instructions and backend tool gate.

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

`npm test` uses a separate temporary SQLite database. It covers expiration boundaries/timezone, fourth-sheet-only import/spelling/row validation, database searches, name ambiguity, eight read tools, strict tool validation, mutation gates, source parsing, not-found/review handling, complete multi-round Responses orchestration, streaming deltas, conversation context, interrupted streams, audited persistence, failed recheck retention, backend routes, and sequential batch progress.

With the app running:

```bash
npm run test:ui
npm run verify:kathryn
npm run ai:smoke
npm run ai:smoke -- --verify
npm run test:live-ui
npm run test:provider
```

`ai:smoke` uses your actual OpenAI key, requires database tools for each credential question, and prints streamed chunks. `--verify` additionally performs a live AI-triggered Kathryn lookup and requires a successful source result. `--only-verify` tests that action alone. `test:live-ui` checks the dashboard Verify button, real browser chat, follow-up context, persistence after reload, and AI-triggered verification. These live checks use OpenAI credits and contact the public state website.

After `npm run build`, you can also run:

```bash
npm run test:integration
```

That test uses a clearly labeled **local Responses API fixture**, an isolated database, and a separate production server on port 3107. It exercises the installed OpenAI SDK, real chat route, SSE wire protocol, database tool, persisted multi-turn messages, and browser Markdown without calling a live model or changing the local demo database. Fixture behavior is confined to test code; the application always uses the actual SDK and configured provider.

Screenshots from browser checks are saved locally in the ignored `debug/` directory. No debug files are publicly served.

## API routes

| Route                            | Behavior                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /api/dashboard`             | Employees, counts, managers, current date, key-configured boolean, and batch progress. |
| `GET /api/employees`             | Roster with optional `q`, `manager`, `state`, and `attention=true` filters.            |
| `GET /api/employees/:id`         | Employee details and up to 25 recent source audits.                                    |
| `POST /api/employees/:id/verify` | One deterministic live lookup and audited database update.                             |
| `POST /api/verify-all`           | Starts or returns the running sequential job.                                          |
| `GET /api/verify-all`            | Current progress.                                                                      |
| `GET /api/chat/session`          | Creates/resumes the browser's conversation and loads history.                          |
| `POST /api/chat/session`         | Creates a fresh conversation.                                                          |
| `POST /api/chat`                 | Validates a message and streams assistant/tool/text/completion/error events.           |

## Practical limits

This is a local hackathon workspace: no enterprise authentication, SSO, production notification delivery, or scheduled verification. The attention center implements visual 30/14/7-day follow-up. Batch progress is in memory and requires the server to keep running. Paginated state results are conservatively sent to human review rather than automatically selecting a license. The public source sometimes returns HTTP 502; such failures are shown honestly, retain historical results, and can be retried.

Only worksheet four and Michigan RNs are supported. Re-import does not reconcile removals or arbitrary row moves. Chat uses the latest 40 messages per model request; older messages remain stored, but extremely long conversations may lose earlier context. Stopping a chat response can cancel generation; a credential action already started may still finish. There are no seeded fake expiration alerts.

Production dependency audit passed with zero reported vulnerabilities after compatible dependency fixes. The development lint toolchain still inherits the published `braces` stack-exhaustion advisory; no patched compatible version was available during this build. It does not ship in the production dependency set.

Official API references used for implementation: [Responses function calling](https://developers.openai.com/api/docs/guides/function-calling) and [Responses streaming](https://developers.openai.com/api/docs/guides/streaming-responses). Installed SDK types were inspected before selecting method names and event shapes.
