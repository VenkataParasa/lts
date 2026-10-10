import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { stripTypeScriptTypes } from 'node:module'

// Strip domain TypeScript using Node's built-in loader; type-check separately with npm run build.
const out = resolve('.tools/test-build')
await mkdir(`${out}/fixtures`, { recursive: true })
for (const name of ['types', 'lib', 'seedData', 'adapters', 'legislative', 'store', 'search', 'fiscalCalculations', 'retrieval', 'hearingSimulation']) {
  const source = await readFile(`src/${name}.ts`, 'utf8')
  let js = stripTypeScriptTypes(source)
  js = js.replace(/from '(\.\/[\w/]+)'/g, "from '$1.js'").replace(/(\.\/fixtures\/[\w-]+)\.json/g, "$1.js")
  await writeFile(`${out}/${name}.js`, js)
}
for (const name of await readdir('src/fixtures')) {
  if (!name.endsWith('.json')) continue
  const raw = await readFile(`src/fixtures/${name}`, 'utf8')
  await writeFile(`${out}/fixtures/${name.replace('.json', '.js')}`, `export default ${raw}`)
}
const fixture = JSON.parse(await readFile('src/fixtures/hb1001.json', 'utf8'))
await writeFile(`${out}/fixtures/hb1001.js`, `export default ${JSON.stringify(fixture)}`)
const { useStore } = await import(pathToFileURL(`${out}/store.js`))
const { SampleLscProvider, detectChanges, legislativeDate } = await import(pathToFileURL(`${out}/legislative.js`))
const { computeDue, H, canSeeItem } = await import(pathToFileURL(`${out}/lib.js`))
const { calcSection } = await import(pathToFileURL(`${out}/fiscalCalculations.js`))
const { searchWorkspace } = await import(pathToFileURL(`${out}/search.js`))
const st = () => useStore.getState(), item = id => st().data.items.find(i => i.id === id)
let count = 0
async function test(name, run) { await run(); console.log(`PASS ${name}`); count++ }

await test('Sample JSON normalizes HB 1001, 13 sponsors, six hearings, enacted status and source fields', () => {
  const b = new SampleLscProvider().normalize(fixture)
  assert.equal(b.number, 'HB 1001'); assert.equal(b.session, '2021-22'); assert.equal(b.status, 'C 52 L 21')
  assert.equal(b.sponsors.length, 13); assert.equal(b.sponsors[0], 'Representative Maycumber')
  assert.equal(b.hearingRecords.length, 6); assert.equal(b.hearingRecords[0].revisedDate, undefined)
  assert.equal(b.hearingRecords[2].committee, 'Senate Law & Justice'); assert.equal(b.enacted, true)
  assert.equal(b.legislation.PrimeSponsorID, 14115)
})
await test('Singleton sponsors/hearings and null optional endpoints are accepted', () => {
  const p = structuredClone(fixture)
  p.endpoints.GetSponsors['HB 1001'].data.Sponsor = p.endpoints.GetSponsors['HB 1001'].data.Sponsor[0]
  p.endpoints.GetHearings.data.Hearing = p.endpoints.GetHearings.data.Hearing[0]
  const b = new SampleLscProvider().normalize(p); assert.equal(b.sponsors.length, 1); assert.equal(b.hearings.length, 1)
  p.endpoints.GetLegislation.ok = false; assert.throws(() => new SampleLscProvider().normalize(p))
})
await test('Import is idempotent and detects changed, canceled, added hearings and status changes', () => {
  const provider = new SampleLscProvider(), a = provider.normalize(fixture)
  assert.equal(detectChanges(a, provider.normalize(fixture), 'now').length, 0)
  const p = structuredClone(fixture); p.endpoints.GetCurrentStatus.data.Status = 'Changed'
  p.endpoints.GetHearings.data.Hearing[0].CommitteeMeeting.Cancelled = true
  const b = provider.normalize(p), changes = detectChanges(a, b, 'now')
  assert(changes.some(c => c.type === 'Hearing Canceled')); assert(changes.some(c => c.type === 'Bill Status Changed'))
  assert.equal(b.hearings.length, 5)
})
await test('Pacific hearing times handle winter/summer and publication deadline is four hours before hearing', () => {
  assert.equal(legislativeDate('2021-01-19T15:30:00'), '2021-01-19T15:30:00-08:00')
  assert.equal(legislativeDate('2021-03-16T16:00:00'), '2021-03-16T16:00:00-07:00')
  assert.equal(computeDue('BA', 100, 100 + 20 * H), 100 + 16 * H)
  assert.equal(computeDue('FN', 100), 100 + 72 * H)
})
let id, billId
await test('Tracking assignment creation retains version and participants with an audit entry', () => {
  st().reset(); st().setRole('Assigner'); st().importLegislation(fixture); const b = st().data.bills.find(b => b.id === 'LSC-2021-22-1001'); billId = b.id
  const preparer = st().data.staff.find(s => s.role === 'Analyst'), reviewer = st().data.staff.find(s => s.role === 'Reviewer')
  const i = st().createItem('BA', b.id, { preparerId: preparer.id, assigneeIds: [preparer.id], reviewerId: reviewer.id }); id = i.id
  assert.equal(i.billVersionId, b.currentVersionId); assert(st().data.audit.some(a => a.target === id && a.action === 'Created'))
})
await test('Read-only cannot create, submit, edit or publish an unapproved analysis', async () => {
  st().setRole('Read-only'); assert.throws(() => st().createItem('BA', billId))
  st().saveItem(id, i => ({ ...i, body: 'unauthorized' })); assert.notEqual(item(id).body, 'unauthorized')
  st().submitForReview(id); assert.equal(item(id).stage, 'Assigned')
  await st().publish(id); assert.equal(item(id).publishedVersion, undefined)
})
await test('Analysis submission requires issue details; assigned reviewer can return for rework', () => {
  st().setRole('Analyst'); st().setUser(item(id).preparerId)
  st().saveItem(id, i => ({ ...i, body: '<p>Analysis of grant program.</p>', hasIssues: true }))
  st().submitForReview(id); assert.equal(item(id).stage, 'In progress')
  st().saveItem(id, i => ({ ...i, issueNotes: 'Administrative costs need clarification.' })); st().submitForReview(id)
  assert.equal(item(id).stage, 'In review'); st().setRole('Reviewer'); st().setUser(item(id).reviewerId)
  assert.equal(st().returnForRework(id, ''), false); assert.equal(st().returnForRework(id, 'Clarify costs'), true)
  assert.equal(item(id).stage, 'Rework')
})
await test('Review approval and publication create an immutable published revision', async () => {
  st().setRole('Analyst'); st().setUser(item(id).preparerId); st().submitForReview(id)
  st().setRole('Reviewer'); st().setUser(item(id).reviewerId); assert.equal(st().approve(id), true)
  st().setRole('Manager'); await st().publish(id)
  assert.equal(item(id).stage, 'Delivered'); assert.equal(item(id).revisions.length, 1)
})
await test('Published edits require fresh review and republish; prior revision remains unchanged', async () => {
  const publishedBody = item(id).revisions[0].body
  st().setRole('Analyst'); st().setUser(item(id).preparerId)
  st().saveItem(id, i => ({ ...i, body: '<p>Updated analysis.</p>' }))
  assert.equal(item(id).changesPending, true); assert.equal(item(id).reviewApproved, false)
  assert.equal(item(id).revisions[0].body, publishedBody)
  st().setRole('Manager'); await st().publish(id); assert.equal(item(id).publishedVersion, 1)
  st().setRole('Analyst'); st().setUser(item(id).preparerId); st().submitForReview(id)
  st().setRole('Reviewer'); st().setUser(item(id).reviewerId); st().approve(id)
  st().setRole('Manager'); await st().publish(id)
  assert.equal(item(id).publishedVersion, 2); assert.equal(item(id).changesPending, false)
})
await test('Version-specific analysis copy does not mutate old analysis', () => {
  const oldBody = item(id).body; const bill = st().data.bills.find(b => b.id === billId)
  const version = { ...bill.versions[0], id: `${bill.id}-SHB`, label: 'SHB 1001' }
  st().patchData(d => ({ ...d, bills: d.bills.map(b => b.id === billId ? { ...b, versions: [...b.versions, version] } : b) }))
  const copy = st().createItem('BA', billId, { billVersionId: version.id, body: oldBody, provenance: `Started from ${id}` })
  assert.notEqual(copy.billVersionId, item(id).billVersionId); assert.equal(item(id).body, oldBody)
  assert.throws(() => st().createItem('BA', billId, { billVersionId: 'foreign-version' }))
})
await test('Later LSC import flags active work and generates notifications without overwriting analysis', () => {
  const p = structuredClone(fixture), before = item(id).body
  p.endpoints.GetHearings.data.Hearing[0].CommitteeMeeting.Date = new Date(Date.now() + 20 * H).toISOString()
  st().importLegislation(p)
  assert(st().data.legislativeChanges.some(c => c.type === 'Hearing Changed'))
  assert(st().data.notifications.some(n => n.subject.includes('Hearing Changed')))
  assert.equal(item(id).body, before); assert.equal(st().data.importRuns[0].result, 'Imported')
  st().importLegislation({ invalid: true }); assert.equal(st().data.importRuns[0].result, 'Failed')
})
await test('Fiscal calculation preserves per-year FTE and first-year one-time costs', () => {
  const rows = calcSection({ hours: [2088, 1044], salary: 100000, goods: 100, equipment: 200 }, { hoursPerFte: 2088, benefitsRate: .32, goodsPerFte: 9200, equipmentPerFte: 4300 })
  assert.equal(rows[0].fte, 1); assert.equal(rows[0].total, 145800); assert.equal(rows[1].total, 72750)
})
await test('Executive review is sequential and blocks preparer self-approval', () => {
  st().setRole('Manager'); const chain = st().data.staff.filter(s => s.role === 'Executive Reviewer').map(s => s.id)
  const i = st().createItem('FN', billId, { stage: 'In review', execReview: true, execChain: chain, preparerId: st().data.staff.find(s => s.role === 'Analyst').id }); id = i.id
  assert.equal(st().approve(id), true); assert.equal(item(id).stage, 'Executive review')
  st().setRole('Executive Reviewer'); st().setUser(chain[1]); assert.equal(st().approve(id), false)
  chain.forEach(user => { st().setUser(user); assert.equal(st().approve(id), true) })
  assert.equal(item(id).stage, 'Approved')
})
await test('OFM requires complete content and approvals, stores payload/receipt and locks delivery', async () => {
  st().setRole('Manager'); await st().deliver(id); assert.equal(item(id).stage, 'Approved')
  st().saveItem(id, i => ({ ...i, fiscal: { ...i.fiscal, narrative: { ...i.fiscal.narrative, summary: 'Program costs', assumptions: '1000 participants' } } }))
  assert.equal(item(id).reviewApproved, false); assert.equal(item(id).stage, 'In progress')
  st().submitForReview(id); st().setRole('Reviewer'); st().setUser(item(id).reviewerId); st().approve(id)
  st().setRole('Executive Reviewer'); item(id).execChain.forEach(user => { st().setUser(user); st().approve(id) })
  st().setRole('Manager')
  await st().deliver(id); assert.equal(item(id).stage, 'Delivered'); assert.equal(item(id).locked, true)
  assert.equal(item(id).history.at(-1).status, 'SENT'); assert(item(id).history.at(-1).payload.includes('Simulated integration'))
  st().saveItem(id, i => ({ ...i, title: 'Illegal edit' })); assert.notEqual(item(id).title, 'Illegal edit')
})
await test('Incomplete packages cannot be marked delivered', async () => {
  const p = { id: 'TEST-PKG', name: 'Test', billId, itemIds: ['missing-item'], dueAt: new Date().toISOString(), delivered: false }
  st().patchData(d => ({ ...d, packages: [...d.packages, p] })); await st().deliverPackage(p.id)
  assert.equal(st().data.packages.find(x => x.id === p.id).delivered, false)
})
await test('Search includes sponsors and historical bills; confidential work is excluded from viewer results', () => {
  st().setRole('Manager'); st().createItem('BA', billId, { confidential: true })
  st().setRole('Read-only')
  assert(searchWorkspace(st().data, st().role, st().user(), 'Maycumber').some(r => r.kind === 'Sponsor'))
  const secret = st().data.items.find(i => i.confidential)
  assert(!searchWorkspace(st().data, st().role, st().user(), secret.id).some(r => r.id === secret.id))
  assert.equal(canSeeItem(secret, st().role, st().user()), false)
})
await test('Failed optional source endpoints preserve existing sponsors and hearings and retain errors', () => {
  st().setRole('Administrator')
  const before = st().data.bills.find(b => b.id === billId)
  const p = structuredClone(fixture)
  p.endpoints.GetHearings.ok = false; p.endpoints.GetSponsors['HB 1001'].ok = false
  st().importLegislation(p)
  const after = st().data.bills.find(b => b.id === billId)
  assert.deepEqual(after.hearings, before.hearings); assert.deepEqual(after.sponsors, before.sponsors)
  assert.equal(st().data.importRuns[0].errors.length, 2)
})
await test('All 250 additional source records load across three biennia with unique version/amendment IDs', () => {
  st().reset()
  const bills = st().data.bills.filter(b => b.sourceFeed)
  assert.equal(bills.length, 250)
  assert.equal(st().data.importRuns.filter(r => r.result === 'Failed').length, 0)
  assert.equal(bills.filter(b => b.session === '2025-26').length, 150)
  assert.equal(bills.filter(b => b.session === '2023-24').length, 50)
  assert.equal(bills.filter(b => b.session === '2021-22').length, 50)
  for (const b of bills) {
    assert.equal(new Set(b.versions.map(v => v.id)).size, b.versions.length)
    for (const amendment of b.versions.filter(v => v.kind === 'amendment')) {
      assert.notEqual(amendment.label, 'undefined')
      assert(b.versions.some(v => v.id === amendment.appliesToVersionId))
    }
  }
  const first = bills.find(b => b.id === 'LSC-2025-26-1960')
  assert.equal(first.versions.find(v => v.id === first.currentVersionId).label, 'E3SHB 1960')
  assert(first.versions.filter(v => v.kind === 'amendment').length > 1)
})
await test('Reset isolates edits and preserves authentic source dates; lookup indexes invalidate on array replacement', async () => {
  const { getBill, getVersion } = await import(pathToFileURL(`${out}/retrieval.js`))
  const before = getBill(st().data, 'LSC-2025-26-1960')
  const sourceDate = before.versions[0].date
  assert.equal(getVersion(before, before.currentVersionId).label, 'E3SHB 1960')
  st().patchData(d => ({ ...d, bills: d.bills.map(b => b.id === before.id ? { ...b, title: 'Session-only edit' } : b) }))
  assert.equal(getBill(st().data, before.id).title, 'Session-only edit')
  st().reset()
  assert.notEqual(getBill(st().data, before.id).title, 'Session-only edit')
  assert.equal(getBill(st().data, before.id).versions[0].date, sourceDate)
})
await test('Only official bills seed the workspace and every workflow relationship resolves', () => {
  st().reset(); const d = st().data, bills = new Map(d.bills.map(b => [b.id, b]))
  assert(d.items.length > 0); assert.equal(d.packages.length, 0); assert.equal(d.implTasks.length, 0);
  assert.equal(d.bills.length, 250); assert(d.bills.every(b => b.sourceFeed && b.id.startsWith('LSC-')))
  assert.equal(d.sessions.find(s => s.current).id, '2025-26')
  for (const i of d.items) {
    const b = bills.get(i.billId); assert(b); assert(b.versions.some(v => v.id === i.billVersionId))
    assert(i.title.includes(b.title)); assert(i.provenance.startsWith('Mock '))
  }
  for (const p of d.packages) { assert(bills.has(p.billId)); assert(p.itemIds.every(id => d.items.some(i => i.id === id && i.billId === p.billId))) }
  assert(d.implTasks.every(t => bills.get(t.billId)?.enacted))
  assert(d.savedQueries.every(q => q.sessions.every(id => d.sessions.some(s => s.id === id))))
})
await test('Legislature simulation works with official biennia and preserves source fixture on reset', async () => {
  st().reset(); st().setRole('Assigner'); const initial = st().data.items.length
  await st().simulateLegislature(); assert.equal(st().data.items.length, initial)
  assert(st().data.bills.some(b => b.hearingRecords.some(h => h.metadata.Simulation && Date.parse(h.date) > Date.now())))
  st().reset(); assert.equal(st().data.items.length, initial)
})
await test('Collector-shaped hearing scenarios trigger only the 72-hour window and preserve history', () => {
  st().reset(); const d = st().data, now = Date.parse(d.now)
  const simulated = d.bills.flatMap(b => b.hearingRecords.filter(h => h.metadata.Simulation))
  assert.deepEqual(simulated.map(h => (Date.parse(h.date) - now) / H), [20, 48, 70, 96])
  assert.equal(d.notifications.filter(n => n.category === 'Hearings').length, 3)
  assert.equal(d.importRuns.filter(r => r.source.includes('simulation')).length, 4)
  const bill = d.bills.find(b => b.id === 'LSC-2025-26-1960')
  assert(bill.hearingRecords.some(h => !h.metadata.Simulation && Date.parse(h.date) < now))
  st().setRole('Assigner'); const i = st().createItem('BA', bill.id)
  assert(Math.abs(Date.parse(i.dueAt) - (now + 16 * H)) < 1000)
  assert(!i.id.includes('DEMO'))
})
await test('Every login persona has appropriate mock work and item IDs remain unique after creation', () => {
  st().reset(); const d = st().data
  for (const person of d.staff) {
    const visible = d.items.filter(i => canSeeItem(i, person.role, person))
    assert(visible.some(i => i.assigneeIds.includes(person.id)))
    if (person.role === 'Reviewer') assert(visible.some(i => i.stage === 'In review' && i.reviewerId === person.id))
    if (person.role === 'Executive Reviewer') assert(visible.some(i => i.stage === 'Executive review' && i.execChain[0] === person.id))
  }
  st().setRole('Assigner'); st().createItem('BA', d.bills[0].id); st().createItem('FN', d.bills[0].id)
  assert.equal(new Set(st().data.items.map(i => i.id)).size, st().data.items.length)
})
await test('Fiscal-note graph has at least two linked records per stage with valid approvals and delivery states', () => {
  st().reset(); const d = st().data
  for (const stage of ['Assigned', 'In progress', 'In review', 'Rework', 'Executive review', 'Approved', 'Delivered']) {
    const notes = d.items.filter(i => i.type === 'FN' && i.stage === stage)
    assert(notes.length >= 2)
    for (const note of notes) {
      assert(d.bills.some(b => b.id === note.billId))
      if (stage === 'Executive review') { assert(note.reviewApproved); assert(note.execChain.length > note.execIndex) }
      if (stage === 'Approved' || stage === 'Delivered') { assert(note.reviewApproved); assert.equal(note.execIndex, note.execChain.length) }
      if (stage === 'Delivered') { assert(note.locked); assert.equal(note.history.at(-1).status, 'SENT') }
    }
  }
})
console.log(`\n${count} domain and workflow journey tests passed.`)
