import { create } from 'zustand'
import { buildSeed } from './seedData'
import { D, H, computeDue, iso, ms, ROLES, canSeeItem, currentVersion } from './lib'
import type { Bill, BillVersion, ItemType, Notification, Role, Seed, Staff, WorkItem, Comment, SavedQuery, ImplTask } from './types'
import { callAdapter, type AdapterName } from './adapters'

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; msg: string }

interface Store {
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
let seq = 1000

export const personaFor = (seed: Seed, role: Role) => seed.staff.find(s => s.role === role)!

export const useStore = create<Store>((set, get) => {
  const initial = buildSeed()
  const startRole: Role = 'Analyst'
  return {
    data: initial, role: startRole, userId: personaFor(initial, startRole).id, now: Date.now(), toasts: [], guideOpen: true,
    navCollapsed: false, drawerOpen: false, simCount: 0,

    reset() {
      const d = buildSeed()
      const role = get().role
      set({ data: d, userId: personaFor(d, role).id, simCount: 0, now: Date.now() })
      get().toast('Demo reset. Seed content reloaded.', 'success')
    },
    setRole(role) {
      set(s => ({ role, userId: personaFor(s.data, role).id, drawerOpen: false }))
      const u = get().user()
      get().toast(`Now viewing as ${role}: ${u.name}`, 'info')
    },
    setUser(id) { set({ userId: id }) },
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
      const list: Notification[] = channels.map(channel => ({ id: `N${++seq}`, at, channel, toRoles, subject, body, link, read: false, category }))
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
      get().updateItem(id, i => ({ ...fn(i), savedAt: iso(Date.now()) }))
      const { data } = get()
      const last = data.audit[0]
      if (!(last && last.action === 'Edited' && last.target === id && last.userId === get().userId && Date.now() - ms(last.at) < 60_000)) get().audit('Edited', id, detail)
    },
    addComment(id, text, kind = 'comment', section) {
      get().updateItem(id, i => ({ ...i, comments: [...i.comments, { id: `c${++seq}`, by: get().userId, at: iso(Date.now()), text, kind, section }] }))
    },

    submitForReview(id) {
      const it = get().data.items.find(i => i.id === id)!
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
        if (!['Reviewer', 'Manager', 'Administrator'].includes(role)) { get().toast('Only a Reviewer or Manager can approve at this stage.', 'error'); return false }
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
      if (it.stage !== 'Approved') { get().toast('Delivery is blocked until all approvals are complete.', 'error'); return }
      const adapter: AdapterName = it.type === 'FN' ? 'OFM Fiscal Note System' : it.type === 'FE' ? 'OFM BEARS' : it.type === 'BA' ? 'SharePoint' : 'Email'
      const receipt = await get().external(adapter, `${id} ${it.type === 'BA' ? 'published' : 'transmitted'}`)
      get().updateItem(id, i => ({
        ...i, stage: 'Delivered', locked: true, version: i.version + 1,
        history: [...i.history, { id: `d${++seq}`, at: iso(Date.now()), by: get().userId, channel: adapter, receipt, version: i.version + 1 }],
      }))
      get().audit('Transmitted', id, `Sent via ${adapter}. Receipt ${receipt}. Version locked.`)
      get().notify(`${id} delivered`, `Receipt ${receipt}. The delivered version is locked.`, ['Manager', 'Assigner', 'Budget Office', 'Analyst'], `/review/${id}`, 'Delivery')
      get().toast(`Receipt ${receipt}. Version locked and saved to history.`)
    },

    async deliverPackage(id) {
      const pk = get().data.packages.find(p => p.id === id)!
      const its = get().data.items.filter(i => pk.itemIds.includes(i.id))
      if (its.some(i => i.stage !== 'Approved' && i.stage !== 'Delivered')) { get().toast('Every item in the package must be approved first.', 'error'); return }
      for (const it of its) if (it.stage === 'Approved') await get().deliver(it.id)
      set(s => ({ data: { ...s.data, packages: s.data.packages.map(p => (p.id === id ? { ...p, delivered: true } : p)) } }))
      get().audit('Transmitted', id, 'Package delivered as one product')
      get().toast(`${id} delivered as one product.`)
    },

    async publish(id) {
      const it = get().data.items.find(i => i.id === id)!
      const receipt = await get().external('SharePoint', `${id} ${it.publishedVersion ? 're-published' : 'published'}`)
      get().updateItem(id, i => ({ ...i, publishedVersion: (i.publishedVersion ?? 0) + 1, savedAt: iso(Date.now()) }))
      get().audit(it.publishedVersion ? 'Re-published' : 'Published', id, `Published version ${(it.publishedVersion ?? 0) + 1} (${receipt})`)
    },

    bulkReassign(ids, staffId) {
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
      const b = d.bills.find(x => x.id === billId)!
      const n = (d.idCounters[type] ?? 1)
      const id = `${type}-27-${String(n).padStart(3, '0')}`
      const nowMs = Date.now()
      const hearing = b.hearings.map(ms).filter(h => h > nowMs).sort()[0]
      const due = computeDue(type, nowMs, hearing)
      const item: WorkItem = {
        id, type, billId, title: `${{ FN: 'Fiscal note', FE: 'Fiscal estimate', DR: 'Data request', BA: 'Bill analysis' }[type]}: ${b.number ? currentVersion(b).label : 'agency request'} ${b.title}`.slice(0, 110),
        stage: 'Assigned', onHold: false, confidential: false, execReview: false, preparerId: get().userId, assigneeIds: [get().userId], startAt: iso(nowMs), dueAt: iso(due),
        customerDueAt: iso(hearing ?? due + 6 * H), priority: due - nowMs < 24 * H ? 'Urgent' : 'Normal', billChanged: false, locked: false, version: 0, execChain: [], execIndex: 0,
        reviewApproved: false, comments: [], history: [], savedAt: iso(nowMs), reviewerId: d.staff.find(s => s.role === 'Reviewer')!.id,
        ...(type === 'BA' ? { body: '<h3>Summary</h3><p></p>', topics: [...b.topics], hasIssues: false, issueNotes: '', correspondence: [] } : {}),
        ...extra,
      }
      if (type === 'FN' || type === 'FE') {
        const tmpl = d.items.find(i => i.fiscal && d.bills.find(x => x.id === i.billId)?.taxType === b.taxType) ?? d.items.find(i => i.fiscal)!
        const tf = tmpl.fiscal!
        item.fiscal = {
          ...tf, narrative: { summary: '', assumptions: '', methodology: '', prior: '' }, revenueAssigneeId: undefined, revenueDueAt: iso(due - 6 * H), workPapers: [],
          revenue: tf.revenue.map(r => ({ ...r, values: r.values.map(() => 0) })),
          expenditure: (type === 'FE' ? tf.expenditure.slice(0, 2) : tf.expenditure).map(e => ({ ...e, assigneeId: undefined, status: 'Not started' as const, hours: e.hours.map(() => 0), goods: 0, equipment: 0, dueAt: iso(due - 4 * H) })),
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
      set(s => ({ data: { ...s.data, notifications: s.data.notifications.map(n => (id === 'all' || n.id === id ? { ...n, read: true } : n)) } }))
    },

    async simulateLegislature() {
      const st = get()
      const n = st.simCount
      const nowMs = Date.now()
      const numbered = st.data.bills.filter(b => b.session === '2027' && !b.draft && b.number)
      const noSoon = numbered.filter(b => !b.hearings.some(h => ms(h) > nowMs && ms(h) < nowMs + 72 * H))
      const withFn = numbered.filter(b => st.data.items.some(i => i.billId === b.id && i.type === 'FN'))
      const verBill = withFn[(n * 3 + 2) % withFn.length]
      const ampBill = numbered[(n * 5 + 7) % numbered.length]
      const hearBill = noSoon[(n * 4) % noSoon.length]
      const label = await (async () => { await callAdapter('Legislature feed'); return 'ok' })()
      void label
      const hearingAt = nowMs + 20 * H
      const newVersion = (b: Bill): BillVersion => {
        const cur = currentVersion(b)
        const chainPrefixes = b.chamber === 'House' ? ['HB', 'SHB', '2SHB', 'ESHB', 'E2SHB'] : ['SB', 'SSB', '2SSB', 'ESSB', 'E2SSB']
        const nVer = b.versions.filter(v => v.kind === 'version').length
        const num = b.number!.replace(/^[A-Z]+ /, '')
        const text = cur.text.replace(/(\d+) percent/, (_, x) => `${+x + 2} percent`).replace('January 1, 2028', 'July 1, 2028') + '\n\nSec. 6. The department may adopt emergency rules to implement this act.'
        return { id: `${b.id}-V${nVer + 1}s${n}`, label: `${chainPrefixes[Math.min(nVer, 4)]} ${num}`, kind: 'version', date: iso(nowMs), text }
      }
      const nv = newVersion(verBill)
      const amText = currentVersion(ampBill).text.replace(/\$([\d,]+)/, (_, x) => '$' + (parseInt(x.replace(/,/g, '')) * 2).toLocaleString('en-US'))
      const am: BillVersion = { id: `${ampBill.id}-A${ampBill.versions.length + 1}s${n}`, label: `Amendment ${ampBill.number!.replace(/^[A-Z]+ /, '')}-A${ampBill.versions.filter(v => v.kind === 'amendment').length + 1}`, kind: 'amendment', date: iso(nowMs), text: amText, analyzed: false, sponsor: ampBill.sponsors[0] }
      // apply bill changes
      set(s => ({
        simCount: s.simCount + 1,
        data: {
          ...s.data,
          bills: s.data.bills.map(b => {
            if (b.id === verBill.id) return { ...b, versions: [...b.versions, nv], currentVersionId: nv.id }
            if (b.id === ampBill.id) return { ...b, versions: [...b.versions, am] }
            if (b.id === hearBill.id) return { ...b, hearings: [...b.hearings, iso(hearingAt)].sort() }
            return b
          }),
          items: s.data.items.map(i => (i.billId === verBill.id && i.stage !== 'Delivered' ? { ...i, billChanged: true } : i)),
        },
      }))
      // urgent tasks for the new hearing: assign to the analysts with lowest workload
      const load = (id: string) => get().data.items.filter(i => i.preparerId === id && i.stage !== 'Delivered').length
      const sorted = [...get().data.staff.filter(s => s.role === 'Analyst')].sort((a, b) => load(a.id) - load(b.id))
      const t1 = get().createItem('BA', hearBill.id, { preparerId: sorted[0].id, assigneeIds: [sorted[0].id], priority: 'Urgent', stage: 'Assigned' })
      const t2 = get().createItem('FN', hearBill.id, { preparerId: sorted[1].id, assigneeIds: [sorted[1].id], priority: 'Urgent', stage: 'Assigned', execReview: false })
      const t3 = get().createItem('BA', ampBill.id, { preparerId: sorted[2].id, assigneeIds: [sorted[2].id], title: `Bill analysis: ${am.label} amendment`, stage: 'Assigned' })
      get().audit('Legislature update', hearBill.id, `New hearing ${new Date(hearingAt).toLocaleString()}; new version ${nv.label} on ${verBill.number}; amendment ${am.label}`)
      get().notify('Legislature update: new hearing within 72 hours', `${hearBill.number} hearing in about 20 hours. Tasks ${t1.id}, ${t2.id} created.`, ['Analyst', 'Assigner', 'Manager', 'Executive Reviewer', 'Leadership'], `/bills/${hearBill.id}`, 'Hearings')
      get().notify('Bill changed', `${nv.label} replaced the prior version of ${verBill.number}. Open work products were flagged "Bill changed".`, ['Analyst', 'Reviewer', 'Assigner', 'Manager'], `/bills/${verBill.id}`, 'Bills')
      get().notify('New amendment awaiting analysis', `${am.label} was filed. Task ${t3.id} created.`, ['Analyst', 'Assigner'], `/compare?bill=${ampBill.id}`, 'Bills')
      get().toast(`Legislature feed (simulated): ${nv.label} version, ${am.label} and a hearing for ${hearBill.number} in 20 hours. 3 tasks created.`, 'info')
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
      set(s => ({ data: { ...s.data, implTasks: s.data.implTasks.map(t => (t.id === id ? { ...t, ...patch } : t)) } }))
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
  return data.items.filter(i => canSeeItem(i, role, me))
}
export { ROLES, D }
