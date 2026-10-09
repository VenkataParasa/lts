import { useVisibleItems, useStore } from '../store'
import type { Bill } from '../types'
import { A, Card, Chip, StageChip } from '../components/ui'
import { fiscalTotal, fmtDateTime, money } from '../lib'
import { calcSection } from '../fiscalCalculations'

export default function BillSummary({ bill }: { bill: Bill }) {
  const { data } = useStore(), work = useVisibleItems().filter(i => i.billId === bill.id)
  const analysis = work.filter(i => i.type === 'BA'), fiscal = work.filter(i => i.fiscal), lead = work[0]
  const expenditure = fiscal.reduce((sum, i) => sum + i.fiscal!.expenditure.reduce((s, e) => s + calcSection(e, data.costRules).reduce((a, y) => a + y.total, 0), 0), 0)
  return <Card title="DOR tracking and executive summary" className="mb-4"><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div><dt className="text-sm text-muted">Tracking</dt><dd>{bill.tracked || work.length ? 'Tracked' : 'Not tracked'} {bill.hasIssues && <Chip tone="warn">Issues identified</Chip>}</dd></div>
    <div><dt className="text-sm text-muted">Assignment owner / priority</dt><dd>{data.staff.find(s => s.id === lead?.preparerId)?.name ?? 'Unassigned'} / {lead?.priority ?? 'Not set'}</dd></div>
    <div><dt className="text-sm text-muted">Revenue impact (all fiscal products)</dt><dd>{money(fiscal.reduce((s, i) => s + fiscalTotal(i), 0))}</dd></div>
    <div><dt className="text-sm text-muted">Expenditure impact (all fiscal products)</dt><dd>{money(expenditure)}</dd></div>
    <div><dt className="text-sm text-muted">Bill analysis</dt><dd>{analysis.length ? analysis.map(i => <div key={i.id}><A to={`/analyses/${i.id}`}>{i.id}</A> <StageChip item={i} /></div>) : 'No analysis assigned'}</dd></div>
    <div><dt className="text-sm text-muted">Fiscal work status</dt><dd>{fiscal.length ? fiscal.map(i => <div key={i.id}><A to={i.type === 'FN' ? `/fiscal/${i.id}` : `/estimates/${i.id}`}>{i.id}</A> <StageChip item={i} /></div>) : 'No fiscal work assigned'}</dd></div>
    <div><dt className="text-sm text-muted">Executive Review</dt><dd>{work.filter(i => i.execReview).map(i => <div key={i.id}>{i.id}: {i.execIndex} of {i.execChain.length} complete</div>)}{!work.some(i => i.execReview) && 'Not required'}</dd></div>
    <div><dt className="text-sm text-muted">Publication target</dt><dd>{lead?.publicationTarget ? fmtDateTime(lead.publicationTarget) : 'Not set'}</dd></div>
    <div><dt className="text-sm text-muted">Topics</dt><dd>{bill.topics.join(', ') || 'Not classified'}</dd></div>
    <div><dt className="text-sm text-muted">Internal flags</dt><dd>{work.some(i => i.confidential) ? 'Confidential work' : 'No confidential work visible'} {work.some(i => i.onHold) && '· On Hold'}</dd></div>
    <div><dt className="text-sm text-muted">Related packages</dt><dd>{data.packages.filter(p => p.billId === bill.id && p.itemIds.every(id => work.some(i => i.id === id))).map(p => <div key={p.id}><A to={`/packages/${p.id}`}>{p.name}</A></div>)}</dd></div>
  </dl></Card>
}
