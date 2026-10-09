import { getBill } from '../retrieval'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, useMe, useVisibleItems } from '../store'
import { A, Avatar, Button, Card, Chip, ClockChip, DataTable, EmptyState, Field, LinkButton, Modal, PageHeader, Presence, Select, StageChip, Tabs, inputCls, Skeleton, useLoading, openItem, Icon } from '../components/ui'
import { billLabel, canAssign, fiscalTotal, fmtDateTime, iso, ms, money, num, relTime, download } from '../lib'
import { go } from '../router'
import type { ExpSection, FiscalData, WorkItem } from '../types'

export const DISALLOWED = /[<>&"{}[\]\\^~|`\u0000-\u0008\u000B\u000C\u000E-\u001F‘’“”–—]/g

export function SavedIndicator({ savedAt, saving }: { savedAt: string; saving: boolean }) {
  const now = useStore(s => s.now)
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-1 text-sm text-muted">
      <Icon name={saving ? 'refresh' : 'check'} size={14} className={saving ? 'text-info' : 'text-ok'} />
      {saving ? 'Saving...' : `Saved ${relTime(savedAt, now)}`}
    </span>
  )
}

export function useDebouncedSave<T>(commit: (v: T) => void, delay = 600) {
  const [saving, setSaving] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<{ value: T; commit: (v: T) => void } | null>(null)
  const flush = () => { if (t.current) clearTimeout(t.current); const p = pending.current; pending.current = null; if (p) p.commit(p.value); setSaving(false) }
  const run = (v: T) => {
    setSaving(true)
    pending.current = { value: v, commit }
    if (t.current) clearTimeout(t.current)
    t.current = setTimeout(flush, delay)
  }
  useEffect(() => () => { if (t.current) clearTimeout(t.current); const p = pending.current; pending.current = null; if (p) p.commit(p.value) }, [])
  return { saving, run, flush }
}

export const canEditItem = (item: WorkItem, role: string, userId: string) =>
  !item.locked && (['Manager', 'Administrator', 'Assigner'].includes(role) || (['Analyst', 'Expenditure Contributor'].includes(role) && item.assigneeIds.includes(userId)))

// ---------- new fiscal note ----------
function NewFiscal({ onClose }: { onClose: () => void }) {
  const { data, createItem, role } = useStore()
  const bills = data.bills.filter(b => b.session === data.sessions.find(s => s.current)?.id)
  const [bill, setBill] = useState(bills[0].id)
  return (
    <Modal title="New fiscal note" onClose={onClose}>
      <Field label="Bill" htmlFor="nfb"><Select id="nfb" value={bill} onChange={setBill} options={bills.map(b => ({ value: b.id, label: `${billLabel(b)}: ${b.title.slice(0, 60)}` }))} /></Field>
      <p className="mt-2 text-sm text-muted">The ID is assigned automatically. The deadline is 72 hours, or hearing minus 4 hours if a hearing is under 72 hours away.</p>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => { const it = createItem('FN', bill, { stage: canAssign(role) ? 'Assigned' : 'In progress' }); onClose(); go(`/fiscal/${it.id}`) }}>Create fiscal note</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  )
}

export function FiscalList() {
  const loading = useLoading(300)
  const { data, role } = useStore()
  const all = useVisibleItems().filter(i => i.type === 'FN')
  const [st, setSt] = useState('All')
  const [q, setQ] = useState('')
  const [nw, setNw] = useState(false)
  const rows = all.filter(i => (st === 'All' || i.stage === st) && (!q || `${i.id} ${i.title}`.toLowerCase().includes(q.toLowerCase())))
  if (loading) return <><PageHeader title="Fiscal Notes" /><Skeleton rows={8} /></>
  return (
    <>
      <PageHeader title="Fiscal Notes" subtitle={role === 'Read-only' ? 'Delivered fiscal notes.' : `${all.length} fiscal notes across all workflow states.`}
        actions={role !== 'Read-only' && role !== 'Expenditure Contributor' && role !== 'Leadership' ? <Button icon="plus" onClick={() => setNw(true)}>New fiscal note</Button> : undefined} />
      <Card className="mb-4"><div className="flex flex-wrap gap-3">
        <Field label="Search" htmlFor="fq"><input id="fq" className={inputCls} value={q} onChange={e => setQ(e.target.value)} placeholder="ID or title" /></Field>
        <Field label="Status" htmlFor="fs"><Select id="fs" value={st} onChange={setSt} options={['All', 'Assigned', 'In progress', 'In review', 'Rework', 'Executive review', 'Approved', 'Delivered']} /></Field>
      </div></Card>
      <Card pad={false}>
        <DataTable caption="Fiscal notes" rows={rows} rowKey={i => i.id} onRow={i => go(`/fiscal/${i.id}`)}
          cols={[
            { key: 'id', header: 'ID', sort: i => i.id, render: i => <span className="flex items-center gap-2"><A to={`/fiscal/${i.id}`} className="font-semibold">{i.id}</A><Presence itemId={i.id} />{i.confidential && <Chip icon="lock">Confidential</Chip>}</span> },
            { key: 'b', header: 'Bill', render: i => { const b = getBill(data, i.billId)!; return billLabel(b) } },
            { key: 'p', header: 'Preparer', render: i => data.staff.find(s => s.id === i.preparerId)?.name, className: 'hidden md:table-cell' },
            { key: 'r', header: 'Revenue, 4 years', sort: i => fiscalTotal(i), render: i => <span className="tnum">{money(fiscalTotal(i))}</span>, className: 'hidden lg:table-cell text-right' },
            { key: 's', header: 'Status', render: i => <StageChip item={i} /> },
            { key: 'c', header: 'Deadline', sort: i => ms(i.dueAt), render: i => <ClockChip item={i} /> },
          ]} />
      </Card>
      {nw && <NewFiscal onClose={() => setNw(false)} />}
    </>
  )
}

// ---------- cost calculation ----------
export { calcSection } from '../fiscalCalculations'
import { calcSection } from '../fiscalCalculations'

const parseNum = (v: string) => { const n = Number(v.replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0 }

function NumInput({ value, onChange, label, w = 'w-28' }: { value: number; onChange: (n: number) => void; label: string; w?: string }) {
  const [t, setT] = useState(String(value))
  useEffect(() => { setT(String(value)) }, [value])
  return <input aria-label={label} inputMode="numeric" value={t} onChange={e => { setT(e.target.value); onChange(parseNum(e.target.value)) }} className={`min-h-[36px] ${w} rounded border border-[#8a8d91] bg-white px-2 text-right tnum`} />
}

// ---------- workspace ----------
export function FiscalWorkspace({ id, tab }: { id: string; tab: string }) {
  const loading = useLoading(300)
  const { data, role, userId, saveItem, updateItem, submitForReview, audit, toast, routeFiscal, external } = useStore()
  const me = useMe()
  const item = useVisibleItems().find(i => i.id === id)
  const bill = item && getBill(data, item.billId)
  const fiscal = item?.fiscal
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (item?.confidential) audit('Viewed confidential item', item.id, 'Opened fiscal workspace', true) }, [item?.id]) // eslint-disable-line

  const contributor = role === 'Expenditure Contributor'
  const tabs = useMemo(() => {
    const t = [{ id: 'narrative', label: 'Narrative' }, { id: 'revenue', label: 'Revenue' }, { id: 'expenditure', label: 'Expenditure & FTE' }, { id: 'assign', label: 'Assignments' }, { id: 'papers', label: 'Work papers & methodology' }, { id: 'prior', label: 'Prior-year comparison' }]
    return contributor ? t.filter(x => x.id === 'expenditure' || x.id === 'papers') : canAssign(role) ? t : t.filter(x => x.id !== 'assign')
  }, [contributor, role])
  const cur = tabs.some(t => t.id === tab) ? tab : tabs[0].id

  if (loading) return <Skeleton rows={9} />
  if (!item || !bill || !fiscal) return <EmptyState title="Item not found" text="It may not be available to your role." action={<LinkButton to="/fiscal">Back to fiscal notes</LinkButton>} />
  const editable = canEditItem(item, role, userId)
  const setFiscal = (fn: (f: FiscalData) => FiscalData, detail?: string) => saveItem(item.id, i => ({ ...i, fiscal: fn(i.fiscal!) }), detail)
  const canSubmit = editable && !contributor && ['Assigned', 'In progress', 'Rework'].includes(item.stage)

  return (
    <>
      <PageHeader crumbs={[{ label: item.type === 'FN' ? 'Fiscal Notes' : 'Estimates & Data Requests', to: item.type === 'FN' ? '/fiscal' : '/estimates' }, { label: item.id }]}
        title={<span className="flex flex-wrap items-center gap-3">{item.id} <StageChip item={item} /> {item.confidential && <Chip icon="lock">Confidential</Chip>} {item.execReview && <Chip tone="info" icon="shield">Executive review</Chip>} <Presence itemId={item.id} /></span>}
        subtitle={<><A to={`/bills/${bill.id}`}>{billLabel(bill)}</A>: {bill.title}</>}
        actions={<>
          {canSubmit && <Button icon="send" onClick={() => submitForReview(item.id)}>Mark done and notify next</Button>}
          <LinkButton to={`/review/${item.id}`} variant="secondary" icon="shield">Review and deliver</LinkButton>
        </>} />
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
        <ClockChip item={item} />
        <span>Customer due <span className="tnum font-semibold">{fmtDateTime(item.customerDueAt)}</span></span>
        <span>Preparer <span className="font-semibold">{data.staff.find(s => s.id === item.preparerId)?.name}</span></span>
        <SavedIndicator savedAt={item.savedAt} saving={saving} />
        {!editable && <Chip tone="neutral" icon={item.locked ? 'lock' : 'eye'}>{item.locked ? 'Locked after delivery' : 'View only'}</Chip>}
      </div>
      {item.billChanged && (
        <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded border border-[#E5B677] bg-[#FFF1DE] p-3 text-[#5E3200]">
          <Icon name="alert" className="text-warn" />
          <p className="flex-1"><strong>Bill changed.</strong> A new version was filed after this work started. Compare versions and confirm the estimate still applies.</p>
          <LinkButton to={`/compare?bill=${bill.id}`} variant="secondary" icon="compare">Compare versions</LinkButton>
          <Button variant="secondary" onClick={() => { updateItem(item.id, i => ({ ...i, billChanged: false })); toast('Change acknowledged.') }}>Acknowledge</Button>
        </div>
      )}

      <Tabs label="Fiscal note sections" value={cur} onChange={t => go(`/fiscal/${item.id}?tab=${t}`)} tabs={tabs} />

      {cur === 'narrative' && <Narrative item={item} editable={editable} setSaving={setSaving} />}
      {cur === 'revenue' && <Revenue item={item} editable={editable} setFiscal={setFiscal} />}
      {cur === 'expenditure' && <Expenditure item={item} editable={editable} contributor={contributor} me={me.id} setFiscal={setFiscal} />}
      {cur === 'assign' && (
        <Assign item={item} onRoute={(rev, secs) => routeFiscal(item.id, rev, secs)} />
      )}
      {cur === 'papers' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Attached work papers" actions={editable && <Button variant="secondary" icon="plus" onClick={async () => {
            const name = ['Comparable filers 2025.xlsx', 'Rate schedule notes.docx', 'Forecast excerpt.pdf'][fiscal.workPapers.length % 3]
            setFiscal(f => ({ ...f, workPapers: [...f.workPapers, { id: `wp${Date.now()}`, name, size: '96 KB', by: me.id }] }), `Attached ${name}`)
            await external('SharePoint', `Attached ${name}`)
          }}>Attach from SharePoint</Button>}>
            {editable && <Field label="Upload local supporting document (maximum 2 MB)" htmlFor="paper-upload"><input id="paper-upload" type="file" accept=".pdf,.docx,.xlsx,.csv,.txt" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024 || !/\.(pdf|docx|xlsx|csv|txt)$/i.test(file.name)) { toast('Choose a supported document up to 2 MB.', 'error'); return }; const reader = new FileReader(); reader.onload = () => setFiscal(f => ({ ...f, workPapers: [...f.workPapers, { id: crypto.randomUUID(), name: file.name, size: `${Math.ceil(file.size / 1024)} KB`, by: me.id, at: new Date().toISOString(), mime: file.type, content: String(reader.result) }] }), `Document uploaded: ${file.name}`); reader.readAsDataURL(file) }} /></Field>}
            {fiscal.workPapers.length === 0 ? <EmptyState title="No work papers yet" text="Attach files stored in SharePoint." /> : (
              <ul className="divide-y divide-line">
                {fiscal.workPapers.map(w => (
                  <li key={w.id} className="flex items-center gap-3 py-2"><Icon name="file" className="text-muted" /><span className="flex-1">{w.name}<span className="block text-sm text-muted">{w.size}, added by {data.staff.find(s => s.id === w.by)?.name}</span></span>
                    {w.content && <Button variant="ghost" onClick={() => { const a = document.createElement('a'); a.href = w.content!; a.download = w.name; a.click() }}>Download</Button>}
                    {editable && <Button variant="ghost" onClick={() => setFiscal(f => ({ ...f, workPapers: f.workPapers.filter(x => x.id !== w.id) }), `Removed ${w.name}`)}>Remove</Button>}</li>
                ))}
              </ul>
            )}
          </Card>
          {!contributor && <Narrative item={item} editable={editable} setSaving={setSaving} only="methodology" />}
        </div>
      )}
      {cur === 'prior' && <Prior item={item} editable={editable} setFiscal={setFiscal} />}
    </>
  )
}

// ---------- narrative ----------
const LIMITS: Record<string, number> = { summary: 600, assumptions: 900, methodology: 700, prior: 300 }
const LABELS: Record<string, string> = { summary: 'Summary of the fiscal impact', assumptions: 'Assumptions', methodology: 'Methodology notes', prior: 'Reference to prior products' }

function NarrativeField({ item, k, editable, setSaving }: { item: WorkItem; k: keyof FiscalData['narrative']; editable: boolean; setSaving: (b: boolean) => void }) {
  const { saveItem } = useStore()
  const stored = item.fiscal!.narrative[k]
  const [v, setV] = useState(stored)
  const [msg, setMsg] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { setV(stored) }, [stored])
  const { run, saving } = useDebouncedSave<string>(val => saveItem(item.id, i => ({ ...i, fiscal: { ...i.fiscal!, narrative: { ...i.fiscal!.narrative, [k]: val } } }), `Edited ${LABELS[k]}`))
  useEffect(() => setSaving(saving), [saving]) // eslint-disable-line
  const limit = LIMITS[k]
  const change = (raw: string) => {
    const bad = raw.match(DISALLOWED)
    let clean = raw.replace(DISALLOWED, '')
    const flash = (m: string) => { setMsg(m); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(''), 4000) }
    if (bad) flash(`Removed character${bad.length > 1 ? 's' : ''} not allowed in OFM fields: ${[...new Set(bad)].join(' ')}`)
    if (clean.length > limit) { clean = clean.slice(0, limit); flash(`Limit of ${limit} characters reached.`) }
    setV(clean); run(clean)
  }
  const over = v.length >= limit * 0.9
  return (
    <div>
      <label htmlFor={`n-${k}`} className="text-sm font-semibold">{LABELS[k]}</label>
      <textarea id={`n-${k}`} rows={k === 'prior' ? 2 : 5} value={v} readOnly={!editable} onChange={e => change(e.target.value)} spellCheck aria-describedby={`n-${k}-h`} className={`${inputCls} mt-1 ${!editable ? 'bg-page' : ''}`} />
      <div id={`n-${k}-h`} className="flex flex-wrap justify-between gap-2 text-sm">
        <span role="status" className="text-warn">{msg}</span>
        <span className={`tnum ${over ? 'font-semibold text-warn' : 'text-muted'}`}>{v.length} / {limit} characters</span>
      </div>
    </div>
  )
}

function Narrative({ item, editable, setSaving, only }: { item: WorkItem; editable: boolean; setSaving: (b: boolean) => void; only?: keyof FiscalData['narrative'] }) {
  const keys = (only ? [only] : ['summary', 'assumptions', 'methodology', 'prior']) as (keyof FiscalData['narrative'])[]
  return (
    <Card title={only ? 'Methodology notes' : 'Narrative'}>
      <p className="mb-3 text-sm text-muted">Fields are limited in length. Characters that OFM cannot accept (such as angle brackets, ampersands and curly quotes) are blocked as you type.</p>
      <div className="space-y-4">{keys.map(k => <NarrativeField key={k} item={item} k={k} editable={editable} setSaving={setSaving} />)}</div>
    </Card>
  )
}

// ---------- revenue ----------
function Revenue({ item, editable, setFiscal }: { item: WorkItem; editable: boolean; setFiscal: (fn: (f: FiscalData) => FiscalData, d?: string) => void }) {
  const f = item.fiscal!
  const colTotals = f.years.map((_, yi) => f.revenue.reduce((s, r) => s + r.values[yi], 0))
  return (
    <Card title="Revenue impact by fiscal year and fund" actions={<Chip icon="calc">Whole dollars</Chip>} pad={false}>
      <div className="overflow-x-auto p-4">
        <table className="fiscal w-full min-w-[40rem] border-collapse text-[15px]">
          <caption className="sr-only">Revenue by fund and fiscal year</caption>
          <thead><tr className="border-b border-line bg-[#EEF1F4]"><th scope="col" className="px-3 py-2 text-left text-navy">Fund</th>{f.years.map(y => <th key={y} scope="col" className="px-3 py-2 text-right text-navy">FY {y}</th>)}<th scope="col" className="px-3 py-2 text-right text-navy">Total</th></tr></thead>
          <tbody>
            {f.revenue.map((r, ri) => (
              <tr key={r.fund} className="border-b border-line">
                <th scope="row" className="px-3 py-2 text-left font-medium">{r.fund}</th>
                {r.values.map((v, yi) => (
                  <td key={yi} className="px-3 py-1 text-right">{editable ? <NumInput label={`${r.fund} FY ${f.years[yi]}`} value={v} onChange={n => setFiscal(ff => ({ ...ff, revenue: ff.revenue.map((x, i) => (i === ri ? { ...x, values: x.values.map((y, j) => (j === yi ? n : y)) } : x)) }), `Edited revenue ${r.fund}`)} /> : money(v)}</td>
                ))}
                <td className="px-3 py-2 text-right font-semibold">{money(r.values.reduce((a, b) => a + b, 0))}</td>
              </tr>
            ))}
            <tr className="bg-lightblue font-semibold"><th scope="row" className="px-3 py-2 text-left">Total all funds</th>{colTotals.map((t, i) => <td key={i} className="px-3 py-2 text-right">{money(t)}</td>)}<td className="px-3 py-2 text-right">{money(colTotals.reduce((a, b) => a + b, 0))}</td></tr>
          </tbody>
        </table>
        <p className="mt-2 text-sm text-muted">Negative numbers are revenue reductions. Totals update as you type.</p>
      </div>
    </Card>
  )
}

// ---------- expenditure and FTE ----------
function Expenditure({ item, editable, contributor, me, setFiscal }: { item: WorkItem; editable: boolean; contributor: boolean; me: string; setFiscal: (fn: (f: FiscalData) => FiscalData, d?: string) => void }) {
  const { data, patchData, toast } = useStore()
  const f = item.fiscal!
  const rules = data.costRules
  const sections = contributor ? f.expenditure.filter(s => s.assigneeId === me) : f.expenditure
  const upd = (id: string, fn: (s: ExpSection) => ExpSection, d = 'Edited expenditure') => setFiscal(ff => ({ ...ff, expenditure: ff.expenditure.map(s => (s.id === id ? fn(s) : s)) }), d)
  const totals = f.years.map((_, yi) => sections.reduce((s, sec) => s + calcSection(sec, rules)[yi].total, 0))
  const fteTotals = f.years.map((_, yi) => sections.reduce((s, sec) => s + calcSection(sec, rules)[yi].fte, 0))
  const setRule = (k: keyof typeof rules, v: number) => patchData(d => ({ ...d, costRules: { ...d.costRules, [k]: v } }))
  return (
    <div className="space-y-4">
      {!contributor && (
        <Card title="Cost rules" actions={<Chip icon="settings">Applies to all sections</Chip>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Hours per FTE per year" htmlFor="r1"><input id="r1" className={inputCls + ' tnum'} inputMode="numeric" value={rules.hoursPerFte} onChange={e => setRule('hoursPerFte', Math.max(1, parseNum(e.target.value)))} disabled={!editable} /></Field>
            <Field label="Benefits rate, percent of salary" htmlFor="r2"><input id="r2" className={inputCls + ' tnum'} inputMode="decimal" value={Math.round(rules.benefitsRate * 1000) / 10} onChange={e => setRule('benefitsRate', parseNum(e.target.value) / 100)} disabled={!editable} /></Field>
            <Field label="Goods and services per FTE" htmlFor="r3"><input id="r3" className={inputCls + ' tnum'} inputMode="numeric" value={rules.goodsPerFte} onChange={e => setRule('goodsPerFte', parseNum(e.target.value))} disabled={!editable} /></Field>
            <Field label="Equipment per FTE" htmlFor="r4"><input id="r4" className={inputCls + ' tnum'} inputMode="numeric" value={rules.equipmentPerFte} onChange={e => setRule('equipmentPerFte', parseNum(e.target.value))} disabled={!editable} /></Field>
          </div>
        </Card>
      )}
      {sections.length === 0 && <Card><EmptyState title="No sections assigned to you" text="Sections assigned to you appear here." /></Card>}
      {sections.map(s => {
        const c = calcSection(s, rules)
        const mine = editable && (!contributor || s.assigneeId === me)
        const who = data.staff.find(x => x.id === s.assigneeId)
        return (
          <Card key={s.id} title={s.name} actions={<>
            <Chip tone={s.status === 'Complete' ? 'ok' : s.status === 'In progress' ? 'info' : 'neutral'} icon={s.status === 'Complete' ? 'check' : s.status === 'In progress' ? 'edit' : 'clock'}>{s.status}</Chip>
            {mine && s.status !== 'Complete' && <Button variant="secondary" icon="check" onClick={() => { upd(s.id, x => ({ ...x, status: 'Complete' }), `Section complete: ${s.name}`); toast(`${s.name} marked complete. Assigner notified.`) }}>Mark section complete</Button>}</>}>
            <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">{who ? <><Avatar name={who.name} size={22} /> {who.name}, {who.division}</> : <Chip tone="warn" icon="alert">Unassigned</Chip>} <span>Due <span className="tnum">{fmtDateTime(s.dueAt)}</span></span></p>
            <div className="overflow-x-auto">
              <table className="fiscal w-full min-w-[40rem] border-collapse text-[15px]">
                <caption className="sr-only">{s.name} cost calculation</caption>
                <thead><tr className="border-b border-line bg-[#EEF1F4]"><th scope="col" className="px-3 py-2 text-left text-navy">Line</th>{f.years.map(y => <th key={y} scope="col" className="px-3 py-2 text-right text-navy">FY {y}</th>)}</tr></thead>
                <tbody>
                  <tr className="border-b border-line"><th scope="row" className="px-3 py-2 text-left font-medium">Staff hours</th>{s.hours.map((h, yi) => <td key={yi} className="px-3 py-1 text-right">{mine ? <NumInput w="w-24" label={`${s.name} hours FY ${f.years[yi]}`} value={h} onChange={n => upd(s.id, x => ({ ...x, hours: x.hours.map((y, j) => (j === yi ? n : y)) }), `Edited hours in ${s.name}`)} /> : num(h)}</td>)}</tr>
                  <tr className="border-b border-line"><th scope="row" className="px-3 py-2 text-left font-medium">FTE (hours divided by {num(rules.hoursPerFte)})</th>{c.map((x, i) => <td key={i} className="px-3 py-2 text-right font-semibold">{num(x.fte, 2)}</td>)}</tr>
                  <tr className="border-b border-line"><th scope="row" className="px-3 py-2 text-left font-medium">Salaries</th>{c.map((x, i) => <td key={i} className="px-3 py-2 text-right">{money(x.salaries)}</td>)}</tr>
                  <tr className="border-b border-line"><th scope="row" className="px-3 py-2 text-left font-medium">Benefits</th>{c.map((x, i) => <td key={i} className="px-3 py-2 text-right">{money(x.benefits)}</td>)}</tr>
                  <tr className="border-b border-line"><th scope="row" className="px-3 py-2 text-left font-medium">Goods and services</th>{c.map((x, i) => <td key={i} className="px-3 py-2 text-right">{money(x.goods)}</td>)}</tr>
                  <tr className="border-b border-line"><th scope="row" className="px-3 py-2 text-left font-medium">Equipment</th>{c.map((x, i) => <td key={i} className="px-3 py-2 text-right">{money(x.equipment)}</td>)}</tr>
                  <tr className="bg-lightblue font-semibold"><th scope="row" className="px-3 py-2 text-left">Total cost</th>{c.map((x, i) => <td key={i} className="px-3 py-2 text-right">{money(x.total)}</td>)}</tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Annual salary per FTE" htmlFor={`sal-${s.id}`}><input id={`sal-${s.id}`} disabled={!mine} inputMode="numeric" className={inputCls + ' tnum'} value={s.salary} onChange={e => upd(s.id, x => ({ ...x, salary: parseNum(e.target.value) }), `Edited salary in ${s.name}`)} /></Field>
              <Field label="One-time goods and services" htmlFor={`g-${s.id}`}><input id={`g-${s.id}`} disabled={!mine} inputMode="numeric" className={inputCls + ' tnum'} value={s.goods} onChange={e => upd(s.id, x => ({ ...x, goods: parseNum(e.target.value) }))} /></Field>
              <Field label="One-time equipment" htmlFor={`e-${s.id}`}><input id={`e-${s.id}`} disabled={!mine} inputMode="numeric" className={inputCls + ' tnum'} value={s.equipment} onChange={e => upd(s.id, x => ({ ...x, equipment: parseNum(e.target.value) }))} /></Field>
            </div>
          </Card>
        )
      })}
      {!contributor && sections.length > 0 && (
        <Card title="Expenditure summary" pad={false}>
          <div className="overflow-x-auto p-4"><table className="fiscal w-full min-w-[32rem] text-[15px]">
            <thead><tr className="border-b border-line"><th className="px-3 py-2 text-left text-navy" scope="col">All sections</th>{f.years.map(y => <th key={y} className="px-3 py-2 text-right text-navy" scope="col">FY {y}</th>)}</tr></thead>
            <tbody>
              <tr className="border-b border-line"><th scope="row" className="px-3 py-2 text-left font-medium">Total FTE</th>{fteTotals.map((t, i) => <td key={i} className="px-3 py-2 text-right font-semibold">{num(t, 2)}</td>)}</tr>
              <tr className="bg-lightblue font-semibold"><th scope="row" className="px-3 py-2 text-left">Total expenditure</th>{totals.map((t, i) => <td key={i} className="px-3 py-2 text-right">{money(t)}</td>)}</tr>
            </tbody></table></div>
        </Card>
      )}
    </div>
  )
}

// ---------- assignments ----------
function Assign({ item, onRoute }: { item: WorkItem; onRoute: (rev: string, secs: { id: string; assigneeId: string; dueAt: string }[]) => void }) {
  const { data } = useStore()
  const f = item.fiscal!
  const analysts = data.staff.filter(s => s.role === 'Analyst')
  const contributors = data.staff.filter(s => s.role === 'Expenditure Contributor')
  const [rev, setRev] = useState(f.revenueAssigneeId ?? analysts[0].id)
  const local = (t: string) => { const d = new Date(t); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
  const [secs, setSecs] = useState(f.expenditure.map((s, i) => ({ id: s.id, assigneeId: s.assigneeId ?? contributors[i % contributors.length].id, dueAt: s.dueAt })))
  const dis = item.locked
  return (
    <Card title="Route to revenue and expenditure contributors">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-line p-3">
          <h3 className="mb-2 font-semibold text-navy">Revenue section</h3>
          <Field label="Assigned analyst" htmlFor="ra"><Select id="ra" value={rev} onChange={setRev} options={analysts.map(a => ({ value: a.id, label: `${a.name} (${a.division})` }))} /></Field>
        </div>
        {secs.map((s, i) => (
          <div key={s.id} className="rounded border border-line p-3">
            <h3 className="mb-2 font-semibold text-navy">{f.expenditure[i].name}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Assignee" htmlFor={`sa-${s.id}`}><Select id={`sa-${s.id}`} value={s.assigneeId} onChange={v => setSecs(secs.map(x => (x.id === s.id ? { ...x, assigneeId: v } : x)))} options={contributors.map(a => ({ value: a.id, label: `${a.name} (${a.division})` }))} /></Field>
              <Field label="Due" htmlFor={`sd-${s.id}`}><input id={`sd-${s.id}`} type="datetime-local" className={inputCls} value={local(s.dueAt)} onChange={e => setSecs(secs.map(x => (x.id === s.id ? { ...x, dueAt: iso(new Date(e.target.value).getTime()) } : x)))} /></Field>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button icon="send" disabled={dis} onClick={() => onRoute(rev, secs)}>Route to contributors</Button>
        <span className="text-sm text-muted">Assignees get an in-app, email and Teams notification (simulated).</span>
      </div>
    </Card>
  )
}

// ---------- prior-year comparison ----------
function Prior({ item, editable, setFiscal }: { item: WorkItem; editable: boolean; setFiscal: (fn: (f: FiscalData) => FiscalData, d?: string) => void }) {
  const { toast, audit } = useStore()
  const f = item.fiscal!, p = f.prior
  if (!p.productId) return <Card><EmptyState title="No prior fiscal product supplied" text="The official dataset includes legislative records, but no prior agency fiscal estimates. A comparison becomes available when a prior product is supplied." /></Card>
  const curTotals = f.revenue.map(r => r.values.reduce((a, b) => a + b, 0))
  const priTotals = p.revenue.map(r => r.values.reduce((a, b) => a + b, 0))
  const curFte = f.expenditure.length
  void curFte
  return (
    <div className="space-y-4">
      <Card title={`Compared with ${p.productId}: ${p.billLabel}`} actions={editable && <>
        <Button variant="secondary" icon="download" onClick={() => { setFiscal(ff => ({ ...ff, narrative: { ...ff.narrative, summary: ff.prior.narrative.slice(0, 600), assumptions: ff.prior.narrative.slice(0, 900) } }), `Copied narrative forward from ${p.productId}`); audit('Copied forward', item.id, `Narrative from ${p.productId}`); toast(`Narrative copied forward from ${p.productId}. Review before sending.`) }}>Copy forward narrative</Button>
        <Button variant="secondary" icon="download" onClick={() => { setFiscal(ff => ({ ...ff, revenue: ff.prior.revenue.map(r => ({ ...r, values: [...r.values] })) }), `Copied revenue forward from ${p.productId}`); audit('Copied forward', item.id, `Revenue from ${p.productId}`); toast(`Revenue table copied forward from ${p.productId}. Update the figures.`) }}>Copy forward revenue</Button></>}>
        <div className="grid gap-4 md:grid-cols-2">
          <div><h3 className="mb-1 font-semibold text-navy">Prior product</h3><p className="whitespace-pre-wrap rounded bg-page p-3">{p.narrative}</p></div>
          <div><h3 className="mb-1 font-semibold text-navy">This note</h3><p className="whitespace-pre-wrap rounded bg-lightblue p-3">{f.narrative.summary}</p></div>
        </div>
      </Card>
      <Card title="Revenue, four-year total by fund" pad={false}>
        <div className="overflow-x-auto p-4"><table className="fiscal w-full min-w-[32rem] text-[15px]">
          <thead><tr className="border-b border-line bg-[#EEF1F4]"><th scope="col" className="px-3 py-2 text-left text-navy">Fund</th><th scope="col" className="px-3 py-2 text-right text-navy">Prior</th><th scope="col" className="px-3 py-2 text-right text-navy">This note</th><th scope="col" className="px-3 py-2 text-right text-navy">Change</th></tr></thead>
          <tbody>{f.revenue.map((r, i) => <tr key={r.fund} className="border-b border-line"><th scope="row" className="px-3 py-2 text-left font-medium">{r.fund}</th><td className="px-3 py-2 text-right">{money(priTotals[i])}</td><td className="px-3 py-2 text-right">{money(curTotals[i])}</td><td className={`px-3 py-2 text-right font-semibold ${curTotals[i] - priTotals[i] < 0 ? 'text-bad' : 'text-ok'}`}>{curTotals[i] - priTotals[i] === 0 ? '-' : `${curTotals[i] - priTotals[i] < 0 ? 'Down ' : 'Up '}${money(Math.abs(curTotals[i] - priTotals[i]))}`}</td></tr>)}
            <tr className="bg-lightblue font-semibold"><th scope="row" className="px-3 py-2 text-left">Total</th><td className="px-3 py-2 text-right">{money(priTotals.reduce((a, b) => a + b, 0))}</td><td className="px-3 py-2 text-right">{money(curTotals.reduce((a, b) => a + b, 0))}</td><td className="px-3 py-2 text-right">{money(curTotals.reduce((a, b) => a + b, 0) - priTotals.reduce((a, b) => a + b, 0))}</td></tr>
          </tbody></table>
          <p className="mt-2 text-sm text-muted">Prior estimate used {p.totalFte} FTE in total.</p></div>
      </Card>
    </div>
  )
}

export { openItem }
