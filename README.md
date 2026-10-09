# DOR Legislative Tracking System: demo build

A clickable, fully interactive demo of a Legislative Tracking System for the Washington State Department of Revenue. React, TypeScript, Tailwind, Recharts, `diff` for redlines and `zustand` for the in-memory store.

All 250 seeded bills come from `src/fixtures/wa-legislation-sample-250.json`: 150 for 2025-26, 50 for 2023-24 and 50 for 2021-22. My Work loads mock assignments for every persona from `assignment-scenarios.json`; packages, implementation tasks and audit history start empty. `workspace-config.json` contains application settings and personas only; no BA-DEMO/FN-DEMO records remain. All initial data comes from JSON in the application folder; runtime edits stay in memory with no database or browser storage.

`hearing-alert-simulation.json` uses the same dataset/records and endpoint-envelope structure as the supplied collector JSON. Its four records refer to existing bills and add explicitly simulated meetings at 20, 48, 70 and 96 hours from application load. Historical meetings remain unchanged. Three meetings trigger 72-hour notifications; the fourth falls outside that window. These are simulation overlays, not additional bills or real announced hearings.

## Run it

```
npm ci           # Node 22.16+; Node 22.22+ or 24 recommended for Vite
npm run dev      # http://localhost:5173
npm run build    # type-checks, then builds to dist/
npm test         # domain rules and workflow journeys
npx playwright install chromium
npm run test:e2e # browser journey and phone-width hearing history
```

On this Windows workspace, Node was missing and a portable runtime was downloaded into ignored `.tools/`. Dependencies and Chromium are installed. Run `powershell -ExecutionPolicy Bypass -File scripts/run.ps1 dev` from `lts` to launch without installing Node globally. The helper also accepts `build`, `test`, `test:e2e` and `preview`. A fresh clone requires the standard Node/npm setup above.

## Reset the demo

User menu (top right) > **Reset demo**. This restores the 250 official bills and hearing scenarios. Only workflow deadlines are rebased relative to "now"; official legislative dates are preserved. Refreshing or resetting reloads the JSON fixtures and discards unsaved session changes. Document uploads are limited to 2 MB each and held in memory.

## New source-data and tracking journey

Open **Bills**, select **2025-26**, search **1960**, and inspect the official versions, amendments, sponsors and hearing history. Choose an untracked bill to start a new workflow, or add a work assignment to a tracked bill. Administration > Legislative imports can re-import a supplied dataset record or refresh simulated hearings.

Switch to **Assigner** and choose **Start Tracking**. The five-step wizard creates selected work products with primary/backup/reviewer/manager participants, classification and deadlines. Switch to the assigned **Analyst** using **Acting as**, draft analysis and submit; the assigned **Reviewer** approves or returns it. **Manager**, **Assigner** or **Administrator** can publish approved content. Editing published content creates **Published — Changes Pending** and requires fresh review before republishing. Published snapshots remain retained.

**Administration → Legislative imports** accepts uploaded/pasted collector JSON, retains raw import payloads, and offers an idempotent sample import plus a changed-hearing demonstration. Later imports create source change events and notifications without overwriting DOR analysis. **Compare versions** supports selected-version analyses, prior-analysis copy with provenance and DOR analysis comparisons.

**Hearings**, **Search**, **My Work → Needs My Review**, saved bill filters, **Reports → Operational reports**, local fiscal supporting-document uploads and inspectable OFM demo payloads are available. Fiscal content edits invalidate previous approvals. OFM/BEARS/SharePoint/Email/Teams remain **Demo Integration** adapters.

For the complete audit against the supplied prompt, including remaining gaps, see [RFP traceability](docs/rfp-traceability.md). See [architecture](docs/architecture.md), [data model](docs/data-model.md), [workflows](docs/workflows.md), [integrations](docs/integrations.md) and the [demo script](docs/demo-script.md).

The .NET API, EF/PostgreSQL storage, Docker/AWS deployment, Entra authentication and server-side authorization remain unimplemented. Browser checks and the local audit history are demonstration behavior and do not establish production security or immutable storage.

## Where things are

| Path | What |
| --- | --- |
| `src/fixtures/workspace-config.json` | Personas, templates, picklists, cost rules and workflow settings; operational record arrays are empty. |
| `src/fixtures/hb1001.json` | Historical collector payload retained for parser regression tests; not seeded or exposed as an application sample. |
| `src/fixtures/wa-legislation-sample-250.json` | Supplied 250-record collector dataset, unchanged. |
| `src/fixtures/hearing-alert-simulation.json` | Collector-shaped overlays for four existing bills, with explicitly simulated upcoming hearings. |
| `src/hearingSimulation.ts` | Moves only marked simulated meeting dates relative to load/reset. |
| `src/retrieval.ts` | Cached bill/version indexes and work-product grouping for retrieval. |
| `src/seedData.ts` | JSON loader; caches legislative normalization once, isolates reset state, registers source sessions/committees and rebases only synthetic dates. |
| `src/store.ts` | Central in-memory store and workflow rules (approval, sequential executive review, publication snapshots, delivery lock, legislative imports, audit). |
| `src/legislative.ts` | Collector JSON normalization, Pacific hearing dates and snapshot change detection. |
| `src/fiscalCalculations.ts` | Domain FTE and expenditure calculation rules, shared with fiscal editors. |
| `tests/` | Domain rule/journey tests and Playwright browser tests. |
| `src/adapters.ts` | Mock adapters for the Legislature feed, OFM FNS, OFM BEARS, SharePoint, Email and Teams. 300 to 800 ms delay, then a receipt ID. Labelled "Simulated" on Admin > Integrations. |
| `src/lib.ts` | Deadline clocks, role and visibility rules, formatting. |
| `src/pages/` | One file per screen. `src/components/ui.tsx` holds the shared components. |

Bill titles, numbers, sponsors, versions, status and hearings come from official JSON. No tax classification or budget inclusion is inferred from the dataset. Staff personas are illustrative. New fiscal products start with blank narratives and zero amounts.

## Roles

Switch role in the header (wide screens) or the user menu. The user menu also has **Acting as**, to pick a specific person for a role (needed for the three sequential executive reviewers). Navigation, buttons and visible data change by role. Enforced rules:

- The preparer of a work product can never approve or return it .
- Read-only sees only delivered, non-confidential items and no drafts or internal notes.
- Expenditure Contributors see only fiscal notes where they are assigned a section, and only those sections.
- Confidential items are hidden from roles without need to know, and every view of one writes an audit entry.

## Demo scenarios

1. Open Hearings: four simulated upcoming meetings appear. Notifications lists alerts for the three inside 72 hours.
2. Open Bills as Assigner and Start Tracking. Create analysis, fiscal-note or estimate assignments; all IDs use the current year and an incrementing sequence.
3. Draft an analysis as the assigned Analyst, submit, approve as Reviewer, and publish as Manager. Editing published content still requires fresh review.
4. Create a fiscal note, enter narrative/revenue/expenditure assumptions, route contributors, review, and transmit with a retained demo integration payload.
5. Refresh simulated hearings through presenter controls or Legislative imports. Source changes flag existing work and generate notifications; no assignments are automatically created.

## Before the demo

- Confirm the hex codes in `src/index.css` against DOR's real palette (values are approximate).
- Walk every scenario with the keyboard only. An automated axe-core pass (WCAG 2.2 AA rules) found no violations on the main screens, but that does not replace a manual pass.
- Confirm official legislative records are clearly distinguished from illustrative agency work products.

## Legislative dataset retrieval

The loader normalizes legislative fixtures once per application load and deduplicates bills by biennium plus bill number, preferring the latest retrieval timestamp. Source dates remain unchanged. Raw responses remain available in import history without copying the full source dataset on every reset. Bill/version lookups use array-identity indexes, which automatically invalidate on immutable store updates. Bills, hearing lists and import history show 25 records per page. Choose a source biennium on Bills to retrieve the new records. Session edits remain in memory only.
