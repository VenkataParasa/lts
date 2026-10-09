import { hearingSimulationRecords } from './hearingSimulation'
import { getBill } from './retrieval'
import { useMemo } from 'react'
import { create } from 'zustand'
import { buildSeed } from './seedData'
import { D, H, computeDue, iso, ms, ROLES, canSeeItem, currentVersion, visibleItems } from './lib'
import type { Bill, BillVersion, ItemType, Notification, Role, Seed, Staff, WorkItem, Comment, SavedQuery, ImplTask } from './types'
import { callAdapter, type AdapterName } from './adapters'
import { SampleLscProvider, detectChanges, endpointErrors } from './legislative'

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; msg: string }

interface Store {
  importLegislation(payload: unknown): void
  data: Seed
  role: Role
  userId: string
  now: number
  toasts: Toast[]
  guideOpen: boolean
  navCollapsed: boolean
  drawerOpen: boolean
  simCount: number
  // shell
  reset(): void
  setRole(r: Role): void
  setUser(id: string): void
  tick(): void
  toast(msg: string, kind?: Toast['kind']): void
  dismissToast(id: number): void
  setGuide(v: boolean): void
  setNavCollapsed(v: boolean): void
  setDrawer(v: boolean): void
  // helpers
  user(): Staff
  staffById(id?: string): Staff | undefined
  audit(action: string, target: string, detail: string, confidential?: boolean): void
  notify(subject: string, body: string, toRoles: Role[], link?: string, category?: string, channels?: Notification['channel'][]): void
  external(name: AdapterName, msg: string): Promise<string>
  // items
  updateItem(id: string, fn: (i: WorkItem) => WorkItem): void
  saveItem(id: string, fn: (i: WorkItem) => WorkItem, detail?: string): void
  addComment(id: string, text: string, kind?: Comment['kind'], section?: string): void
  submitForReview(id: string): void
  approve(id: string): boolean
  returnForRework(id: string, text: string): boolean
  routeFiscal(id: string, revenueAssignee: string, sections: { id: string; assigneeId: string; dueAt: string }[]): void
  deliver(id: string): Promise<void>
  deliverPackage(id: string): Promise<void>
  publish(id: string): Promise<void>
  bulkReassign(ids: string[], staffId: string): void
  toggleHold(id: string): void
  createItem(type: ItemType, billId: string, extra?: Partial<WorkItem>): WorkItem
  renameItem(oldId: string, newId: string): string | null
  markRead(id: string | 'all'): void
  simulateLegislature(): Promise<void>
  provisionSession(id: string): Promise<void>
  addQuery(q: Omit<SavedQuery, 'id' | 'by'>): void
  addImplTask(t: Omit<ImplTask, 'id'>): void
  patchTask(id: string, patch: Partial<ImplTask>): void
  flagEnacted(billId: string): void
  patchData(fn: (d: Seed) => Seed): void
}

let toastSeq = 1
let seq = Date.now() * 1000

export const personaFor = (seed: Seed, role: Role) => seed.staff.find(s => s.role === role)!

export const useStore = create<Store>((set, get) => {
  const seeded = buildSeed
  const initial = seeded()
  const startRole: Role = 'Analyst'
  return {
    data: initial, role: startRole, userId: personaFor(initial, startRole).id, now: Date.now(), toasts: [], guideOpen: true,
    navCollapsed: false, drawerOpen: false, simCount: 0,

    reset() {
      const d = seeded()
      const role = get().role
      set({ data: d, userId: personaFor(d, role).id, simCount: 0, now: Date.now() })
      get().toast('Workspace reset. Initial records reloaded.', 'success')
    },
    setRole(role) {
      set(s => ({ role, userId: personaFor(s.data, role).id, drawerOpen: false }))
      const u = get().user()
      get().toast(`Now viewing as ${role}: ${u.name}`, 'info')
    },
    setUser(id) { if (get().data.staff.some(s => s.id === id && s.role === get().role)) set({ userId: id }); else get().toast('Select a person matching the active role.', 'error') },
    tick() { set({ now: Date.now() }) },
    toast(msg, kind = 'success') {
      const id = toastSeq++
      set(s => ({ toasts: [...s.toasts, { id, kind, msg }].slice(-4) }))
    },
    dismissToast(id) { set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })) },
    setGuide(v) { set({ guideOpen: v }) },
    setNavCollapsed(v) { set({ navCollapsed: v }) },
    setDrawer(v) { set({ drawerOpen: v }) },

    user() { const s = get(); return s.data.staff.find(x => x.id === s.userId)! },
    staffById(id) { return id ? get().data.staff.find(s => s.id === id) : undefined },
    patchData(fn) { set(s => ({ data: fn(s.data) })) },

    audit(action, target, detail, confidential) {
      const { role, userId } = get()
      set(s => ({ data: { ...s.data, audit: [{ id: `A${++seq}`, at: iso(Date.now()), userId, role, action, target, detail, confidential }, ...s.data.audit] } }))
    },
    notify(subject, body, toRoles, link, category = 'Work', channels = ['In-app', 'Email', 'Teams']) {
      const at = iso(Date.now())
      const list: Notification[] = channels.filter(channel => get().data.notificationPreferences?.[`${category}|${channel}`] !== false).map(channel => ({ id: `N${++seq}`, at, channel, toRoles, subject, body, link, read: false, category }))
      set(s => ({ data: { ...s.data, notifications: [...list, ...s.data.notifications] } }))
    },
    async external(name, msg) {
      const receipt = await callAdapter(name)
      get().toast(`${name} (simulated): ${msg}`, 'success')
      return receipt
    },

    updateItem(id, fn) {
      set(s => ({ data: { ...s.data, items: s.data.items.map(i => (i.id === id ? fn(i) : i)) } }))
    },
    saveItem(id, fn, detail = 'Content edited') {
      const old = get().data.items.find(i => i.id === id)
      if (!old || old.locked || !(['Manager', 'Administrator', 'Assigner'].includes(get().role) || (['Analyst', 'Expenditure Contributor', 'Budget Office'].includes(get().role) && old.assigneeIds.includes(get().userId)))) { get().toast('You cannot edit this work product.', 'error'); return }
      get().updateItem(id, i => {
        const next = fn(i)
        if (get().role === 'Expenditure Contributor') {
          const own = i.fiscal?.expenditure.filter(s => s.assigneeId === get().userId).map(s => s.id) ?? []
          const unauthorized = !next.fiscal || JSON.stringify({ ...next, fiscal: undefined, savedAt: undefined }) !== JSON.stringify({ ...i, fiscal: undefined, savedAt: undefined }) || JSON.stringify(next.fiscal.narrative) !== JSON.stringify(i.fiscal?.narrative) || JSON.stringify(next.fiscal.revenue) !== JSON.stringify(i.fiscal?.revenue) || next.fiscal.expenditure.some(s => !own.includes(s.id) && JSON.stringify(s) !== JSON.stringify(i.fiscal?.expenditure.find(old => old.id === s.id)))
          if (unauthorized) { get().toast('Contributors can edit their assigned expenditure sections and supporting papers only.', 'error'); return i }
        }
        const substantive = ['body', 'topics', 'hasIssues', 'issueNotes'].some(k => JSON.stringify(next[k as keyof WorkItem]) !== JSON.stringify(i[k as keyof WorkItem]))
        const fiscalChanged = i.fiscal && JSON.stringify(next.fiscal) !== JSON.stringify(i.fiscal)
        return { ...next, ...(i.type === 'BA' && substantive ? { changesPending: !!i.publishedVersion, stage: 'In progress' as const, reviewApproved: false, execIndex: 0 } : {}), ...(fiscalChanged && ['Approved', 'In review', 'Executive review'].includes(i.stage) ? { stage: 'In progress' as const, reviewApproved: false, execIndex: 0 } : {}), savedAt: iso(Date.now()) }
      })
      if (old.type === 'BA') set(s => ({ data: { ...s.data, bills: s.data.bills.map(b => b.id === old.billId ? { ...b, hasIssues: s.data.items.some(i => i.billId === b.id && i.hasIssues) } : b) } }))
      const { data } = get()
      const last = data.audit[0]
      if (!(last && last.action === 'Edited' && last.target === id && last.userId === get().userId && Date.now() - ms(last.at) < 60_000)) get().audit('Edited', id, detail)
    },
    addComment(id, text, kind = 'comment', section) {
      get().updateItem(id, i => ({ ...i, comments: [...i.comments, { id: `c${++seq}`, by: get().userId, at: iso(Date.now()), text, kind, section }] }))
    },

    submitForReview(id) {
      const it = get().data.items.find(i => i.id === id)!
      if (!it || it.onHold || !['Assigned', 'In progress', 'Rework'].includes(it.stage) || !(['Manager', 'Administrator'].includes(get().role) || get().role === 'Analyst' && it.assigneeIds.includes(get().userId))) { get().toast('Submission is unavailable for your role or this workflow stage.', 'error'); return }
      if (it.type === 'BA' && (!(it.body ?? '').replace(/<[^>]*>/g, '').trim() || it.hasIssues && !it.issueNotes?.trim())) { get().toast('Add analysis content and details for any identified issues.', 'error'); return }
      get().updateItem(id, i => ({ ...i, stage: 'In review', reviewApproved: false, execIndex: 0 }))
      get().addComment(id, 'Marked done. Sent to review.', 'system')
      get().audit('Marked done', id, 'Submitted for review')
      const rev = get().staffById(it.reviewerId)
      get().notify(`${id} ready for review`, `${get().user().name} marked ${id} done and sent it to ${rev?.name ?? 'the reviewer'}.`, ['Reviewer'], `/review/${id}`, 'Review')
      get().toast(`${id} sent to ${rev?.name ?? 'reviewer'}. Notification sent.`)
    },

    approve(id) {
      const { userId, role } = get()
      const it = get().data.items.find(i => i.id === id)!
      if (it.preparerId === userId) {
        get().toast('Blocked: you prepared this work product, so you cannot approve it.', 'error')
        get().audit('Approval blocked', id, 'Preparer attempted to approve own work')
        return false
      }
      if (it.stage === 'In review') {
        if (!['Reviewer', 'Manager', 'Administrator'].includes(role) || role === 'Reviewer' && it.reviewerId !== userId) { get().toast('Only a Reviewer or Manager can approve at this stage.', 'error'); return false }
        get().addComment(id, 'Approved at review.', 'approve')
        if (it.execReview && it.execChain.length) {
          get().updateItem(id, i => ({ ...i, stage: 'Executive review', reviewApproved: true, execIndex: 0 }))
          const first = get().staffById(it.execChain[0])
          get().notify(`${id} awaiting your executive review`, `${first?.name} is first in the executive review sequence for ${id}.`, ['Executive Reviewer'], `/review/${id}`, 'Review')
          get().toast(`Approved. Executive review started; ${first?.name} notified.`)
        } else {
          get().updateItem(id, i => ({ ...i, stage: 'Approved', reviewApproved: true }))
          get().toast('Approved. All approvals complete; ready to deliver.')
        }
        get().audit('Approved', id, 'Reviewer approval')
        return true
      }
      if (it.stage === 'Executive review') {
        const current = it.execChain[it.execIndex]
        if (userId !== current) {
          get().toast(`Waiting on ${get().staffById(current)?.name ?? 'the current executive reviewer'}. Reviews are sequential.`, 'error')
          return false
        }
        get().addComment(id, 'Approved at executive review.', 'approve')
        const nextIx = it.execIndex + 1
        if (nextIx >= it.execChain.length) {
          get().updateItem(id, i => ({ ...i, stage: 'Approved', execIndex: nextIx }))
          get().notify(`${id} approved and ready to deliver`, 'All executive approvals are complete.', ['Manager', 'Assigner', 'Analyst'], `/review/${id}`, 'Review')
          get().toast('Final executive approval recorded. Item is ready to deliver.')
        } else {
          get().updateItem(id, i => ({ ...i, execIndex: nextIx }))
          const nx = get().staffById(it.execChain[nextIx])
          get().notify(`${id} awaiting your executive review`, `Previous reviewer approved. You are next for ${id}.`, ['Executive Reviewer'], `/review/${id}`, 'Review')
          get().toast(`Approved. ${nx?.name} notified as the next executive reviewer.`)
        }
        get().audit('Approved', id, `Executive approval ${nextIx} of ${it.execChain.length}`)
        return true
      }
      get().toast('This item is not waiting for an approval.', 'info')
      return false
    },

    returnForRework(id, text) {
      const { userId } = get()
      const it = get().data.items.find(i => i.id === id)!
      if (!(['Reviewer', 'Manager', 'Administrator'].includes(get().role) && it.stage === 'In review' || get().role === 'Executive Reviewer' && it.stage === 'Executive review' && it.execChain[it.execIndex] === userId)) { get().toast('You cannot return this work at this stage.', 'error'); return false }
      if (it.preparerId === userId) { get().toast('Blocked: you prepared this work product.', 'error'); return false }
      if (!text.trim()) { get().toast('Add a comment explaining what needs to change.', 'error'); return false }
      get().updateItem(id, i => ({ ...i, stage: 'Rework', reviewApproved: false, execIndex: 0 }))
      get().addComment(id, text, 'return')
      get().audit('Returned for rework', id, text.slice(0, 80))
      get().notify(`${id} returned for rework`, text, ['Analyst'], `/review/${id}`, 'Review')
      get().toast(`Returned to ${get().staffById(it.preparerId)?.name ?? 'preparer'} for rework.`)
      return true
    },

    routeFiscal(id, revenueAssignee, sections) {
      if (!['Assigner', 'Manager', 'Administrator'].includes(get().role)) { get().toast('You cannot route work.', 'error'); return }
      get().updateItem(id, i => ({
        ...i, stage: 'In progress',
        assigneeIds: [...new Set([i.preparerId, revenueAssignee, ...sections.map(s => s.assigneeId)].filter(Boolean))],
        fiscal: i.fiscal && {
          ...i.fiscal, revenueAssigneeId: revenueAssignee,
          expenditure: i.fiscal.expenditure.map(e => {
            const m = sections.find(s => s.id === e.id)
            return m ? { ...e, assigneeId: m.assigneeId, dueAt: m.dueAt, status: 'In progress' } : e
          }),
        },
      }))
      get().audit('Routed', id, 'Assigned revenue and expenditure sections')
      get().notify(`You were assigned work on ${id}`, 'Open the fiscal note to see your section and due date.', ['Analyst', 'Expenditure Contributor'], `/fiscal/${id}`, 'Assignments')
      get().toast('Routed. Assignees notified by email and Teams (simulated).')
    },

    async deliver(id) {
      const it = get().data.items.find(i => i.id === id)!
      if (!['Manager', 'Assigner', 'Administrator', 'Budget Office'].includes(get().role)) { get().toast('You are not authorized to transmit work.', 'error'); return }
      if (it.onHold) { get().toast('Release the hold before transmitting.', 'error'); return }
      if (it.type === 'BA') { await get().publish(id); return }
      if (it.execReview && it.execIndex < it.execChain.length || !it.reviewApproved) { get().toast('All review stages must be complete.', 'error'); return }
      if (it.stage !== 'Approved') { get().toast('Delivery is blocked until all approvals are complete.', 'error'); return }
      if ((it.type === 'FN' || it.type === 'FE') && (!it.fiscal?.narrative.summary.trim() || !it.fiscal.narrative.assumptions.trim())) { get().toast('Fiscal summary and assumptions are required for transmission.', 'error'); return }
      const adapter: AdapterName = it.type === 'FN' ? 'OFM Fiscal Note System' : it.type === 'FE' ? 'OFM BEARS' : 'Email'
      const receipt = await get().external(adapter, `${id} transmitted — Simulated integration`)
      get().updateItem(id, i => ({
        ...i, stage: 'Delivered', locked: true, version: i.version + 1,
        history: [...i.history, { id: `d${++seq}`, at: iso(Date.now()), by: get().userId, channel: adapter, receipt, version: i.version + 1, status: 'SENT', payload: JSON.stringify({ integration: 'Simulated integration', workProductId: i.id, billVersionId: i.billVersionId, revision: i.version + 1, fiscal: i.fiscal, response: i.body }, null, 2), demoResponse: `Successfully transmitted — Simulated integration. Receipt ${receipt}` }],
      }))
      get().audit('Transmitted', id, `Sent via ${adapter}. Receipt ${receipt}. Version locked.`)
      get().notify(`${id} delivered`, `Receipt ${receipt}. The delivered version is locked.`, ['Manager', 'Assigner', 'Budget Office', 'Analyst'], `/review/${id}`, 'Delivery')
      get().toast(`Receipt ${receipt}. Version locked and saved to history.`)
    },

    async deliverPackage(id) {
      if (!['Assigner', 'Manager', 'Administrator', 'Budget Office'].includes(get().role)) { get().toast('You cannot deliver packages.', 'error'); return }
      const pk = get().data.packages.find(p => p.id === id)!
      const its = get().data.items.filter(i => pk.itemIds.includes(i.id))
      if (!its.length || its.length !== pk.itemIds.length || its.some(i => i.stage !== 'Approved' && i.stage !== 'Delivered')) { get().toast('Every item in the package must be approved first.', 'error'); return }
      if (its.some(i => i.onHold || i.execReview && i.execIndex < i.execChain.length || i.stage !== 'Delivered' && (!i.reviewApproved || i.fiscal && (!i.fiscal.narrative.summary.trim() || !i.fiscal.narrative.assumptions.trim())))) { get().toast('Package blocked: complete required content, release holds and finish all review stages.', 'error'); return }
      for (const it of its) if (it.stage === 'Approved') await get().deliver(it.id)
      if (!get().data.items.filter(i => pk.itemIds.includes(i.id)).every(i => i.stage === 'Delivered')) return
      set(s => ({ data: { ...s.data, packages: s.data.packages.map(p => (p.id === id ? { ...p, delivered: true } : p)) } }))
      get().audit('Transmitted', id, 'Package delivered as one product')
      get().toast(`${id} delivered as one product.`)
    },

    async publish(id) {
      const it = get().data.items.find(i => i.id === id)!
      if (it.onHold) { get().toast('Release the hold before publishing.', 'error'); return }
      if (it.type !== 'BA' || !['Manager', 'Assigner', 'Administrator'].includes(get().role) || it.stage !== 'Approved' || !it.reviewApproved || it.execReview && it.execIndex < it.execChain.length) { get().toast('Publication requires approval and an authorized publishing role.', 'error'); return }
      const receipt = await get().external('SharePoint', `${id} ${it.publishedVersion ? 're-published' : 'published'}`)
      get().updateItem(id, i => ({ ...i, stage: 'Delivered', locked: false, changesPending: false, publishedVersion: (i.publishedVersion ?? 0) + 1, savedAt: iso(Date.now()), revisions: [...(i.revisions ?? []), { revision: (i.publishedVersion ?? 0) + 1, at: iso(Date.now()), by: get().userId, body: i.body ?? '', topics: [...(i.topics ?? [])], issueNotes: i.issueNotes ?? '', billVersionId: i.billVersionId }] }))
      get().audit(it.publishedVersion ? 'Re-published' : 'Published', id, `Published version ${(it.publishedVersion ?? 0) + 1} (${receipt})`)
    },

    bulkReassign(ids, staffId) {
      if (!['Assigner', 'Manager', 'Administrator'].includes(get().role)) { get().toast('You cannot reassign work.', 'error'); return }
      const who = get().staffById(staffId)!
      set(s => ({ data: { ...s.data, items: s.data.items.map(i => (ids.includes(i.id) ? { ...i, preparerId: staffId, assigneeIds: [...new Set([staffId, ...i.assigneeIds.filter(a => a !== i.preparerId)])] } : i)) } }))
      ids.forEach(id => get().audit('Reassigned', id, `Reassigned to ${who.name}`))
      get().notify('Work reassigned to you', `${ids.length} item(s) were reassigned to ${who.name}.`, ['Analyst'], '/queue', 'Assignments')
      get().toast(`${ids.length} item(s) reassigned to ${who.name}.`)
    },

    toggleHold(id) {
      const it = get().data.items.find(i => i.id === id)!
      get().updateItem(id, i => ({ ...i, onHold: !i.onHold }))
      get().audit(it.onHold ? 'Released hold' : 'Placed on hold', id, '')
      get().toast(it.onHold ? `${id} released from hold.` : `${id} placed on hold. Clock paused in views.`, 'info')
    },

    createItem(type, billId, extra = {}) {
      const d = get().data
      if (!['Analyst', 'Assigner', 'Manager', 'Administrator', 'Budget Office'].includes(get().role)) throw new Error('Your role cannot create work products.')
      const b = getBill(d, billId)!
      if (!b) throw new Error('Bill does not exist.')
      if (extra.billVersionId && !b.versions.some(v => v.id === extra.billVersionId)) throw new Error('Version must belong to the selected bill.')
      const n = (d.idCounters[type] ?? 1)
      const id = `${type}-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`
      const nowMs = Date.now()
      const hearing = b.hearings.map(ms).filter(h => h > nowMs).sort()[0]
      const due = computeDue(type, nowMs, hearing)
      const item: WorkItem = {
        billVersionId: b.currentVersionId,
        id, type, billId, title: `${{ FN: 'Fiscal note', FE: 'Fiscal estimate', DR: 'Data request', BA: 'Bill analysis' }[type]}: ${b.number ? currentVersion(b).label : 'agency request'} ${b.title}`.slice(0, 110),
        stage: 'Assigned', onHold: false, confidential: false, execReview: false, preparerId: get().userId, assigneeIds: [get().userId], startAt: iso(nowMs), dueAt: iso(due),
        customerDueAt: iso(hearing ?? due + 6 * H), priority: due - nowMs < 24 * H ? 'Urgent' : 'Normal', billChanged: false, locked: false, version: 0, execChain: [], execIndex: 0,
        reviewApproved: false, comments: [], history: [], savedAt: iso(nowMs), reviewerId: d.staff.find(s => s.role === 'Reviewer')!.id,
        ...(type === 'BA' ? { body: '<h3>What the Bill Does</h3><p></p><h3>Impact on DOR</h3><p></p><h3>Issues / Concerns</h3><p></p><h3>Bill Description</h3><p></p><h3>Recommended Position</h3><p></p><h3>External Contacts</h3><p></p><h3>Internal Collaboration Notes</h3><p></p>', topics: [...b.topics], hasIssues: false, issueNotes: '', correspondence: [] } : {}),
        ...extra,
      }
      if (type === 'FN' || type === 'FE') {
        const years = Array.from({ length: 4 }, (_, n) => new Date().getFullYear() + 1 + n)
        const zeros = () => years.map(() => 0)
        item.fiscal = {
          years, narrative: { summary: '', assumptions: '', methodology: '', prior: '' }, revenueDueAt: iso(due - 6 * H), workPapers: [],
          revenue: [{ fund: 'General Fund-State', values: zeros() }],
          expenditure: (type === 'FE' ? ['Agency administration', 'Information systems'] : ['Agency administration', 'Information systems', 'Audit and compliance', 'Legal and rulemaking']).map((name, n) => ({ id: `sec-${n + 1}`, name, dueAt: iso(due - 4 * H), status: 'Not started' as const, hours: zeros(), salary: 0, goods: 0, equipment: 0 })),
          prior: { productId: '', billLabel: '', narrative: '', revenue: [], totalFte: 0 },
        }
        Object.assign(item, extra)
      }
      set(s => ({ data: { ...s.data, items: [item, ...s.data.items], idCounters: { ...s.data.idCounters, [type]: n + 1 } } }))
      get().audit('Created', id, `${item.title}`)
      return item
    },

    renameItem(oldId, newId) {
      const d = get().data
      if (!newId.trim()) return 'Enter a new ID.'
      if (d.items.some(i => i.id === newId) || d.packages.some(p => p.id === newId)) return `ID ${newId} is already in use.`
      set(s => ({
        data: {
          ...s.data,
          items: s.data.items.map(i => (i.id === oldId ? { ...i, id: newId } : i)),
          packages: s.data.packages.map(p => ({ ...p, itemIds: p.itemIds.map(x => (x === oldId ? newId : x)) })),
          presence: Object.fromEntries(Object.entries(s.data.presence).map(([k, v]) => [k === oldId ? newId : k, v])),
        },
      }))
      get().audit('ID override', newId, `Renamed from ${oldId}`)
      return null
    },

    markRead(id) {
      set(s => ({ data: { ...s.data, notifications: s.data.notifications.map(n => (n.toRoles.includes(s.role) && (id === 'all' || n.id === id) ? { ...n, read: true } : n)) } }))
    },

    importLegislation(payload) {
      if (!['Assigner', 'Manager', 'Administrator'].includes(get().role)) { get().toast('Import requires Assignment Manager or Administrator access.', 'error'); return }
      const at = iso(Date.now()), runId = crypto.randomUUID()
      try {
        const next = new SampleLscProvider().normalize(payload)
        const old = getBill(get().data, next.id)
        const errors = endpointErrors(payload)
        if (old && errors.some(e => e.includes('GetSponsors'))) { next.sponsors = old.sponsors; next.sponsorRecords = old.sponsorRecords }
        if (old && errors.some(e => e.includes('GetHearings'))) { next.hearings = old.hearings; next.hearingRecords = old.hearingRecords; next.committee = old.committee }
        const changes = detectChanges(old, next, at).map(c => ({ ...c, affectedItems: get().data.items.filter(i => i.billId === next.id && i.stage !== 'Delivered').map(i => i.id) }))
        const merged = { ...next, tracked: old?.tracked ?? false, topics: old?.topics ?? [], hasIssues: old?.hasIssues ?? false, inBudget: old?.inBudget ?? false, versions: [...next.versions, ...(old?.versions ?? []).filter(v => !next.versions.some(n => n.id === v.id))], hearingRecords: [...(next.hearingRecords ?? []), ...(old?.hearingRecords ?? []).filter(h => !next.hearingRecords?.some(n => n.id === h.id))] }
        set(s => ({ data: { ...s.data, bills: old ? s.data.bills.map(b => b.id === next.id ? merged : b) : [merged, ...s.data.bills], sessions: s.data.sessions.some(x => x.id === next.session) ? s.data.sessions : [...s.data.sessions, { id: next.session, name: next.session, current: false, start: `${next.session.slice(0, 4)}-01-01`, end: `${Number(next.session.slice(0, 4)) + 1}-12-31`, provisioned: false }], legislativeChanges: [...changes, ...(s.data.legislativeChanges ?? [])], importRuns: [{ id: runId, at, by: s.userId, source: next.sourceFeed!.source, billId: next.id, result: 'Imported', errors, raw: payload }, ...(s.data.importRuns ?? [])], items: s.data.items.map(i => changes.some(c => c.affectedItems.includes(i.id)) ? { ...i, billChanged: true } : i) } }))
        changes.forEach(c => get().notify(`${next.number}: ${c.type}`, `${c.newValue}. Affected work: ${c.affectedItems.join(', ') || 'none'}`, ['Analyst', 'Reviewer', 'Assigner', 'Manager'], `/bills/${next.id}`, 'Legislative changes', ['In-app']))
        next.versions.filter(v => v.kind === 'amendment' && !old?.versions.some(o => o.id === v.id)).forEach(v => {
          const prior = get().data.items.find(i => i.billId === next.id && i.type === 'BA')
          const analyst = prior?.preparerId ?? get().data.staff.find(s => s.role === 'Analyst' && s.division === 'L&P')!.id
          const task = get().createItem('BA', next.id, { billVersionId: v.id, preparerId: analyst, assigneeIds: [analyst], title: `Amendment analysis: ${v.label}`, reviewerId: prior?.reviewerId })
          get().notify(`${v.label}: amendment analysis assigned`, `Applies to ${v.appliesToVersionId}. Work ${task.id} retains its own review and audit history.`, ['Analyst', 'Reviewer'], `/analyses/${task.id}`, 'Bills', ['In-app'])
        })
        get().audit('Legislative import', next.id, `${changes.length} changes detected. Raw payload retained in ${runId}.`)
        get().toast(`Imported ${next.number}; ${changes.length} changes detected.`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        set(s => ({ data: { ...s.data, importRuns: [{ id: runId, at, by: s.userId, source: 'LSC', result: 'Failed', errors: [message], raw: payload }, ...(s.data.importRuns ?? [])] } }))
        get().audit('Legislative import failed', runId, message)
        get().toast(message, 'error')
      }
    },

    async simulateLegislature() {
      const st = get()
      if (!['Analyst', 'Assigner', 'Manager', 'Administrator'].includes(st.role)) { get().toast('Switch to Analyst, Assigner, Manager or Administrator to run the simulated legislative update.', 'error'); return }
      for (const raw of hearingSimulationRecords()) get().importLegislation(raw)
      set(s => ({ simCount: s.simCount + 1 }))
      get().toast('Simulated hearings refreshed at 20, 48, 70 and 96 hours. No work assignments were created.', 'info')
    },

    async provisionSession(id) {
      await get().external('SharePoint', `Folders provisioned for session ${id}: /Bills, /Fiscal notes, /Analyses, /Correspondence`)
      set(s => ({ data: { ...s.data, sessions: s.data.sessions.map(x => (x.id === id ? { ...x, provisioned: true } : x)) } }))
      get().audit('Provisioned', `Session ${id}`, 'SharePoint folders created (simulated)')
    },
    addQuery(q) {
      set(s => ({ data: { ...s.data, savedQueries: [...s.data.savedQueries, { ...q, id: `Q${++seq}`, by: s.userId }] } }))
      get().audit('Created', 'Saved query', q.name)
      get().toast(`Query saved: ${q.name}`)
    },
    addImplTask(t) {
      set(s => ({ data: { ...s.data, implTasks: [...s.data.implTasks, { ...t, id: `IT-${++seq}` }] } }))
      get().audit('Created', 'Implementation task', t.title)
      get().toast('Implementation task assigned.')
    },
    patchTask(id, patch) {
      const task = get().data.implTasks.find(t => t.id === id)
      if (!task || !['Assigner', 'Manager', 'Administrator'].includes(get().role) && task.owner !== get().user().name) { get().toast('Only the task owner or a manager can update this task.', 'error'); return }
      set(s => ({ data: { ...s.data, implTasks: s.data.implTasks.map(t => (t.id === id ? { ...t, ...patch } : t)) } }))
      get().audit('Implementation task updated', id, JSON.stringify(patch))
    },
    flagEnacted(billId) {
      set(s => ({ data: { ...s.data, bills: s.data.bills.map(b => (b.id === billId ? { ...b, enacted: true, status: 'Signed' } : b)) } }))
      get().audit('Flagged enacted', billId, 'Added to implementation tracker')
      get().toast('Bill flagged as enacted and added to the tracker.')
    },
  }
})

export const useMe = () => useStore(s => s.data.staff.find(x => x.id === s.userId)!)
export const useVisibleItems = () => {
  const data = useStore(s => s.data), role = useStore(s => s.role), me = useMe()
  return useMemo(() => visibleItems(data, role, me), [data.items, role, me])
}
export { ROLES, D }
