# DOR Legislative Tracking System: demo build

A clickable, fully interactive demo of a Legislative Tracking System for the Washington State Department of Revenue. React, TypeScript, Tailwind, Recharts, `diff` for redlines and `zustand` for the in-memory store.

Everything is fictional. There is no backend and no persistence: all state lives in memory and is rebuilt from `src/seedData.ts` on every page load.

## Run it

```
npm install
npm run dev      # http://localhost:5173
npm run build    # type-checks, then builds to dist/
```

## Reset the demo

User menu (top right) > **Reset demo**. This rebuilds the seed, including all dates relative to "now". Reloading the page does the same.

## Where things are

| Path | What |
| --- | --- |
| `src/seedData.ts` | All demo content: staff, sessions, bills and versions, work items, packages, notifications, audit, templates, pick-lists. Deterministic (seeded random), dates relative to now. |
| `src/store.ts` | Central store and all workflow rules (approval, sequential executive review, delivery lock, simulate legislature update, audit entries). |
| `src/adapters.ts` | Mock adapters for the Legislature feed, OFM FNS, OFM BEARS, SharePoint, Email and Teams. 300 to 800 ms delay, then a receipt ID. Labelled "Simulated" on Admin > Integrations. |
| `src/lib.ts` | Deadline clocks, role and visibility rules, formatting. |
| `src/pages/` | One file per screen. `src/components/ui.tsx` holds the shared components. |

Bill numbers use ranges that do not exist in any real session (HB 61xx to 73xx, SB 91xx to 96xx). Names, sponsors and dollar figures are invented.

## Roles

Switch role in the header (wide screens) or the user menu. The user menu also has **Acting as**, to pick a specific person for a role (needed for the three sequential executive reviewers). Navigation, buttons and visible data change by role. Enforced rules:

- The preparer of a work product can never approve or return it (try `FN-27-005` as Reviewer).
- Read-only sees only delivered, non-confidential items and no drafts or internal notes.
- Expenditure Contributors see only fiscal notes where they are assigned a section, and only those sections.
- Confidential items are hidden from roles without need to know, and every view of one writes an audit entry.

## Demo scenarios

Open **Demo guide** from the user menu. Each entry switches role and jumps to the right screen.

1. **New hearing in under 72 hours.** Runs *Simulate legislature update*: a new version, a new amendment and a hearing 20 hours out. Three tasks are created, open work on the changed bill shows "Bill changed", and in-app, email and Teams notifications are sent. Can be run repeatedly.
2. **Assigner routes a fiscal note.** `FN-27-001` as Assigner, *Assignments* tab: choose contributors and due dates, then **Route**.
3. **Compare SHB to HB and draft the analysis.** Bill compare (side by side with synchronized scroll, or inline redline), then **Draft the analysis** opens `BA-27-002` with the clause library.
4. **FTE calculation and prior-year comparison.** `FN-27-002`, *Expenditure & FTE* (editable cost rules) and *Prior-year comparison* (copy forward with one click).
5. **Review, return, fix, executive review.** `FN-27-003` as Reviewer: approve or return with a comment. After approval, switch to Executive Reviewer and use **Acting as** for each of the three reviewers in turn. The Approvals page (`/executive`) is built for phone widths.
6. **Transmit to OFM and show the audit trail.** `FN-27-004` as Manager: preview Word, PDF and OFM XML, transmit, get a receipt ID. The version locks and the audit trail on the same page updates. Full log at Admin > Audit log.
7. **Manager workload and a saved query.** Reports > Workload, then Reports > Query builder (saved query "Capital gains notes over $5 million").

## Before the demo

- Confirm the hex codes in `src/index.css` against DOR's real palette (values are approximate).
- Walk every scenario with the keyboard only. An automated axe-core pass (WCAG 2.2 AA rules) found no violations on the main screens, but that does not replace a manual pass.
- Confirm no real names or bill numbers appear in the seed.
