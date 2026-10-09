# Current domain model

`Bill` owns `BillVersion` records. Every newly created work product retains `billVersionId`; comparisons and copy-forward actions respect that relationship. Amendment versions retain `appliesToVersionId` and receive a dedicated BA task on import. That task has its own reviewer, comments, status and audit entries.

Hearing records retain agenda identity, chamber, committee, date, cancellation, revision, hearing description and location. Committee meeting metadata retains the remaining feed fields. Sponsors retain IDs, names, contact details, ordering and primary/secondary classification. Bill legislative metadata retains fiscal-note flags, titles, descriptions, companions, requests, original agency and current status. The application work fields are separate from feed fields.

Import runs retain the unmodified source payload, actor, import time, result and errors. Changes retain old/new values, detection timestamp, source, affected active work IDs and acknowledgement. Bill versions and old hearings are retained across imports.

Work products currently double as assignment/task/workflow records. Primary, backup, reviewer and manager participants plus analyst/customer/reviewer/publication dates are retained on the work product. Published BA revisions retain body, topics, issue details, actor, date and legislative version. Fiscal deliveries retain payload, receipt, sent status, actor, timestamp and revision. Actual local supporting documents use data URLs with a 2 MB per-document limit; they are stored in memory for the current page session, not public URLs or JSON files.

These are TypeScript domain records, **not relational tables**. The requested relational schema, separate immutable database keys, status-history tables, normalized assignment participants, document version rows and server-enforced audit immutability remain to be implemented. The browser audit array is appended by commands but is not tamper-proof storage.
