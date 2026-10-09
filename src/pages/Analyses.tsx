import { getBill } from '../retrieval'
import { useEffect, useRef, useState } from 'react'
import { useStore, useMe, useVisibleItems } from '../store'
import { A, Button, Card, Chip, ClockChip, DataTable, EmptyState, Field, LinkButton, PageHeader, Presence, Select, StageChip, inputCls, Skeleton, useLoading, Icon } from '../components/ui'
import { billLabel, canAssign, fmtDate, fmtDateTime, iso, ms } from '../lib'
import { SavedIndicator, useDebouncedSave, canEditItem } from './Fiscal'
import { go } from '../router'
import type { WorkItem } from '../types'

export function Analyses() {
  const loading = useLoading(300)
  const { data, role, createItem } = useStore()
  const all = useVisibleItems().filter(i => i.type === 'BA')
  const [st, setSt] = useState('All')
  const [bill, setBill] = useState((data.bills.find(b => b.session === data.sessions.find(s => s.current)?.id) ?? data.bills[0])?.id ?? '')
  const rows = all.filter(i => st === 'All' || i.stage === st)
  if (loading) return <><PageHeader title="Bill Analyses" /><Skeleton rows={8} /></>
  return (
    <>
      <PageHeader title="Bill Analyses" subtitle={`${all.length} analyses across all workflow states.`} />
      <Card className="mb-4"><div className="flex flex-wrap items-end gap-3">
        <Field label="Status" htmlFor="as"><Select id="as" value={st} onChange={setSt} options={['All', 'Assigned', 'In progress', 'In review', 'Rework', 'Executive review', 'Approved', 'Delivered']} /></Field>
        {['Analyst', 'Assigner', 'Manager', 'Administrator'].includes(role) && <>
          <Field label="Start a new analysis for" htmlFor="ab"><Select id="ab" value={bill} onChange={setBill} options={data.bills.filter(b => !b.draft).map(b => ({ value: b.id, label: `${billLabel(b)}: ${b.title.slice(0, 50)}` }))} /></Field>
          <Button icon="plus" onClick={() => { const it = createItem('BA', bill, canAssign(role) ? {} : { stage: 'In progress' }); go(`/analyses/${it.id}`) }}>New analysis</Button></>}
      </div></Card>
      <Card pad={false}>
        <DataTable caption="Bill analyses" rows={rows} rowKey={i => i.id} onRow={i => go(`/analyses/${i.id}`)}
          cols={[
            { key: 'id', header: 'ID', sort: i => i.id, render: i => <span className="flex items-center gap-2"><A to={`/analyses/${i.id}`} className="font-semibold">{i.id}</A><Presence itemId={i.id} />{i.confidential && <Chip icon="lock">Confidential</Chip>}{i.hasIssues && <Chip tone="warn" icon="flag">Issues</Chip>}</span> },
            { key: 'b', header: 'Bill', render: i => billLabel(getBill(data, i.billId)!) },
            { key: 'p', header: 'Published', render: i => (i.publishedVersion ? <Chip tone="ok" icon="check">Version {i.publishedVersion}</Chip> : <span className="text-muted">Not published</span>), className: 'hidden md:table-cell' },
            { key: 's', header: 'Status', render: i => <StageChip item={i} /> },
            { key: 'c', header: 'Deadline', sort: i => ms(i.dueAt), render: i => <ClockChip item={i} /> },
          ]} />
      </Card>
    </>
  )
}

export function AnalysisEditor({ id }: { id: string }) {
  const loading = useLoading(300)
  const { data, role, userId, saveItem, submitForReview, publish, audit, toast } = useStore()
  const me = useMe()
  const item = useVisibleItems().find(i => i.id === id)
  const ed = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [clause, setClause] = useState('')
  const [corr, setCorr] = useState({ to: '', note: '', contactType: 'External', sent: new Date().toISOString().slice(0, 10) })
  const { run, flush, saving: sv } = useDebouncedSave<string>(html => saveItem(id, i => ({ ...i, body: html }), 'Edited analysis text'))
  useEffect(() => setSaving(sv), [sv])
  useEffect(() => { if (item?.confidential) audit('Viewed confidential item', item.id, 'Opened analysis', true) }, [id]) // eslint-disable-line
  useEffect(() => { if (ed.current && item) ed.current.innerHTML = item.body ?? '' }, [id, loading, role]) // eslint-disable-line
  if (!item) return <EmptyState title="Analysis not found" action={<LinkButton to="/analyses">Back to analyses</LinkButton>} />
  if (loading) return <Skeleton rows={9} />
  const bill = getBill(data, item.billId)!
  const editable = canEditItem(item, role, userId) && (['Assigned', 'In progress', 'Rework', 'Delivered'].includes(item.stage))
  const canPublish = ['Manager', 'Assigner', 'Administrator'].includes(role) && item.stage === 'Approved' && item.reviewApproved
  const cmd = (c: string, v?: string) => { ed.current?.focus(); document.execCommand(c, false, v); run(ed.current!.innerHTML) }
  const insert = (html: string) => {
    const e = ed.current!
    e.focus()
    const sel = window.getSelection()
    if (!sel?.rangeCount || !e.contains(sel.anchorNode)) { const r = document.createRange(); r.selectNodeContents(e); r.collapse(false); sel?.removeAllRanges(); sel?.addRange(r) }
    document.execCommand('insertHTML', false, html)
    run(e.innerHTML)
  }
  const tb = 'min-h-[36px] rounded border border-line bg-white px-3 text-[15px] font-semibold hover:bg-lightblue disabled:opacity-50'
  const topics = item.topics ?? []
  const upd = (fn: (i: WorkItem) => WorkItem, d?: string) => saveItem(item.id, fn, d)

  return (
    <>
      <PageHeader crumbs={[{ label: 'Bill Analyses', to: '/analyses' }, { label: item.id }]}
        title={<span className="flex flex-wrap items-center gap-3">{item.id} <StageChip item={item} />{item.confidential && <Chip icon="lock">Confidential</Chip>}{item.hasIssues && <Chip tone="warn" icon="flag">Has issues</Chip>}<Presence itemId={item.id} /></span>}
        subtitle={<><A to={`/bills/${bill.id}`}>{billLabel(bill)}</A>: {bill.title}</>}
        actions={<>
          {editable && ['Assigned', 'In progress', 'Rework'].includes(item.stage) && <Button variant="secondary" icon="send" onClick={() => { flush(); submitForReview(item.id) }}>Mark done and notify next</Button>}
          <Button disabled={!canPublish || busy} icon="upload" onClick={async () => { setBusy(true); await publish(item.id); setBusy(false) }}>{item.publishedVersion ? `Re-publish (now version ${item.publishedVersion})` : 'Publish'}</Button>
          <LinkButton to={`/review/${item.id}`} variant="secondary" icon="shield">Review and deliver</LinkButton>
        </>} />
      <div className="mb-4 flex flex-wrap items-center gap-4"><ClockChip item={item} /><SavedIndicator savedAt={item.savedAt} saving={saving} />
        <LinkButton to={`/compare?bill=${bill.id}`} variant="ghost" icon="compare">Compare bill versions</LinkButton></div>
      {item.changesPending && <div role="status" className="mb-4 rounded border border-line p-3">Published — Changes Pending. Submit changes through review before republishing. The last published revision remains retained.</div>}
      <Card title="Analysis version and publication history" className="mb-4"><p>Bill version: {bill.versions.find(v => v.id === item.billVersionId)?.label ?? 'Legacy version'}</p>{item.provenance && <p>{item.provenance}</p>}{(item.revisions ?? []).map(r => <details key={r.revision}><summary>Published revision {r.revision} · {fmtDateTime(r.at)}</summary><pre className="whitespace-pre-wrap">{r.body.replace(/<[^>]*>/g, ' ')}</pre><p>Topics: {r.topics.join(', ')}{role !== 'Read-only' && <> · Issues: {r.issueNotes}</>}</p></details>)}</Card>
      {item.billChanged && <div role="alert" className="mb-4 rounded border border-[#E5B677] bg-[#FFF1DE] p-3 text-[#5E3200]"><Icon name="alert" className="mr-2 inline text-warn" /><strong>Bill changed.</strong> A new version was filed. Compare versions and update the analysis. <Button variant="secondary" className="ml-2" onClick={() => { useStore.getState().updateItem(item.id, i => ({ ...i, billChanged: false })); toast('Change acknowledged.') }}>Acknowledge</Button></div>}
      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card title="Analysis text" pad={false}>
            <div className="flex flex-wrap gap-1 border-b border-line p-2" role="toolbar" aria-label="Text formatting">
              {[['Bold', () => cmd('bold')], ['Italic', () => cmd('italic')], ['Heading', () => cmd('formatBlock', 'h3')], ['Paragraph', () => cmd('formatBlock', 'p')], ['Bullets', () => cmd('insertUnorderedList')], ['Numbered', () => cmd('insertOrderedList')], ['Undo', () => cmd('undo')], ['Redo', () => cmd('redo')]].map(([l, f]) => (
                <button key={l as string} type="button" disabled={!editable} className={tb} onMouseDown={e => e.preventDefault()} onClick={f as () => void}>{l as string}</button>
              ))}
              <span className="ml-auto self-center text-sm text-muted">Spell check is on. Misspelled words are underlined.</span>
            </div>
            <div ref={ed} contentEditable={editable} suppressContentEditableWarning spellCheck role="textbox" aria-multiline="true" aria-label="Analysis text" tabIndex={0}
              onInput={() => run(ed.current!.innerHTML)} className={`editor-area min-h-[22rem] p-4 leading-relaxed ${!editable ? 'bg-page' : ''}`} />
          </Card>
          <Card title="Correspondence log" pad={false}>
            <DataTable caption="Correspondence" rows={item.correspondence ?? []} rowKey={c => c.id} empty={<EmptyState title="No correspondence logged" />}
              cols={[{ key: 'to', header: 'To whom', render: c => c.to }, { key: 's', header: 'Sent', render: c => fmtDate(c.sent) }, { key: 'note', header: 'Collaboration notes', render: c => c.note },
                { key: 'r', header: 'Response received', render: c => <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" disabled={!editable} checked={c.responseReceived} onChange={e => upd(i => ({ ...i, correspondence: i.correspondence!.map(x => (x.id === c.id ? { ...x, responseReceived: e.target.checked, responseDate: e.target.checked ? iso(Date.now()) : undefined } : x)) }), 'Updated correspondence')} />{c.responseReceived ? <Chip tone="ok" icon="check">Yes</Chip> : <Chip tone="warn" icon="clock">Waiting</Chip>}</label> }]} />
            {editable && (
              <div className="flex flex-wrap items-end gap-3 border-t border-line p-4">
                <Field label="To whom" htmlFor="cto"><input id="cto" className={inputCls} value={corr.to} onChange={e => setCorr({ ...corr, to: e.target.value })} /></Field>
                <Field label="Contact type" htmlFor="contact-type"><Select id="contact-type" value={corr.contactType} onChange={v => setCorr({ ...corr, contactType: v })} options={['Internal', 'External']} /></Field><Field label="Collaboration notes" htmlFor="contact-note"><input id="contact-note" className={inputCls} value={corr.note} onChange={e => setCorr({ ...corr, note: e.target.value })} /></Field>
                <Field label="Sent date" htmlFor="csd"><input id="csd" type="date" className={inputCls} value={corr.sent} onChange={e => setCorr({ ...corr, sent: e.target.value })} /></Field>
                <Button variant="secondary" icon="plus" disabled={!corr.to.trim()} onClick={() => { upd(i => ({ ...i, correspondence: [...(i.correspondence ?? []), { id: `m${Date.now()}`, to: corr.to, sent: new Date(corr.sent).toISOString(), responseReceived: false, note: `${corr.contactType}: ${corr.note}` }] }), 'Logged correspondence'); setCorr({ ...corr, to: '' }); toast('Correspondence logged.') }}>Add entry</Button>
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Clause library">
            <p className="mb-2 text-sm text-muted">Insert a prepopulated clause at the cursor.</p>
            <ul className="space-y-2">
              {data.clauses.map(c => (
                <li key={c.id}><button type="button" disabled={!editable} onMouseDown={e => e.preventDefault()} onClick={() => { insert(`<p>${c.text}</p>`); setClause(c.title); toast(`Inserted clause: ${c.title}`, 'info') }} className="w-full rounded border border-line bg-white px-3 py-2 text-left text-[15px] hover:bg-lightblue disabled:opacity-50"><span className="font-semibold text-blue">{c.title}</span></button></li>
              ))}
            </ul>
            <p className="sr-only" role="status">{clause && `Inserted ${clause}`}</p>
          </Card>
          <Card title="Topics">
            <fieldset><legend className="sr-only">Topic tags</legend>
              <div className="flex flex-wrap gap-2">
                {data.picklists.Topics.map(t => {
                  const on = topics.includes(t)
                  return <label key={t} className={`flex min-h-[36px] cursor-pointer items-center gap-1 rounded border px-2 text-sm ${on ? 'border-blue bg-lightblue font-semibold text-[#08487F]' : 'border-line bg-white'}`}><input type="checkbox" className="h-4 w-4" disabled={!editable} checked={on} onChange={() => upd(i => ({ ...i, topics: on ? topics.filter(x => x !== t) : [...topics, t] }), 'Edited topic tags')} />{t}</label>
                })}
              </div>
            </fieldset>
          </Card>
          <Card title="Issues">
            <label className="flex min-h-[40px] items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" disabled={!editable} checked={!!item.hasIssues} onChange={e => upd(i => ({ ...i, hasIssues: e.target.checked }), 'Changed Has issues flag')} />Has issues</label>
            {role !== 'Read-only' && (
              <Field label="Issue notes (internal)" htmlFor="isn"><textarea id="isn" rows={4} spellCheck disabled={!editable} className={`${inputCls} mt-1`} value={item.issueNotes ?? ''} onChange={e => upd(i => ({ ...i, issueNotes: e.target.value }), 'Edited issue notes')} /></Field>
            )}
            <p className="mt-1 text-sm text-muted">Last saved {fmtDateTime(item.savedAt)} by {me.name}.</p>
          </Card>
        </div>
      </div>
    </>
  )
}
