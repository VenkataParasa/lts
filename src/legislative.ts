import type { Bill, HearingRecord, LegislativeChange } from './types'

type Obj = Record<string, any>
const list = (v: any): Obj[] => v == null ? [] : Array.isArray(v) ? v : [v]
const date = (v: any) => typeof v === 'string' && !v.startsWith('0001-') ? v : undefined
// LSC timestamps without an offset describe Washington local time. Use Pacific DST rules.
export function legislativeDate(v: string): string {
  if (/Z$|[+-]\d\d:\d\d$/.test(v)) return v
  const d = new Date(v + 'Z'), year = d.getUTCFullYear()
  const march = new Date(Date.UTC(year, 2, 1)), november = new Date(Date.UTC(year, 10, 1))
  const start = Date.UTC(year, 2, 8 + (7 - march.getUTCDay()) % 7, 2)
  const end = Date.UTC(year, 10, 1 + (7 - november.getUTCDay()) % 7, 2)
  return v + (d.getTime() >= start && d.getTime() < end ? '-07:00' : '-08:00')
}

export interface ILegislativeDataProvider { normalize(payload: unknown): Bill }
export class SampleLscProvider implements ILegislativeDataProvider {
  normalize(payload: unknown): Bill {
    const p = payload as Obj
    if (!p || !/^\d{4}-\d{2}$/.test(p.biennium ?? '') || !Number.isInteger(p.billNumber) || typeof p.source !== 'string' || !Number.isFinite(Date.parse(p.retrievedAtUtc)) || !p.endpoints) throw new Error('Expected valid biennium, billNumber, source, retrievedAtUtc and endpoints in an LSC collector fixture.')
    const ep = p.endpoints as Obj
    const required = ep.GetLegislation
    if (!required?.ok || !required.data?.Legislation) throw new Error('GetLegislation failed or contains no legislation.')
    const rows = list(required.data.Legislation).sort((a, b) => Number(a.SubstituteVersion ?? 0) - Number(b.SubstituteVersion ?? 0) || Number(a.EngrossedVersion ?? 0) - Number(b.EngrossedVersion ?? 0))
    const l = rows[0]
    if (!l.BillId || !date(l.IntroducedDate)) throw new Error('Legislation requires BillId and a valid IntroducedDate.')
    const id = `LSC-${p.biennium}-${p.billNumber}`
    const versions = rows.map(r => ({ id: `${id}-${r.BillId.replace(/\s/g, '')}`, label: r.BillId, kind: 'version' as const, date: legislativeDate(r.IntroducedDate), text: r.LongDescription ?? r.LegalTitle ?? '', metadata: r }))
    const status = ep.GetCurrentStatus?.ok ? ep.GetCurrentStatus.data : l.CurrentStatus
    const current = versions.find(v => v.label === status?.BillId) ?? versions.find(v => v.metadata?.Active === true) ?? versions.at(-1)!
    const versionByLabel = new Map(versions.map(v => [v.label, v]))
    const sponsors = Object.values(ep.GetSponsors ?? {}).flatMap((s: any) => s.ok ? list(s.data?.Sponsor) : [])
    const unique = [...new Map(sponsors.map(s => [s.Id, s])).values()].sort((a, b) => a.Order - b.Order)
    const hearings: HearingRecord[] = (ep.GetHearings?.ok ? list(ep.GetHearings.data?.Hearing) : []).map(h => {
      const m = h.CommitteeMeeting ?? {}, c = list(m.Committees?.Committee)[0] ?? {}
      if (!date(m.Date)) throw new Error('Hearing requires a valid meeting Date.')
      return { id: `${id}-${m.AgendaId}-${h.HearingType}`, billVersionId: versionByLabel.get(h.BillId)?.id ?? current.id, committee: c.LongName ?? c.Name ?? '', chamber: m.Agency ?? '', date: legislativeDate(m.Date), cancelled: !!m.Cancelled, revisedDate: date(m.RevisedDate), type: h.HearingType ?? '', description: h.HearingTypeDescription ?? '', location: [m.Room, m.Building, m.City].filter(Boolean).join(', '), metadata: m }
    })
    const amendments = [...list(ep.GetAmendmentsForBiennium?.data?.Amendment), ...Object.values(ep.GetAmendmentsForYear ?? {}).flatMap((v: any) => list(v.data?.Amendment))]
    const amendmentKey = (a: Obj) => String(a.AmendmentId ?? a.Id ?? a.Name ?? a.PdfUrl ?? a.HtmUrl ?? `${a.BillId}-${a.Drafter}-${a.FloorNumber}`)
    const dedup = [...new Map(amendments.map(a => [amendmentKey(a), a])).values()]
    return { id, session: p.biennium, number: l.BillId, chamber: l.OriginalAgency === 'Senate' ? 'Senate' : 'House', title: l.ShortDescription ?? '', status: status?.Status ?? 'Introduced', sponsors: unique.map(s => s.LongName ?? s.Name), committee: hearings.at(-1)?.committee ?? '', topics: [], taxType: 'Not classified', hearings: hearings.filter(h => !h.cancelled).map(h => h.date), hearingRecords: hearings, versions: [...versions, ...dedup.map(a => ({ id: `${id}-A-${amendmentKey(a)}`, label: String(a.Name ?? a.AmendmentId ?? a.Id), kind: 'amendment' as const, date: date(a.FloorActionDate ?? a.Date) ? legislativeDate(a.FloorActionDate ?? a.Date) : p.retrievedAtUtc, text: a.Summary ?? a.Description ?? '', sponsor: a.SponsorName, appliesToVersionId: versionByLabel.get(a.BillId)?.id ?? current.id, metadata: a }))], currentVersionId: current.id, hasIssues: false, inBudget: false, enacted: /^C \d+ L/.test(status?.Status ?? ''), draft: false, tracked: false, sourceFeed: { source: p.source, retrievedAtUtc: p.retrievedAtUtc, url: required.request_url }, sponsorRecords: unique, legislation: { ...l, CurrentStatus: status } }
  }
}

export function endpointErrors(payload: unknown): string[] {
  const p = payload as Obj
  const visit = (v: any, path: string): string[] => {
    if (!v || typeof v !== 'object') return []
    if ('ok' in v) return v.ok ? [] : [`${path}: endpoint failed (HTTP ${v.http_status ?? 'unknown'})`]
    return Object.entries(v).flatMap(([k, child]) => visit(child, `${path}.${k}`))
  }
  return visit(p?.endpoints, 'endpoints')
}

export function detectChanges(old: Bill | undefined, next: Bill, at: string): LegislativeChange[] {
  if (!old) return []
  const changes: LegislativeChange[] = []
  const add = (type: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ id: crypto.randomUUID(), billId: next.id, type, oldValue: JSON.stringify(a) ?? '', newValue: JSON.stringify(b) ?? '', at, source: next.sourceFeed!.source, affectedItems: [], acknowledged: false }) }
  add('Bill Status Changed', old.status, next.status)
  add('Bill Description Changed', [old.title, old.legislation?.LongDescription], [next.title, next.legislation?.LongDescription])
  add('Sponsor Information Changed', old.sponsorRecords, next.sponsorRecords)
  for (const v of next.versions) if (!old.versions.some(o => o.id === v.id)) add(v.kind === 'amendment' ? 'New Amendment' : 'New Bill Version', null, v.label)
  for (const h of next.hearingRecords ?? []) {
    const prev = old.hearingRecords?.find(o => o.id === h.id)
    add(!prev ? 'Hearing Added' : !prev.cancelled && h.cancelled ? 'Hearing Canceled' : 'Hearing Changed', prev, h)
  }
  return changes
}
