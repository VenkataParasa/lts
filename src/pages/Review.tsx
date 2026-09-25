import { useMemo, useState } from 'react'
import { useStore, useMe } from '../store'
import { A, Avatar, Button, Card, Chip, ClockChip, DataTable, EmptyState, Field, Icon, LinkButton, PageHeader, Select, StageChip, Stepper, Tabs, inputCls, Skeleton, useLoading } from '../components/ui'
import { billLabel, fmtDateTime, money, relTime } from '../lib'
import { calcSection } from './Fiscal'
import type { WorkItem, Seed } from '../types'

const stripHtml = (h: string) => h.replace(/<\/(h3|p|li)>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function renderTemplate(body: string, item: WorkItem, data: Seed, xml = false): string {
  const bill = data.bills.find(b => b.id === item.billId)!
  const cv = bill.versions.find(v => v.id === bill.currentVersionId)!
  const total = item.fiscal ? item.fiscal.revenue.reduce((s, r) => s + r.values.reduce((a, b) => a + b, 0), 0) : 0
  const exp = item.fiscal ? item.fiscal.expenditure.reduce((s, sec) => s + calcSection(sec, data.costRules).reduce((a, x) => a + x.total, 0), 0) : 0
  const last = item.history[item.history.length - 1]
  const map: Record<string, string> = {
    'item.id': item.id, 'item.preparer': data.staff.find(s => s.id === item.preparerId)?.name ?? '', 'item.topics': (item.topics ?? []).join(', '),
    'bill.label': cv.label, 'bill.number': bill.number ?? 'Draft', 'bill.title': bill.title, 'bill.session': bill.session,
    'fiscal.summary': item.fiscal?.narrative.summary ?? '', 'fiscal.assumptions': item.fiscal?.narrative.assumptions ?? '',
    'fiscal.total': money(total), 'fiscal.expenditure': money(exp),
    'delivery.date': new Date(last?.at ?? Date.now()).toLocaleDateString('en-US'), 'analysis.body': stripHtml(item.body ?? item.question ?? ''),
  }
  return body.replace(/\{\{([\w.]+)\}\}/g, (_, k) => (xml ? esc(map[k] ?? '') : map[k] ?? `[${k}]`))
}

export default function Review({ id }: { id: string }) {
  const loading = useLoading(300)
  const { data, role, userId, approve, returnForRework, submitForReview, addComment, deliver, now, toast } = useStore()
  const me = useMe()
  const item = data.items.find(i => i.id === id)
  const [text, setText] = useState('')
  const [sec, setSec] = useState('General')
  const [busy, setBusy] = useState(false)
  const [pv, setPv] = useState('Word')
  const audit = useMemo(() => data.audit.filter(a => a.target === id).slice(0, 12), [data.audit, id])
  if (!item) return <EmptyState title="Item not found" text="Pick a work product from the queue." action={<LinkButton to="/queue">Go to my queue</LinkButton>} />
  if (loading) return <Skeleton rows={9} />
  const staff = (sid?: string) => data.staff.find(s => s.id === sid)
  const bill = data.bills.find(b => b.id === item.billId)!
  const openTo = item.type === 'FN' ? `/fiscal/${item.id}` : item.type === 'BA' ? `/analyses/${item.id}` : `/estimates/${item.id}`

  const chain = item.execChain
  const stageDone = { prep: !['Assigned', 'In progress', 'Rework'].includes(item.stage), rev: item.reviewApproved || ['Approved', 'Delivered'].includes(item.stage), gate: ['Approved', 'Delivered'].includes(item.stage), del: item.stage === 'Delivered' }
  const steps = [
    { label: 'Prepared', sub: staff(item.preparerId)?.name, done: stageDone.prep },
    { label: 'Reviewer', sub: staff(item.reviewerId)?.name, done: stageDone.rev },
    ...chain.map((c, i) => ({ label: `Executive ${i + 1}`, sub: staff(c)?.name, done: item.execIndex > i || stageDone.gate })),
    { label: 'Final gate', sub: stageDone.gate ? 'All approvals complete' : 'Blocks delivery', done: stageDone.gate },
    { label: 'Delivered', sub: stageDone.del ? 'Locked' : undefined, done: stageDone.del },
  ]
  const current = steps.findIndex(s => !s.done)

  const isPreparer = item.preparerId === userId
  const reviewTurn = item.stage === 'In review'
  const execTurn = item.stage === 'Executive review'
  const expectedId = reviewTurn ? item.reviewerId : execTurn ? chain[item.execIndex] : undefined
  const roleOk = reviewTurn ? ['Reviewer', 'Manager', 'Administrator'].includes(role) : execTurn ? userId === expectedId : false
  let why = ''
  if (reviewTurn || execTurn) {
    if (isPreparer) why = 'You prepared this work product, so you cannot approve or return it.'
    else if (!roleOk) why = execTurn ? `Waiting on ${staff(expectedId)?.name}. Executive reviews happen in sequence.` : `Waiting on ${staff(expectedId)?.name ?? 'the reviewer'} at review.`
  }
  const canAct = (reviewTurn || execTurn) && !why
  const canSubmit = ['Assigned', 'In progress', 'Rework'].includes(item.stage) && (isPreparer || ['Manager', 'Assigner', 'Administrator'].includes(role))
  const canDeliver = ['Manager', 'Assigner', 'Administrator', 'Budget Office', 'Analyst', 'Leadership'].includes(role)

  const target = item.type === 'FN' ? 'OFM FNS' : item.type === 'FE' ? 'OFM BEARS' : item.type === 'BA' ? 'SharePoint' : 'Email'
  const actionLabel = item.type === 'FN' ? 'Transmit to OFM FNS' : item.type === 'FE' ? 'Transmit to OFM BEARS' : item.type === 'BA' ? 'Publish to SharePoint' : 'Send to requester by email'
  const tpl = (fmt: string) => data.templates.find(t => (item.type === 'FN' || item.type === 'FE') ? t.format === fmt && t.id !== 'T4' : t.id === 'T4')
  const previewFormats = item.type === 'FN' || item.type === 'FE' ? ['Word', 'PDF', 'OFM XML'] : ['Word']
  const t = tpl(pv) ?? tpl('Word')!
  const rendered = renderTemplate(t.body, item, data, t.format === 'OFM XML')
  const missing = [
    !stageDone.prep && 'Preparer has not marked the work done',
    !stageDone.rev && `Reviewer approval (${staff(item.reviewerId)?.name ?? 'reviewer'})`,
    ...chain.map((c, i) => (item.execIndex > i || stageDone.gate ? '' : `Executive approval ${i + 1}: ${staff(c)?.name}`)),
  ].filter(Boolean) as string[]

  return (
    <>
      <PageHeader crumbs={[{ label: 'My Queue', to: '/queue' }, { label: item.id }]}
        title={<span className="flex flex-wrap items-center gap-3">Review: {item.id} <StageChip item={item} />{item.confidential && <Chip icon="lock">Confidential</Chip>}</span>}
        subtitle={<><A to={`/bills/${bill.id}`}>{billLabel(bill)}</A>: {item.title}</>}
        actions={<LinkButton to={openTo} variant="secondary" icon="edit">Open work product</LinkButton>} />
      <div className="mb-4 flex flex-wrap items-center gap-4"><ClockChip item={item} /><span>Customer due <span className="tnum font-semibold">{fmtDateTime(item.customerDueAt)}</span></span>{item.billChanged && <Chip tone="warn" icon="alert">Bill changed</Chip>}</div>

      <Card title="Approval path" className="mb-4"><Stepper steps={steps} current={current === -1 ? steps.length : current} /></Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Your action">
          {canSubmit && (
            <div className="mb-3"><Button icon="send" className="w-full sm:w-auto" onClick={() => submitForReview(item.id)}>Mark done and notify next</Button>
              <p className="mt-1 text-sm text-muted">Sends this to {staff(item.reviewerId)?.name} for review.</p></div>
          )}
          {(reviewTurn || execTurn) && (
            <>
              <p className="mb-2">{execTurn ? `Executive review ${item.execIndex + 1} of ${chain.length}: ${staff(expectedId)?.name}` : `Review: ${staff(item.reviewerId)?.name}`}</p>
              {why && <p role="status" className="mb-3 flex items-start gap-2 rounded border border-[#E5B677] bg-[#FFF1DE] p-2 text-[#5E3200]"><Icon name="lock" className="mt-0.5" />{why}</p>}
              <Field label="Comment (required to return for rework)" htmlFor="rc"><textarea id="rc" rows={3} spellCheck className={inputCls} value={text} onChange={e => setText(e.target.value)} disabled={!canAct} /></Field>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button icon="check" disabled={!canAct} className="min-h-[48px] sm:min-h-[40px]" onClick={() => { if (approve(item.id)) setText('') }}>Approve</Button>
                <Button variant="secondary" icon="undo" disabled={!canAct} className="min-h-[48px] sm:min-h-[40px]" onClick={() => { if (returnForRework(item.id, text)) setText('') }}>Return for rework</Button>
              </div>
            </>
          )}
          {!canSubmit && !reviewTurn && !execTurn && <p className="text-muted">{item.stage === 'Rework' ? 'Waiting on the preparer to fix the returned items.' : item.stage === 'Approved' ? 'All approvals are complete. Deliver from the panel below.' : item.stage === 'Delivered' ? 'This item was delivered and is locked.' : 'No approval action is waiting for you here.'}</p>}
        </Card>

        <Card title="Comments">
          <ul className="mb-3 max-h-72 space-y-3 overflow-auto">
            {item.comments.length === 0 && <li className="text-muted">No comments yet.</li>}
            {item.comments.map(c => (
              <li key={c.id} className="flex gap-2"><Avatar name={staff(c.by)?.name ?? '?'} />
                <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2 text-sm text-muted">{staff(c.by)?.name} <span>{relTime(c.at, now)}</span>
                  {c.kind === 'return' && <Chip tone="warn" icon="undo">Returned</Chip>}{c.kind === 'approve' && <Chip tone="ok" icon="check">Approved</Chip>}{c.section && <Chip>{c.section}</Chip>}</p>
                  <p>{c.text}</p></div></li>
            ))}
          </ul>
          {role !== 'Read-only' && (
            <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
              <Field label="Section" htmlFor="cs"><Select id="cs" value={sec} onChange={setSec} options={['General', 'Summary', 'Assumptions', 'Revenue', 'Expenditure', 'Methodology']} /></Field>
              <div className="min-w-[10rem] flex-1"><Field label="Add comment" htmlFor="cm"><input id="cm" className={inputCls} value={text} onChange={e => setText(e.target.value)} /></Field></div>
              <Button variant="secondary" disabled={!text.trim() || item.locked} onClick={() => { addComment(item.id, text, 'comment', sec === 'General' ? undefined : sec); setText(''); toast('Comment added.') }}>Add</Button>
            </div>
          )}
        </Card>
      </div>

      <Card title="Final gate and delivery" className="mt-4" actions={item.locked && <Chip tone="ok" icon="lock">Locked at version {item.version}</Chip>}>
        {!stageDone.gate ? (
          <div role="status" className="mb-4 rounded border border-[#E3A19B] bg-[#FBE9E7] p-3 text-[#6E140E]">
            <p className="flex items-center gap-2 font-semibold"><Icon name="lock" />Delivery is blocked until all approvals are complete.</p>
            <ul className="mt-1 list-disc pl-6">{missing.map(m => <li key={m}>{m}</li>)}</ul>
          </div>
        ) : !item.locked ? (
          <p className="mb-4 flex items-center gap-2 rounded border border-[#9CCB9F] bg-[#E8F3E9] p-3 text-[#1E5A22]"><Icon name="check" />All approvals complete. This item can be delivered.</p>
        ) : null}
        {canDeliver && (
          <>
            <Tabs label="Preview format" value={pv} onChange={setPv} tabs={previewFormats.map(f => ({ id: f, label: `${f} preview` }))} />
            {pv === 'PDF' ? (
              <div className="mx-auto max-w-2xl bg-[#E4E7EA] p-4"><div className="min-h-[18rem] whitespace-pre-wrap bg-white p-8 text-[14px] shadow"><div className="mb-3 border-b-2 border-navy pb-2 text-lg font-semibold text-navy">Washington State Department of Revenue</div>{rendered}</div></div>
            ) : pv === 'OFM XML' ? (
              <pre tabIndex={0} aria-label="OFM XML preview" className="max-h-72 overflow-auto rounded bg-[#1B2733] p-4 text-sm text-[#E8EEF3]">{rendered}</pre>
            ) : (
              <div tabIndex={0} aria-label="Word preview" className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-line bg-white p-6 font-serif text-[15px]">{rendered}</div>
            )}
            <p className="mt-1 text-sm text-muted">Generated from template "{t.name}". Edit templates in Admin.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button icon="send" disabled={!stageDone.gate || item.locked || busy} className="min-h-[48px] sm:min-h-[40px]" onClick={async () => { setBusy(true); await deliver(item.id); setBusy(false) }}>{busy ? 'Sending...' : actionLabel}</Button>
              <Button variant="secondary" icon="download" onClick={() => toast(`Downloaded ${item.id}.${pv === 'Word' ? 'docx' : pv === 'PDF' ? 'pdf' : 'xml'} (simulated)`, 'info')}>Download {pv}</Button>
              <span className="text-sm text-muted">Target: {target} (simulated)</span>
            </div>
          </>
        )}
        {item.history.length > 0 && (
          <div className="mt-5"><h3 className="mb-1 font-semibold text-navy">Delivery history</h3>
            <DataTable caption="Delivery history" rows={item.history} rowKey={h => h.id} cols={[{ key: 'v', header: 'Version', render: h => h.version }, { key: 'a', header: 'Sent', render: h => <span className="tnum">{fmtDateTime(h.at)}</span> }, { key: 'c', header: 'Channel', render: h => h.channel }, { key: 'r', header: 'Receipt ID', render: h => <span className="tnum font-semibold">{h.receipt}</span> }, { key: 'b', header: 'By', render: h => staff(h.by)?.name }]} />
          </div>
        )}
      </Card>

      {role !== 'Read-only' && (
        <Card title="Audit trail for this item" className="mt-4" pad={false}>
          <DataTable caption="Audit trail" rows={audit} rowKey={a => a.id} empty={<EmptyState title="No audit entries yet" />}
            cols={[{ key: 'w', header: 'When', render: a => <span className="tnum">{fmtDateTime(a.at)}</span> }, { key: 'u', header: 'User', render: a => `${staff(a.userId)?.name ?? a.userId} (${a.role})` }, { key: 'a', header: 'Action', render: a => <Chip icon={a.confidential ? 'lock' : 'shield'}>{a.action}</Chip> }, { key: 'd', header: 'Detail', render: a => a.detail }]} />
        </Card>
      )}
      <p className="sr-only">{me.name}</p>
    </>
  )
}
