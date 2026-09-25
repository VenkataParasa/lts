import { useMemo, useState } from 'react'
import { useStore, useMe, useVisibleItems } from '../store'
import { A, Button, Card, ClockChip, DataTable, Chip, PageHeader, PriorityChip, Presence, Select, StageChip, Tabs, Skeleton, useLoading, openItem, Field } from '../components/ui'
import { canAssign, clockOf, fmtDateTime, ms, TYPE_NAME } from '../lib'
import { useRoute, go } from '../router'
import type { WorkItem } from '../types'

const TABS = ['Assigned', 'Rework', 'Due soon', 'Overdue', 'On hold'] as const

export default function Queue() {
  const loading = useLoading(300)
  const route = useRoute()
  const tab = (route.q.get('tab') as (typeof TABS)[number]) || 'Assigned'
  const { data, role, now, bulkReassign, toast } = useStore()
  const me = useMe()
  const all = useVisibleItems()
  const [f, setF] = useState({ confidential: false, exec: false, hold: false, type: 'All', pkg: 'All' })
  const [sel, setSel] = useState<string[]>([])
  const [target, setTarget] = useState('')
  const [view, setView] = useState('')

  const mine = useMemo(() => {
    const canSeeAll = canAssign(role) || role === 'Leadership' || role === 'Reviewer' || role === 'Executive Reviewer' || role === 'Budget Office'
    return all.filter(i => i.stage !== 'Delivered' && (canSeeAll || i.assigneeIds.includes(me.id)))
  }, [all, role, me.id])
  const myRole = (i: WorkItem) => i.preparerId === me.id ? 'Preparer' : i.reviewerId === me.id ? 'Reviewer' : i.execChain.includes(me.id) ? 'Executive reviewer' : i.assigneeIds.includes(me.id) ? 'Contributor' : role === 'Assigner' ? 'Assigner' : 'Oversight'

  const inTab = (i: WorkItem) => {
    const c = clockOf(i, now)
    switch (tab) {
      case 'Assigned': return i.stage === 'Assigned' || i.stage === 'In progress' || i.stage === 'In review' || i.stage === 'Executive review'
      case 'Rework': return i.stage === 'Rework'
      case 'Due soon': return !i.onHold && ms(i.dueAt) - now < 24 * 3600_000 && c.state !== 'overdue'
      case 'Overdue': return c.state === 'overdue'
      case 'On hold': return i.onHold
    }
  }
  const rows = mine.filter(inTab).filter(i => (!f.confidential || i.confidential) && (!f.exec || i.execReview) && (!f.hold || i.onHold) && (f.type === 'All' || i.type === f.type) && (f.pkg === 'All' || (f.pkg === 'In a package' ? !!i.packageId : !i.packageId)))
    .sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
  const counts = Object.fromEntries(TABS.map(t => [t, mine.filter(i => { const old = tab; void old; return t === 'Assigned' ? ['Assigned', 'In progress', 'In review', 'Executive review'].includes(i.stage) : t === 'Rework' ? i.stage === 'Rework' : t === 'Due soon' ? !i.onHold && ms(i.dueAt) - now < 24 * 3600_000 && clockOf(i, now).state !== 'overdue' : t === 'Overdue' ? clockOf(i, now).state === 'overdue' : i.onHold }).length]))

  const applyView = (id: string) => {
    setView(id)
    const v = data.savedViews.find(x => x.id === id)
    if (!v) return
    setF({ confidential: v.filter.confidential === '1', exec: v.filter.exec === '1', hold: false, type: v.filter.type ?? 'All', pkg: 'All' })
    toast(`Applied saved view: ${v.name}`, 'info')
  }
  const canBulk = canAssign(role)
  const analysts = data.staff.filter(s => s.role === 'Analyst')

  if (loading) return <><PageHeader title="My Queue" /><Skeleton rows={7} /></>
  return (
    <>
      <PageHeader title="My Queue" subtitle="Work assigned to you, or across the team if you assign or oversee work." />
      <Tabs label="Queue views" value={tab} onChange={t => go(`/queue?tab=${t}`)} tabs={TABS.map(t => ({ id: t, label: <>{t} <span className="ml-1 rounded-full bg-[#EEF0F2] px-2 text-sm text-ink">{counts[t]}</span></> }))} />
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Saved view" htmlFor="sv"><Select id="sv" value={view} onChange={applyView} options={[{ value: '', label: 'Choose a saved view' }, ...data.savedViews.map(v => ({ value: v.id, label: v.name }))]} /></Field>
          <Field label="Work type" htmlFor="wt"><Select id="wt" value={f.type} onChange={v => setF({ ...f, type: v })} options={[{ value: 'All', label: 'All types' }, { value: 'FN', label: 'Fiscal note' }, { value: 'FE', label: 'Fiscal estimate' }, { value: 'DR', label: 'Data request' }, { value: 'BA', label: 'Bill analysis' }]} /></Field>
          <Field label="Package" htmlFor="pk"><Select id="pk" value={f.pkg} onChange={v => setF({ ...f, pkg: v })} options={['All', 'In a package', 'Not in a package']} /></Field>
          {([['confidential', 'Confidential'], ['exec', 'Executive review'], ['hold', 'On hold']] as const).map(([k, l]) => (
            <label key={k} className="flex min-h-[40px] items-center gap-2 text-[15px]"><input type="checkbox" className="h-5 w-5" checked={f[k]} onChange={e => setF({ ...f, [k]: e.target.checked })} />{l}</label>
          ))}
        </div>
      </Card>

      {canBulk && (
        <Card className="mb-4 bg-lightblue" >
          <div className="flex flex-wrap items-end gap-3">
            <Field label={`Bulk reassign ${sel.length} selected`} htmlFor="ba"><Select id="ba" value={target} onChange={setTarget} options={[{ value: '', label: 'Choose an analyst' }, ...analysts.map(a => ({ value: a.id, label: `${a.name} (${a.division})` }))]} /></Field>
            <Button disabled={!sel.length || !target} onClick={() => { bulkReassign(sel, target); setSel([]); setTarget('') }}>Reassign</Button>
          </div>
        </Card>
      )}

      <Card pad={false}>
        <DataTable caption={`${tab} work`} rows={rows} rowKey={i => i.id} selectable={canBulk} selected={sel} onSelect={setSel} onRow={i => openItem(i.id, i.type)}
          cols={[
            { key: 'id', header: 'ID', sort: i => i.id, render: i => <span className="flex items-center gap-2"><A to={i.type === 'FN' ? `/fiscal/${i.id}` : i.type === 'BA' ? `/analyses/${i.id}` : `/estimates/${i.id}`} className="font-semibold">{i.id}</A><Presence itemId={i.id} />{i.confidential && <Chip tone="neutral" icon="lock">Confidential</Chip>}{i.billChanged && <Chip tone="warn" icon="alert">Bill changed</Chip>}</span> },
            { key: 'type', header: 'Type', sort: i => i.type, render: i => TYPE_NAME[i.type] },
            { key: 'bill', header: 'Bill', render: i => { const b = data.bills.find(x => x.id === i.billId)!; return <A to={`/bills/${b.id}`}>{b.number ?? 'Draft'}</A> } },
            { key: 'role', header: 'My role', render: myRole },
            { key: 'due', header: 'My due date', sort: i => ms(i.dueAt), render: i => <div><div className="tnum">{fmtDateTime(i.dueAt)}</div><ClockChip item={i} /></div> },
            { key: 'cdue', header: 'Customer due', sort: i => ms(i.customerDueAt), render: i => <span className="tnum">{fmtDateTime(i.customerDueAt)}</span>, className: 'hidden xl:table-cell' },
            { key: 'pri', header: 'Priority', sort: i => ['Low', 'Normal', 'High', 'Urgent'].indexOf(i.priority), render: i => <PriorityChip p={i.priority} /> },
            { key: 'st', header: 'Status', render: i => <StageChip item={i} /> },
          ]} />
      </Card>
    </>
  )
}
