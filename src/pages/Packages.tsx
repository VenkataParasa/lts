import { useState } from 'react'
import { useStore, useVisibleItems } from '../store'
import { A, Button, Card, Chip, ClockChip, DataTable, EmptyState, Field, LinkButton, Modal, PageHeader, Select, StageChip, Skeleton, useLoading, openItem } from '../components/ui'
import { billLabel, canAssign, fmtDateTime, ms, TYPE_NAME } from '../lib'
import { go } from '../router'
import { STAGES, type Pkg } from '../types'

export function Packages({ id }: { id?: string }) {
  const loading = useLoading(300)
  const { data, role, patchData, audit, toast, deliverPackage } = useStore()
  const all = useVisibleItems()
  const [nw, setNw] = useState(false)
  const [bill, setBill] = useState(data.bills.find(b => b.session === '2027')!.id)
  const [busy, setBusy] = useState(false)
  const rollup = (p: Pkg) => {
    const its = data.items.filter(i => p.itemIds.includes(i.id))
    const min = Math.min(...its.map(i => STAGES.indexOf(i.stage)))
    const done = its.filter(i => i.stage === 'Approved' || i.stage === 'Delivered').length
    return { its, stage: STAGES[min], done, total: its.length, held: its.some(i => i.onHold) }
  }
  if (loading) return <><PageHeader title="Packages" /><Skeleton rows={5} /></>

  if (id) {
    const p = data.packages.find(x => x.id === id)
    if (!p) return <EmptyState title="Package not found" action={<LinkButton to="/packages">Back to packages</LinkButton>} />
    const r = rollup(p)
    const ready = r.its.every(i => i.stage === 'Approved' || i.stage === 'Delivered') && !p.delivered
    return (
      <>
        <PageHeader crumbs={[{ label: 'Packages', to: '/packages' }, { label: p.id }]} title={<span className="flex flex-wrap items-center gap-3">{p.id} {p.delivered ? <Chip tone="ok" icon="send">Delivered</Chip> : <Chip tone="info" icon="clock">{r.stage}</Chip>}</span>} subtitle={p.name}
          actions={canAssign(role) || role === 'Manager' ? <Button icon="send" disabled={!ready || busy} onClick={async () => { setBusy(true); await deliverPackage(p.id); setBusy(false) }}>Deliver as one product</Button> : undefined} />
        <Card className="mb-4">
          <p className="mb-2 font-semibold">Roll-up: {r.done} of {r.total} items approved or delivered</p>
          <div className="h-3 overflow-hidden rounded bg-[#E4E7EA]" role="progressbar" aria-valuemin={0} aria-valuemax={r.total} aria-valuenow={r.done} aria-label="Items approved"><div className="h-full bg-ok" style={{ width: `${(r.done / Math.max(1, r.total)) * 100}%` }} /></div>
          {!ready && !p.delivered && <p className="mt-2 text-sm text-warn">Delivery is blocked until every item is approved.</p>}
          <p className="mt-1 text-sm text-muted">Package due {fmtDateTime(p.dueAt)}</p>
        </Card>
        <Card title="Items in this package" pad={false}>
          <DataTable caption="Package items" rows={r.its} rowKey={i => i.id} onRow={i => openItem(i.id, i.type)}
            cols={[{ key: 'id', header: 'ID', render: i => <A to={`/review/${i.id}`}>{i.id}</A> }, { key: 't', header: 'Type', render: i => TYPE_NAME[i.type] }, { key: 's', header: 'Status', render: i => <StageChip item={i} /> }, { key: 'c', header: 'Deadline', render: i => <ClockChip item={i} /> }]} />
        </Card>
      </>
    )
  }

  const candidates = all.filter(i => i.billId === bill && !i.packageId && i.type !== 'BA')
  return (
    <>
      <PageHeader title="Packages" subtitle="Bundle fiscal notes, estimates and data requests and deliver them as one product."
        actions={['Assigner', 'Manager', 'Administrator', 'Analyst'].includes(role) ? <Button icon="plus" onClick={() => setNw(true)}>New package</Button> : undefined} />
      <Card pad={false}>
        <DataTable caption="Packages" rows={data.packages} rowKey={p => p.id} onRow={p => go(`/packages/${p.id}`)}
          cols={[
            { key: 'id', header: 'Package', render: p => <A to={`/packages/${p.id}`} className="font-semibold">{p.id}</A> },
            { key: 'n', header: 'Name', render: p => p.name },
            { key: 'i', header: 'Items', render: p => p.itemIds.length },
            { key: 'r', header: 'Roll-up status', render: p => { const r = rollup(p); return p.delivered ? <Chip tone="ok" icon="send">Delivered</Chip> : <span className="flex flex-wrap gap-1"><Chip tone="info" icon="clock">{r.stage}</Chip><Chip>{r.done} of {r.total} approved</Chip>{r.held && <Chip tone="warn" icon="pause">Item on hold</Chip>}</span> } },
            { key: 'd', header: 'Due', render: p => <span className="tnum">{fmtDateTime(p.dueAt)}</span>, className: 'hidden md:table-cell' },
          ]} />
      </Card>
      {nw && (
        <Modal title="New package" onClose={() => setNw(false)}>
          <Field label="Bill" htmlFor="pb"><Select id="pb" value={bill} onChange={setBill} options={data.bills.filter(b => b.session === '2027' && !b.draft).map(b => ({ value: b.id, label: `${billLabel(b)}: ${b.title.slice(0, 50)}` }))} /></Field>
          <p className="my-3 text-sm text-muted">{candidates.length} unbundled note, estimate or request items exist for this bill.</p>
          <div className="flex gap-2">
            <Button disabled={!candidates.length} onClick={() => {
              const pid = `PK-27-${String(data.idCounters.PK ?? data.packages.length + 1).padStart(3, '0')}`
              patchData(d => ({ ...d, idCounters: { ...d.idCounters, PK: (d.idCounters.PK ?? 4) + 1 }, packages: [...d.packages, { id: pid, name: `${billLabel(d.bills.find(b => b.id === bill)!)} response package`, billId: bill, itemIds: candidates.map(c => c.id), dueAt: new Date(Math.min(...candidates.map(c => ms(c.dueAt)))).toISOString(), delivered: false }], items: d.items.map(i => (candidates.some(c => c.id === i.id) ? { ...i, packageId: pid } : i)) }))
              audit('Created', pid, `Package with ${candidates.length} items`); toast(`${pid} created with ${candidates.length} items.`); setNw(false); go(`/packages/${pid}`)
            }}>Create package</Button>
            <Button variant="secondary" onClick={() => setNw(false)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </>
  )
}
