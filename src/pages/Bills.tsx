import { getBill, groupWorkByBill } from '../retrieval'
import { useMemo, useState } from 'react'
import { useStore, useMe, useVisibleItems } from '../store'
import { A, Button, Card, Chip, DataTable, EmptyState, Field, HearingBadge, LinkButton, PageHeader, StageChip, ClockChip, Select, Skeleton, Tabs, useLoading, inputCls, Icon, openItem, Avatar } from '../components/ui'
import { billLabel, currentVersion, fmtDate, fmtDateTime, nextHearing, ms, visibleBills, TYPE_NAME } from '../lib'
import { useRoute, go } from '../router'
import type { Bill } from '../types'
import StartTracking from './StartTracking'
import BillSummary from './BillSummary'

export function BillsList() {
  const loading = useLoading(300)
  const { data, role, now, patchData, audit } = useStore()
  const route = useRoute()
  const [f, setF] = useState({ q: '', session: 'All', chamber: 'All', committee: 'All', topic: 'All', tax: 'All', hearing: route.q.get('hearing') ?? 'Any', fn: false, issues: false, budget: false, status: 'All', sponsor: 'All', tracked: 'All', analyst: 'All', analysisStatus: 'All', fiscalRequired: false })
  const [filterName, setFilterName] = useState('')
  const items = useVisibleItems()
  const workByBill = useMemo(() => groupWorkByBill(items), [items])
  const billWork = (id: string) => workByBill.get(id) ?? []
  const rows = useMemo(() => visibleBills(data, role).filter(b => {
    const t = f.q.trim().toLowerCase()
    const nh = nextHearing(b, now)
    const hw = f.hearing === 'Any' ? true : !!nh && ms(nh) > now && ms(nh) - now < Number(f.hearing) * 3600_000
    return (f.session === 'All' || b.session === f.session) && (f.chamber === 'All' || b.chamber === f.chamber) && (f.committee === 'All' || b.committee === f.committee)
      && (f.topic === 'All' || b.topics.includes(f.topic)) && (f.tax === 'All' || b.taxType === f.tax) && hw
      && (!t || `${b.number ?? ''} ${b.title} ${billLabel(b)} ${b.status} ${b.sponsors.join(' ')} ${b.topics.join(' ')}`.toLowerCase().includes(t))
      && (!f.fn || billWork(b.id).some(i => i.type === 'FN')) && (!f.issues || b.hasIssues) && (!f.budget || b.inBudget)
      && (f.status === 'All' || b.status === f.status) && (f.sponsor === 'All' || b.sponsors.includes(f.sponsor))
      && (f.tracked === 'All' || !!(b.tracked || billWork(b.id).length > 0) === (f.tracked === 'Tracked'))
      && (f.analyst === 'All' || billWork(b.id).some(i => i.preparerId === f.analyst))
      && (f.analysisStatus === 'All' || billWork(b.id).some(i => i.type === 'BA' && i.stage === f.analysisStatus))
      && (!f.fiscalRequired || b.legislation?.StateFiscalNote === true)
  }).sort((a, b) => (nextHearing(a, now) ?? '9').localeCompare(nextHearing(b, now) ?? '9')), [data, role, f, now, items])
  if (loading) return <><PageHeader title="Bills" /><Skeleton rows={8} /></>
  const opt = (label: string, list: string[]) => [{ value: 'All', label }, ...list.map(x => ({ value: x, label: x }))]
  return (
    <>
      <PageHeader title="Bills" subtitle="Search and filter bills tracked by the department." />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search number or title" htmlFor="bq"><input id="bq" className={inputCls} value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="For example: capital gains" /></Field>
          <Field label="Biennium" htmlFor="bs"><Select id="bs" value={f.session} onChange={v => setF({ ...f, session: v })} options={opt('All biennia', [...new Set(data.bills.map(b => b.session))].sort().reverse())} /></Field>
          <Field label="Chamber" htmlFor="bc"><Select id="bc" value={f.chamber} onChange={v => setF({ ...f, chamber: v })} options={opt('Both chambers', ['House', 'Senate'])} /></Field>
          <Field label="Committee" htmlFor="bm"><Select id="bm" value={f.committee} onChange={v => setF({ ...f, committee: v })} options={opt('All committees', data.picklists.Committees)} /></Field>
          <Field label="Topic" htmlFor="bt"><Select id="bt" value={f.topic} onChange={v => setF({ ...f, topic: v })} options={opt('All topics', data.picklists.Topics)} /></Field>
          <Field label="Tax type" htmlFor="bx"><Select id="bx" value={f.tax} onChange={v => setF({ ...f, tax: v })} options={opt('All tax types', data.picklists['Tax types'])} /></Field>
          <Field label="Status" htmlFor="bstatus"><Select id="bstatus" value={f.status} onChange={v => setF({ ...f, status: v })} options={opt('All statuses', [...new Set(data.bills.map(b => b.status))])} /></Field>
          <Field label="Sponsor" htmlFor="bsponsor"><Select id="bsponsor" value={f.sponsor} onChange={v => setF({ ...f, sponsor: v })} options={opt('All sponsors', [...new Set(data.bills.flatMap(b => b.sponsors))])} /></Field>
          <Field label="Tracking" htmlFor="btracked"><Select id="btracked" value={f.tracked} onChange={v => setF({ ...f, tracked: v })} options={['All', 'Tracked', 'Not tracked']} /></Field>
          <Field label="Assigned analyst" htmlFor="banalyst"><Select id="banalyst" value={f.analyst} onChange={v => setF({ ...f, analyst: v })} options={[{ value: 'All', label: 'All analysts' }, ...data.staff.filter(s => s.role === 'Analyst').map(s => ({ value: s.id, label: s.name }))]} /></Field>
          <Field label="Analysis status" htmlFor="banalysis"><Select id="banalysis" value={f.analysisStatus} onChange={v => setF({ ...f, analysisStatus: v })} options={['All', 'Assigned', 'In progress', 'In review', 'Rework', 'Executive review', 'Approved', 'Delivered']} /></Field>
          <Field label="Hearing date" htmlFor="bh"><Select id="bh" value={f.hearing} onChange={v => setF({ ...f, hearing: v })} options={[{ value: 'Any', label: 'Any time' }, { value: '24', label: 'Within 24 hours' }, { value: '72', label: 'Within 72 hours' }, { value: '240', label: 'Within 10 days' }]} /></Field>
          <div className="flex flex-wrap items-end gap-x-4">
            {([['fn', 'Has fiscal note'], ['issues', 'Has issues flag'], ['budget', 'In DOR budget'], ['fiscalRequired', 'State fiscal note required']] as const).map(([k, l]) => (
              <label key={k} className="flex min-h-[40px] items-center gap-2 text-[15px]"><input type="checkbox" className="h-5 w-5" checked={f[k]} onChange={e => setF({ ...f, [k]: e.target.checked })} />{l}</label>
            ))}
          </div>
        </div>
      </Card>
      <Card className="mb-4"><div className="flex flex-wrap gap-3 items-end"><Field label="Saved bill filter" htmlFor="bill-filter"><Select id="bill-filter" value="" onChange={v => { const saved = data.savedViews.find(x => x.id === v); if (saved?.filter.billFilter) setF(JSON.parse(saved.filter.billFilter)) }} options={[{ value: '', label: 'Load saved filter' }, ...data.savedViews.filter(v => v.filter.billFilter).map(v => ({ value: v.id, label: v.name }))]} /></Field><Field label="Filter name" htmlFor="bill-filter-name"><input id="bill-filter-name" className={inputCls} value={filterName} onChange={e => setFilterName(e.target.value)} /></Field><Button disabled={!filterName.trim()} onClick={() => { patchData(d => ({ ...d, savedViews: [...d.savedViews, { id: crypto.randomUUID(), name: filterName, filter: { billFilter: JSON.stringify(f) } }] })); audit('Bill filter saved', filterName, JSON.stringify(f)); setFilterName('') }}>Save filter</Button></div></Card>
      <p className="mb-2 text-sm text-muted" aria-live="polite">{rows.length} bills</p>
      <Card pad={false}>
        <DataTable caption="Bills" pageSize={25} rows={rows} rowKey={b => b.id} onRow={b => go(`/bills/${b.id}`)}
          cols={[
            { key: 'n', header: 'Bill', sort: b => b.number ?? 'ZZ', render: b => <A to={`/bills/${b.id}`} className="font-semibold">{billLabel(b)}</A> },
            { key: 't', header: 'Title', render: b => <span>{b.title}{b.draft && <> <Chip tone="info" icon="edit">Agency request</Chip></>}</span> },
            { key: 's', header: 'Biennium', render: b => b.session, className: 'hidden md:table-cell' },
            { key: 'c', header: 'Committee', render: b => b.committee, className: 'hidden lg:table-cell' },
            { key: 'st', header: 'Status', render: b => <Chip>{b.status}</Chip>, className: 'hidden md:table-cell' },
            { key: 'sponsor', header: 'Primary sponsor', render: b => b.sponsors[0], className: 'hidden xl:table-cell' },
            { key: 'tracked', header: 'Tracked', render: b => b.tracked || billWork(b.id).length > 0 ? 'Yes' : 'No' },
            { key: 'analysis', header: 'Analysis status', render: b => billWork(b.id).filter(i => i.type === 'BA').map(i => <StageChip key={i.id} item={i} />), className: 'hidden xl:table-cell' },
            { key: 'updated', header: 'Legislative update', render: b => b.sourceFeed ? fmtDateTime(b.sourceFeed.retrievedAtUtc) : 'No source timestamp', className: 'hidden xl:table-cell' },
            { key: 'fl', header: 'Flags', render: b => <span className="flex flex-wrap gap-1">{b.hasIssues && <Chip tone="warn" icon="flag">Issues</Chip>}{b.inBudget && <Chip tone="info" icon="star">In budget</Chip>}{billWork(b.id).some(i => i.type === 'FN') && <Chip icon="calc">Fiscal note</Chip>}</span>, className: 'hidden xl:table-cell' },
            { key: 'h', header: 'Next hearing', sort: b => nextHearing(b, now) ?? '9', render: b => { const h = nextHearing(b, now); return h ? <div><div className="tnum text-sm">{fmtDateTime(h)}</div><HearingBadge at={h} /></div> : <span className="text-muted">None scheduled</span> } },
          ]} />
      </Card>
    </>
  )
}

function lineage(b: Bill, all: Bill[]): Bill[] {
  const chain: Bill[] = [b]
  let cur = b
  while (cur.priorBillId) { const p = all.find(x => x.id === cur.priorBillId); if (!p) break; chain.unshift(p); cur = p }
  return chain
}

export function Bill360({ id, tab }: { id: string; tab: string }) {
  const { data, now, role, audit } = useStore()
  const items = useVisibleItems()
  const bill = getBill(data, id)
  const [note, setNote] = useState('')
  const [tracking, setTracking] = useState(false)
  const loading = useLoading(250)
  if (!bill || (role === 'Read-only' && bill.draft)) return <EmptyState title="Bill not found" text="This bill does not exist or is not available to your role." action={<LinkButton to="/bills">Back to bills</LinkButton>} />
  if (loading) return <Skeleton rows={9} />
  const cv = currentVersion(bill)
  const nh = nextHearing(bill, now)
  const work = items.filter(i => i.billId === bill.id)
  const chain = lineage(bill, data.bills)
  const TABS = ['Summary', 'Hearings', 'Versions & Amendments', 'Analyses', 'Fiscal Work', 'Correspondence', 'Documents', 'Discussion', 'History'].filter(t => role !== 'Read-only' || !['Discussion', 'Correspondence'].includes(t))
  const corr = work.filter(i => i.type === 'BA').flatMap(i => (i.correspondence ?? []).map(c => ({ ...c, item: i.id })))
  const versions = bill.versions
  const compareLink = `/compare?bill=${bill.id}`
  return (
    <>
      <PageHeader crumbs={[{ label: 'Bills', to: '/bills' }, { label: billLabel(bill) }]}
        title={<>{billLabel(bill)} <span className="text-lg font-normal text-muted">{bill.session} biennium</span></>}
        subtitle={bill.title}
        actions={<>{['Assigner', 'Manager', 'Administrator'].includes(role) && <Button onClick={() => setTracking(true)}>{bill.tracked ? 'Add work assignment' : 'Start Tracking'}</Button>}<LinkButton to={compareLink} variant="secondary" icon="compare">Compare versions</LinkButton></>} />
      <Card className="mb-4">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-sm text-muted">Current version</dt><dd className="font-semibold">{cv.label}</dd></div>
          <div><dt className="text-sm text-muted">Status</dt><dd><Chip>{bill.status}</Chip> {bill.hasIssues && <Chip tone="warn" icon="flag">Has issues</Chip>}</dd></div>
          <div><dt className="text-sm text-muted">Sponsors</dt><dd>{bill.sponsors.join(', ')}</dd></div>
          <div><dt className="text-sm text-muted">Next hearing</dt><dd>{nh ? <><span className="tnum">{fmtDateTime(nh)}</span> <HearingBadge at={nh} /></> : 'None scheduled'}</dd></div>
          <div><dt className="text-sm text-muted">Committee</dt><dd>{bill.committee}</dd></div>
          <div><dt className="text-sm text-muted">Tax type</dt><dd>{bill.taxType}</dd></div>
          <div><dt className="text-sm text-muted">Topics</dt><dd>{bill.topics.join(', ')}</dd></div>
          <div><dt className="text-sm text-muted">In DOR budget</dt><dd>{bill.inBudget ? 'Yes' : 'No'}</dd></div>
        </dl>
      </Card>
      <BillSummary bill={bill} />
      {tracking && <StartTracking bill={bill} onClose={() => setTracking(false)} />}
      {bill.sourceFeed && <Card className="mb-4" title="Washington Legislature source feed"><p>{bill.sourceFeed.source} · Retrieved {fmtDateTime(bill.sourceFeed.retrievedAtUtc)}</p><p>{String(bill.legislation?.LongDescription ?? '')}</p><p>{String((bill.legislation?.CurrentStatus as Record<string, unknown>)?.HistoryLine ?? '')}</p><p>{String(bill.legislation?.LegalTitle ?? '')}</p><a href={bill.sourceFeed.url} target="_blank" rel="noreferrer">Source endpoint</a></Card>}
      {(data.legislativeChanges ?? []).filter(c => c.billId === bill.id && !c.acknowledged).map(c => <Card key={c.id} className="mb-3" title={c.type}><p>{c.newValue}</p><Button variant="secondary" onClick={() => { useStore.getState().patchData(d => ({ ...d, legislativeChanges: d.legislativeChanges?.map(x => x.id === c.id ? { ...x, acknowledged: true } : x) })); audit('Legislative change acknowledged', bill.id, c.type) }}>Acknowledge</Button></Card>)}
      <Tabs label="Bill sections" value={TABS.includes(tab) ? tab : 'Summary'} onChange={t => go(`/bills/${bill.id}?tab=${encodeURIComponent(t)}`)} tabs={TABS.map(t => ({ id: t, label: t }))} />

      {tab === 'Summary' || !TABS.includes(tab) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Lineage: draft to enacted, across biennia">
            <ol className="relative ml-2 space-y-4 border-l-2 border-line pl-5">
              {chain.map(c => (
                <li key={c.id}>
                  <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue" aria-hidden="true" />
                  <p className="font-semibold">{c.session} biennium: {c.number ? c.number : 'Agency draft'} {c.id === bill.id && <Chip tone="info">This bill</Chip>}</p>
                  <p className="text-sm text-muted">{c.title}</p>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {c.versions.filter(v => v.kind === 'version').map(v => <li key={v.id}><Chip tone={v.id === c.currentVersionId ? 'info' : 'neutral'}>{v.label}</Chip></li>)}
                    <li><Chip tone={c.enacted ? 'ok' : c.status === 'Died' ? 'bad' : 'neutral'} icon={c.enacted ? 'check' : c.status === 'Died' ? 'x' : 'clock'}>{c.enacted ? 'Enacted' : c.status}</Chip></li>
                  </ul>
                  {c.id !== bill.id && <A to={`/bills/${c.id}`} className="text-sm">Open {c.number}</A>}
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Work on this bill" pad={false}>
            <DataTable caption="Work products for this bill" rows={work} rowKey={i => i.id} onRow={i => openItem(i.id, i.type)} empty={<EmptyState title="No work products yet" />}
              cols={[{ key: 'id', header: 'ID', render: i => <A to={i.type === 'FN' ? `/fiscal/${i.id}` : i.type === 'BA' ? `/analyses/${i.id}` : `/estimates/${i.id}`}>{i.id}</A> }, { key: 't', header: 'Type', render: i => TYPE_NAME[i.type] }, { key: 's', header: 'Status', render: i => <StageChip item={i} /> }, { key: 'c', header: 'Clock', render: i => <ClockChip item={i} /> }]} />
          </Card>
          <Card title="Bill text, current version" className="lg:col-span-2"><pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed">{cv.text}</pre></Card>
        </div>
      ) : tab === 'Hearings' ? (<Card title="Legislative hearings" pad={false}><DataTable caption="Hearings" rows={bill.hearingRecords ?? bill.hearings.map((h, n) => ({ id: String(n), billVersionId: bill.currentVersionId, metadata: {}, date: h, committee: bill.committee, chamber: bill.chamber, type: 'Hearing', description: '', location: 'Location not supplied', cancelled: false, revisedDate: undefined }))} rowKey={h => h.id} cols={[{ key: 'committee', header: 'Committee', render: h => h.committee }, { key: 'chamber', header: 'Chamber', render: h => h.chamber }, { key: 'date', header: 'Date / time', render: h => fmtDateTime(h.date) }, { key: 'type', header: 'Type', render: h => h.type }, { key: 'description', header: 'Description', render: h => h.description }, { key: 'location', header: 'Location', render: h => h.location }, { key: 'cancelled', header: 'Canceled', render: h => h.cancelled ? 'Yes' : 'No' }, { key: 'revised', header: 'Revised', render: h => h.revisedDate ? fmtDateTime(h.revisedDate) : '—' }]} /></Card>) : tab === 'Versions & Amendments' ? (
        <Card title="Versions and amendments" pad={false} actions={<LinkButton to={compareLink} icon="compare">Compare any two</LinkButton>}>
          <DataTable caption="Versions and amendments" rows={versions} rowKey={v => v.id} onRow={() => go(compareLink)}
            cols={[{ key: 'l', header: 'Label', render: v => <span className="font-semibold">{v.label}</span> }, { key: 'k', header: 'Type', render: v => <Chip icon={v.kind === 'version' ? 'file' : 'edit'}>{v.kind === 'version' ? 'Version' : 'Amendment'}</Chip> }, { key: 'd', header: 'Date', render: v => fmtDate(v.date) },
              { key: 'a', header: 'Analysis', render: v => v.kind === 'amendment' ? (v.analyzed ? <Chip tone="ok" icon="check">Analyzed</Chip> : <Chip tone="warn" icon="alert">Awaiting analysis</Chip>) : <span className="text-muted">n/a</span> },
              { key: 'c', header: 'Current', render: v => (v.id === bill.currentVersionId ? <Chip tone="info" icon="star">Current</Chip> : '') }]} />
        </Card>
      ) : tab === 'Analyses' ? (
        <Card title="Bill analyses" pad={false}>
          <DataTable caption="Bill analyses" rows={work.filter(i => i.type === 'BA')} rowKey={i => i.id} onRow={i => go(`/analyses/${i.id}`)} empty={<EmptyState title="No analyses for this bill" />}
            cols={[{ key: 'id', header: 'ID', render: i => <A to={`/analyses/${i.id}`}>{i.id}</A> }, { key: 's', header: 'Status', render: i => <StageChip item={i} /> }, { key: 'p', header: 'Published', render: i => (i.publishedVersion ? `Version ${i.publishedVersion}` : 'Not published') }, { key: 'c', header: 'Clock', render: i => <ClockChip item={i} /> }]} />
        </Card>
      ) : tab === 'Fiscal Work' ? (
        <Card title="Fiscal notes, estimates and data requests" pad={false}>
          <DataTable caption="Fiscal work" rows={work.filter(i => i.type !== 'BA')} rowKey={i => i.id} onRow={i => openItem(i.id, i.type)} empty={<EmptyState title="No fiscal work for this bill" />}
            cols={[{ key: 'id', header: 'ID', render: i => <A to={i.type === 'FN' ? `/fiscal/${i.id}` : `/estimates/${i.id}`}>{i.id}</A> }, { key: 't', header: 'Type', render: i => TYPE_NAME[i.type] }, { key: 's', header: 'Status', render: i => <StageChip item={i} /> }, { key: 'c', header: 'Clock', render: i => <ClockChip item={i} /> }]} />
        </Card>
      ) : tab === 'Correspondence' ? (
        <Card title="Correspondence log" pad={false}>
          <DataTable caption="Correspondence" rows={corr} rowKey={c => c.id} empty={<EmptyState title="No correspondence logged" text="Log correspondence from the bill analysis editor." />}
            cols={[{ key: 't', header: 'To', render: c => c.to }, { key: 's', header: 'Sent', render: c => fmtDate(c.sent) }, { key: 'r', header: 'Response', render: c => (c.responseReceived ? <Chip tone="ok" icon="check">Received</Chip> : <Chip tone="warn" icon="clock">Waiting</Chip>) }, { key: 'i', header: 'Analysis', render: c => <A to={`/analyses/${c.item}`}>{c.item}</A> }]} />
        </Card>
      ) : tab === 'Documents' ? (
        <Card title="Documents (SharePoint, simulated)">
          <ul className="divide-y divide-line">
            {[`${billLabel(bill)} bill report.pdf`, `${billLabel(bill)} testimony notes.docx`, ...work.filter(i => i.fiscal).flatMap(i => i.fiscal!.workPapers.map(w => w.name))].map(n => (
              <li key={n} className="flex items-center gap-3 py-2"><Icon name="file" className="text-muted" /><span className="flex-1">{n}</span><Button variant="ghost" icon="download" onClick={() => useStore.getState().toast(`SharePoint (simulated): downloaded ${n}`)}>Download</Button></li>
            ))}
          </ul>
        </Card>
      ) : tab === 'Discussion' ? (
        <Card title="Discussion">
          <ul className="mb-4 space-y-3">
            {work.flatMap(i => i.comments.map(c => ({ ...c, item: i.id }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8).map(c => (
              <li key={c.id} className="flex gap-3"><Avatar name={data.staff.find(s => s.id === c.by)?.name ?? '?'} /><div><p className="text-sm text-muted">{data.staff.find(s => s.id === c.by)?.name} on {c.item}, {fmtDateTime(c.at)}</p><p>{c.text}</p></div></li>
            ))}
            {!work.some(i => i.comments.length) && <li className="text-muted">No comments yet.</li>}
          </ul>
          <Field label="Add a comment" htmlFor="dc"><textarea id="dc" className={inputCls} rows={3} value={note} onChange={e => setNote(e.target.value)} /></Field>
          <Button className="mt-2" disabled={!note.trim() || !work.length} onClick={() => { useStore.getState().addComment(work[0].id, note, 'comment'); audit('Created', work[0].id, 'Discussion comment'); setNote('') }}>Post comment</Button>
        </Card>
      ) : (
        <Card title="History" pad={false}>
          <DataTable caption="Bill history" rows={[...bill.versions.map(v => ({ id: v.id, at: v.date, text: `${v.kind === 'version' ? 'Version' : 'Amendment'} ${v.label}` })), ...bill.hearings.map(h => ({ id: h, at: h, text: `Hearing scheduled: ${bill.committee}` })), ...data.audit.filter(a => work.some(w => w.id === a.target) || a.target === bill.id).map(a => ({ id: a.id, at: a.at, text: `${a.action}: ${a.target}` }))].sort((a, b) => b.at.localeCompare(a.at))} rowKey={r => r.id}
            cols={[{ key: 'd', header: 'Date', render: r => <span className="tnum">{fmtDateTime(r.at)}</span> }, { key: 't', header: 'Event', render: r => r.text }]} />
        </Card>
      )}
    </>
  )
}
