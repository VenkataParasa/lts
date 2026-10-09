# Working workflows and assumptions

## Start tracking

Assignment Manager (`Assigner`), Manager and Administrator can start tracking from a bill. The wizard selects BA/FN/FE/DR or Bill Description, assigns primary/backup/reviewer/manager, classifies priority/topics/issues/confidentiality/Executive Review/hold and sets four deadlines. Bill Description is a separate BA work product with a `workKind` subtype. Each selected work type creates a work product, assignment participants, initial workflow state, notification and audit event. The work product is the prototype's task; there is no separate assignment table.

## Analysis and publication

Assigned → In progress → In review → Approved → Published (stored as Delivered). A reviewer can return In review → Rework. The analyst edits and resubmits. Empty issue details block submission when Issues is enabled. Only the assigned reviewer or Manager/Administrator can approve; preparers cannot approve their own work. Executive Review, when required, follows its configured person sequence.

Publication requires reviewer approval, completed Executive Review, and an Assigner/Manager/Administrator role. A published substantive edit clears approval, moves work into In progress and marks Published — Changes Pending. Submit and approve again, then republish. Every publication retains a separate snapshot; read-only viewers see the latest published snapshot while changes are pending. No separate Submitted for review/In review states are modeled. Manager is retained as an assignment participant, not a distinct mandatory approval stage.

## Legislative versions and amendments

Compare selects legislative versions; Compare DOR analyses compares version-specific BA content. Draft analysis opens or creates work for the selected right-hand version. Copy prior analysis creates a new record with provenance and preserves the source record. Feed descriptions are not presented as full legislative bill text. Amendment import creates a BA task tied to the amendment, with parent-version context retained. Full amendment-specific UI fields and manual amendment entry remain partial.

## Hearings and deadlines

Collector timestamps without offsets are Washington local times and converted using Pacific DST transition rules. Min-year revised timestamps mean no revision. Canceled hearings remain visible in history and do not drive deadlines. A hearing inside 72 hours recommends hearing minus four hours; work is not silently reassigned or rescheduled on import. Dates in the wizard are entered in the browser's local time zone.

## Fiscal, review and transmission

Fiscal notes and estimates use per-year revenue and expenditure/FTE calculations. Contributors and section dates are routed by authorized assignment roles. Editing approved fiscal content invalidates prior approvals and requires fresh review. Approved fiscal work requires narrative summary, assumptions and completed required approvals before demo transmission. The demo response, payload and receipt are retained and the delivered record is locked. Packages require every referenced item, complete approvals/content and no holds; unsuccessful delivery cannot mark the package delivered.

## Persistence and permissions

Application-folder JSON fixtures are the only initial data source. Runtime changes are in memory and are discarded on reload/reset; the browser does not write edits back to those files. Persona roles use the preexisting generic labels: Analyst covers Primary/Backup/Fiscal Analyst; Assigner covers Assignment Manager; Read-only covers Agency Viewer. Divisions are shown in Acting as. Role switching is an explicit unauthenticated demo behavior. Server authorization, confidential persistence, enterprise notification recipients and simultaneous editor conflict resolution are not provided.
