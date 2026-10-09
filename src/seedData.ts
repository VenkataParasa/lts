import assignments from './fixtures/assignment-scenarios.json'
import { hearingSimulationRecords } from './hearingSimulation'
import fixture from './fixtures/workspace-config.json'
import type { Seed, Bill, ImportRun } from './types'
import dataset from './fixtures/wa-legislation-sample-250.json'
import { SampleLscProvider, endpointErrors } from './legislative'

// Normalize immutable source fixtures once, rather than on every reset or render.
const provider = new SampleLscProvider()
const sourceBills = new Map<string, Bill>()
const sourceRuns: ImportRun[] = []
const records: unknown[] = dataset.records
for (const [index, raw] of records.entries()) {
  try {
    const bill = provider.normalize(raw)
    const existing = sourceBills.get(bill.id)
    if (!existing || Date.parse(bill.sourceFeed!.retrievedAtUtc) > Date.parse(existing.sourceFeed!.retrievedAtUtc)) sourceBills.set(bill.id, bill)
    sourceRuns.push({ id: `seed-lsc-${index}`, at: bill.sourceFeed!.retrievedAtUtc, by: 'SampleLscProvider', source: bill.sourceFeed!.source, billId: bill.id, result: 'Imported', errors: endpointErrors(raw), raw })
  } catch (error) {
    sourceRuns.push({ id: `seed-lsc-${index}`, at: new Date().toISOString(), by: 'SampleLscProvider', source: 'LSC JSON fixture', result: 'Failed', errors: [error instanceof Error ? error.message : String(error)], raw })
  }
}

// Personas and settings remain separate from mock assignment scenarios.
export function buildSeed(): Seed {
  const now = Date.now()
  const data = { ...structuredClone(fixture), now: new Date(now).toISOString(), bills: structuredClone([...sourceBills.values()]) } as unknown as Seed
  const index = new Map(data.bills.map(b => [b.id, b]))
  data.importRuns = sourceRuns.map(run => ({ ...run, errors: [...run.errors] }))
  for (const [n, raw] of hearingSimulationRecords(now).entries()) {
    const simulated = provider.normalize(raw), bill = index.get(simulated.id)
    if (!bill) continue
    // Overlay hearings on existing supplied bills; never add fictional bills.
    bill.hearings = simulated.hearings
    bill.hearingRecords = simulated.hearingRecords
    data.importRuns.unshift({ id: `hearing-simulation-${n}`, at: data.now, by: 'Hearing simulation', source: simulated.sourceFeed!.source, billId: bill.id, result: 'Imported', errors: endpointErrors(raw), raw })
    for (const hearing of bill.hearingRecords ?? []) {
      const hours = (Date.parse(hearing.date) - now) / 3600000
      if (!hearing.cancelled && hearing.metadata.Simulation && hours > 0 && hours <= 72) data.notifications.push({ id: `hearing-alert-${hearing.id}`, at: data.now, channel: 'In-app', toRoles: ['Analyst', 'Reviewer', 'Assigner', 'Manager', 'Executive Reviewer', 'Leadership'], subject: `Hearing within 72 hours: ${bill.number}`, body: `Simulated hearing in ${hours} hours. Publication target is four hours before the hearing.`, link: `/bills/${bill.id}?tab=Hearings`, read: false, category: 'Hearings' })
    }
  }
  const biennia = [...new Set(data.bills.map(b => b.session))].sort().reverse()
  data.sessions = biennia.map((id, n) => ({ id, name: `${id} biennium`, current: n === 0, start: `${id.slice(0, 4)}-01-01`, end: `${Number(id.slice(0, 4)) + 1}-12-31`, provisioned: true }))
  data.picklists.Committees = [...new Set(data.bills.flatMap(b => (b.hearingRecords ?? []).map(h => h.committee)))].filter(Boolean).sort()
  const offset = now - Date.parse(assignments.baselineUtc)
  const rebase = (value: unknown): unknown => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(Date.parse(value) + offset).toISOString()
    if (Array.isArray(value)) return value.map(rebase)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rebase(child)]))
    return value
  }
  data.items = rebase(assignments.items) as Seed['items']
  for (const item of data.items) {
    const bill = index.get(item.billId)!
    item.id = item.id.replace('-', `-${new Date(now).getFullYear()}-`)
    item.billVersionId = bill.currentVersionId
    item.title = `${({ BA: 'Bill analysis', FN: 'Fiscal note', FE: 'Fiscal estimate', DR: 'Data request' })[item.type]}: ${bill.number} ${bill.title}`
    if (item.publishedVersion) item.revisions = [{ revision: item.publishedVersion, at: item.savedAt, by: item.preparerId, body: item.body ?? '', topics: [], issueNotes: '', billVersionId: item.billVersionId }]
    bill.tracked = true
  }
  for (const type of ['BA', 'FN', 'FE', 'DR']) data.idCounters[type] = data.items.filter(i => i.type === type).length + 1
  data.legislativeChanges = []
  return data
}
