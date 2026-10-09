import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore, useMe, personaFor } from './store'
import { useRoute, go } from './router'
import { Icon, Modal, Toaster, Button, Chip } from './components/ui'
import { ROLES, canNav, countdown, ms, nextHearing, visibleBills, visibleItems, type NavKey, billLabel } from './lib'
import type { Role } from './types'
import Dashboard from './pages/Dashboard'
import Queue from './pages/Queue'
import { BillsList, Bill360 } from './pages/Bills'
import Compare from './pages/Compare'
import { FiscalList, FiscalWorkspace } from './pages/Fiscal'
import { Estimates, EstimateDetail } from './pages/Estimates'
import { Packages } from './pages/Packages'
import { Analyses, AnalysisEditor } from './pages/Analyses'
import Review from './pages/Review'
import Executive from './pages/Executive'
import Reports from './pages/Reports'
import Implementation from './pages/Implementation'
import Notifications from './pages/Notifications'
import Admin from './pages/Admin'
import Hearings from './pages/Hearings'
import Search from './pages/Search'
import { searchWorkspace } from './search'

const NAV: { key: NavKey; label: string; to: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', to: '/', icon: 'home' },
  { key: 'queue', label: 'My Work', to: '/queue', icon: 'list' },
  { key: 'bills', label: 'Bills', to: '/bills', icon: 'bill' },
  { key: 'bills', label: 'Hearings', to: '/hearings', icon: 'clock' },
  { key: 'queue', label: 'Assignments', to: '/queue?tab=Assigned', icon: 'users' },
  { key: 'fiscal', label: 'Fiscal Notes', to: '/fiscal', icon: 'calc' },
  { key: 'estimates', label: 'Estimates & Data Requests', to: '/estimates', icon: 'file' },
  { key: 'packages', label: 'Packages', to: '/packages', icon: 'folder' },
  { key: 'analyses', label: 'Bill Analyses', to: '/analyses', icon: 'edit' },
  { key: 'executive', label: 'Executive Review', to: '/executive', icon: 'shield' },
  { key: 'reports', label: 'Reports', to: '/reports', icon: 'chart' },
  { key: 'bills', label: 'Search', to: '/search', icon: 'search' },
  { key: 'bills', label: 'Notifications', to: '/notifications', icon: 'bell' },
  { key: 'implementation', label: 'Implementation', to: '/implementation', icon: 'flag' },
  { key: 'admin', label: 'Admin', to: '/admin', icon: 'settings' },
]

function LogoMark() {
  return <img src="./dor-logo.svg" alt="Washington Department of Revenue" width={100} height={40} className="h-10 w-[100px] shrink-0 rounded bg-white p-1 object-contain" />
}

function useOutside(ref: React.RefObject<HTMLElement | null>, on: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) on() }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') on() }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [ref, on])
}

function GlobalSearch() {
  const data = useStore(s => s.data), role = useStore(s => s.role), me = useMe()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    const bills = visibleBills(data, role).filter(b => `${b.number ?? ''} ${b.title} ${b.status} ${b.sponsors.join(' ')} ${b.topics.join(' ')} ${b.committee}`.toLowerCase().includes(t)).slice(0, 5).map(b => ({ label: `${billLabel(b)}: ${b.title}`, to: `/bills/${b.id}`, kind: 'Bill' }))
    const items = visibleItems(data, role, me).filter(i => `${i.id} ${i.title} ${i.body ?? ''} ${(i.correspondence ?? []).map(c => c.to + ' ' + c.note).join(' ')}`.toLowerCase().includes(t)).slice(0, 5).map(i => ({ label: `${i.id}: ${i.title}`, to: i.type === 'FN' ? `/fiscal/${i.id}` : i.type === 'BA' ? `/analyses/${i.id}` : `/estimates/${i.id}`, kind: 'Work' }))
    void bills; void items
    return searchWorkspace(data, role, me, q).slice(0, 12).map(r => ({ label: r.label, to: r.link, kind: r.kind }))
  }, [q, data, role, me])
  return (
    <div ref={ref} className="relative w-full max-w-xl" role="search">
      <label htmlFor="gsearch" className="sr-only">Search bills and work products</label>
      <div className="flex items-center gap-2 rounded bg-white px-3 text-ink">
        <Icon name="search" className="text-muted" />
        <input id="gsearch" value={q} onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Search bills, IDs, titles" autoComplete="off"
          className="min-h-[40px] w-full bg-transparent py-2 text-[15px] outline-none placeholder:text-muted" />
      </div>
      {open && q.trim().length >= 2 && (
        <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-auto rounded border border-line bg-white py-1 text-ink shadow-lg">
          {results.length === 0 && <li className="px-3 py-2 text-muted">No matches</li>}
          {results.map(r => (
            <li key={r.to}><a href={'#' + r.to} onClick={() => { setOpen(false); setQ('') }} className="flex items-center gap-2 px-3 py-2 text-ink no-underline hover:bg-lightblue"><Chip>{r.kind}</Chip><span className="truncate">{r.label}</span></a></li>
          ))}
        </ul>
      )}
    </div>
  )
}

function UserMenu({ onHelp }: { onHelp: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  const { role, setRole, setUser, userId, data, reset, simulateLegislature, guideOpen, setGuide } = useStore()
  const me = useMe()
  const people = data.staff.filter(s => s.role === role)
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)} className="flex min-h-[40px] items-center gap-2 rounded border border-white/40 px-3 py-1 text-left hover:bg-white/15">
        <span className="hidden text-sm leading-tight sm:block"><span className="block font-semibold">{me.name}</span><span className="block text-white/85">{role}</span></span>
        <span className="sm:hidden"><Icon name="users" /></span>
        <Icon name="down" size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 max-w-[92vw] rounded-md border border-line bg-white p-4 text-ink shadow-xl">
          <p className="mb-2 text-sm font-semibold text-navy">Presenter controls</p>
          <label htmlFor="role-sel" className="text-sm font-semibold">Role</label>
          <select id="role-sel" className="mb-3 min-h-[40px] w-full rounded border border-[#8a8d91] px-2" value={role} onChange={e => setRole(e.target.value as Role)}>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
          <label htmlFor="person-sel" className="text-sm font-semibold">Acting as</label>
          <select id="person-sel" className="mb-3 min-h-[40px] w-full rounded border border-[#8a8d91] px-2" value={userId} onChange={e => setUser(e.target.value)}>
            {people.map(p => <option key={p.id} value={p.id}>{p.name} ({p.division})</option>)}
          </select>
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <Button variant="secondary" icon="refresh" onClick={() => { setOpen(false); void simulateLegislature() }}>Simulate legislature update</Button>
            <Button variant="secondary" icon="star" onClick={() => { setGuide(!guideOpen); setOpen(false) }}>{guideOpen ? 'Hide' : 'Show'} Guide</Button>
            <Button variant="secondary" icon="undo" onClick={() => { setOpen(false); reset() }}>Reset workspace</Button>
            <Button variant="ghost" icon="help" onClick={() => { setOpen(false); onHelp() }}>Help</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Header({ onHelp }: { onHelp: () => void }) {
  const { role, setRole, setDrawer, drawerOpen, data } = useStore()
  const unread = data.notifications.filter(n => !n.read && n.toRoles.includes(role)).length
  return (
    <header className="on-dark shrink-0 z-30 bg-navy text-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:px-4">
        <button type="button" aria-label="Open navigation menu" aria-expanded={drawerOpen} onClick={() => setDrawer(!drawerOpen)} className="rounded p-2 hover:bg-white/15 md:hidden"><Icon name="menu" size={24} /></button>
        <a href="#/" className="flex items-center gap-3 text-white no-underline">
          <LogoMark />
          <span className="leading-tight">
            <span className="block text-base font-semibold"><span className="sm:hidden">DOR </span>Legislative Tracking System</span>
          </span>
        </a>
        <div className="order-last w-full md:order-none md:ml-4 md:w-auto md:flex-1"><GlobalSearch /></div>
        <div className="ml-auto flex items-center gap-1">
          <label htmlFor="role-quick" className="sr-only">Switch role</label>
          <select id="role-quick" value={role} onChange={e => setRole(e.target.value as Role)} className="hidden min-h-[40px] rounded bg-white px-2 text-[15px] text-ink lg:block">
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
          <a href="#/notifications" aria-label={`Notifications, ${unread} unread`} className="relative rounded p-2 text-white hover:bg-white/15">
            <Icon name="bell" size={22} />
            {unread > 0 && <span className="absolute right-0 top-0 rounded-full bg-gold px-1.5 text-xs font-bold text-navy">{unread}</span>}
          </a>
          <button type="button" aria-label="Help" onClick={onHelp} className="rounded p-2 hover:bg-white/15"><Icon name="help" size={22} /></button>
          <UserMenu onHelp={onHelp} />
        </div>
      </div>
    </header>
  )
}

function AlertBanner() {
  const data = useStore(s => s.data), role = useStore(s => s.role), now = useStore(s => s.now)
  const [hidden, setHidden] = useState(false)
  const upcoming = visibleBills(data, role).map(b => ({ b, h: nextHearing(b, now) })).filter(x => x.h && ms(x.h) > now).sort((a, b) => ms(a.h!) - ms(b.h!))
  const in24 = upcoming.filter(x => ms(x.h!) - now < 24 * 3600_000)
  const in72 = upcoming.filter(x => ms(x.h!) - now < 72 * 3600_000)
  if (hidden || !in72.length) return null
  const list = in24.length ? in24 : in72
  const first = list[0]
  return (
    <div role="region" aria-label="Urgent hearings" className="flex shrink-0 items-center gap-3 bg-[#FFF1DE] px-4 py-2 text-[15px] text-[#5E3200]">
      <Icon name="alert" className="text-warn" />
      <p className="flex-1">
        <strong>{list.length} hearing{list.length > 1 ? 's' : ''} in the next {in24.length ? '24' : '72'} hours.</strong>{' '}
        Next: <a className="font-semibold text-[#5E3200] underline" href={`#/bills/${first.b.id}`}>{billLabel(first.b)}</a> {countdown(first.h!, now)}.{' '}
        <a className="font-semibold text-[#5E3200] underline" href="#/bills?hearing=72">See all hearings</a>
      </p>
      <button type="button" aria-label="Dismiss alert" onClick={() => setHidden(true)} className="rounded p-1 hover:bg-black/10"><Icon name="x" size={18} /></button>
    </div>
  )
}

function SideNav({ path }: { path: string }) {
  const { role, navCollapsed, setNavCollapsed, drawerOpen, setDrawer } = useStore()
  const root = '/' + (path.split('/')[1] ?? '')
  const items = NAV.filter(n => canNav(role, n.key))
  const isActive = (to: string) => (to === '/' ? path === '/' : root === to || (to === '/fiscal' && path.startsWith('/review')))
  const body = (collapsed: boolean) => (
    <nav aria-label="Main" className="on-dark flex h-full min-h-0 flex-col overflow-hidden bg-navy text-white print:h-auto print:overflow-visible">
      <ul className="nav-menu min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 md:py-1 print:overflow-visible">
        {items.map(n => (
          <li key={n.to}>
            <a href={'#' + n.to} onClick={() => setDrawer(false)} aria-current={isActive(n.to) ? 'page' : undefined} title={collapsed ? n.label : undefined}
              className={`flex min-h-[44px] items-center gap-3 border-l-4 px-4 py-2 text-[15px] text-white no-underline hover:bg-white/10 md:min-h-9 md:gap-2 md:px-3 md:py-1 md:text-sm md:leading-5 ${isActive(n.to) ? 'border-gold bg-blue font-semibold' : 'border-transparent'}`}>
              <Icon name={n.icon} size={20} />
              {!collapsed && <span>{n.label}</span>}
              {collapsed && <span className="sr-only">{n.label}</span>}
            </a>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setNavCollapsed(!navCollapsed)} className="hidden min-h-10 shrink-0 items-center gap-2 border-t border-white/20 px-4 py-2 text-sm hover:bg-white/10 md:flex" aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}>
        <Icon name={navCollapsed ? 'right' : 'menu'} size={20} />{!collapsed && 'Collapse menu'}
      </button>
    </nav>
  )
  return (
    <>
      <aside className={`hidden shrink-0 self-start bg-navy md:sticky md:top-[var(--app-header-height,0px)] md:block md:h-[calc(100dvh-var(--app-header-height,0px))] print:static print:h-auto ${navCollapsed ? 'w-16' : 'w-60'}`}>{body(navCollapsed)}</aside>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute left-0 top-0 h-full w-72" onClick={e => e.stopPropagation()}>{body(false)}</aside>
        </div>
      )}
    </>
  )
}

function BottomTabs({ path }: { path: string }) {
  const { role, data } = useStore()
  const unread = data.notifications.filter(n => !n.read && n.toRoles.includes(role)).length
  const tabs = [
    { label: 'Queue', to: '/queue', icon: 'list' }, { label: 'Bills', to: '/bills', icon: 'bill' },
    { label: 'Approvals', to: '/executive', icon: 'shield' }, { label: 'Alerts', to: '/notifications', icon: 'bell' },
  ]
  return (
    <nav aria-label="Mobile" className="on-dark fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-white/20 bg-navy text-white md:hidden">
      {tabs.map(t => (
        <a key={t.to} href={'#' + t.to} aria-current={path.startsWith(t.to) ? 'page' : undefined}
          className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs text-white no-underline ${path.startsWith(t.to) ? 'bg-blue font-semibold' : ''}`}>
          <Icon name={t.icon} size={22} />{t.label}
          {t.label === 'Alerts' && unread > 0 && <span className="absolute right-6 top-1 rounded-full bg-gold px-1.5 text-[11px] font-bold text-navy">{unread}</span>}
        </a>
      ))}
    </nav>
  )
}

function DemoGuide() {
  const { guideOpen, setGuide, setRole, data, simulateLegislature } = useStore()
  const [collapsed, setCollapsed] = useState(true)
  const scenarios: { title: string; steps: string; run: () => void }[] = [
    { title: '1. New hearing in under 72 hours', steps: 'Refreshes collector-shaped hearing scenarios. Start Tracking to create work.', run: () => { setRole('Assigner'); void simulateLegislature(); go('/queue?tab=Assigned') } },
    { title: '2. Route a fiscal note', steps: 'Create a fiscal note, then assign revenue and expenditure sections.', run: () => { setRole('Assigner'); go('/fiscal') } },
    { title: '3. Compare SHB to HB, draft analysis', steps: 'Compare versions with redline, then open the analysis editor.', run: () => { setRole('Analyst'); go(`/compare?bill=${data.bills[0].id}`) } },
    { title: '4. FTE calculation and prior products', steps: 'Edit hours in the calculator. The prior-product tab shows when no verified prior estimate is supplied.', run: () => { setRole('Analyst'); go('/fiscal') } },
    { title: '5. Review, return, fix, executive review', steps: 'Reviewer approves or returns. Then switch to Executive Reviewer on a phone-width view.', run: () => { setRole('Reviewer'); go('/executive') } },
    { title: '6. Transmit to OFM and view audit', steps: 'Preview Word, PDF and XML, transmit, then open Admin > Audit log.', run: () => { setRole('Manager'); go('/fiscal') } },
    { title: '7. Manager workload and saved query', steps: 'Workload chart, then the saved fiscal query.', run: () => { setRole('Manager'); go('/reports?tab=query') } },
  ]
  if (!guideOpen) return null
  return (
    <aside aria-label="Workflow guide" className="fixed bottom-16 left-2 z-40 w-[min(92vw,22rem)] rounded-md border border-line bg-white shadow-xl md:bottom-4 md:left-auto md:right-4 md:w-80">
      <div className="flex items-center justify-between rounded-t-md bg-navy px-3 py-2 text-white">
        <h2 className="text-base font-semibold">Guide</h2>
        <div className="flex gap-1">
          <button type="button" className="rounded px-2 hover:bg-white/15" aria-expanded={!collapsed} onClick={() => setCollapsed(c => !c)}>{collapsed ? 'Expand' : 'Collapse'}</button>
          <button type="button" className="rounded p-1 hover:bg-white/15" aria-label="Close workflow guide" onClick={() => setGuide(false)}><Icon name="x" size={16} /></button>
        </div>
      </div>
      {!collapsed && (
        <ul className="max-h-[55vh] divide-y divide-line overflow-auto">
          {scenarios.map(s => (
            <li key={s.title}>
              <button type="button" onClick={s.run} className="block w-full px-3 py-2 text-left hover:bg-lightblue">
                <span className="block text-[15px] font-semibold text-blue">{s.title}</span>
                <span className="block text-sm text-muted">{s.steps}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

function Footer({ onA11y }: { onA11y: () => void }) {
  return (
    <footer className="on-dark mt-8 bg-navy px-4 py-5 text-sm text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>Legislative Tracking System. Washington legislative records and agency workflows.</p>
        <p>For support, contact your system administrator.</p>
        <button type="button" onClick={onA11y} className="text-white underline">Accessibility</button>
      </div>
    </footer>
  )
}

function Screen({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export default function App() {
  const route = useRoute()
  const { tick, role, data } = useStore()
  const [help, setHelp] = useState(false)
  const [a11y, setA11y] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    // The alert and responsive header can change height; keep the sidebar below both.
    const updateHeight = () => header.parentElement?.style.setProperty('--app-header-height', `${header.getBoundingClientRect().height}px`)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  useEffect(() => { const t = setInterval(tick, 20_000); return () => clearInterval(t) }, [tick])
  const [a, b] = route.seg
  const guard = (k: NavKey, el: ReactNode) => (canNav(role, k) || k === 'dashboard' ? el : <AccessDenied />)
  let page: ReactNode
  switch (a) {
    case undefined: page = <Dashboard />; break
    case 'queue': page = <Queue />; break
    case 'bills': page = b ? <Bill360 id={b} tab={route.q.get('tab') ?? 'Summary'} /> : <BillsList />; break
    case 'hearings': page = <Hearings />; break;
    case 'search': page = <Search />; break;
    case 'compare': page = <Compare />; break
    case 'fiscal': page = b ? <FiscalWorkspace id={b} tab={route.q.get('tab') ?? 'narrative'} /> : <FiscalList />; break
    case 'estimates': page = b ? <EstimateDetail id={b} /> : <Estimates />; break
    case 'packages': page = <Packages id={b} />; break
    case 'analyses': page = b ? <AnalysisEditor id={b} /> : <Analyses />; break
    case 'review': page = <Review id={b} />; break
    case 'executive': page = <Executive />; break
    case 'reports': page = guard('reports', <Reports />); break
    case 'implementation': page = guard('implementation', <Implementation />); break
    case 'notifications': page = <Notifications />; break
    case 'admin': page = guard('admin', <Admin section={b ?? 'roles'} />); break
    default: page = <NotFound />
  }
  void data
  return (
    <div className="flex min-h-dvh flex-col">
      <a className="skip-link" href="#main" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus() }}>Skip to main content</a>
      <div ref={headerRef} className="z-30 shrink-0 md:sticky md:top-0 print:static">
        <Header onHelp={() => setHelp(true)} />
        <AlertBanner />
      </div>
      <div className="flex min-h-0 flex-1">
        <SideNav path={route.path} />
        <div data-page-content className="min-w-0 flex-1">
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 pb-24 outline-none md:px-6 md:pb-8">
          <p className="mb-4 rounded border border-line bg-white px-3 py-2 text-sm text-muted">250 official Washington legislative records. Additional simulated hearings exercise 72-hour alerts; My Work includes mock assignments for each persona.</p>
          <Screen key={route.path + (route.q.get('tab') ?? '')}>{page}</Screen>
        </main>
        <Footer onA11y={() => setA11y(true)} />
        </div>
      </div>
      <BottomTabs path={route.path} />
      <DemoGuide />
      <Toaster />
      {help && (
        <Modal title="Help" onClose={() => setHelp(false)}>
          <ul className="list-disc space-y-2 pl-5">
            <li>Use the role menu in the header to change persona. Navigation and buttons change by role.</li>
            <li>Every button, link and row responds to a single click or tap.</li>
            <li>Open guide from the user menu for guided scenarios. Use Reset workspace to reload the seed content.</li>
            <li>All integrations (Legislature feed, OFM, SharePoint, Email, Teams) are simulated.</li>
          </ul>
        </Modal>
      )}
      {a11y && (
        <Modal title="Accessibility" onClose={() => setA11y(false)}>
          <p>This system is designed to meet WCAG 2.2 AA: keyboard operation, visible focus, screen-reader labels, sufficient contrast and reduced-motion support. To report a barrier, contact your system administrator.</p>
        </Modal>
      )}
    </div>
  )
}

function AccessDenied() {
  const role = useStore(s => s.role)
  return (
    <div className="mx-auto max-w-lg rounded-md border border-line bg-white p-6 text-center">
      <Icon name="lock" size={32} className="mx-auto text-muted" />
      <h1 className="mt-2 text-xl font-semibold text-navy">This area is not available to your role</h1>
      <p className="mt-1 text-muted">The {role} role does not have access to this page. Switch role from the user menu to continue.</p>
      <a href="#/" className="mt-4 inline-block font-semibold text-blue">Return to the dashboard</a>
    </div>
  )
}
function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-md border border-line bg-white p-6 text-center">
      <h1 className="text-xl font-semibold text-navy">Page not found</h1>
      <a href="#/" className="mt-2 inline-block font-semibold text-blue">Return to the dashboard</a>
    </div>
  )
}
export { personaFor }
