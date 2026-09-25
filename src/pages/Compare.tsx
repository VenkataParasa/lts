import { useEffect, useMemo, useRef, useState } from 'react'
import { diffWords } from 'diff'
import { useStore, useMe } from '../store'
import { Button, Card, Chip, Field, PageHeader, Select, Tabs, LinkButton } from '../components/ui'
import { billLabel, currentVersion, visibleBills } from '../lib'
import { useRoute, go } from '../router'
import type { Bill } from '../types'

function priorChain(b: Bill, all: Bill[]): Bill[] {
  const out: Bill[] = [b]
  let cur = b
  while (cur.priorBillId) { const p = all.find(x => x.id === cur.priorBillId); if (!p) break; out.push(p); cur = p }
  return out
}

export default function Compare() {
  const route = useRoute()
  const { data, role, toast, patchData, createItem, audit } = useStore()
  const me = useMe()
  const bills = visibleBills(data, role).filter(b => b.session === '2027' || data.bills.some(x => x.priorBillId === b.id))
  const billId = route.q.get('bill') || data.items.find(i => i.id === 'BA-27-002')?.billId || bills.find(b => b.session === '2027' && b.versions.length > 2)?.id || bills[0].id
  const bill = data.bills.find(b => b.id === billId) ?? bills[0]
  const pool = useMemo(() => priorChain(bill, data.bills).flatMap(b => b.versions.map(v => ({ ...v, bill: b }))), [bill, data.bills])
  const [aId, setA] = useState('')
  const [bId, setB] = useState('')
  const [mode, setMode] = useState<'side' | 'inline'>('side')
  useEffect(() => {
    const first = bill.versions[0], cur = currentVersion(bill)
    setA(first.id); setB(cur.id === first.id && bill.versions[1] ? bill.versions[1].id : cur.id)
  }, [bill.id, bill])
  const a = pool.find(v => v.id === aId) ?? pool[0]
  const b = pool.find(v => v.id === bId) ?? pool[pool.length - 1]
  const parts = useMemo(() => diffWords(a.text, b.text), [a, b])
  const stats = { add: parts.filter(p => p.added).length, del: parts.filter(p => p.removed).length }

  const l = useRef<HTMLDivElement>(null), r = useRef<HTMLDivElement>(null), lock = useRef(false)
  const sync = (from: 'l' | 'r') => () => {
    if (lock.current) { lock.current = false; return }
    const s = from === 'l' ? l.current : r.current, t = from === 'l' ? r.current : l.current
    if (!s || !t) return
    lock.current = true
    t.scrollTop = (s.scrollTop / Math.max(1, s.scrollHeight - s.clientHeight)) * (t.scrollHeight - t.clientHeight)
  }
  const label = (v: (typeof pool)[number]) => `${v.label} (${v.bill.session}${v.kind === 'amendment' ? ', amendment' : ''})`
  const opts = pool.map(v => ({ value: v.id, label: label(v) }))

  const draft = () => {
    const existing = data.items.find(i => i.type === 'BA' && i.billId === bill.id)
    if (existing) { go(`/analyses/${existing.id}`); return }
    const it = createItem('BA', bill.id, { stage: 'In progress' })
    go(`/analyses/${it.id}`)
  }
  const markAnalyzed = () => {
    patchData(d => ({ ...d, bills: d.bills.map(x => (x.id === bill.id ? { ...x, versions: x.versions.map(v => (v.id === b.id ? { ...v, analyzed: true } : v)) } : x)) }))
    audit('Edited', bill.id, `Marked ${b.label} analyzed`); toast(`${b.label} marked as analyzed.`)
  }
  void me

  return (
    <>
      <PageHeader title="Compare versions" subtitle="Pick any two versions or amendments, including those from a prior session." crumbs={[{ label: 'Bills', to: '/bills' }, { label: billLabel(bill), to: `/bills/${bill.id}` }, { label: 'Compare' }]}
        actions={<><Button variant="secondary" icon="edit" onClick={draft}>Draft the analysis</Button>{b.kind === 'amendment' && !b.analyzed && <Button variant="secondary" icon="check" onClick={markAnalyzed}>Mark amendment analyzed</Button>}</>} />
      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Bill" htmlFor="cb"><Select id="cb" value={bill.id} onChange={v => go(`/compare?bill=${v}`)} options={bills.map(x => ({ value: x.id, label: `${billLabel(x)} (${x.session})` }))} /></Field>
          <Field label="Compare from (older)" htmlFor="ca"><Select id="ca" value={a.id} onChange={setA} options={opts} /></Field>
          <Field label="Compare to (newer)" htmlFor="cc"><Select id="cc" value={b.id} onChange={setB} options={opts} /></Field>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Chip tone="ok" icon="plus">{stats.add} additions</Chip><Chip tone="bad" icon="x">{stats.del} deletions</Chip>
          {pool.some(v => v.bill.id !== bill.id) && <span>Prior-session versions are included in the pick-lists.</span>}
        </p>
      </Card>
      <Tabs label="Comparison view" value={mode} onChange={m => setMode(m as 'side' | 'inline')} tabs={[{ id: 'side', label: 'Side by side' }, { id: 'inline', label: 'Inline redline' }]} />
      {mode === 'side' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={label(a)} pad={false}>
            <div ref={l} onScroll={sync('l')} tabIndex={0} role="region" aria-label={`Text of ${a.label}, scrolls with the other panel`} className="redline h-[28rem] overflow-auto whitespace-pre-wrap p-4 leading-relaxed">
              {parts.filter(p => !p.added).map((p, i) => (p.removed ? <del key={i}>{p.value}</del> : <span key={i}>{p.value}</span>))}
            </div>
          </Card>
          <Card title={label(b)} pad={false}>
            <div ref={r} onScroll={sync('r')} tabIndex={0} role="region" aria-label={`Text of ${b.label}, scrolls with the other panel`} className="redline h-[28rem] overflow-auto whitespace-pre-wrap p-4 leading-relaxed">
              {parts.filter(p => !p.removed).map((p, i) => (p.added ? <ins key={i}>{p.value}</ins> : <span key={i}>{p.value}</span>))}
            </div>
          </Card>
        </div>
      ) : (
        <Card title={`${a.label} to ${b.label}`} pad={false}>
          <div tabIndex={0} role="region" aria-label="Inline redline" className="redline max-h-[32rem] overflow-auto whitespace-pre-wrap p-4 leading-relaxed">
            {parts.map((p, i) => (p.added ? <ins key={i}>{p.value}</ins> : p.removed ? <del key={i}>{p.value}</del> : <span key={i}>{p.value}</span>))}
          </div>
        </Card>
      )}
      <p className="mt-3 text-sm text-muted">Additions are underlined and shaded green. Deletions are struck through and shaded red.</p>
      <div className="mt-2"><LinkButton to={`/bills/${bill.id}?tab=Versions %26 Amendments`} variant="ghost">Back to versions list</LinkButton></div>
    </>
  )
}
