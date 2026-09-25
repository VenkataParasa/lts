// Mock adapters for external systems. Nothing here calls a network; each returns after a short delay.
export type AdapterName = 'Legislature feed' | 'OFM Fiscal Note System' | 'OFM BEARS' | 'SharePoint' | 'Email' | 'Microsoft Teams'

export const ADAPTERS: { name: AdapterName; purpose: string; direction: string; lastSync: string }[] = [
  { name: 'Legislature feed', purpose: 'Bill versions, amendments and hearing schedules', direction: 'Inbound', lastSync: '2 minutes ago' },
  { name: 'OFM Fiscal Note System', purpose: 'Transmit fiscal notes as OFM XML', direction: 'Outbound', lastSync: '1 hour ago' },
  { name: 'OFM BEARS', purpose: 'Budget and fiscal estimate transmission', direction: 'Outbound', lastSync: '3 hours ago' },
  { name: 'SharePoint', purpose: 'Session folders, work papers and published analyses', direction: 'Two-way', lastSync: '5 minutes ago' },
  { name: 'Email', purpose: 'Notification and delivery messages', direction: 'Outbound', lastSync: '12 minutes ago' },
  { name: 'Microsoft Teams', purpose: 'Channel and direct message alerts', direction: 'Outbound', lastSync: '12 minutes ago' },
]

export function callAdapter(name: AdapterName): Promise<string> {
  const delay = 300 + Math.floor(Math.random() * 500)
  const prefix = { 'Legislature feed': 'LEG', 'OFM Fiscal Note System': 'FNS', 'OFM BEARS': 'BRS', SharePoint: 'SPO', Email: 'EML', 'Microsoft Teams': 'TMS' }[name]
  return new Promise(res => setTimeout(() => res(`${prefix}-${Math.floor(100000 + Math.random() * 899999)}`), delay))
}
