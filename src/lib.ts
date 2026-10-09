import { getVersion } from './retrieval'
import type { Bill, ItemType, Role, Seed, Staff, WorkItem } from './types'

export const H = 3600_000
export const D = 24 * H

export const iso = (ms: number) => new Date(ms).toISOString()
export const ms = (s: string) => new Date(s).getTime()

const dtf = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const df = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
export const fmtDateTime = (s: string) => dtf.format(new Date(s))
export const fmtDate = (s: string) => df.format(new Date(s))
export const money = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US')
export const num = (n: number, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export function countdown(target: string, now: number): string {
  const diff = ms(target) - now
  const abs = Math.abs(diff)
  const h = Math.floor(abs / H)
  const m = Math.floor((abs % H) / 60000)
  const txt = h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
  return diff < 0 ? `${txt} overdue` : `in ${txt}`
}

export function relTime(s: string, now: number): string {
  const diff = now - ms(s)
  if (diff < 45_000) return 'just now'
  if (diff < H) return `${Math.round(diff / 60000)} min ago`
  if (diff < D) return `${Math.round(diff / H)} h ago`
  return `${Math.round(diff / D)} d ago`
}

// Deadline rules: bill description 48h, fiscal note 72h; when a hearing is under 72h away, due = hearing minus 4h.
export const CLOCK_HOURS: Record<ItemType, number> = { BA: 48, FN: 72, FE: 72, DR: 72 }
export function computeDue(type: ItemType, startMs: number, hearingMs?: number): number {
  const base = startMs + CLOCK_HOURS[type] * H
  if (hearingMs && hearingMs - startMs < 72 * H && hearingMs > startMs) return Math.min(base, hearingMs - 4 * H)
  return base
}

export type ClockState = 'ok' | 'amber' | 'red' | 'overdue' | 'done' | 'hold'
export function clockOf(item: WorkItem, now: number): { state: ClockState; pct: number; remaining: number } {
  const start = ms(item.startAt), due = ms(item.dueAt)
  const pct = Math.max(0, (now - start) / Math.max(1, due - start))
  const remaining = due - now
  if (item.stage === 'Delivered') return { state: 'done', pct: 1, remaining }
  if (item.onHold) return { state: 'hold', pct, remaining }
  if (now > due) return { state: 'overdue', pct, remaining }
  if (pct >= 0.8) return { state: 'red', pct, remaining }
  if (pct >= 0.5) return { state: 'amber', pct, remaining }
  return { state: 'ok', pct, remaining }
}

export const currentVersion = (b: Bill) => getVersion(b, b.currentVersionId) ?? b.versions[0]
export const billLabel = (b: Bill) => (b.number ? currentVersion(b).label : 'Agency request (no number yet)')
export const billShort = (b: Bill) => (b.number ? b.number : 'Draft')

export function nextHearing(b: Bill, now: number): string | undefined {
  return b.hearings.filter(h => ms(h) > now - H).sort()[0]
}

// ---- roles and permissions ----
export const ROLES: Role[] = [
  'Analyst', 'Reviewer', 'Assigner', 'Manager', 'Executive Reviewer', 'Leadership',
  'Expenditure Contributor', 'Budget Office', 'Read-only', 'Administrator',
]

export type NavKey = 'dashboard' | 'queue' | 'bills' | 'fiscal' | 'estimates' | 'packages' | 'analyses' | 'executive' | 'reports' | 'implementation' | 'admin'
const ALL = ROLES
export const NAV_ACCESS: Record<NavKey, Role[]> = {
  dashboard: ALL,
  queue: ALL.filter(r => r !== 'Read-only'),
  bills: ALL,
  fiscal: ALL,
  estimates: ['Analyst', 'Reviewer', 'Assigner', 'Manager', 'Leadership', 'Budget Office', 'Administrator', 'Read-only'],
  packages: ['Analyst', 'Reviewer', 'Assigner', 'Manager', 'Executive Reviewer', 'Leadership', 'Budget Office', 'Administrator', 'Read-only'],
  analyses: ['Analyst', 'Reviewer', 'Assigner', 'Manager', 'Executive Reviewer', 'Leadership', 'Administrator', 'Read-only'],
  executive: ['Executive Reviewer', 'Leadership', 'Manager', 'Administrator'],
  reports: ['Analyst', 'Reviewer', 'Assigner', 'Manager', 'Executive Reviewer', 'Leadership', 'Budget Office', 'Administrator'],
  implementation: ['Analyst', 'Assigner', 'Manager', 'Executive Reviewer', 'Leadership', 'Administrator', 'Read-only'],
  admin: ['Administrator'],
}
export const canNav = (role: Role, k: NavKey) => NAV_ACCESS[k].includes(role)

const CONF_ROLES: Role[] = ['Manager', 'Leadership', 'Administrator', 'Assigner', 'Executive Reviewer', 'Reviewer']

export function canSeeItem(item: WorkItem, role: Role, user: Staff): boolean {
  if (role === 'Read-only') return !item.confidential && (item.stage === 'Delivered' || item.type === 'BA' && !!item.revisions?.length)
  if (role === 'Expenditure Contributor') {
    return item.type === 'FN' && !!item.fiscal && (item.fiscal.expenditure.some(s => s.assigneeId === user.id) || item.fiscal.revenueAssigneeId === user.id)
  }
  if (role === 'Budget Office' && item.confidential) return false
  if (item.confidential) return CONF_ROLES.includes(role) || item.preparerId === user.id || item.assigneeIds.includes(user.id)
  return true
}

export function visibleItems(seed: Seed, role: Role, user: Staff): WorkItem[] {
  return seed.items.filter(i => canSeeItem(i, role, user)).map(i => {
    if (role !== 'Read-only' || i.type !== 'BA') return i
    const r = i.revisions?.at(-1)
    return r ? { ...i, body: r.body, topics: r.topics, issueNotes: '', correspondence: [], comments: [], changesPending: false, stage: 'Delivered', locked: true } : { ...i, issueNotes: '', correspondence: [], comments: [], locked: true }
  })
}

export function visibleBills(seed: Seed, role: Role): Bill[] {
  return role === 'Read-only' ? seed.bills.filter(b => !b.draft) : seed.bills
}

export const canPrepare = (role: Role) => ['Analyst', 'Manager', 'Reviewer', 'Administrator', 'Expenditure Contributor', 'Budget Office'].includes(role)
export const canAssign = (role: Role) => ['Assigner', 'Manager', 'Administrator'].includes(role)
export const isStaffRole = (role: Role) => role !== 'Read-only'

export const TYPE_NAME: Record<ItemType, string> = { FN: 'Fiscal note', FE: 'Fiscal estimate', DR: 'Data request', BA: 'Bill analysis' }
export const TYPE_ROUTE: Record<ItemType, string> = { FN: '/fiscal/', FE: '/estimates/', DR: '/estimates/', BA: '/analyses/' }

export const csv = (rows: (string | number)[][]) =>
  rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')

export function download(name: string, content: string, mime = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const fiscalTotal = (item: WorkItem) =>
  item.fiscal ? item.fiscal.revenue.reduce((s, r) => s + r.values.reduce((a, b) => a + b, 0), 0) : 0
