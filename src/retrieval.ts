import type { Bill, BillVersion, Seed, WorkItem } from './types'

// Store updates replace arrays. Cache indexes by array identity so resets and
// imports naturally invalidate them without stale global ID maps.
const bills = new WeakMap<Bill[], Map<string, Bill>>()
const versions = new WeakMap<BillVersion[], Map<string, BillVersion>>()
export function getBill(data: Pick<Seed, 'bills'>, id?: string): Bill | undefined {
  let index = bills.get(data.bills)
  if (!index) { index = new Map(data.bills.map(b => [b.id, b])); bills.set(data.bills, index) }
  return id ? index.get(id) : undefined
}
export function getVersion(bill: Bill, id: string): BillVersion | undefined {
  let index = versions.get(bill.versions)
  if (!index) { index = new Map(bill.versions.map(v => [v.id, v])); versions.set(bill.versions, index) }
  return index.get(id)
}
export function groupWorkByBill(items: WorkItem[]): Map<string, WorkItem[]> {
  const index = new Map<string, WorkItem[]>()
  for (const item of items) {
    const group = index.get(item.billId)
    if (group) group.push(item); else index.set(item.billId, [item])
  }
  return index
}
