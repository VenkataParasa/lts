import { getBill } from './retrieval'
import { billLabel, visibleBills, visibleItems, TYPE_NAME } from './lib'
import type { Seed, Role, Staff } from './types'
export interface SearchResult { id: string; kind: string; label: string; text: string; link: string; session: string; status: string; owner: string; topics: string[] }
export function searchWorkspace(data: Seed, role: Role, user: Staff, query: string): SearchResult[] {
  const items = visibleItems(data, role, user), bills = visibleBills(data, role)
  const results: SearchResult[] = []
  const add = (r: SearchResult) => { if (`${r.label} ${r.text} ${r.status} ${r.topics.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())) results.push(r) }
  bills.forEach(b => {
    const common = { session: b.session, status: b.status, owner: '', topics: b.topics }
    add({ ...common, id: b.id, kind: 'Bill', label: `${billLabel(b)}: ${b.title}`, text: `${b.sponsors.join(' ')} ${b.committee} ${b.legislation?.LongDescription ?? ''}`, link: `/bills/${b.id}` })
    b.versions.forEach(v => add({ ...common, id: v.id, kind: v.kind === 'amendment' ? 'Amendment' : 'Bill Version', label: v.label, text: v.text, link: `/compare?bill=${b.id}` }))
    b.sponsors.forEach((s, n) => add({ ...common, id: `${b.id}-s${n}`, kind: 'Sponsor', label: s, text: billLabel(b), link: `/bills/${b.id}` }))
    ;(b.hearingRecords ?? []).forEach(h => add({ ...common, id: h.id, kind: 'Hearing / Committee', label: `${h.committee}: ${billLabel(b)}`, text: h.description, link: `/bills/${b.id}?tab=Hearings` }))
  })
  items.forEach(i => {
    const b = bills.find(b => b.id === i.billId)
    if (!b) return
    const common = { session: b.session, status: i.stage, owner: i.preparerId, topics: i.topics ?? b.topics }
    const link = i.type === 'BA' ? `/analyses/${i.id}` : i.type === 'FN' ? `/fiscal/${i.id}` : `/estimates/${i.id}`
    const published = i.revisions?.at(-1)
    const text = role === 'Read-only' && i.type === 'BA' ? published?.body ?? '' : `${i.body ?? ''} ${i.question ?? ''} ${i.fiscal ? Object.values(i.fiscal.narrative).join(' ') : ''}`
    add({ ...common, id: i.id, kind: TYPE_NAME[i.type], label: `${i.id}: ${i.title}`, text, link })
    if (role !== 'Read-only') (i.correspondence ?? []).forEach(c => add({ ...common, id: c.id, kind: 'Correspondence', label: c.to, text: c.note, link }))
    ;(i.fiscal?.workPapers ?? []).forEach(d => add({ ...common, id: d.id, kind: 'Document', label: d.name, text: i.id, link }))
  })
  data.packages.filter(p => p.itemIds.every(id => items.some(i => i.id === id))).forEach(p => add({ id: p.id, kind: 'Package', label: `${p.id}: ${p.name}`, text: p.itemIds.join(' '), link: `/packages/${p.id}`, session: getBill(data, p.billId)?.session ?? '', status: p.delivered ? 'Delivered' : 'Open', owner: '', topics: [] }))
  data.implTasks.forEach(t => add({ id: t.id, kind: 'Implementation Task', label: t.title, text: `${t.owner} ${t.division}`, link: '/implementation', session: getBill(data, t.billId)?.session ?? '', status: t.done ? 'Complete' : 'Open', owner: data.staff.find(s => s.name === t.owner)?.id ?? '', topics: [] }))
  return results
}
