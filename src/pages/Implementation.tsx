import { useState } from 'react'
import { useStore } from '../store'
import { A, Button, Card, Chip, DataTable, EmptyState, Field, Modal, PageHeader, Select, inputCls } from '../components/ui'
import { billLabel, currentVersion, canAssign, csv, download, fmtDate, iso, ms, D } from '../lib'
import type { Bill, Division } from '../types'

function BillDetails({ bill }: { bill: Bill }) {
  const version = currentVersion(bill)
  const legislation = version.metadata ?? bill.legislation ?? {}
  const status = (bill.legislation?.CurrentStatus ?? {}) as Record<string, unknown>
  const description = version.text || String(legislation.LongDescription ?? legislation.LegalTitle ?? bill.title)
  const actionDate = typeof status.ActionDate === 'string' && Number.isFinite(Date.parse(status.ActionDate)) && !status.ActionDate.startsWith('0001-') ? fmtDate(status.ActionDate) : undefined
  const fiscalRequirement = (key: string) => typeof legislation[key] === 'boolean' ? legislation[key] ? 'Required' : 'Not required' : 'Not supplied'
  return <section aria-label={`Legislative details for ${billLabel(bill)}`} className="space-y-3 border-b border-line px-4 py-4">
    <h3 className="font-semibold text-navy">{bill.title}</h3>
    <p className="text-ink">{description}</p>
    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div><dt className="font-semibold text-muted">Enactment status</dt><dd>{bill.status}</dd></div>
      <div><dt className="font-semibold text-muted">Chamber</dt><dd>{bill.chamber}</dd></div>
      <div><dt className="font-semibold text-muted">Current bill version</dt><dd>{version.label}</dd></div>
      <div className="sm:col-span-2"><dt className="font-semibold text-muted">Latest legislative action</dt><dd>{String(status.HistoryLine || 'Not supplied')}{actionDate && ` (${actionDate})`}</dd></div>
      <div><dt className="font-semibold text-muted">State / local fiscal note</dt><dd>{fiscalRequirement('StateFiscalNote')} / {fiscalRequirement('LocalFiscalNote')}</dd></div>
      <div className="sm:col-span-2"><dt className="font-semibold text-muted">Sponsors</dt><dd>{bill.sponsors.join(', ') || 'Not supplied'}</dd></div>
      <div><dt className="font-semibold text-muted">Legislative history</dt><dd>{bill.versions.filter(v => v.kind === 'version').length} versions, {bill.versions.filter(v => v.kind === 'amendment').length} amendments, {bill.hearingRecords?.length ?? bill.hearings.length} hearings</dd></div>
    </dl>
    <div className="flex flex-wrap gap-4 text-sm"><A to={`/bills/${bill.id}`}>View full bill details</A><A to={`/bills/${bill.id}?tab=Versions%20%26%20Amendments`}>Versions and amendments</A><A to={`/bills/${bill.id}?tab=Hearings`}>Hearing history</A></div>
  </section>
}

export default function Implementation() {
  const { data, role, now, addImplTask, patchTask, flagEnacted, toast } = useStore()
  const enacted = data.bills.filter(b => b.enacted)
  const candidates = data.bills.filter(b => !b.enacted && b.session === data.sessions.find(s => s.current)?.id && !b.draft)
  const [flag, setFlag] = useState(candidates[0]?.id ?? '')
  const [f, setF] = useState({ bill: enacted[0]?.id ?? '', title: '', owner: data.staff.find(s => s.role === 'Expenditure Contributor')!.id, due: iso(now + 14 * D).slice(0, 10) })
  const [report, setReport] = useState(false)
  const canManage = canAssign(role) || role === 'Leadership'
  const owners = data.staff.filter(s => !['Read-only'].includes(s.role))
  const rows = enacted.map(b => {
    const t = data.implTasks.filter(x => x.billId === b.id)
    return { b, tasks: t, done: t.filter(x => x.done).length, late: t.filter(x => !x.done && ms(x.dueAt) < now).length }
  })
  return (
    <>
      <PageHeader title="Implementation tracker" subtitle="Track cross-division tasks needed to implement enacted bills."
        actions={<Button variant="secondary" icon="file" onClick={() => setReport(true)}>Status report</Button>} />
      {canManage && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Card title="Flag an enacted bill">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[14rem] flex-1"><Field label="Bill" htmlFor="fb"><Select id="fb" value={flag} onChange={setFlag} options={candidates.map(b => ({ value: b.id, label: `${billLabel(b)}: ${b.title.slice(0, 50)}` }))} /></Field></div>
              <Button icon="flag" disabled={!flag} onClick={() => { flagEnacted(flag); setF({ ...f, bill: flag }) }}>Flag as enacted</Button>
            </div>
          </Card>
          <Card title="Assign a task">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bill" htmlFor="tb"><Select id="tb" value={f.bill} onChange={v => setF({ ...f, bill: v })} options={enacted.map(b => ({ value: b.id, label: billLabel(b) }))} /></Field>
              <Field label="Task" htmlFor="tt"><input id="tt" className={inputCls} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
              <Field label="Owner" htmlFor="to"><Select id="to" value={f.owner} onChange={v => setF({ ...f, owner: v })} options={owners.map(s => ({ value: s.id, label: `${s.name} (${s.division})` }))} /></Field>
              <Field label="Due date" htmlFor="td"><input id="td" type="date" className={inputCls} value={f.due} onChange={e => setF({ ...f, due: e.target.value })} /></Field>
            </div>
            <Button className="mt-3" icon="plus" disabled={!f.title.trim() || !f.bill} onClick={() => { const o = data.staff.find(s => s.id === f.owner)!; addImplTask({ billId: f.bill, title: f.title, owner: o.name, division: o.division as Division, dueAt: new Date(f.due).toISOString(), done: false }); setF({ ...f, title: '' }) }}>Assign task</Button>
          </Card>
        </div>
      )}
      {rows.length === 0 && <Card><EmptyState title="No enacted bills yet" text="Flag an enacted bill to start tracking implementation." /></Card>}
      <div className="space-y-4">
        {rows.map(r => (
          <Card key={r.b.id} title={<span><A to={`/bills/${r.b.id}`}>{billLabel(r.b)}</A> <span className="text-base font-normal text-muted">{r.b.session} biennium</span></span>}
            actions={<><Chip tone="info" icon="check">{r.done} of {r.tasks.length} complete</Chip>{r.late > 0 && <Chip tone="bad" icon="alert">{r.late} overdue</Chip>}</>} pad={false}>
            <BillDetails bill={r.b} />
            <DataTable caption={`Tasks for ${billLabel(r.b)}`} rows={r.tasks} rowKey={t => t.id} empty={<EmptyState title="No tasks yet" text="Assign the first cross-division task." />}
              cols={[
                { key: 'd', header: 'Done', render: t => <input type="checkbox" className="h-5 w-5" aria-label={`Mark ${t.title} complete`} checked={t.done} disabled={!canManage && t.owner !== useStore.getState().user().name} onChange={e => { patchTask(t.id, { done: e.target.checked, completedAt: e.target.checked ? new Date().toISOString() : undefined }); toast(e.target.checked ? 'Task marked complete.' : 'Task reopened.', 'info') }} /> },
                { key: 't', header: 'Task', render: t => t.title },
                { key: 'o', header: 'Owner', render: t => t.owner },
                { key: 'notes', header: 'Notes', render: t => <input aria-label={`Notes for ${t.title}`} className={inputCls} disabled={!canManage && t.owner !== useStore.getState().user().name} defaultValue={t.notes ?? ''} onBlur={e => { if (e.target.value !== (t.notes ?? '')) patchTask(t.id, { notes: e.target.value }) }} /> },
                { key: 'completed', header: 'Completed', render: t => t.completedAt ? fmtDate(t.completedAt) : '—' },
                { key: 'v', header: 'Division', render: t => t.division, className: 'hidden md:table-cell' },
                { key: 'du', header: 'Due', sort: t => ms(t.dueAt), render: t => <span className="tnum">{fmtDate(t.dueAt)}</span> },
                { key: 's', header: 'Status', render: t => (t.done ? <Chip tone="ok" icon="check">Complete</Chip> : ms(t.dueAt) < now ? <Chip tone="bad" icon="alert">Overdue</Chip> : <Chip tone="info" icon="clock">Open</Chip>) },
              ]} />
          </Card>
        ))}
      </div>
      {report && (
        <Modal title="Implementation status report" wide onClose={() => setReport(false)}>
          <DataTable caption="Status report" rows={rows} rowKey={r => r.b.id} cols={[
            { key: 'b', header: 'Bill', render: r => billLabel(r.b) }, { key: 'p', header: 'Progress', render: r => `${r.done} of ${r.tasks.length} tasks` },
            { key: 'pc', header: 'Percent', render: r => <span className="tnum">{r.tasks.length ? Math.round((r.done / r.tasks.length) * 100) : 0}%</span> },
            { key: 'l', header: 'Overdue', render: r => r.late }]} />
          <div className="mt-4 flex gap-2">
            <Button icon="download" onClick={() => { download('implementation-status.csv', csv([['Bill', 'Task', 'Owner', 'Division', 'Due', 'Done'], ...data.implTasks.map(t => [billLabel(data.bills.find(b => b.id === t.billId)!), t.title, t.owner, t.division, t.dueAt, t.done ? 'Yes' : 'No'])])); toast('Downloaded implementation-status.csv') }}>Export CSV</Button>
            <Button variant="secondary" onClick={() => setReport(false)}>Close</Button>
          </div>
        </Modal>
      )}
    </>
  )
}
