import { useState } from 'react'
import { useStore, useMe, useVisibleItems } from '../store'
import { A, Button, Card, Chip, ClockChip, EmptyState, Field, Icon, LinkButton, PageHeader, StageChip, inputCls, Skeleton, useLoading } from '../components/ui'
import { billLabel, fiscalTotal, fmtDateTime, money } from '../lib'
import type { WorkItem } from '../types'

// Approvals screen. Built for phone widths: large touch targets, one column, no tables.
export default function Executive() {
  const loading = useLoading(300)
  const { data, userId, approve, returnForRework, role } = useStore()
  const me = useMe()
  const items = useVisibleItems()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const staff = (id?: string) => data.staff.find(s => s.id === id)?.name ?? ''

  const waitingOnMe = (i: WorkItem) => (i.stage === 'In review' && i.reviewerId === userId) || (i.stage === 'Executive review' && i.execChain[i.execIndex] === userId)
  const mine = items.filter(waitingOnMe)
  const upstream = items.filter(i => (i.stage === 'Executive review' || i.stage === 'In review') && !waitingOnMe(i) && (i.execChain.includes(userId) || i.reviewerId === userId))
  const overview = ['Manager', 'Leadership', 'Administrator'].includes(role) ? items.filter(i => i.stage === 'Executive review' && !waitingOnMe(i)) : []
  if (loading) return <><PageHeader title="Approvals" /><Skeleton rows={6} /></>

  const card = (i: WorkItem, actionable: boolean) => {
    const bill = data.bills.find(b => b.id === i.billId)!
    return (
      <li key={i.id}>
        <Card className="h-full">
          <div className="flex flex-wrap items-center gap-2"><A to={`/review/${i.id}`} className="text-lg font-semibold">{i.id}</A><StageChip item={i} />{i.confidential && <Chip icon="lock">Confidential</Chip>}{i.billChanged && <Chip tone="warn" icon="alert">Bill changed</Chip>}</div>
          <p className="mt-1">{billLabel(bill)}: {bill.title}</p>
          <dl className="my-3 grid grid-cols-2 gap-2 text-[15px]">
            <div><dt className="text-sm text-muted">Deadline</dt><dd><ClockChip item={i} /></dd></div>
            <div><dt className="text-sm text-muted">Customer due</dt><dd className="tnum">{fmtDateTime(i.customerDueAt)}</dd></div>
            {i.fiscal && <div><dt className="text-sm text-muted">Revenue, 4 years</dt><dd className="tnum font-semibold">{money(fiscalTotal(i))}</dd></div>}
            <div><dt className="text-sm text-muted">Prepared by</dt><dd>{staff(i.preparerId)}</dd></div>
          </dl>
          {i.execChain.length > 0 && (
            <ol className="mb-3 flex flex-wrap gap-1" aria-label="Executive review sequence">
              {i.execChain.map((c, ix) => <li key={c}><Chip tone={i.execIndex > ix || i.stage === 'Approved' ? 'ok' : i.execIndex === ix && i.stage === 'Executive review' ? 'info' : 'neutral'} icon={i.execIndex > ix ? 'check' : i.execIndex === ix ? 'eye' : 'clock'}>{ix + 1}. {staff(c)}</Chip></li>)}
            </ol>
          )}
          {i.comments.filter(c => c.kind === 'return').slice(-1).map(c => <p key={c.id} className="mb-3 rounded bg-page p-2 text-sm"><strong>Latest return note:</strong> {c.text}</p>)}
          {actionable ? (
            <>
              <Field label="Comment" htmlFor={`n-${i.id}`}><textarea id={`n-${i.id}`} rows={2} spellCheck className={inputCls} value={notes[i.id] ?? ''} onChange={e => setNotes({ ...notes, [i.id]: e.target.value })} placeholder="Required if you return this for rework" /></Field>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button icon="check" className="min-h-[52px]" onClick={() => approve(i.id)}>Approve</Button>
                <Button variant="secondary" icon="undo" className="min-h-[52px]" onClick={() => { if (returnForRework(i.id, notes[i.id] ?? '')) setNotes({ ...notes, [i.id]: '' }) }}>Return</Button>
              </div>
              <LinkButton to={`/review/${i.id}`} variant="ghost" className="mt-2 w-full">Open full review</LinkButton>
            </>
          ) : <LinkButton to={`/review/${i.id}`} variant="secondary" className="w-full">Open</LinkButton>}
        </Card>
      </li>
    )
  }

  return (
    <>
      <PageHeader title="Approvals" subtitle={`Waiting for ${me.name}. Executive reviewers are notified in sequence.`} />
      <h2 className="mb-2 text-lg font-semibold text-navy">Waiting for you ({mine.length})</h2>
      {mine.length === 0 ? <Card><EmptyState title="Nothing waiting for your approval" text="Items appear here when it is your turn in the sequence. Try switching to a different executive reviewer in the user menu." /></Card> : <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{mine.map(i => card(i, true))}</ul>}
      {upstream.length > 0 && <><h2 className="mb-2 mt-6 text-lg font-semibold text-navy">Coming to you ({upstream.length})</h2><ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{upstream.map(i => card(i, false))}</ul></>}
      {overview.length > 0 && <><h2 className="mb-2 mt-6 text-lg font-semibold text-navy">In executive review ({overview.length})</h2><ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{overview.slice(0, 6).map(i => card(i, false))}</ul></>}
      <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Icon name="shield" size={16} />Approve or return in one tap. The next reviewer is notified automatically.</p>
    </>
  )
}
