import { useState } from 'react'
import { useStore } from '../store'
import { A, Button, Card, DataTable, Field, inputCls } from '../components/ui'
import { download, fmtDateTime } from '../lib'
import dataset from '../fixtures/wa-legislation-sample-250.json'
import { hearingSimulationRecords } from '../hearingSimulation'
const sample = dataset.records[0]

export default function LegislativeImport() {
  const { data, importLegislation, toast } = useStore()
  const [text, setText] = useState('')
  return <div className="space-y-4"><Card title="LSC JSON ingestion — Simulated integration">
    <p className="mb-3">Import the collector endpoint envelopes. Source JSON is retained separately from normalized bills, sponsors, versions and hearings.</p>
    <Field label="Upload collector JSON" htmlFor="lsc-file"><input id="lsc-file" type="file" accept=".json,application/json" onChange={async e => { const f = e.target.files?.[0]; if (f) setText(await f.text()) }} /></Field>
    <Field label="Or paste JSON" htmlFor="lsc-json"><textarea id="lsc-json" className={inputCls} rows={8} value={text} onChange={e => setText(e.target.value)} /></Field>
    <div className="mt-3 flex gap-3"><Button disabled={!text.trim()} onClick={() => { try { importLegislation(JSON.parse(text)) } catch { toast('Invalid JSON. Correct the syntax before importing.', 'error') } }}>Import JSON</Button><Button variant="secondary" onClick={() => importLegislation(sample)}>Import dataset sample</Button><Button variant="secondary" onClick={() => {
      for (const raw of hearingSimulationRecords()) importLegislation(raw)
    }}>Refresh simulated hearings</Button></div>
  </Card><Card title="Import history" pad={false}><DataTable caption="Legislative import runs" pageSize={25} rows={data.importRuns ?? []} rowKey={r => r.id} cols={[
    { key: 'at', header: 'Imported at', render: r => fmtDateTime(r.at) }, { key: 'source', header: 'Source', render: r => r.source }, { key: 'result', header: 'Result', render: r => r.result }, { key: 'errors', header: 'Errors', render: r => r.errors.join('; ') || 'None' }, { key: 'bill', header: 'Bill', render: r => r.billId ? <A to={`/bills/${r.billId}`}>Open bill</A> : '' }, { key: 'raw', header: 'Source payload', render: r => <Button variant="ghost" onClick={() => download(`${r.id}.json`, JSON.stringify(r.raw, null, 2), 'application/json')}>Download raw JSON</Button> }
  ]} /></Card></div>
}
