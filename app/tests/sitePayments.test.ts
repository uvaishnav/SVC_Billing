import assert from 'node:assert/strict'
import { calculateFifoAllocation, getClientOutstandingBills, recordLumpSumPayment } from '../src/db/paymentsDb'

const inserts: { table: string; value: any }[] = []
let failAllocations = false
const invoices = [
  { id: 1, project_id: 10, projects: { site_location: 'North' }, invoice_number: '001', invoice_date: '2026-01-01', net_receivable: 100 },
  { id: 2, project_id: 20, projects: { site_location: 'South' }, invoice_number: '002', invoice_date: '2026-02-01', net_receivable: 200 },
  { id: 3, project_id: 10, projects: { site_location: 'North' }, invoice_number: '003', invoice_date: '2026-03-01', net_receivable: 100 },
]
;(globalThis as any).paymentTestDb = {
  from(table: string) {
    let inserted = false
    const query: any = {
      select: () => query, eq: () => query, order: () => query, in: () => query,
      insert(value: any) { inserted = true; inserts.push({ table, value }); return query },
      single: () => Promise.resolve({ data: { id: 99 }, error: null }),
      then(resolve: any, reject: any) {
        const result = table === 'invoices' ? { data: invoices } :
          table === 'payment_allocations' && !inserted ?
            { data: [], error: failAllocations ? new Error('Allocation lookup failed') : null } : { error: null }
        return Promise.resolve(result).then(resolve, reject)
      },
    }
    return query
  },
}
const bills = await getClientOutstandingBills(1)
assert.deepEqual(bills.map(b => b.projectId), [10, 20, 10])
const preview = calculateFifoAllocation(bills, 150, [1, 3])
assert.deepEqual(preview.items.map(i => i.allocatedNow), [100, 0, 50])
const base = { clientId: 1, siteProjectId: 10, amount: 150, paymentDate: '2026-11-01' }
for (const selectedInvoiceIds of [[], [2], [1, 2], [999]]) {
  assert.equal((await recordLumpSumPayment({ ...base, selectedInvoiceIds })).ok, false)
}
assert.equal((await recordLumpSumPayment({ ...base, selectedInvoiceIds: [1] })).ok, false)
assert.equal(inserts.length, 0, 'Invalid selection must not create payment records')
assert.equal((await recordLumpSumPayment({ ...base, selectedInvoiceIds: [1, 3] })).ok, true)
assert.deepEqual(inserts.find(i => i.table === 'payment_allocations')?.value, [
  { payment_id: 99, invoice_id: 1, allocated_amount: 100 },
  { payment_id: 99, invoice_id: 3, allocated_amount: 50 },
])
failAllocations = true
await assert.rejects(() => getClientOutstandingBills(1), /Allocation lookup failed/)
console.log('Site payment checks passed: site isolation, explicit selection, balances, allocation order, and lookup errors.')
