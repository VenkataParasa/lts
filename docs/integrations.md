# Integrations

LSC fixture parsing is real local parsing through `ILegislativeDataProvider` / `SampleLscProvider`; it does not contact the Legislature. Supported collector envelopes are `GetLegislation.data.Legislation` (singleton or array), `GetHearings.data.Hearing`, bill-keyed `GetSponsors`, `GetCurrentStatus`, year-keyed amendments and biennium amendments. Successful null amendment responses are valid. Failed/malformed required legislation imports create failed import records and leave existing content unchanged.

Administration → Legislative imports accepts a local JSON upload or paste. Import dataset sample is idempotent. Refresh simulated hearings imports four collector-shaped JSON records for existing bills with additional meetings at 20, 48, 70 and 96 hours. Historical dates and the supplied dataset file remain unchanged. Raw payloads are downloadable from import history. Metadata and normalized source records remain distinct from synthetic DOR work data.

Meaningful changes generate old/new snapshots, active-work flags and in-app notifications. The generic legacy Simulate legislature update action remains an independent synthetic demo generator, not an LSC import run.

OFM FNS, BEARS, SharePoint, Email and Teams are **Demo Integration** adapters. They create local simulated receipts. Fiscal delivery shows its sent payload in Delivery history → View Payload; it does not send to real OFM. Template previews are text/XML previews; Word/PDF generation is still simulated. Real local work-paper uploads retain file content for downloads; seeded SharePoint links remain simulated.

External adapters should later implement asynchronous calls, retry policy, idempotency keys, delivery receipts and tenant-specific private credentials. No cloud or external account is currently needed.
