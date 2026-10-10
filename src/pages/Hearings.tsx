import { useState } from 'react'
import { useStore } from '../store'
import { A, Card, DataTable, PageHeader, Select } from '../components/ui'
import { billLabel, countdown, fmtDateTime, visibleBills } from '../lib'

export default function Hearings() {
  const { data, role, now } = useStore()
  const [period, setPeriod] = useState('Upcoming')
  const rows = visibleBills(data, role).flatMap(b => (b.hearingRecords ?? b.hearings.map((h, n) => ({ id: `${b.id}-${n}`, date: h, committee: b.committee, chamber: b.chamber, metadata: {}, type: 'Hearing', cancelled: false, location: 'Location not supplied' }))).map(h => ({ ...h, bill: b }))).filter(h => period === 'All' || period === 'Canceled' ? period !== 'Canceled' || h.cancelled : !h.cancelled && new Date(h.date).getTime() >= now).sort((a, b) => a.date.localeCompare(b.date))
  return <><PageHeader title="Hearings" subtitle="Official legislative history plus simulated upcoming meetings for 72-hour alerts." /><Card className="mb-4"><Select label="Hearing period" value={period} onChange={setPeriod} options={['Upcoming', 'All', 'Canceled']} /></Card><Card pad={false}><DataTable caption="Hearings" pageSize={25} rows={rows} rowKey={h => h.id} cols={[
    { key: 'bill', header: 'Bill', render: h => <A to={`/bills/${h.bill.id}?tab=Hearings`}>{billLabel(h.bill)}</A> }, { key: 'committee', header: 'Committee', render: h => h.committee }, { key: 'date', header: 'Date', render: h => fmtDateTime(h.date) }, { key: 'type', header: 'Type', render: h => <>{h.type}{'Simulation' in h.metadata && h.metadata.Simulation ? ' (simulated)' : ''}</> }, { key: 'location', header: 'Location', render: h => h.location }, { key: 'cancelled', header: 'Canceled', render: h => h.cancelled ? 'Yes' : 'No' }, { key: 'deadline', header: 'Publication target', render: h => h.cancelled ? 'Canceled' : countdown(new Date(new Date(h.date).getTime() - 4 * 3600000).toISOString(), now) }
  ]} /></Card></>
}
