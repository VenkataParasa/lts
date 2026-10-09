import { useRef, useState } from 'react'
import { useStore } from '../store'
import { Button, Card, Chip, DataTable, EmptyState, Field, Icon, PageHeader, Select, Tabs, inputCls } from '../components/ui'
import { ROLES, fmtDateTime, fmtDate } from '../lib'
import { ADAPTERS, callAdapter, type AdapterName } from '../adapters'
import { renderTemplate } from './Review'
import { go } from '../router'
import type { Role } from '../types'
import LegislativeImport from './LegislativeImport'

const SECTIONS = [
  ['roles', 'Roles and permissions'], ['workflow', 'Workflow stages'], ['templates', 'Templates'], ['picklists', 'Pick-lists'],
  ['session', 'Session setup'], ['ids', 'ID sequences'], ['integrations', 'Integrations'], ['imports', 'Legislative imports'], ['audit', 'Audit log'],
] as const

const CAPS: [string, Role[]][] = [
  ['View bills and lineage', ROLES], ['View fiscal notes and analyses', ROLES],
  ['View drafts and internal notes', ROLES.filter(r => r !== 'Read-only')],
  ['View Confidential items', ['Reviewer', 'Assigner', 'Manager', 'Executive Reviewer', 'Leadership', 'Administrator']],
  ['Create and edit work products', ['Analyst', 'Assigner', 'Manager', 'Expenditure Contributor', 'Administrator']],
  ['Edit only assigned fiscal sections', ['Expenditure Contributor']],
  ['Route and reassign work', ['Assigner', 'Manager', 'Administrator']],
  ['Approve (never own work)', ['Reviewer', 'Manager', 'Executive Reviewer']],
  ['Executive review, in sequence', ['Executive Reviewer']],
  ['Deliver and transmit', ['Analyst', 'Assigner', 'Manager', 'Budget Office', 'Leadership', 'Administrator']],
  ['Run reports and saved queries', ['Analyst', 'Reviewer', 'Assigner', 'Manager', 'Executive Reviewer', 'Leadership', 'Budget Office', 'Administrator']],
  ['Manage implementation tasks', ['Assigner', 'Manager', 'Leadership', 'Administrator']],
  ['Administer the system', ['Administrator']],
]
const GROUPS: Record<Role, string> = {
  Analyst: 'SG-DOR-LTS-Analysts', Reviewer: 'SG-DOR-LTS-Reviewers', Assigner: 'SG-DOR-LTS-Assigners', Manager: 'SG-DOR-LTS-Managers',
  'Executive Reviewer': 'SG-DOR-LTS-ExecReviewers', Leadership: 'SG-DOR-LTS-Leadership', 'Expenditure Contributor': 'SG-DOR-LTS-ExpContributors',
  'Budget Office': 'SG-DOR-LTS-BudgetOffice', 'Read-only': 'SG-DOR-LTS-ReadOnly', Administrator: 'SG-DOR-LTS-Admins',
}

export default function Admin({ section }: { section: string }) {
  const s = SECTIONS.some(x => x[0] === section) ? section : 'roles'
  return (
    <>
      <PageHeader title="Administration" subtitle="Application configuration. Directory and integration connections are simulated." />
      <Tabs label="Admin sections" value={s} onChange={v => go(`/admin/${v}`)} tabs={SECTIONS.map(([id, label]) => ({ id, label }))} />
      {s === 'roles' && <Roles />}
      {s === 'workflow' && <Workflow />}
      {s === 'templates' && <Templates />}
      {s === 'picklists' && <Picklists />}
      {s === 'session' && <SessionSetup />}
      {s === 'ids' && <IdSeq />}
      {s === 'integrations' && <Integrations />}
      {s === 'audit' && <Audit />}
      {s === 'imports' && <LegislativeImport />}
    </>
  )
}

function Roles() {
  return (
    <div className="space-y-4">
      <Card title="Permissions matrix (read-only)" pad={false}>
        <div className="overflow-x-auto"><table className="w-full min-w-[56rem] border-collapse text-sm">
          <caption className="sr-only">Capabilities by role</caption>
          <thead><tr className="border-b border-line bg-[#EEF1F4]"><th scope="col" className="px-3 py-2 text-left text-navy">Capability</th>{ROLES.map(r => <th key={r} scope="col" className="px-2 py-2 text-center text-navy">{r}</th>)}</tr></thead>
          <tbody>{CAPS.map(([c, rs]) => (
            <tr key={c} className="border-b border-line"><th scope="row" className="px-3 py-2 text-left font-medium">{c}</th>
              {ROLES.map(r => <td key={r} className="px-2 py-2 text-center">{rs.includes(r) ? <span className="inline-flex items-center gap-1 text-ok"><Icon name="check" size={14} />Yes</span> : <span className="text-muted">No</span>}</td>)}</tr>
          ))}</tbody></table></div>
      </Card>
      <Card title="Entra ID group mapping (read-only)" pad={false}>
        <DataTable caption="Entra ID group mapping" rows={ROLES} rowKey={r => r} cols={[{ key: 'r', header: 'LTS role', render: r => r }, { key: 'g', header: 'Entra ID group', render: r => <code>{GROUPS[r]}</code> }, { key: 'm', header: 'Members', render: r => useStore.getState().data.staff.filter(s => s.role === r).length }]} />
        <p className="p-4 text-sm text-muted">Group membership is managed in Entra ID. Changes appear here after the next sync (simulated).</p>
      </Card>
    </div>
  )
}

function Workflow() {
  const { data, patchData, audit, toast } = useStore()
  const w = data.workflow
  const set = (fn: (x: typeof w) => typeof w) => patchData(d => ({ ...d, workflow: fn(d.workflow) }))
  const move = (i: number, dir: -1 | 1) => set(x => { const y = [...x]; const j = i + dir; if (j < 0 || j >= y.length) return x; [y[i], y[j]] = [y[j], y[i]]; return y })
  return (
    <Card title="Workflow stage editor" actions={<Button icon="check" onClick={() => { audit('Edited', 'Admin', 'Saved workflow stages'); toast('Workflow stages saved.') }}>Save changes</Button>}>
      <ol className="space-y-3">
        {w.map((st, i) => (
          <li key={st.id} className="grid items-end gap-2 rounded border border-line p-3 sm:grid-cols-[2rem_1fr_9rem_1fr_auto]">
            <span className="font-semibold text-navy">{i + 1}</span>
            <Field label="Stage name" htmlFor={`wn-${st.id}`}><input id={`wn-${st.id}`} className={inputCls} value={st.name} onChange={e => set(x => x.map(s => (s.id === st.id ? { ...s, name: e.target.value } : s)))} /></Field>
            <Field label="Target hours" htmlFor={`wh-${st.id}`}><input id={`wh-${st.id}`} inputMode="numeric" className={inputCls + ' tnum'} value={st.slaHours} onChange={e => set(x => x.map(s => (s.id === st.id ? { ...s, slaHours: Number(e.target.value.replace(/\D/g, '')) } : s)))} /></Field>
            <Field label="Who acts" htmlFor={`ww-${st.id}`}><input id={`ww-${st.id}`} className={inputCls} value={st.who} onChange={e => set(x => x.map(s => (s.id === st.id ? { ...s, who: e.target.value } : s)))} /></Field>
            <div className="flex gap-1"><Button variant="secondary" aria-label={`Move ${st.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>Up</Button><Button variant="secondary" aria-label={`Move ${st.name} down`} disabled={i === w.length - 1} onClick={() => move(i, 1)}>Down</Button></div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-muted">Deadline clocks: bill descriptions 48 hours, fiscal notes 72 hours, and hearing time minus 4 hours when a hearing is under 72 hours away. Amber at 50 percent elapsed, red at 80 percent.</p>
    </Card>
  )
}

const FIELDS = ['item.id', 'item.preparer', 'item.topics', 'bill.label', 'bill.number', 'bill.title', 'bill.session', 'fiscal.summary', 'fiscal.assumptions', 'fiscal.total', 'fiscal.expenditure', 'delivery.date', 'analysis.body']
function Templates() {
  const { data, patchData, audit, toast } = useStore()
  const [id, setId] = useState(data.templates[0].id)
  const t = data.templates.find(x => x.id === id)!
  const ta = useRef<HTMLTextAreaElement>(null)
  const sample = data.items.find(i => i.type === 'FN')!
  const setBody = (body: string) => patchData(d => ({ ...d, templates: d.templates.map(x => (x.id === id ? { ...x, body } : x)) }))
  const ins = (f: string) => {
    const el = ta.current!, s = el.selectionStart ?? t.body.length, e = el.selectionEnd ?? s
    setBody(t.body.slice(0, s) + `{{${f}}}` + t.body.slice(e))
    setTimeout(() => { el.focus(); el.setSelectionRange(s + f.length + 4, s + f.length + 4) }, 0)
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Template editor" actions={<Button icon="check" onClick={() => { audit('Edited', t.id, `Saved template ${t.name}`); toast('Template saved.') }}>Save template</Button>}>
        <Field label="Template" htmlFor="tpl"><Select id="tpl" value={id} onChange={setId} options={data.templates.map(x => ({ value: x.id, label: `${x.name}` }))} /></Field>
        <p className="mb-1 mt-3 text-sm font-semibold">Merge fields (click to insert)</p>
        <div className="mb-2 flex flex-wrap gap-1">{FIELDS.map(f => <button key={f} type="button" onClick={() => ins(f)} className="min-h-[32px] rounded border border-line bg-white px-2 text-sm hover:bg-lightblue"><code>{f}</code></button>)}</div>
        <label htmlFor="tb" className="sr-only">Template body</label>
        <textarea id="tb" ref={ta} rows={12} className={`${inputCls} font-mono text-sm`} value={t.body} onChange={e => setBody(e.target.value)} />
      </Card>
      <Card title={sample ? `Preview with ${sample.id}` : 'Template preview'}><pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap rounded bg-page p-3 text-sm">{sample ? renderTemplate(t.body, sample, data, t.format === 'OFM XML') : 'Create a fiscal note to preview merged values.'}</pre></Card>
    </div>
  )
}

function Picklists() {
  const { data, patchData, audit, toast } = useStore()
  const names = Object.keys(data.picklists)
  const [n, setN] = useState(names[0])
  const [v, setV] = useState('')
  const list = data.picklists[n]
  const set = (l: string[]) => patchData(d => ({ ...d, picklists: { ...d.picklists, [n]: l } }))
  return (
    <Card title="Pick-list manager">
      <div className="mb-3 max-w-sm"><Field label="List" htmlFor="pl"><Select id="pl" value={n} onChange={setN} options={names} /></Field></div>
      <ul className="mb-3 flex flex-wrap gap-2">{list.map(x => <li key={x} className="flex items-center gap-1 rounded border border-line bg-white py-1 pl-3 pr-1">{x}<button type="button" className="rounded p-1 hover:bg-page" aria-label={`Remove ${x}`} onClick={() => { set(list.filter(y => y !== x)); audit('Edited', 'Admin', `Removed ${x} from ${n}`) }}><Icon name="x" size={14} /></button></li>)}</ul>
      <div className="flex flex-wrap items-end gap-3"><Field label="Add value" htmlFor="pv"><input id="pv" className={inputCls} value={v} onChange={e => setV(e.target.value)} /></Field>
        <Button icon="plus" disabled={!v.trim() || list.includes(v.trim())} onClick={() => { set([...list, v.trim()]); audit('Edited', 'Admin', `Added ${v.trim()} to ${n}`); toast(`Added ${v.trim()} to ${n}.`); setV('') }}>Add</Button></div>
    </Card>
  )
}

function SessionSetup() {
  const { data, patchData, provisionSession } = useStore()
  const [busy, setBusy] = useState('')
  const [nm, setNm] = useState('2028 regular session')
  return (
    <div className="space-y-4">
      <Card title="Legislative sessions" pad={false}>
        <DataTable caption="Sessions" rows={data.sessions} rowKey={s => s.id} cols={[
          { key: 'n', header: 'Session', render: s => <span className="font-semibold">{s.name}</span> }, { key: 'c', header: 'Status', render: s => (s.current ? <Chip tone="ok" icon="clock">Current</Chip> : <Chip>Closed</Chip>) },
          { key: 'd', header: 'Dates', render: s => `${fmtDate(s.start)} to ${fmtDate(s.end)}` },
          { key: 'p', header: 'SharePoint folders', render: s => (s.provisioned ? <Chip tone="ok" icon="check">Provisioned</Chip> : <Chip tone="warn" icon="alert">Not provisioned</Chip>) },
          { key: 'a', header: 'Action', render: s => <Button variant="secondary" icon="folder" disabled={busy === s.id} onClick={async () => { setBusy(s.id); await provisionSession(s.id); setBusy('') }}>{busy === s.id ? 'Provisioning...' : 'Provision SharePoint folders'}</Button> },
        ]} />
      </Card>
      <Card title="Set up a new session">
        <div className="flex flex-wrap items-end gap-3"><Field label="Session name" htmlFor="sn"><input id="sn" className={inputCls} value={nm} onChange={e => setNm(e.target.value)} /></Field>
          <Button icon="plus" disabled={!nm.trim()} onClick={() => patchData(d => ({ ...d, sessions: [...d.sessions, { id: nm.slice(0, 4) + d.sessions.length, name: nm, current: false, start: new Date().toISOString(), end: new Date().toISOString(), provisioned: false }] }))}>Add session</Button></div>
        <p className="mt-2 text-sm text-muted">New sessions start unprovisioned. Provisioning creates Bills, Fiscal notes, Analyses and Correspondence folders (simulated).</p>
      </Card>
    </div>
  )
}

function IdSeq() {
  const { data, patchData, renameItem, toast } = useStore()
  const [oldId, setOld] = useState(data.items[0]?.id ?? '')
  const [nid, setNid] = useState('')
  const [err, setErr] = useState('')
  const names: Record<string, string> = { FN: 'Fiscal notes', FE: 'Fiscal estimates', DR: 'Data requests', BA: 'Bill analyses', PK: 'Packages' }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Automatic ID sequences">
        <p className="mb-3 text-sm text-muted">IDs are assigned automatically by type. Change the next number to skip ahead.</p>
        <div className="space-y-3">{Object.entries(names).map(([p, label]) => (
          <div key={p} className="flex items-center gap-3"><span className="w-40">{label} (<code>{p}-{new Date().getFullYear()}-</code>)</span>
            <input aria-label={`Next number for ${label}`} inputMode="numeric" className={inputCls + ' w-28 tnum'} value={data.idCounters[p] ?? 1} onChange={e => patchData(d => ({ ...d, idCounters: { ...d.idCounters, [p]: Math.max(1, Number(e.target.value.replace(/\D/g, ''))) } }))} /></div>
        ))}</div>
      </Card>
      <Card title="Override an ID">
        <div className="space-y-3">
          <Field label="Item" htmlFor="oi"><Select id="oi" value={oldId} onChange={setOld} options={data.items.map(i => i.id)} /></Field>
          <Field label="New ID" htmlFor="ni" hint="Must be unique."><input id="ni" className={inputCls} value={nid} onChange={e => { setNid(e.target.value); setErr('') }} placeholder={`For example FN-${new Date().getFullYear()}-00901`} /></Field>
          {err && <p role="alert" className="text-bad">{err}</p>}
          <Button disabled={!oldId || !nid.trim()} onClick={() => { const e = renameItem(oldId, nid.trim()); if (e) setErr(e); else { toast(`${oldId} is now ${nid.trim()}.`); setOld(nid.trim()); setNid('') } }}>Apply override</Button>
        </div>
      </Card>
    </div>
  )
}

function Integrations() {
  const { toast, simulateLegislature, audit } = useStore()
  const [busy, setBusy] = useState('')
  return (
    <div className="space-y-4">
      <div role="note" className="flex items-start gap-2 rounded border border-[#9DC1DE] bg-lightblue p-3 text-[#08487F]"><Icon name="help" className="mt-0.5" /><p><strong>All integrations are simulated.</strong> No data leaves the browser. Each adapter responds after a short delay and returns a receipt ID.</p></div>
      <Card title="Integration status" pad={false}>
        <DataTable caption="Integrations" rows={ADAPTERS} rowKey={a => a.name} cols={[
          { key: 'n', header: 'System', render: a => <span className="font-semibold">{a.name}</span> }, { key: 's', header: 'Mode', render: () => <Chip tone="info" icon="settings">Simulated</Chip> },
          { key: 'h', header: 'Health', render: () => <Chip tone="ok" icon="check">Connected</Chip> }, { key: 'p', header: 'Purpose', render: a => a.purpose, className: 'hidden md:table-cell' },
          { key: 'd', header: 'Direction', render: a => a.direction, className: 'hidden lg:table-cell' }, { key: 'l', header: 'Last sync', render: a => a.lastSync },
          { key: 't', header: 'Test', render: a => <Button variant="secondary" disabled={busy === a.name} onClick={async () => { setBusy(a.name); const r = await callAdapter(a.name as AdapterName); toast(`${a.name} (simulated): connection OK, receipt ${r}`); audit('Tested', a.name, 'Simulated connection test'); setBusy('') }}>{busy === a.name ? 'Testing...' : 'Test connection'}</Button> },
        ]} />
      </Card>
      <Card title="Simulate legislature update"><p className="mb-3 text-muted">Injects a new bill version, a new amendment and a newly scheduled hearing inside 72 hours. Tasks are created, affected work is flagged "Bill changed" and notifications are sent.</p><Button icon="refresh" onClick={() => void simulateLegislature()}>Simulate legislature update</Button></Card>
    </div>
  )
}

function Audit() {
  const { data } = useStore()
  const [f, setF] = useState({ user: 'All', action: 'All', q: '', conf: false })
  const actions = [...new Set(data.audit.map(a => a.action))].sort()
  const rows = data.audit.filter(a => (f.user === 'All' || a.userId === f.user) && (f.action === 'All' || a.action === f.action) && (!f.q || `${a.target} ${a.detail}`.toLowerCase().includes(f.q.toLowerCase())) && (!f.conf || a.confidential))
  return (
    <>
      <Card className="mb-4"><div className="flex flex-wrap items-end gap-3">
        <Field label="User" htmlFor="au"><Select id="au" value={f.user} onChange={v => setF({ ...f, user: v })} options={[{ value: 'All', label: 'All users' }, ...data.staff.map(s => ({ value: s.id, label: s.name }))]} /></Field>
        <Field label="Action" htmlFor="aa"><Select id="aa" value={f.action} onChange={v => setF({ ...f, action: v })} options={['All', ...actions]} /></Field>
        <Field label="Search target or detail" htmlFor="aq"><input id="aq" className={inputCls} value={f.q} onChange={e => setF({ ...f, q: e.target.value })} /></Field>
        <label className="flex min-h-[40px] items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.conf} onChange={e => setF({ ...f, conf: e.target.checked })} />Confidential views only</label>
      </div></Card>
      <p className="mb-2 text-sm text-muted" aria-live="polite">{rows.length} entries</p>
      <Card pad={false}>
        {rows.length === 0 ? <EmptyState title="No audit entries match" /> : (
          <DataTable caption="Audit log" rows={rows} rowKey={a => a.id} cols={[
            { key: 'w', header: 'When', sort: a => a.at, render: a => <span className="tnum">{fmtDateTime(a.at)}</span> },
            { key: 'u', header: 'User', render: a => `${data.staff.find(s => s.id === a.userId)?.name ?? a.userId} (${a.role})` },
            { key: 'a', header: 'Action', render: a => <Chip icon={a.confidential ? 'lock' : 'shield'}>{a.action}</Chip> },
            { key: 't', header: 'Target', render: a => a.target }, { key: 'd', header: 'Detail', render: a => a.detail, className: 'hidden md:table-cell' },
          ]} />
        )}
      </Card>
    </>
  )
}
