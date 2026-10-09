import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { useStore } from '../store'
import { clockOf, countdown, type ClockState } from '../lib'
import type { Stage, WorkItem } from '../types'
import { go } from '../router'

// ---------- icons ----------
const P: Record<string, string> = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z',
  alert: 'M12 8v5M12 16.5v.5M10.3 4.2L2.8 17.5A2 2 0 004.5 20.5h15a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z',
  pause: 'M9 6v12M15 6v12',
  lock: 'M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  send: 'M3 11l18-8-8 18-2-8z',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  x: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  bell: 'M6 16V11a6 6 0 1112 0v5l2 2H4zM10 21h4',
  help: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9.5a2.5 2.5 0 115 0c0 1.7-2.5 2-2.5 4M12 17v.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  home: 'M4 11l8-7 8 7M6 10v10h12V10',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.5M4 12h.5M4 18h.5',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  calc: 'M6 3h12v18H6zM9 7h6M9 12h.5M12 12h.5M15 12h.5M9 16h.5M12 16h.5M15 16h.5',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M16 6a3 3 0 010 6M18 20a5 5 0 00-3-4.6',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
  folder: 'M3 6h6l2 2h10v11H3z',
  down: 'M6 9l6 6 6-6',
  right: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 12a8 8 0 10-2.3 5.7M20 5v5h-5',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  compare: 'M8 4v16M16 4v16M4 8h8M12 16h8',
  inbox: 'M4 13l3-8h10l3 8v6H4zM4 13h5l1 2h4l1-2h5',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-2-4-2 .5-1.5-1L15 4H9l-.5 2.5-1.5 1L5 7 3 11l2 1v1l-2 1 2 4 2-.5 1.5 1L9 20h6l.5-2.5 1.5-1 2 .5 2-4-2-1z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  undo: 'M9 7L4 12l5 5M4 12h10a6 6 0 010 8',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  bill: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  upload: 'M12 16V5M7 9l5-5 5 5M5 20h14',
}
export function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={P[name] ?? P.file} />
    </svg>
  )
}

// ---------- buttons ----------
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dark'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-blue text-white hover:bg-[#004a82] border border-blue',
  secondary: 'bg-white text-blue hover:bg-lightblue border border-blue',
  danger: 'bg-bad text-white hover:bg-[#8f1d16] border border-bad',
  ghost: 'bg-transparent text-blue hover:bg-lightblue border border-transparent',
  dark: 'bg-transparent text-white hover:bg-white/15 border border-white/40',
}
export function Button({ variant = 'primary', icon, className = '', children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string }) {
  return (
    <button type="button" {...p} className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded px-4 py-2 text-[15px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  )
}
export function LinkButton({ to, children, variant = 'primary', icon, className = '' }: { to: string; children: ReactNode; variant?: Variant; icon?: string; className?: string }) {
  return (
    <a href={'#' + to} className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded px-4 py-2 text-[15px] font-semibold no-underline ${VARIANTS[variant]} ${className}`}>
      {icon && <Icon name={icon} />}
      {children}
    </a>
  )
}
export const A = ({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) => (
  <a href={'#' + to} className={`text-blue underline underline-offset-2 hover:no-underline ${className}`}>{children}</a>
)

// ---------- chips ----------
type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral'
const TONES: Record<Tone, string> = {
  ok: 'bg-[#E8F3E9] text-[#1E5A22] border-[#9CCB9F]',
  warn: 'bg-[#FFF1DE] text-[#7A3F00] border-[#E5B677]',
  bad: 'bg-[#FBE9E7] text-[#8F1D16] border-[#E3A19B]',
  info: 'bg-lightblue text-[#08487F] border-[#9DC1DE]',
  neutral: 'bg-[#EEF0F2] text-[#333] border-[#C9CDD1]',
}
export function Chip({ tone = 'neutral', icon, children, title }: { tone?: Tone; icon?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-sm font-medium ${TONES[tone]}`}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  )
}
const STAGE_META: Record<Stage, [Tone, string]> = {
  Assigned: ['neutral', 'inbox'], 'In progress': ['info', 'edit'], 'In review': ['info', 'eye'], Rework: ['warn', 'undo'],
  'Executive review': ['info', 'shield'], Approved: ['ok', 'check'], Delivered: ['ok', 'send'],
}
export function StageChip({ item }: { item: Pick<WorkItem, 'stage' | 'onHold'> & Partial<Pick<WorkItem, 'type' | 'publishedVersion' | 'changesPending'>> }) {
  if (item.changesPending) return <Chip tone="warn" icon="edit">Published — Changes Pending</Chip>
  if (item.type === 'BA' && item.publishedVersion && item.stage === 'Delivered') return <Chip tone="ok" icon="check">Published</Chip>
  if (item.onHold) return <Chip tone="warn" icon="pause">On hold</Chip>
  const [t, i] = STAGE_META[item.stage]
  return <Chip tone={t} icon={i}>{item.stage}</Chip>
}
export function ClockChip({ item }: { item: WorkItem }) {
  const now = useStore(s => s.now)
  const c = clockOf(item, now)
  const t = countdown(item.dueAt, now)
  const map: Record<ClockState, [Tone, string, string]> = {
    ok: ['ok', 'clock', `On track, due ${t}`],
    amber: ['warn', 'clock', `Half elapsed, due ${t}`],
    red: ['bad', 'alert', `Due soon, ${t}`],
    overdue: ['bad', 'alert', `Overdue, ${t.replace(' overdue', '')}`],
    done: ['ok', 'check', 'Delivered'],
    hold: ['warn', 'pause', 'Clock paused'],
  }
  const [tone, icon, txt] = map[c.state]
  return <Chip tone={tone} icon={icon}>{txt}</Chip>
}
export function PriorityChip({ p }: { p: string }) {
  return p === 'Urgent' ? <Chip tone="bad" icon="flag">Urgent</Chip> : p === 'High' ? <Chip tone="warn" icon="flag">High</Chip> : <Chip>{p}</Chip>
}
export function HearingBadge({ at }: { at: string }) {
  const now = useStore(s => s.now)
  const diff = new Date(at).getTime() - now
  const tone: Tone = diff < 24 * 3600_000 ? 'bad' : diff < 72 * 3600_000 ? 'warn' : 'info'
  return <Chip tone={tone} icon="clock">Hearing {countdown(at, now)}</Chip>
}

// ---------- layout blocks ----------
export function Card({ title, actions, children, className = '', pad = true, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean; id?: string }) {
  return (
    <section id={id} className={`rounded-md border border-line bg-white ${className}`} aria-label={typeof title === 'string' ? title : undefined}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-lg font-semibold text-navy">{title}</h2>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}
export function PageHeader({ title, subtitle, actions, crumbs }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumbs?: { label: string; to?: string }[] }) {
  return (
    <div className="mb-4">
      {crumbs && (
        <nav aria-label="Breadcrumb" className="mb-1 text-sm text-muted">
          {crumbs.map((c, i) => (
            <span key={i}>{c.to ? <A to={c.to}>{c.label}</A> : c.label}{i < crumbs.length - 1 && <span aria-hidden="true"> / </span>}</span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-navy">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
export function Tabs({ tabs, value, onChange, label }: { tabs: { id: string; label: ReactNode }[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map(t => (
        <button key={t.id} role="tab" type="button" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`-mb-px whitespace-nowrap border-b-4 px-4 py-2 text-[15px] font-semibold ${value === t.id ? 'border-blue text-blue' : 'border-transparent text-muted hover:text-ink'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Icon name="inbox" size={32} className="text-muted" />
      <p className="text-lg font-semibold text-navy">{title}</p>
      {text && <p className="max-w-md text-muted">{text}</p>}
      {action}
    </div>
  )
}
export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-6" style={{ width: `${95 - (i % 3) * 15}%` }} />)}
    </div>
  )
}
export function useLoading(ms = 350) {
  const [l, setL] = useState(true)
  useEffect(() => { const t = setTimeout(() => setL(false), ms); return () => clearTimeout(t) }, [ms])
  return l
}

export function Field({ label, children, hint, htmlFor }: { label: string; children: ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">{label}</label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}
export const inputCls = 'min-h-[40px] w-full rounded border border-[#8a8d91] bg-white px-3 py-2 text-[15px] text-ink'
export function Select({ value, onChange, options, id, label, className = '' }: { value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; id?: string; label?: string; className?: string }) {
  return (
    <select id={id} aria-label={label} value={value} onChange={e => onChange(e.target.value)} className={`${inputCls} ${className}`}>
      {options.map(o => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  )
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const ini = name.split(' ').map(w => w[0]).slice(0, 2).join('')
  return <span title={name} aria-label={name} className="inline-flex items-center justify-center rounded-full bg-navy font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.4 }}>{ini}</span>
}
export function Presence({ itemId }: { itemId: string }) {
  const staff = useStore(s => s.data.staff)
  const pid = useStore(s => s.data.presence[itemId])
  const me = useStore(s => s.userId)
  const who = staff.find(x => x.id === pid)
  if (!who || who.id === me) return null
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted" title={`${who.name} is viewing`}>
      <span className="relative"><Avatar name={who.name} size={22} /><span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-ok" /></span>
      <span className="sr-only">{who.name} is viewing this item</span>
    </span>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
      const k = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeRef.current()
        if (e.key === 'Tab') {
          const nodes = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length)
          const first = nodes[0], last = nodes.at(-1)
          if (!first) { e.preventDefault(); return }
          if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus() }
          else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first.focus() }
        }
      }
    window.addEventListener('keydown', k)
    return () => { window.removeEventListener('keydown', k); prev?.focus() }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        className={`mt-10 w-full rounded-md bg-white shadow-xl ${wide ? 'max-w-4xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-lg font-semibold text-navy">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded p-1 hover:bg-page"><Icon name="x" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export function Toaster() {
  const toasts = useStore(s => s.toasts)
  const dismiss = useStore(s => s.dismissToast)
  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => dismiss(toasts[0].id), 5500)
    return () => clearTimeout(t)
  }, [toasts, dismiss])
  return (
    <div className="fixed bottom-20 right-4 z-[60] flex w-[min(92vw,26rem)] flex-col gap-2 md:bottom-4" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-start gap-2 rounded border-l-4 bg-white p-3 text-[15px] shadow-lg ${t.kind === 'error' ? 'border-bad' : t.kind === 'info' ? 'border-info' : 'border-ok'}`}>
          <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'bell' : 'check'} className={t.kind === 'error' ? 'text-bad' : t.kind === 'info' ? 'text-info' : 'text-ok'} />
          <span className="flex-1">{t.msg}</span>
          <button type="button" aria-label="Dismiss message" onClick={() => dismiss(t.id)} className="rounded p-0.5 hover:bg-page"><Icon name="x" size={16} /></button>
        </div>
      ))}
    </div>
  )
}

// ---------- table ----------
export interface Col<T> { key: string; header: string; render: (r: T) => ReactNode; className?: string; sort?: (r: T) => string | number }
export function DataTable<T>({ cols, rows, rowKey, onRow, selectable, selected, onSelect, caption, empty, pageSize }: {
  cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; onRow?: (r: T) => void; selectable?: boolean
  selected?: string[]; onSelect?: (ids: string[]) => void; caption: string; empty?: ReactNode; pageSize?: number
}) {
  const [sortKey, setSortKey] = useState<string>('')
  const [dir, setDir] = useState<1 | -1>(1)
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [rows, pageSize, sortKey, dir])
  const sorted = (() => {
    const c = cols.find(x => x.key === sortKey)
    if (!c?.sort) return rows
    return [...rows].sort((a, b) => { const x = c.sort!(a), y = c.sort!(b); return (x < y ? -1 : x > y ? 1 : 0) * dir })
  })()
  const pages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const currentPage = Math.min(page, pages - 1)
  const shown = pageSize ? sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : sorted
  if (!rows.length) return <>{empty ?? <EmptyState title="Nothing to show" text="No records match the current filters." />}</>
  const allIds = rows.map(rowKey)
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[15px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-[#EEF1F4] text-sm">
            {selectable && (
              <th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Select all rows" className="h-5 w-5" checked={!!selected && selected.length === allIds.length && allIds.length > 0}
                onChange={e => onSelect?.(e.target.checked ? allIds : [])} /></th>
            )}
            {cols.map(c => (
              <th key={c.key} scope="col" className={`px-3 py-2 font-semibold text-navy ${c.className ?? ''}`} aria-sort={sortKey === c.key ? (dir === 1 ? 'ascending' : 'descending') : undefined}>
                {c.sort ? (
                  <button type="button" className="inline-flex items-center gap-1 font-semibold hover:underline" onClick={() => { if (sortKey === c.key) setDir(d => (d === 1 ? -1 : 1)); else { setSortKey(c.key); setDir(1) } }}>
                    {c.header}{sortKey === c.key && <span aria-hidden="true">{dir === 1 ? '▲' : '▼'}</span>}
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map(r => {
            const id = rowKey(r)
            const isSel = selected?.includes(id)
            return (
              <tr key={id} onClick={onRow ? () => onRow(r) : undefined} className={`border-b border-line align-top ${onRow ? 'cursor-pointer hover:bg-lightblue' : ''} ${isSel ? 'bg-lightblue' : ''}`}>
                {selectable && (
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="h-5 w-5" aria-label={`Select ${id}`} checked={!!isSel} onChange={e => onSelect?.(e.target.checked ? [...(selected ?? []), id] : (selected ?? []).filter(x => x !== id))} />
                  </td>
                )}
                {cols.map(c => <td key={c.key} className={`px-3 py-2 ${c.className ?? ''}`}>{c.render(r)}</td>)}
              </tr>
            )
          })}
        </tbody>
      </table>
      {pageSize && pages > 1 && <nav aria-label={`${caption} pagination`} className="flex items-center justify-between gap-3 border-t border-line p-3"><span role="status">{currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, rows.length)} of {rows.length}</span><div className="flex gap-2"><Button variant="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button variant="secondary" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button></div></nav>}
    </div>
  )
}

export function Stat({ label, value, tone, to, sub }: { label: string; value: ReactNode; tone?: Tone; to?: string; sub?: string }) {
  const color = tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-navy'
  const inner = (
    <>
      <div className={`text-3xl font-semibold tnum ${color}`}>{value}</div>
      <div className="text-sm font-medium text-ink">{label}</div>
      {sub && <div className="text-sm text-muted">{sub}</div>}
    </>
  )
  return to ? (
    <a href={'#' + to} className="block rounded-md border border-line bg-white p-4 no-underline hover:bg-lightblue">{inner}</a>
  ) : <div className="rounded-md border border-line bg-white p-4">{inner}</div>
}

export function Stepper({ steps, current }: { steps: { label: string; sub?: string; done: boolean }[]; current: number }) {
  return (
    <ol className="flex flex-col gap-3 md:flex-row md:gap-0" aria-label="Review progress">
      {steps.map((s, i) => {
        const state = s.done ? 'done' : i === current ? 'current' : 'todo'
        return (
          <li key={i} className="flex flex-1 items-start gap-2 md:flex-col md:items-center md:text-center" aria-current={state === 'current' ? 'step' : undefined}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${state === 'done' ? 'border-ok bg-ok text-white' : state === 'current' ? 'border-blue bg-lightblue text-blue' : 'border-line bg-white text-muted'}`}>
              {state === 'done' ? <Icon name="check" size={16} /> : i + 1}
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">{s.label}</span>
              <span className="block text-sm text-muted">{s.sub ?? (state === 'done' ? 'Complete' : state === 'current' ? 'In progress' : 'Waiting')}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export const openItem = (id: string, type: WorkItem['type']) => go(type === 'FN' ? `/fiscal/${id}` : type === 'BA' ? `/analyses/${id}` : `/estimates/${id}`)
