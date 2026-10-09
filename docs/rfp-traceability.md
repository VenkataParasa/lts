# Prompt and RFP flow audit

Statuses describe runnable behavior in this repository, not production compliance. RFP IDs below are the mappings supplied in the user's prompt, not independently verified against an RFP document.

| Prompt sections / supplied RFP ID | Status | Evidence / remaining gap |
| --- | --- | --- |
| 1, 3: working domain behavior | Partially Implemented | Store commands, tests, audit. Significant entities do not all have common actor/revision metadata. |
| 2, 35, 43, 44: API/database/AWS/security | Not Yet Implemented | Frontend-only; no ASP.NET/EF/PostgreSQL/Docker/OIDC/API authorization; no concurrent-user proof. |
| 4 / B.COM.06: demo personas/RBAC | Partially Implemented | Roles, Acting as, guarded core commands, restricted direct links and search. Browser checks are not server RBAC. |
| 5: navigation | Implemented | Home, My Work, Bills, Hearings, Assignments, analyses, fiscal work, packages, implementation, reports, search, notifications, admin. Assignments reuses queue. |
| 6: dashboard | Partially Implemented | Operational workload, urgent work, hearings and drilldowns; exact requested summaries and all filters not complete. |
| 7–8 / B.COM.31: LSC and HB 1001 | Implemented | Real supplied collector fixture parsing, bills/versions/sponsors/hearings/status, raw source retained, import history. Relational import tables await backend. |
| 9, 17 / B.COM.31: changes/hearings | Partially Implemented | Idempotent comparison, status/description/sponsor/version/amendment/hearing events, cancellation retention, affected-work notifications. Endpoint errors are retained and failed sponsor/hearing endpoints preserve prior data; removed-hearing reconciliation remains. |
| 10: Bills/filtering | Partially Implemented | Sessions, chamber, committee, topics, tax, hearing window, issues, fiscal work; search includes status/sponsor/topic. Status/sponsor/tracking/analyst/analysis-state/fiscal-required filters and saved bill filters now work; exact-date filtering remains. |
| 11, 37: bill workspace/history | Partially Implemented | Source provenance, hearings, versions, analyses/fiscal/docs/correspondence/discussion/history. Tracking/financial executive summary is implemented; separate source-status timeline and implementation/task tabs remain. |
| 12 / B.COM.10, B.COM.15: start tracking | Partially Implemented | Five-step wizard, BA/FN/FE/DR, four participants, flags/topics and dates; work product doubles as assignment/task. Bill Description creates a separate BA subtype; separate assignment tables remain. |
| 13, 16, 38 / B.COM.17, B.COM.19, B.COM.33 | Partially Implemented | Rich editor, issue validation, review/rework, approval-gated publish/republish and retained revisions. No distinct submitted revision snapshots or draft/review substates; standalone amendment detail/manual creation remains. |
| 14–15 / B.LNP.02: version analyses/comparison | Implemented | BA version relationship, selected-version draft, provenance copy, bill/analysis redlines. Source sample has descriptions only. |
| 18–21 / B.COM.36, B.RFA.09–10: fiscal editors/calculations | Implemented | Structured narrative/revenue/expenditure, FTE/cost rules, prior-copy, routed contributions and fiscal estimates/data requests. |
| 22–23 / B.COM.19, B.RFA.01–02, B.RFA.04: review | Partially Implemented | Assigned reviewer, self-approval prevention, required return comment, sequential executives. Role due dates retained; separate manager stage/config-driven transitions remain. |
| 26 / B.COM.05, B.RFA.06: packages | Implemented | Create bundles, rollup, required-item/content/approval gates, delivery result retained. |
| 39: outbound systems | Simulated | Adapters, fiscal payload/receipt/sent status/history with Demo Integration label. Real transmission and Word/PDF generation absent. |
| 21 / B.COM.21: documents | Partially Implemented | Local work-paper upload/download, metadata and audit; private server storage/versioning/scanning absent. |
| 27 / B.LNP.03, B.COM.01: correspondence/collaboration | Partially Implemented | Contact/date/response log, rich collaboration notes and comments. Full internal/external/date/notes model and mentions remain. |
| 28: implementation | Partially Implemented | Enacted bill tasks, owners/divisions/due/completion, overdue/progress/export. Completion timestamps and editable task notes work; full plans/task documents remain. |
| 29 / B.COM.10: My Work | Partially Implemented | Assigned, review, waiting, returned/rework, due, overdue, hold and recently completed tabs. Exact per-role due-date clock/deadline views remain. |
| 30 / B.COM.02: notifications | Partially Implemented | Read/unread, role-specific mark-all/deep links, in-memory channel preferences. Background due-soon/overdue/mentions not comprehensive. Email/Teams simulated. |
| 31 / B.COM.09: search | Partially Implemented | Bills/versions/analyses/fiscal/requests/packages/docs/sponsors/hearings/correspondence/implementation; type/session/status/owner filters. Full division/topic/fiscal-year filter set remains. |
| 32 / B.COM.38–40: reporting | Partially Implemented | Operational reports, workload, hearings, fiscal impact groupings, save definition/sort/CSV. Data is browser state, not database; advanced query execution/export formats remain. |
| 33 / B.EXEC.01–03: mobile | Partially Implemented | Responsive bill/approval screens and mobile browser test. Bill summary now includes analysis/fiscal states and revenue/expenditure; standalone executive-specific screen remains partial. |
| 34 / B.COM.33: audit | Partially Implemented | Important commands append events; client log is not immutable trusted storage. |
| 36: identifiers | Partially Implemented | New products use TYPE-year-00000; override remains supported. Separate immutable DB keys await backend. |
| 40: synthetic operational data | Implemented | 250 official seeded bills, empty workspaces, and collector-shaped hearing alert overlays. Users create agency work through existing workflows. |
| 41–42: UI/accessibility | Partially Implemented | Responsive tables, labels, semantic controls, keyboard focus trap; complete WCAG audit not done. |
| 45–46: tests/demo | Partially Implemented | Domain workflow tests and Playwright journeys; complete production concurrency/security/accessibility validation absent. |
| 48: documentation | Implemented | README and architecture, model, workflows, integrations, demo and this traceability audit. |
| 49: overall definition of done | Partially Implemented | Core prototype journeys improved; database/API, full normalized schema, complete flow details and production foundations remain explicitly open. |
