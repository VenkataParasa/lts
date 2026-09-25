import { useState } from 'react'
import { useStore } from '../store'
import { Button, Card, Chip, EmptyState, Icon, PageHeader, Tabs } from '../components/ui'
import { relTime } from '../lib'
import { go } from '../router'

const CATS = ['Hearings', 'Review', 'Deadlines', 'Assignments', 'Bills', 'Delivery']
const CHANNELS = ['In-app', 'Email', 'Teams'] as const
const prefs: Record<string, boolean> = {}

export default function Notifications() {
  const { data, role, now, markRead, toast } = useStore()
  const [tab, setTab] = useState('All')
  const [, force] = useState(0)
  const list = data.notifications.filter(n => n.toRoles.includes(role) && (tab === 'All' || n.channel === tab))
  const unread = data.notifications.filter(n => n.toRoles.includes(role) && !n.read).length
  const on = (c: string, ch: string) => prefs[`${c}|${ch}`] ?? true
  return (
    <>
      <PageHeader title="Notifications" subtitle={`${unread} unread. Email and Teams messages are simulated and shown here for the demo.`}
        actions={<Button variant="secondary" icon="check" disabled={!unread} onClick={() => markRead('all')}>Mark all read</Button>} />
      <Tabs label="Channel" value={tab} onChange={setTab} tabs={['All', ...CHANNELS].map(t => ({ id: t, label: t }))} />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card pad={false}>
          {list.length === 0 ? <EmptyState title="No notifications" text="Nothing has been sent to your role yet." /> : (
            <ul className="divide-y divide-line">
              {list.map(n => (
                <li key={n.id}>
                  <button type="button" className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-lightblue ${n.read ? '' : 'bg-[#F1F7FC]'}`} onClick={() => { markRead(n.id); if (n.link) go(n.link) }}>
                    <Icon name={n.channel === 'Email' ? 'send' : n.channel === 'Teams' ? 'users' : 'bell'} className="mt-1 text-blue" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2"><span className={n.read ? 'font-medium' : 'font-semibold'}>{n.subject}</span><Chip icon={n.channel === 'Email' ? 'send' : n.channel === 'Teams' ? 'users' : 'bell'}>{n.channel}{n.channel !== 'In-app' ? ' (simulated)' : ''}</Chip>{!n.read && <Chip tone="info" icon="star">New</Chip>}</span>
                      <span className="block text-[15px] text-muted">{n.body}</span>
                      <span className="block text-sm text-muted">{relTime(n.at, now)} | {n.category}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Preferences">
          <table className="w-full text-[15px]">
            <caption className="sr-only">Notification preferences by category and channel</caption>
            <thead><tr><th scope="col" className="pb-2 text-left">Category</th>{CHANNELS.map(c => <th key={c} scope="col" className="pb-2 text-center text-sm">{c}</th>)}</tr></thead>
            <tbody>
              {CATS.map(c => (
                <tr key={c} className="border-t border-line"><th scope="row" className="py-2 text-left font-medium">{c}</th>
                  {CHANNELS.map(ch => <td key={ch} className="text-center"><input type="checkbox" className="h-5 w-5" aria-label={`${c} by ${ch}`} checked={on(c, ch)} onChange={e => { prefs[`${c}|${ch}`] = e.target.checked; force(x => x + 1); toast('Preference saved.', 'info') }} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  )
}
