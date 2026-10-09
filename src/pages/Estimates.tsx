import { getBill } from '../retrieval'
import { useEffect, useState } from 'react'
import { useStore, useVisibleItems } from '../store'
import { A, Button, Card, Chip, ClockChip, DataTable, EmptyState, Field, LinkButton, Modal, PageHeader, Presence, Select, StageChip, Tabs, inputCls, Skeleton, useLoading, openItem } from '../components/ui'
import { billLabel, canAssign, fmtDateTime, ms, money, fiscalTotal } from '../lib'
import { FiscalWorkspace, SavedIndicator, useDebouncedSave, canEditItem } from './Fiscal'
import { useRoute, go } from '../router'
import type { ItemType } from '../types'

export function Estimates() {
  const loading = useLoading(300)
  const route = useRoute()
  const tab = route.q.get('tab') ?? 'FE'
  const { data, role, createItem } = useStore()
  const all = useVisibleItems().filter(i => i.type === 'FE' || i.type === 'DR')
  const [nw, setNw] = useState(false)
  const [bill, setBill] = useState((data.bills.find(b => b.session === data.sessions.find(s => s.current)?.id) ?? data.bills[0])?.id ?? '')
  const [type, setType] = useState<ItemType>('DR')
  const rows = all.filter(i => i.type === tab)
  if (loading) return <><PageHeader title="Estimates & Data Requests" /><Skeleton rows={7} /></>
  return (
    <>
      <PageHeader title="Estimates & Data Requests" subtitle="Fiscal estimates for the budget process and data requests from legislative staff."
        actions={['Analyst', 'Assigner', 'Manager', 'Administrator', 'Budget Office'].includes(role) ? <Button icon="plus" onClick={() => setNw(true)}>New estimate or request</Button> : undefined} />
      <Tabs label="Type" value={tab} onChange={t => go(`/estimates?tab=${t}`)} tabs={[{ id: 'FE', label: `Fiscal estimates (${all.filter(i => i.type === 'FE').length})` }, { id: 'DR', label: `Data requests (${all.filter(i => i.type === 'DR').length})` }]} />
      <Card pad={false}>
        <DataTable caption={tab === 'FE' ? 'Fiscal estimates' : 'Data requests'} rows={rows} rowKey={i => i.id} onRow={i => go(`/estimates/${i.id}`)}
          cols={[
            { key: 'id', header: 'ID', sort: i => i.id, render: i => <span className="flex items-center gap-2"><A to={`/estimates/${i.id}`} className="font-semibold">{i.id}</A><Presence itemId={i.id} />{i.confidential && <Chip icon="lock">Confidential</Chip>}</span> },
            { key: 'b', header: 'Bill', render: i => billLabel(getBill(data, i.billId)!) },
            tab === 'FE' ? { key: 'r', header: 'Revenue, 4 years', render: i => <span className="tnum">{money(fiscalTotal(i))}</span>, className: 'hidden md:table-cell text-right' } : { key: 'rq', header: 'Requester', render: i => i.requester, className: 'hidden md:table-cell' },
            { key: 's', header: 'Status', render: i => <StageChip item={i} /> },
            { key: 'c', header: 'Deadline', sort: i => ms(i.dueAt), render: i => <ClockChip item={i} /> },
          ]} />
      </Card>
      {nw && (
        <Modal title="New estimate or request" onClose={() => setNw(false)}>
          <div className="space-y-3">
            <Field label="Type" htmlFor="et"><Select id="et" value={type} onChange={v => setType(v as ItemType)} options={[{ value: 'DR', label: 'Data request' }, { value: 'FE', label: 'Fiscal estimate' }]} /></Field>
            <Field label="Bill" htmlFor="eb"><Select id="eb" value={bill} onChange={setBill} options={data.bills.filter(b => b.session === data.sessions.find(s => s.current)?.id).map(b => ({ value: b.id, label: `${billLabel(b)}: ${b.title.slice(0, 55)}` }))} /></Field>
            <div className="flex gap-2"><Button onClick={() => { const it = createItem(type, bill, canAssign(role) ? {} : { stage: 'In progress' }); setNw(false); go(`/estimates/${it.id}`) }}>Create</Button><Button variant="secondary" onClick={() => setNw(false)}>Cancel</Button></div>
          </div>
        </Modal>
      )}
    </>
  )
}

export function EstimateDetail({ id }: { id: string }) {
  const route = useRoute()
  const { data, role, userId, saveItem, submitForReview, audit } = useStore()
  const item = useVisibleItems().find(i => i.id === id)
  const loading = useLoading(250)
  const [text, setText] = useState('')
  useEffect(() => { if (item?.confidential) audit('Viewed confidential item', item.id, 'Opened data request', true) }, [id]) // eslint-disable-line
  useEffect(() => { setText(item?.body ?? '') }, [id]) // eslint-disable-line
  const { run, saving } = useDebouncedSave<string>(v => saveItem(id, i => ({ ...i, body: v }), 'Edited response'))
  if (!item) return <EmptyState title="Item not found" action={<LinkButton to="/estimates">Back to list</LinkButton>} />
  if (item.type === 'FE') return <FiscalWorkspace id={id} tab={route.q.get('tab') ?? 'narrative'} />
  if (loading) return <Skeleton rows={6} />
  const bill = getBill(data, item.billId)!
  const editable = canEditItem(item, role, userId)
  return (
    <>
      <PageHeader crumbs={[{ label: 'Estimates & Data Requests', to: '/estimates?tab=DR' }, { label: item.id }]}
        title={<span className="flex flex-wrap items-center gap-3">{item.id} <StageChip item={item} />{item.confidential && <Chip icon="lock">Confidential</Chip>}<Presence itemId={item.id} /></span>}
        subtitle={<><A to={`/bills/${bill.id}`}>{billLabel(bill)}</A>: {bill.title}</>}
        actions={<>{editable && ['Assigned', 'In progress', 'Rework'].includes(item.stage) && <Button icon="send" onClick={() => submitForReview(item.id)}>Mark done and notify next</Button>}<LinkButton to={`/review/${item.id}`} variant="secondary" icon="shield">Review and deliver</LinkButton></>} />
      <div className="mb-4 flex flex-wrap items-center gap-4"><ClockChip item={item} /><span>Customer due <span className="tnum font-semibold">{fmtDateTime(item.customerDueAt)}</span></span><SavedIndicator savedAt={item.savedAt} saving={saving} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Request"><dl className="space-y-2"><div><dt className="text-sm text-muted">Requester</dt><dd>{item.requester}</dd></div><div><dt className="text-sm text-muted">Question</dt><dd>{item.question}</dd></div></dl></Card>
        <Card title="Response">
          <label htmlFor="drr" className="text-sm font-semibold">Response text</label>
          <textarea id="drr" rows={8} spellCheck readOnly={!editable} value={text} onChange={e => { setText(e.target.value); run(e.target.value) }} className={`${inputCls} mt-1 ${!editable ? 'bg-page' : ''}`} placeholder="Type the response to the requester." />
        </Card>
      </div>
    </>
  )
}
