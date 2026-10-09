import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { A, Button, Card, Chip, DataTable, EmptyState, Field, PageHeader, Select, Tabs, inputCls } from '../components/ui'
import { billLabel, clockOf, csv, download, fiscalTotal, fmtDateTime, ms, money, nextHearing, H } from '../lib'
import { useRoute, go } from '../router'
import OperationalReports from './OperationalReports'

const REPORTS = [
  { id: 'operational', label: 'Operational reports' },
  { id: 'workload', label: 'Workload by person and division' },
  { id: 'outstanding', label: 'Outstanding fiscal tasks' },
  { id: 'hearings', label: 'Hearing schedule' },
  { id: 'deadlines', label: '48/72-hour performance' },
  { id: 'budget', label: 'DOR budget vs fiscal notes' },
  { id: 'query', label: 'Query builder' },
]

export default function Reports() {
  const route = useRoute()
  const tab = route.q.get('tab') ?? 'workload'
  const { data, now, toast, addQuery } = useStore()
  const staff = (id: string) => data.staff.find(s => s.id === id)
  const exportBtns = (name: string, rows: (string | number)[][]) => (
    <>
      <Button variant="secondary" icon="download" onClick={() => { download(`${name}.csv`, csv(rows)); toast(`Downloaded ${name}.csv`) }}>CSV</Button>

    </>
  )

  const workload = useMemo(() => {
    const people = data.staff.filter(s => ['Analyst', 'Reviewer'].includes(s.role)).map(s => {
      const mine = data.items.filter(i => i.preparerId === s.id || i.reviewerId === s.id).filter(i => i.stage !== 'Delivered')
      return { s, open: mine.length, overdue: mine.filter(i => clockOf(i, now).state === 'overdue').length, urgent: mine.filter(i => i.priority === 'Urgent').length }
    })
    const divs: Record<string, { open: number; overdue: number }> = {}
    people.forEach(p => { const d = (divs[p.s.division] ??= { open: 0, overdue: 0 }); d.open += p.open; d.overdue += p.overdue })
    return { people, divs: Object.entries(divs).map(([division, v]) => ({ division, ...v })) }
  }, [data, now])
  const outstanding = data.items.filter(i => i.fiscal && i.stage !== 'Delivered').flatMap(i => i.fiscal!.expenditure.filter(s => s.status !== 'Complete').map(s => ({ i, s })))
  const hearings = data.bills.flatMap(b => b.hearings.map(h => ({ b, h }))).filter(x => ms(x.h) > now).sort((a, b) => ms(a.h) - ms(b.h))
  const perf = useMemo(() => (['BA', 'FN'] as const).map(t => {
    const done = data.items.filter(i => i.type === t && i.stage === 'Delivered')
    const late = data.items.filter(i => i.type === t && clockOf(i, now).state === 'overdue')
    const active = data.items.filter(i => i.type === t && i.stage !== 'Delivered').length
    return { type: t === 'BA' ? 'Bill description (48h)' : 'Fiscal note (72h)', 'Delivered on time': done.length, Overdue: late.length, Active: active - late.length }
  }), [data, now])
  const budget = data.bills.filter(b => b.inBudget && b.session === data.sessions.find(s => s.current)?.id).map(b => ({ b, fn: data.items.find(i => i.billId === b.id && i.type === 'FN') }))

  // query builder
  const qid = route.q.get('q')
  const saved = data.savedQueries.find(q => q.id === qid)
  const [taxType, setTax] = useState(saved?.taxType ?? 'All')
  const [minAmt, setMin] = useState(String(saved?.minAmount ?? 1_000_000))
  const [sessions, setSessions] = useState<string[]>(saved?.sessions ?? data.sessions.filter(s => s.current).map(s => s.id))
  const [name, setName] = useState('')
  const loadQ = (id: string) => { const q = data.savedQueries.find(x => x.id === id); if (q) { setTax(q.taxType); setMin(String(q.minAmount)); setSessions(q.sessions); toast(`Loaded query: ${q.name}`, 'info') } }
  const results = data.items.filter(i => i.type === 'FN' && i.fiscal).map(i => ({ i, b: data.bills.find(b => b.id === i.billId)!, amt: Math.abs(fiscalTotal(i)) }))
    .filter(x => sessions.includes(x.b.session) && (taxType === 'All' || x.b.taxType === taxType) && x.amt >= Number(minAmt.replace(/\D/g, '') || 0))
  const qRows = [['ID', 'Bill', 'Session', 'Tax type', 'Four-year revenue impact'], ...results.map(x => [x.i.id, billLabel(x.b), x.b.session, x.b.taxType, x.amt])]

  return (
    <>
      <PageHeader title="Reports" subtitle="Prebuilt reports and a query builder with downloadable CSV exports." />
      <Tabs label="Reports" value={tab} onChange={t => go(`/reports?tab=${t}`)} tabs={REPORTS.map(r => ({ id: r.id, label: r.label }))} />
      {tab === 'operational' && <OperationalReports />}

      {tab === 'workload' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Open and overdue work by division" actions={exportBtns('workload-by-division', [['Division', 'Open', 'Overdue'], ...workload.divs.map(d => [d.division, d.open, d.overdue])])}>
            <div className="h-64" role="img" aria-label={workload.divs.map(d => `${d.division}: ${d.open} open, ${d.overdue} overdue`).join('; ')}>
              <ResponsiveContainer><BarChart data={workload.divs}><CartesianGrid strokeDasharray="3 3" stroke="#DCDEE0" /><XAxis dataKey="division" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip /><Legend /><Bar dataKey="open" name="Open" fill="#005A9C" radius={[3, 3, 0, 0]} /><Bar dataKey="overdue" name="Overdue" fill="#B3261E" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer>
            </div>
          </Card>
          <Card title="Workload by person" pad={false}>
            <DataTable caption="Workload by person" rows={workload.people.sort((a, b) => b.open - a.open)} rowKey={p => p.s.id}
              cols={[{ key: 'n', header: 'Person', render: p => p.s.name }, { key: 'd', header: 'Division', render: p => p.s.division }, { key: 'o', header: 'Open', sort: p => p.open, render: p => <span className="tnum">{p.open}</span> }, { key: 'v', header: 'Overdue', sort: p => p.overdue, render: p => (p.overdue ? <Chip tone="bad" icon="alert">{p.overdue}</Chip> : <span className="tnum">0</span>) }, { key: 'u', header: 'Urgent', render: p => <span className="tnum">{p.urgent}</span> }]} />
          </Card>
        </div>
      )}
      {tab === 'outstanding' && (
        <Card title="Outstanding fiscal tasks" actions={exportBtns('outstanding-fiscal-tasks', [['Item', 'Section', 'Assignee', 'Due', 'Status'], ...outstanding.map(x => [x.i.id, x.s.name, staff(x.s.assigneeId ?? '')?.name ?? 'Unassigned', x.s.dueAt, x.s.status])])} pad={false}>
          <DataTable caption="Outstanding fiscal tasks" rows={outstanding} rowKey={x => x.i.id + x.s.id} onRow={x => go(`/fiscal/${x.i.id}?tab=expenditure`)}
            cols={[{ key: 'i', header: 'Item', render: x => <A to={`/fiscal/${x.i.id}`}>{x.i.id}</A> }, { key: 's', header: 'Section', render: x => x.s.name }, { key: 'a', header: 'Assignee', render: x => staff(x.s.assigneeId ?? '')?.name ?? <Chip tone="warn" icon="alert">Unassigned</Chip> }, { key: 'd', header: 'Due', sort: x => ms(x.s.dueAt), render: x => <span className="tnum">{fmtDateTime(x.s.dueAt)}</span> }, { key: 'st', header: 'Status', render: x => <Chip icon={x.s.status === 'In progress' ? 'edit' : 'clock'}>{x.s.status}</Chip> }]} />
        </Card>
      )}
      {tab === 'hearings' && (
        <Card title="Hearing schedule" actions={exportBtns('hearing-schedule', [['Bill', 'Committee', 'When'], ...hearings.map(x => [billLabel(x.b), x.b.committee, x.h])])} pad={false}>
          <DataTable caption="Hearing schedule" rows={hearings} rowKey={x => x.b.id + x.h} onRow={x => go(`/bills/${x.b.id}`)}
            cols={[{ key: 'w', header: 'When', render: x => <span className="tnum">{fmtDateTime(x.h)}</span> }, { key: 'b', header: 'Bill', render: x => <A to={`/bills/${x.b.id}`}>{billLabel(x.b)}</A> }, { key: 'c', header: 'Committee', render: x => x.b.committee }, { key: 'h', header: 'Hours away', render: x => <span className="tnum">{Math.round((ms(x.h) - now) / H)}</span> }]} />
        </Card>
      )}
      {tab === 'deadlines' && (
        <Card title="Performance against 48-hour and 72-hour deadlines" actions={exportBtns('deadline-performance', [['Type', 'Delivered', 'Overdue', 'Active'], ...perf.map(p => [p.type, p['Delivered on time'], p.Overdue, p.Active])])}>
          <div className="h-64" role="img" aria-label={perf.map(p => `${p.type}: ${p['Delivered on time']} delivered, ${p.Overdue} overdue, ${p.Active} active`).join('; ')}>
            <ResponsiveContainer><BarChart data={perf} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" stroke="#DCDEE0" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="type" width={150} tick={{ fontSize: 12 }} /><Tooltip /><Legend /><Bar dataKey="Delivered on time" stackId="a" fill="#2E7D32" /><Bar dataKey="Active" stackId="a" fill="#005A9C" /><Bar dataKey="Overdue" stackId="a" fill="#B3261E" /></BarChart></ResponsiveContainer>
          </div>
        </Card>
      )}
      {tab === 'budget' && (
        <Card title="Bills in the DOR budget and their fiscal notes" actions={exportBtns('budget-vs-fiscal-notes', [['Bill', 'Fiscal note', 'Status'], ...budget.map(x => [billLabel(x.b), x.fn?.id ?? 'None', x.fn?.stage ?? ''])])} pad={false}>
          <DataTable caption="DOR budget bills" rows={budget} rowKey={x => x.b.id} onRow={x => go(`/bills/${x.b.id}`)}
            cols={[{ key: 'b', header: 'Bill', render: x => <A to={`/bills/${x.b.id}`}>{billLabel(x.b)}</A> }, { key: 't', header: 'Title', render: x => x.b.title }, { key: 'f', header: 'Fiscal note', render: x => (x.fn ? <A to={`/fiscal/${x.fn.id}`}>{x.fn.id}</A> : <Chip tone="warn" icon="alert">No fiscal note</Chip>) }, { key: 's', header: 'Status', render: x => (x.fn ? x.fn.stage : '') }, { key: 'r', header: 'Revenue impact', className: 'text-right', render: x => (x.fn ? <span className="tnum">{money(fiscalTotal(x.fn))}</span> : '') }]} />
        </Card>
      )}
      {tab === 'query' && (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <div className="space-y-4">
            <Card title="Filters">
              <div className="space-y-3">
                <Field label="Tax type" htmlFor="qt"><Select id="qt" value={taxType} onChange={setTax} options={['All', ...data.picklists['Tax types']]} /></Field>
                <Field label="Minimum four-year impact (dollars)" htmlFor="qm"><input id="qm" inputMode="numeric" className={inputCls + ' tnum'} value={minAmt} onChange={e => setMin(e.target.value)} /></Field>
                <fieldset><legend className="text-sm font-semibold">Sessions</legend>
                  {data.sessions.map(s => <label key={s.id} className="flex min-h-[36px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={sessions.includes(s.id)} onChange={e => setSessions(e.target.checked ? [...sessions, s.id] : sessions.filter(x => x !== s.id))} />{s.name}</label>)}
                </fieldset>
                <Field label="Save this query as" htmlFor="qn"><input id="qn" className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Query name" /></Field>
                <Button disabled={!name.trim()} icon="plus" onClick={() => { addQuery({ name, taxType, minAmount: Number(minAmt.replace(/\D/g, '') || 0), sessions }); setName('') }}>Save query</Button>
              </div>
            </Card>
            <Card title="Saved queries">
              {data.savedQueries.length === 0 ? <p className="text-muted">No saved queries.</p> : <ul className="space-y-1">{data.savedQueries.map(q => <li key={q.id}><Button variant={q.id === qid ? 'primary' : 'secondary'} className="w-full justify-start" onClick={() => { loadQ(q.id); go(`/reports?tab=query&q=${q.id}`) }}>{q.name}</Button></li>)}</ul>}
            </Card>
          </div>
          <Card title={`${qRows.length - 1} matching fiscal notes`} actions={exportBtns('fiscal-query', qRows)} pad={false}>
            {qRows.length === 1 ? <EmptyState title="No matches" text="Lower the dollar threshold or include more sessions." /> : (
              <DataTable caption="Query results" rows={qRows.slice(1)} rowKey={r => String(r[0]) + r[1]}
                cols={[{ key: 'i', header: 'ID', render: r => <span className="font-semibold">{r[0]}</span> }, { key: 'b', header: 'Bill', render: r => r[1] }, { key: 's', header: 'Session', render: r => r[2] }, { key: 't', header: 'Tax type', render: r => r[3], className: 'hidden md:table-cell' }, { key: 'a', header: 'Four-year impact', className: 'text-right', sort: r => Number(r[4]), render: r => <span className="tnum">{money(Number(r[4]))}</span> }]} />
            )}
          </Card>
        </div>
      )}
    </>
  )
}
