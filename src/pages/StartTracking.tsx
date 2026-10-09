import { useState } from 'react'
import { useStore } from '../store'
import { Button, Field, Modal, Select, inputCls } from '../components/ui'
import { computeDue, iso, nextHearing, TYPE_NAME } from '../lib'
import type { Bill, ItemType, WorkItem } from '../types'

export default function StartTracking({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const { data, createItem, patchData, audit, notify } = useStore()
  const [step, setStep] = useState(1)
  const [types, setTypes] = useState<ItemType[]>(['BA'])
  const [description, setDescription] = useState(false)
  const analysts = data.staff.filter(s => s.role === 'Analyst'), reviewers = data.staff.filter(s => s.role === 'Reviewer'), managers = data.staff.filter(s => s.role === 'Manager')
  const hearing = nextHearing(bill, Date.now())
  const localDate = (v: string) => { const d = new Date(v); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
  const suggested = localDate(iso(computeDue('BA', Date.now(), hearing ? new Date(hearing).getTime() : undefined)))
  const [form, setForm] = useState({ preparerId: analysts.find(s => s.division === 'L&P')?.id ?? analysts[0].id, backupId: analysts[1].id, reviewerId: reviewers[0].id, managerId: managers[0].id, priority: 'Normal', confidential: false, hasIssues: false, execReview: false, onHold: false, dueAt: suggested, customerDueAt: suggested, reviewerDueAt: suggested, publicationTarget: suggested })
  const [topics, setTopics] = useState<string[]>(bill.topics)
  const people = (key: 'preparerId' | 'backupId' | 'reviewerId' | 'managerId', label: string, staff: typeof analysts) => <Field label={label} htmlFor={key}><Select id={key} value={form[key]} onChange={v => setForm({ ...form, [key]: v })} options={staff.map(s => ({ value: s.id, label: `${s.name} (${s.division})` }))} /></Field>
  return <Modal title={`Start Tracking ${bill.number} — Step ${step} of 5`} onClose={onClose}>
    <div className="space-y-3">
      {step === 1 && <fieldset><legend>Work needed</legend>{(['BA', 'FN', 'FE', 'DR'] as ItemType[]).map(t => <label key={t} className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={types.includes(t)} onChange={e => setTypes(e.target.checked ? [...types, t] : types.filter(x => x !== t))} />{TYPE_NAME[t]}</label>)}<label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={description} onChange={e => setDescription(e.target.checked)} />Bill Description</label></fieldset>}
      {step === 2 && <>{people('preparerId', 'Primary Analyst', analysts)}{people('backupId', 'Backup Analyst', analysts)}{people('reviewerId', 'Reviewer', reviewers)}{people('managerId', 'Manager', managers)}</>}
      {step === 3 && <><Field label="Priority" htmlFor="priority"><Select id="priority" value={form.priority} onChange={v => setForm({ ...form, priority: v })} options={['Low', 'Normal', 'High', 'Urgent']} /></Field>{(['confidential', 'hasIssues', 'execReview', 'onHold'] as const).map(k => <label key={k} className="flex min-h-10 gap-2 items-center"><input type="checkbox" checked={form[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} />{({ confidential: 'Confidential', hasIssues: 'Issues identified', execReview: 'Executive Review', onHold: 'On Hold' })[k]}</label>)}<fieldset><legend>Topics</legend>{data.picklists.Topics.map(t => <label key={t} className="flex gap-2 min-h-8"><input type="checkbox" checked={topics.includes(t)} onChange={e => setTopics(e.target.checked ? [...topics, t] : topics.filter(x => x !== t))} />{t}</label>)}</fieldset></>}
      {step === 4 && <>{hearing && <p>Recommended publication target: {new Date(new Date(hearing).getTime() - 4 * 3600000).toLocaleString()} (4 hours before hearing).</p>}{(['customerDueAt', 'dueAt', 'reviewerDueAt', 'publicationTarget'] as const).map(k => <Field key={k} label={({ customerDueAt: 'Customer due', dueAt: 'Analyst due', reviewerDueAt: 'Reviewer due', publicationTarget: 'Publication target' })[k]} htmlFor={k}><input id={k} type="datetime-local" className={inputCls} value={form[k].slice(0, 16)} onChange={e => setForm({ ...form, [k]: e.target.value })} /></Field>)}</>}
      {step === 5 && <p>Create {[...types.map(t => TYPE_NAME[t]), ...(description ? ['Bill Description'] : [])].join(', ')} for {bill.number}, assigned to {data.staff.find(s => s.id === form.preparerId)?.name}, with {form.priority} priority. Assignment participants and deadlines will be retained on each work product.</p>}
      <div className="flex gap-2"><Button variant="secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>Back</Button>{step < 5 ? <Button disabled={(!types.length && !description) || step === 4 && [form.dueAt, form.customerDueAt, form.reviewerDueAt, form.publicationTarget].some(v => !v || !Number.isFinite(Date.parse(v)))} onClick={() => setStep(step + 1)}>Next</Button> : <Button onClick={() => {
        const dates = Object.fromEntries(['dueAt', 'customerDueAt', 'reviewerDueAt', 'publicationTarget'].map(k => [k, new Date(form[k as keyof typeof form] as string).toISOString()]))
        const selectedWork = [...types.map(t => ({ type: t, description: false })), ...(description ? [{ type: 'BA' as ItemType, description: true }] : [])]
        selectedWork.forEach(entry => { const t = entry.type; const item = createItem(t, bill.id, { ...(entry.description ? { workKind: 'Bill Description' as const, title: `Bill description: ${bill.number}` } : {}), ...form, ...dates, priority: form.priority as WorkItem['priority'], topics, assigneeIds: [...new Set([form.preparerId, form.backupId])], execChain: form.execReview ? data.staff.filter(s => s.role === 'Executive Reviewer').map(s => s.id) : [] }); notify(`${item.id} assigned`, `New ${TYPE_NAME[t]} for ${bill.number}`, ['Analyst', 'Reviewer'], t === 'BA' ? `/analyses/${item.id}` : t === 'FN' ? `/fiscal/${item.id}` : `/estimates/${item.id}`, 'Assignment', ['In-app']) })
        patchData(d => ({ ...d, bills: d.bills.map(b => b.id === bill.id ? { ...b, tracked: true, topics, hasIssues: form.hasIssues } : b) }))
        audit('Assignment created', bill.id, `Primary ${form.preparerId}; backup ${form.backupId}; reviewer ${form.reviewerId}; manager ${form.managerId}`)
        onClose()
      }}>Create assignments</Button>}</div>
    </div>
  </Modal>
}
