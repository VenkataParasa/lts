import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore, useMe, useVisibleItems } from '../store'
import { A, Card, DataTable, EmptyState, HearingBadge, PageHeader, Skeleton, Stat, StageChip, ClockChip, useLoading, LinkButton, Icon, openItem } from '../components/ui'
import { D, H, billLabel, clockOf, fmtDate, ms, visibleBills } from '../lib'
import type { Role } from '../types'
import { STAGES } from '../types'

const QUICK: Record<Role, { label: string; to: string; icon: string }[]> = {
  Analyst: [{ label: 'See my assigned work', to: '/queue', icon: 'list' }, { label: 'Compare bill versions', to: '/compare', icon: 'compare' }, { label: 'Open bill analyses', to: '/analyses', icon: 'edit' }, { label: 'Find a bill', to: '/bills', icon: 'search' }],
  Reviewer: [{ label: 'Review waiting work', to: '/executive', icon: 'eye' }, { label: 'See my queue', to: '/queue', icon: 'list' }, { label: 'Find a bill', to: '/bills', icon: 'search' }],
  Assigner: [{ label: 'Route a fiscal note', to: '/fiscal/FN-27-001?tab=assign', icon: 'users' }, { label: 'Reassign work in bulk', to: '/queue', icon: 'list' }, { label: 'See hearings', to: '/bills?hearing=72', icon: 'clock' }],
  Manager: [{ label: 'See workload reports', to: '/reports', icon: 'chart' }, { label: 'Reassign work in bulk', to: '/queue', icon: 'list' }, { label: 'Track implementation', to: '/implementation', icon: 'flag' }],
  'Executive Reviewer': [{ label: 'Approve waiting items', to: '/executive', icon: 'shield' }, { label: 'See hearings', to: '/bills?hearing=72', icon: 'clock' }],
  Leadership: [{ label: 'See waiting approvals', to: '/executive', icon: 'shield' }, { label: 'Open reports', to: '/reports', icon: 'chart' }, { label: 'Track implementation', to: '/implementation', icon: 'flag' }],
  'Expenditure Contributor': [{ label: 'Complete my section', to: '/queue', icon: 'calc' }, { label: 'See due dates', to: '/queue?tab=Due soon', icon: 'clock' }],
  'Budget Office': [{ label: 'Bills in the DOR budget', to: '/reports', icon: 'chart' }, { label: 'Open fiscal estimates', to: '/estimates', icon: 'file' }, { label: 'Find a fiscal note', to: '/fiscal', icon: 'calc' }],
  'Read-only': [{ label: 'Find a bill', to: '/bills', icon: 'search' }, { label: 'Published fiscal notes', to: '/fiscal', icon: 'calc' }, { label: 'Published analyses', to: '/analyses', icon: 'file' }],
  Administrator: [{ label: 'Simulate legislature update', to: '/admin/integrations', icon: 'refresh' }, { label: 'Review audit log', to: '/admin/audit', icon: 'shield' }, { label: 'Manage session setup', to: '/admin/session', icon: 'settings' }],
}

export default function Dashboard() {
  const loading = useLoading()
  const { role, now, data } = useStore()
  const me = useMe()
  const items = useVisibleItems()
  const bills = visibleBills(data, role)

  const stats = useMemo(() => {
    const endToday = new Date(now); endToday.setHours(23, 59, 59, 999)
    const active = items.filter(i => i.stage !== 'Delivered')
    const mine = active.filter(i => i.assigneeIds.includes(me.id))
    return {
      mineToday: mine.filter(i => ms(i.dueAt) <= endToday.getTime()),
      overdue: active.filter(i => clockOf(i, now).state === 'overdue'),
      unassigned: active.filter(i => i.stage === 'Assigned').length,
    }
  }, [items, me.id, now])

  const hearings = useMemo(() => bills.flatMap(b => b.hearings.map(h => ({ b, h }))).filter(x => ms(x.h) > now && ms(x.h) < now + 72 * H).sort((a, b) => ms(a.h) - ms(b.h)), [bills, now])
  const amendments = useMemo(() => bills.flatMap(b => b.versions.filter(v => v.kind === 'amendment' && !v.analyzed).map(v => ({ b, v }))), [bills])
  const workload = useMemo(() => data.staff.filter(s => s.role === 'Analyst').map(s => ({
    name: s.name.split(' ')[0], full: s.name,
    Open: data.items.filter(i => i.preparerId === s.id && i.stage !== 'Delivered').length,
    Overdue: data.items.filter(i => i.preparerId === s.id && clockOf(i, now).state === 'overdue').length,
  })), [data, now])
  const fnByStatus = useMemo(() => STAGES.map(st => ({ stage: st, count: items.filter(i => i.type === 'FN' && i.stage === st).length })), [items])
  const days = Array.from({ length: 10 }, (_, k) => {
    const d = new Date(now + k * D)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    return { d, count: bills.flatMap(b => b.hearings).filter(h => ms(h) >= Math.max(start, k === 0 ? now : 0) && ms(h) < start + D).length }
  })
  const showWorkload = ['Manager', 'Assigner', 'Leadership', 'Administrator', 'Reviewer', 'Budget Office'].includes(role)

  if (loading) return <><PageHeader title="Dashboard" /><Skeleton rows={8} /></>

  return (
    <>
      <PageHeader title={`Good day, ${me.name.split(' ')[0]}`} subtitle={`${role} dashboard. 2027 regular session, ${bills.filter(b => b.session === '2027').length} bills tracked.`} />

      <Card title="Quick actions: I want to..." className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {QUICK[role].map(q => <li key={q.label}><LinkButton to={q.to} variant="secondary" icon={q.icon}>{q.label}</LinkButton></li>)}
        </ul>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="My items due today" value={stats.mineToday.length} tone={stats.mineToday.length ? 'warn' : 'ok'} to="/queue?tab=Due soon" />
        <Stat label="Hearings in 72 hours" value={hearings.length} tone={hearings.length ? 'warn' : 'ok'} to="/bills?hearing=72" />
        <Stat label="Overdue work products" value={stats.overdue.length} tone={stats.overdue.length ? 'bad' : 'ok'} to="/queue?tab=Overdue" sub={role === 'Manager' ? 'Manager alerts sent' : undefined} />
        <Stat label="Amendments awaiting analysis" value={amendments.length} tone={amendments.length ? 'warn' : 'ok'} to="/compare" sub={role === 'Assigner' || role === 'Manager' ? `${stats.unassigned} items unassigned` : undefined} />
      </div>

      <Card title="Session calendar, next 10 days" className="mb-4">
        <ol className="grid grid-cols-5 gap-2 md:grid-cols-10" aria-label="Hearings per day">
          {days.map((x, i) => (
            <li key={i}>
              <a href="#/bills?hearing=240" className={`block rounded border p-2 text-center no-underline ${x.count ? 'border-blue bg-lightblue' : 'border-line bg-white'}`}>
                <span className="block text-xs text-muted">{fmtDate(x.d.toISOString()).split(',')[0]}</span>
                <span className="block text-base font-semibold text-navy">{x.d.getDate()}</span>
                <span className={`block text-xs font-medium ${x.count ? 'text-blue' : 'text-muted'}`}>{x.count} hearing{x.count === 1 ? '' : 's'}</span>
              </a>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Hearings in the next 72 hours" pad={false}>
          <DataTable caption="Hearings in the next 72 hours" rows={hearings} rowKey={x => x.b.id + x.h} onRow={x => (window.location.hash = `/bills/${x.b.id}`)}
            empty={<EmptyState title="No hearings in 72 hours" text="Use Simulate legislature update to add one." />}
            cols={[
              { key: 'b', header: 'Bill', render: x => <A to={`/bills/${x.b.id}`}>{billLabel(x.b)}</A> },
              { key: 'c', header: 'Committee', render: x => x.b.committee, className: 'hidden lg:table-cell' },
              { key: 'h', header: 'When', render: x => <HearingBadge at={x.h} /> },
            ]} />
        </Card>

        <Card title={role === 'Analyst' || role === 'Expenditure Contributor' ? 'My items due today' : 'Items due today or overdue'} pad={false}>
          <DataTable caption="Items due today" rows={(role === 'Analyst' || role === 'Expenditure Contributor' ? stats.mineToday : stats.overdue).slice(0, 6)} rowKey={i => i.id} onRow={i => openItem(i.id, i.type)}
            empty={<EmptyState title="Nothing due today" text="You are caught up." />}
            cols={[
              { key: 'id', header: 'ID', render: i => <A to={`/review/${i.id}`}>{i.id}</A> },
              { key: 's', header: 'Status', render: i => <StageChip item={i} /> },
              { key: 'c', header: 'Clock', render: i => <ClockChip item={i} /> },
            ]} />
        </Card>

        {showWorkload && (
          <Card title="Workload by analyst">
            <div className="h-64" role="img" aria-label={`Bar chart of open and overdue work by analyst. ${workload.map(w => `${w.full}: ${w.Open} open, ${w.Overdue} overdue`).join('; ')}`}>
              <ResponsiveContainer>
                <BarChart data={workload} margin={{ left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#DCDEE0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="Open" fill="#005A9C" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Overdue" fill="#B3261E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-sm text-muted"><span className="font-semibold text-[#005A9C]">Blue</span> open items, <span className="font-semibold text-bad">red</span> overdue items.</p>
          </Card>
        )}

        <Card title="Fiscal notes by status">
          <div className="h-64" role="img" aria-label={`Fiscal notes by status. ${fnByStatus.map(f => `${f.stage}: ${f.count}`).join('; ')}`}>
            <ResponsiveContainer>
              <BarChart data={fnByStatus} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DCDEE0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 3, 3, 0]} label={{ position: 'right', fontSize: 12 }}>
                  {fnByStatus.map((f, i) => <Cell key={i} fill={f.stage === 'Delivered' || f.stage === 'Approved' ? '#2E7D32' : f.stage === 'Rework' ? '#B35C00' : '#005A9C'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Amendments awaiting analysis" pad={false}>
          <DataTable caption="Amendments awaiting analysis" rows={amendments.slice(0, 6)} rowKey={x => x.v.id} onRow={x => (window.location.hash = `/compare?bill=${x.b.id}`)}
            empty={<EmptyState title="All amendments analyzed" />}
            cols={[
              { key: 'a', header: 'Amendment', render: x => <A to={`/compare?bill=${x.b.id}`}>{x.v.label}</A> },
              { key: 'b', header: 'Bill', render: x => billLabel(x.b) },
              { key: 'd', header: 'Filed', render: x => fmtDate(x.v.date), className: 'hidden sm:table-cell' },
            ]} />
        </Card>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Icon name="bell" size={16} />Times refresh automatically. Clocks turn amber at 50 percent elapsed and red at 80 percent.</p>
    </>
  )
}
