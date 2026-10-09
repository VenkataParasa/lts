export type Role =
  | 'Analyst' | 'Reviewer' | 'Assigner' | 'Manager' | 'Executive Reviewer' | 'Leadership'
  | 'Expenditure Contributor' | 'Budget Office' | 'Read-only' | 'Administrator'

export type Division = 'RFA' | 'L&P' | 'Executive' | 'Budget Office' | 'Audit' | 'Taxpayer Services' | 'Information Services' | 'Property Tax'

export interface Staff { id: string; name: string; division: Division; title: string; role: Role; email: string }

export interface Session { id: string; name: string; current: boolean; start: string; end: string; provisioned: boolean }

export interface BillVersion {
  metadata?: Record<string, unknown>
  appliesToVersionId?: string
  id: string
  label: string // e.g. "E3SHB 1960" or a source amendment name
  kind: 'version' | 'amendment'
  date: string
  text: string
  analyzed?: boolean
  sponsor?: string
}

export type BillStatus =
  | 'Introduced' | 'In committee' | 'Passed committee' | 'Passed first chamber' | 'In second chamber'
  | 'Passed legislature' | 'Signed' | 'Died' | 'Draft request'

export interface Bill {
  sourceFeed?: { source: string; retrievedAtUtc: string; url: string }
  legislation?: Record<string, unknown>
  sponsorRecords?: Record<string, unknown>[]
  hearingRecords?: HearingRecord[]
  tracked?: boolean
  id: string
  session: string
  number: string | null // null for agency-request drafts
  chamber: 'House' | 'Senate'
  title: string
  status: BillStatus
  sponsors: string[]
  committee: string
  topics: string[]
  taxType: string
  hearings: string[] // ISO
  versions: BillVersion[]
  currentVersionId: string
  priorBillId?: string
  hasIssues: boolean
  inBudget: boolean
  enacted: boolean
  draft: boolean
}

export type ItemType = 'FN' | 'FE' | 'DR' | 'BA'
export type Stage = 'Assigned' | 'In progress' | 'In review' | 'Rework' | 'Executive review' | 'Approved' | 'Delivered'
export const STAGES: Stage[] = ['Assigned', 'In progress', 'In review', 'Rework', 'Executive review', 'Approved', 'Delivered']

export interface Comment { id: string; by: string; at: string; text: string; kind: 'comment' | 'return' | 'approve' | 'system'; section?: string }
export interface Correspondence { id: string; to: string; sent: string; responseReceived: boolean; responseDate?: string; note: string }
export interface Delivery { id: string; at: string; by: string; channel: string; receipt: string; version: number; payload?: string; status?: 'SENT'; demoResponse?: string }

export interface WorkItem {
  workKind?: 'Bill Description'
  billVersionId?: string
  backupId?: string
  managerId?: string
  reviewerDueAt?: string
  publicationTarget?: string
  changesPending?: boolean
  provenance?: string
  revisions?: { revision: number; at: string; by: string; body: string; topics: string[]; issueNotes: string; billVersionId?: string }[]
  id: string
  type: ItemType
  billId: string
  title: string
  stage: Stage
  onHold: boolean
  confidential: boolean
  execReview: boolean
  packageId?: string
  preparerId: string
  reviewerId?: string
  assigneeIds: string[]
  startAt: string
  dueAt: string
  customerDueAt: string
  priority: 'Low' | 'Normal' | 'High' | 'Urgent'
  billChanged: boolean
  locked: boolean
  version: number
  execChain: string[]
  execIndex: number // index of current exec reviewer; chain.length = all done
  reviewApproved: boolean
  comments: Comment[]
  history: Delivery[]
  savedAt: string
  // analysis-only
  body?: string
  topics?: string[]
  hasIssues?: boolean
  issueNotes?: string
  correspondence?: Correspondence[]
  publishedVersion?: number
  // fiscal
  fiscal?: FiscalData
  // data request
  requester?: string
  question?: string
}

export interface RevenueRow { fund: string; values: number[] } // one per fiscal year
export interface ExpSection {
  id: string; name: string; assigneeId?: string; dueAt: string; status: 'Not started' | 'In progress' | 'Complete'
  hours: number[]; salary: number; benefitsOverride?: number; goods: number; equipment: number
}
export interface CostRules { hoursPerFte: number; benefitsRate: number; goodsPerFte: number; equipmentPerFte: number }
export interface FiscalData {
  years: number[]
  narrative: { summary: string; assumptions: string; methodology: string; prior: string }
  revenue: RevenueRow[]
  revenueAssigneeId?: string
  revenueDueAt: string
  expenditure: ExpSection[]
  workPapers: { id: string; name: string; size: string; by: string; content?: string; mime?: string; at?: string }[]
  prior: { productId: string; billLabel: string; narrative: string; revenue: RevenueRow[]; totalFte: number }
}

export interface Pkg { id: string; name: string; billId: string; itemIds: string[]; dueAt: string; delivered: boolean }

export interface Notification {
  id: string; at: string; channel: 'In-app' | 'Email' | 'Teams'; toRoles: Role[]; subject: string; body: string; link?: string; read: boolean; category: string
}

export interface AuditEntry { id: string; at: string; userId: string; role: Role; action: string; target: string; detail: string; confidential?: boolean }

export interface ImplTask { id: string; billId: string; title: string; owner: string; division: Division; dueAt: string; done: boolean; completedAt?: string; notes?: string }

export interface SavedQuery { id: string; name: string; taxType: string; minAmount: number; sessions: string[]; by: string }

export interface Template { id: string; name: string; format: 'Word' | 'PDF' | 'OFM XML'; body: string }
export interface Clause { id: string; title: string; text: string }
export interface WorkflowStageDef { id: string; name: string; slaHours: number; who: string }

export interface Seed {
  notificationPreferences?: Record<string, boolean>
  importRuns?: ImportRun[]
  legislativeChanges?: LegislativeChange[]
  now: string
  staff: Staff[]
  sessions: Session[]
  bills: Bill[]
  items: WorkItem[]
  packages: Pkg[]
  notifications: Notification[]
  audit: AuditEntry[]
  implTasks: ImplTask[]
  savedQueries: SavedQuery[]
  templates: Template[]
  clauses: Clause[]
  picklists: Record<string, string[]>
  costRules: CostRules
  workflow: WorkflowStageDef[]
  presence: Record<string, string> // itemId -> staffId viewing
  idCounters: Record<string, number>
  savedViews: { id: string; name: string; filter: Record<string, string> }[]
}

export interface HearingRecord { id: string; billVersionId: string; committee: string; chamber: string; date: string; cancelled: boolean; revisedDate?: string; type: string; description: string; location: string; metadata: Record<string, unknown> }
export interface ImportRun { id: string; at: string; by: string; source: string; billId?: string; result: 'Imported' | 'Failed'; errors: string[]; raw: unknown }
export interface LegislativeChange { id: string; billId: string; type: string; oldValue: string; newValue: string; at: string; source: string; affectedItems: string[]; acknowledged: boolean }
