import { getBill } from '../retrieval'
import { useState } from 'react'
import { useStore, useVisibleItems } from '../store'
import { A, Button, Card, DataTable, Field, Select, inputCls } from '../components/ui'
import { billLabel, csv, download, H, ms, TYPE_NAME } from '../lib'

const REPORTS = ['Outstanding Work', 'Work Due in Next 72 Hours', 'Bill Analysis Status', 'Fiscal Note Status', 'Executive Review Status', 'Analyst Workload', 'Reviewer Workload', 'Bills With Issues', 'Fiscal Impact by Year', 'Fiscal Impact by Fund', 'Fiscal Impact by Bill', 'Historical Work by Session']
interface Row { id: string; label: string; detail: string; value: string | number; link: string }
export default function OperationalReports() {
  const { data, now, patchData, audit, toast } = useStore(), items = useVisibleItems()
  const [report, setReport] = useState(REPORTS[0]), [session, setSession] = useState('All'), [name, setName] = useState('')
  const work = items.filter(i => session === 'All' || getBill(data, i.billId)?.session === session)
  let rows: Row[] = []
  if (report.includes('Workload')) rows = data.staff.filter(s => s.role === (report.startsWith('Analyst') ? 'Analyst' : 'Reviewer')).map(s => ({ id: s.id, label: s.name, detail: s.division, value: work.filter(i => i.stage !== 'Delivered' && (report.startsWith('Analyst') ? i.preparerId === s.id : i.reviewerId === s.id)).length, link: '/queue' }))
  else if (report.startsWith('Fiscal Impact')) {
    const groups = new Map<string, number>()
    work.filter(i => i.fiscal).forEach(i => {
      const b = getBill(data, i.billId)!, f = i.fiscal!
      f.revenue.forEach(r => r.values.forEach((v, n) => { const k = report.endsWith('Year') ? String(f.years[n]) : report.endsWith('Fund') ? r.fund : billLabel(b); groups.set(k, (groups.get(k) ?? 0) + v) }))
    })
    rows = [...groups].map(([k, v]) => ({ id: k, label: k, detail: 'Revenue impact across selected work products', value: v, link: '/fiscal' }))
  } else if (report === 'Bills With Issues') rows = data.bills.filter(b => b.hasIssues && (session === 'All' || b.session === session)).map(b => ({ id: b.id, label: billLabel(b), detail: b.title, value: b.status, link: `/bills/${b.id}` }))
  else rows = work.filter(i => report === 'Outstanding Work' ? i.stage !== 'Delivered' : report === 'Work Due in Next 72 Hours' ? i.stage !== 'Delivered' && ms(i.dueAt) >= now && ms(i.dueAt) <= now + 72 * H : report === 'Bill Analysis Status' ? i.type === 'BA' : report === 'Fiscal Note Status' ? i.type === 'FN' : report === 'Executive Review Status' ? i.execReview : true).map(i => ({ id: i.id, label: i.id, detail: `${TYPE_NAME[i.type]} · ${getBill(data, i.billId)?.session} · ${i.title}`, value: i.stage, link: `/review/${i.id}` }))
  const saved = data.savedViews.filter(v => v.filter.report)
  return <div className="space-y-4"><Card title="Operational report definition"><div className="grid gap-3 md:grid-cols-3"><Field label="Report" htmlFor="op-report"><Select id="op-report" value={report} onChange={setReport} options={REPORTS} /></Field><Field label="Session" htmlFor="op-session"><Select id="op-session" value={session} onChange={setSession} options={['All', ...data.sessions.map(s => s.id)]} /></Field><Field label="Saved report" htmlFor="op-saved"><Select id="op-saved" value="" onChange={v => { const def = saved.find(s => s.id === v); if (def) { setReport(def.filter.report); setSession(def.filter.session) } }} options={[{ value: '', label: 'Load definition' }, ...saved.map(v => ({ value: v.id, label: v.name }))]} /></Field><Field label="Save as" htmlFor="op-name"><input id="op-name" className={inputCls} value={name} onChange={e => setName(e.target.value)} /></Field></div><div className="mt-3 flex gap-3"><Button disabled={!name.trim()} onClick={() => { patchData(d => ({ ...d, savedViews: [...d.savedViews, { id: crypto.randomUUID(), name, filter: { report, session } }] })); audit('Report definition saved', name, `${report}; session ${session}`); toast('Report definition saved.'); setName('') }}>Save report definition</Button><Button variant="secondary" onClick={() => download(`${report}.csv`, csv([['Record', 'Detail', 'Status / amount'], ...rows.map(r => [r.label, r.detail, r.value])]))}>Export CSV</Button></div></Card><Card title={report} pad={false}><DataTable caption={report} rows={rows} rowKey={r => r.id} cols={[{ key: 'label', header: 'Record / grouping', sort: r => r.label, render: r => <A to={r.link}>{r.label}</A> }, { key: 'detail', header: 'Detail', render: r => r.detail }, { key: 'value', header: 'Status / amount', sort: r => r.value, render: r => typeof r.value === 'number' && report.startsWith('Fiscal') ? r.value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : r.value }]} /></Card></div>
}
