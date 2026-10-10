import fixture from './fixtures/hearing-alert-simulation.json'

// Preserve historical source dates; move only explicitly simulated meetings.
export function hearingSimulationRecords(now = Date.now()): unknown[] {
  return fixture.records.map(source => {
    const record = structuredClone(source)
    const offset = now - Date.parse(record.simulation.baselineUtc)
    record.retrievedAtUtc = new Date(now).toISOString()
    for (const hearing of record.endpoints.GetHearings.data.Hearing) {
      if ('Simulation' in hearing.CommitteeMeeting && hearing.CommitteeMeeting.Simulation) {
        hearing.CommitteeMeeting.Date = new Date(Date.parse(hearing.CommitteeMeeting.Date) + offset).toISOString()
      }
    }
    return record
  })
}
