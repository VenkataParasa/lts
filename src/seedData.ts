// All demo content lives here. Everything is fictional: names, bill numbers, sponsors and dollar figures are invented.
// Bill numbers use ranges that do not exist in any real session. Dates are relative to the moment the seed is built.
import type {
  AuditEntry, Bill, BillStatus, BillVersion, Clause, Comment, Division, ExpSection, FiscalData, ImplTask, ItemType,
  Notification, Pkg, Role, Seed, Session, Staff, Stage, Template, WorkItem,
} from './types'
import { CLOCK_HOURS, D, H, computeDue, iso } from './lib'

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STAFF_SRC: [string, string, Division, string, Role][] = [
  ['Odalys', 'Fenwick', 'RFA', 'Revenue analyst 3', 'Analyst'],
  ['Tavish', 'Norrell', 'RFA', 'Revenue analyst 3', 'Analyst'],
  ['Ilse', 'Brandvold', 'RFA', 'Revenue analyst 2', 'Analyst'],
  ['Corwin', 'Achterberg', 'L&P', 'Tax policy specialist 3', 'Analyst'],
  ['Pilar', 'Yeomans', 'L&P', 'Tax policy specialist 2', 'Analyst'],
  ['Dashiell', 'Varga', 'RFA', 'Revenue analyst 2', 'Analyst'],
  ['Lenora', 'Quist', 'L&P', 'Tax policy specialist 3', 'Analyst'],
  ['Emeric', 'Tolliver', 'Property Tax', 'Property tax analyst', 'Analyst'],
  ['Jocasta', 'Ridley', 'RFA', 'Senior revenue analyst', 'Reviewer'],
  ['Barnaby', 'Lindqvist', 'L&P', 'Senior policy specialist', 'Reviewer'],
  ['Sunniva', 'Marchetti', 'RFA', 'Senior revenue analyst', 'Reviewer'],
  ['Hollis', 'Deverell', 'RFA', 'Legislative coordinator', 'Assigner'],
  ['Petra', 'Anselmo', 'L&P', 'Legislative coordinator', 'Assigner'],
  ['Ambrose', 'Kettleby', 'RFA', 'Research and fiscal analysis manager', 'Manager'],
  ['Yusra', 'Calloway', 'L&P', 'Legislation and policy manager', 'Manager'],
  ['Delphine', 'Ostrander', 'Executive', 'Assistant director', 'Executive Reviewer'],
  ['Rowan', 'Abelard', 'Executive', 'Deputy director', 'Executive Reviewer'],
  ['Thaddeus', 'Prewitt', 'Executive', 'Legislative director', 'Executive Reviewer'],
  ['Marguerite', 'Sallow', 'Executive', 'Director', 'Leadership'],
  ['Ferris', 'Oakhurst', 'Information Services', 'Systems program manager', 'Expenditure Contributor'],
  ['Leocadia', 'Winthrop', 'Taxpayer Services', 'Customer service manager', 'Expenditure Contributor'],
  ['Garrick', 'Malloy', 'Audit', 'Audit program manager', 'Expenditure Contributor'],
  ['Isolde', 'Penhallow', 'Budget Office', 'Budget analyst', 'Budget Office'],
  ['Nestor', 'Bellweather', 'Taxpayer Services', 'Communications assistant', 'Read-only'],
  ['Cassius', 'Hartnell', 'Information Services', 'Application administrator', 'Administrator'],
]

const TAX_TYPES = [
  'B&O tax', 'Retail sales and use tax', 'Property tax', 'Capital gains tax', 'Estate tax',
  'Tax incentives', 'Cigarette and tobacco', 'Working families tax credit',
]
const TITLES: Record<string, string[]> = {
  'B&O tax': [
    'Modifying the business and occupation tax small business credit',
    'Establishing a B&O tax deduction for nonprofit food distributors',
    'Adjusting the B&O tax rate for regional manufacturers',
    'Creating a B&O tax credit for apprenticeship employers',
    'Concerning B&O tax reporting for multi-location retailers',
    'Extending the B&O tax preferential rate for harbor-based fabrication',
  ],
  'Retail sales and use tax': [
    'Exempting sales of adaptive mobility equipment',
    'Concerning sales tax on prepared meals sold by food cooperatives',
    'Clarifying use tax on out-of-state leased vehicles',
    'Modifying the sales tax exemption for agricultural cold storage',
    'Simplifying destination sourcing for digital goods',
  ],
  'Property tax': [
    'Adjusting the senior property tax exemption income thresholds',
    'Limiting annual levy growth for small fire districts',
    'Concerning valuation of conservation easements',
    'Creating a property tax deferral for wildfire-affected homeowners',
    'Modifying the property tax exemption for community land trusts',
  ],
  'Capital gains tax': [
    'Adjusting the capital gains tax deduction for family-owned timberland',
    'Concerning reporting of capital gains on partnership interests',
    'Modifying the capital gains tax standard deduction',
    'Creating a credit for charitable capital gains contributions',
  ],
  'Estate tax': [
    'Modifying the estate tax exclusion amount',
    'Concerning estate tax treatment of family farms',
    'Clarifying the estate tax apportionment of trusts',
    'Simplifying estate tax return filing for small estates',
  ],
  'Tax incentives': [
    'Establishing a tax incentive for clean hydrogen fuelling stations',
    'Extending the high technology research credit',
    'Concerning the tax preference for rural distribution centers',
    'Creating a tax credit for childcare facility construction',
    'Reviewing tax preference performance statements',
  ],
  'Cigarette and tobacco': [
    'Modifying the tax on vapor products',
    'Concerning cigarette tax stamp enforcement',
    'Adjusting the tobacco products tax on cigars',
    'Establishing licensing fees for tobacco distributors',
  ],
  'Working families tax credit': [
    'Increasing the working families tax credit minimum benefit',
    'Simplifying the application for the working families tax credit',
    'Expanding working families tax credit eligibility for part-year residents',
    'Concerning outreach for the working families tax credit',
  ],
}
const TOPICS_FOR: Record<string, string[]> = {
  'B&O tax': ['Small business', 'Manufacturing', 'Tax administration'],
  'Retail sales and use tax': ['Health care', 'Agriculture', 'Tax administration'],
  'Property tax': ['Housing', 'Local government', 'Low-income relief'],
  'Capital gains tax': ['Agriculture', 'Education funding', 'Nonprofits'],
  'Estate tax': ['Agriculture', 'Small business', 'Tax administration'],
  'Tax incentives': ['Clean energy', 'Manufacturing', 'Local government'],
  'Cigarette and tobacco': ['Health care', 'Tax administration', 'Local government'],
  'Working families tax credit': ['Low-income relief', 'Tax administration', 'Education funding'],
}
const PREF: Record<string, string> = {
  'B&O tax': 'credit', 'Retail sales and use tax': 'exemption', 'Property tax': 'exemption', 'Capital gains tax': 'deduction',
  'Estate tax': 'exclusion', 'Tax incentives': 'credit', 'Cigarette and tobacco': 'rate reduction', 'Working families tax credit': 'credit',
}
const MAGNITUDE: Record<string, number> = {
  'B&O tax': 4_800_000, 'Retail sales and use tax': 6_500_000, 'Property tax': 3_200_000, 'Capital gains tax': 9_400_000,
  'Estate tax': 2_700_000, 'Tax incentives': 5_100_000, 'Cigarette and tobacco': 1_900_000, 'Working families tax credit': 7_300_000,
}
const SPONSORS_H = ['Brightwater', 'Thornquist', 'Kellerman-Voss', 'Amberley', 'Castellan', 'Fairbourne', 'Hollowell', 'Merriweather']
const SPONSORS_S = ['Halloran-Pryce', 'Tennyson-Blake', 'Oduya', 'Larkspur', 'Wintergreen', 'Ballantyne', 'Redmond-Shaw', 'Yarrow']
const COMMITTEES_H = ['House Finance', 'House Appropriations', 'House Housing', 'House Local Government', 'House Consumer Protection']
const COMMITTEES_S = ['Senate Ways & Means', 'Senate Labor & Commerce', 'Senate Local Government', 'Senate Agriculture']
const SUFFIXES = [' in rural counties', ' for tribal and rural communities', ' for small municipalities', ' during a transition period']

export function buildSeed(nowInput: number = Date.now()): Seed {
  const now = Math.floor(nowInput / 60000) * 60000
  const R = mulberry32(20270109)
  const pick = <T,>(a: T[]): T => a[Math.floor(R() * a.length)]
  const int = (a: number, b: number) => a + Math.floor(R() * (b - a + 1))
  const chance = (p: number) => R() < p
  const pad = (n: number, w = 3) => String(n).padStart(w, '0')

  // ---- staff ----
  const staff: Staff[] = STAFF_SRC.map(([f, l, division, title, role], i) => ({
    id: `S${pad(i + 1, 2)}`, name: `${f} ${l}`, division, title, role, email: `${f}.${l}@dor-demo.example`.toLowerCase(),
  }))
  const byRole = (r: Role) => staff.filter(s => s.role === r)
  const analysts = byRole('Analyst'), reviewers = byRole('Reviewer'), execs = byRole('Executive Reviewer'), contributors = byRole('Expenditure Contributor')
  const assigners = byRole('Assigner')

  // ---- sessions ----
  const sessions: Session[] = [
    { id: '2027', name: '2027 regular session', current: true, start: iso(now - 12 * D), end: iso(now + 108 * D), provisioned: true },
    { id: '2026', name: '2026 supplemental session', current: false, start: '2026-01-12T08:00:00Z', end: '2026-03-12T08:00:00Z', provisioned: true },
    { id: '2025', name: '2025 regular session', current: false, start: '2025-01-13T08:00:00Z', end: '2025-04-27T08:00:00Z', provisioned: true },
  ]

  // ---- bill text ----
  const sectionsFor = (tax: string, title: string): string => {
    const pref = PREF[tax]
    const pct = int(3, 25), cap = int(20, 400) * 1000, thr = int(50, 900) * 1000
    return [
      `Sec. 1. The legislature finds that ${title.charAt(0).toLowerCase() + title.slice(1)} will support businesses and households across the state. The legislature intends to provide a ${pref} that is simple to claim and simple to administer.`,
      `Sec. 2. (1) A person engaged in business in this state is allowed a ${pref} equal to ${pct} percent of the qualifying amount, not to exceed $${cap.toLocaleString('en-US')} per calendar year. (2) The department must adopt rules to administer this section within ninety days of the effective date of this section.`,
      `Sec. 3. For the purposes of this act, "qualifying person" means a person with taxable income of less than $${thr.toLocaleString('en-US')} in the prior calendar year.`,
      `Sec. 4. The department must report to the fiscal committees of the legislature by December 1, 2028, on the use of the ${pref}.`,
      `Sec. 5. This act takes effect January 1, 2028.`,
    ].join('\n\n')
  }
  const mutate = (text: string): string => {
    const ops: ((t: string) => string)[] = [
      t => t.replace(/(\d+) percent/, (_, n) => `${Math.max(1, +n + pick([-2, -1, 1, 2, 3]))} percent`),
      t => t.replace(/\$([\d,]+)/, (_, n) => '$' + (Math.round((parseInt(n.replace(/,/g, '')) * pick([2, 0.5, 1.5])) / 1000) * 1000).toLocaleString('en-US')),
      t => t.replace('January 1, 2028', 'July 1, 2028'),
      t => t.replace('ninety days', 'one hundred twenty days'),
      t => t.replace('Sec. 5.', 'Sec. 4A. A person claiming the allowance under this act must retain supporting records for five years.\n\nSec. 5.'),
      t => t.replace('must report', 'must annually report'),
      t => t.replace('less than', 'no more than'),
    ]
    let t = text, guard = 0
    while (t === text && guard++ < 20) {
      const n = int(2, 3)
      for (let i = 0; i < n; i++) t = pick(ops)(t)
    }
    return t
  }

  // ---- bills ----
  const titlePool: { tax: string; title: string }[] = []
  for (let round = 0; round < 3; round++) {
    for (const tax of TAX_TYPES) TITLES[tax].forEach(t => titlePool.push({ tax, title: round === 0 ? t : t + SUFFIXES[(round * 3 + titlePool.length) % SUFFIXES.length] }))
  }
  // deterministic shuffle
  for (let i = titlePool.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [titlePool[i], titlePool[j]] = [titlePool[j], titlePool[i]] }
  let poolIx = 0
  const nextTitle = () => titlePool[poolIx++]

  const HOUSE = ['HB', 'SHB', '2SHB', 'ESHB'], SENATE = ['SB', 'SSB', '2SSB', 'ESSB']
  const sponsorsFor = (ch: 'House' | 'Senate') => {
    const src = ch === 'House' ? SPONSORS_H : SPONSORS_S
    const n = int(1, 3), out = new Set<string>()
    while (out.size < n) out.add(`${ch === 'House' ? 'Rep.' : 'Sen.'} ${pick(src)}`)
    return [...out]
  }

  const bills: Bill[] = []
  interface MakeBillOpts {
    session: string; number: string | null; chamber: 'House' | 'Senate'; tax: string; title: string; status: BillStatus
    nv?: number; nAmend?: number; startMs: number; priorBillId?: string; draft?: boolean; hearingMs?: number[]; text?: string
  }
  const makeBill = (o: MakeBillOpts): Bill => {
    const prefixes = o.chamber === 'House' ? HOUSE : SENATE
    const nvDefault: Record<BillStatus, number> = {
      'Introduced': 1, 'In committee': int(1, 2), 'Passed committee': 2, 'Passed first chamber': 3, 'In second chamber': int(3, 4),
      'Passed legislature': 4, 'Signed': 4, 'Died': int(1, 2), 'Draft request': 1,
    }
    const nv = Math.min(4, o.nv ?? nvDefault[o.status])
    const versions: BillVersion[] = []
    let text = o.text ?? sectionsFor(o.tax, o.title)
    for (let k = 0; k < nv; k++) {
      if (k > 0) text = mutate(text)
      versions.push({
        id: `${o.session}-${o.number ?? 'draft'}-V${k + 1}`,
        label: o.number ? `${prefixes[k]} ${o.number.replace(/^[A-Z]+ /, '')}` : 'Agency draft',
        kind: 'version', date: iso(o.startMs + k * 3 * D), text,
      })
    }
    const nAmend = o.nAmend ?? 0
    for (let a = 0; a < nAmend; a++) {
      versions.push({
        id: `${o.session}-${o.number ?? 'draft'}-A${a + 1}`,
        label: `Amendment ${(o.number ?? 'DRAFT').replace(/^[A-Z]+ /, '')}-A${a + 1}`,
        kind: 'amendment', date: iso(now - int(0, 6) * D - int(1, 20) * H), text: mutate(versions[versions.length - 1 - a > 0 ? nv - 1 : 0].text),
        analyzed: chance(0.45), sponsor: `${o.chamber === 'House' ? 'Rep.' : 'Sen.'} ${pick(o.chamber === 'House' ? SPONSORS_H : SPONSORS_S)}`,
      })
    }
    const committees = o.chamber === 'House' ? COMMITTEES_H : COMMITTEES_S
    const enacted = o.status === 'Signed'
    const b: Bill = {
      id: `${o.session}-${o.number ? o.number.replace(' ', '-') : 'DRAFT-' + (bills.length + 1)}`,
      session: o.session, number: o.number, chamber: o.chamber, title: o.title, status: o.status,
      sponsors: o.draft ? ['Agency request'] : sponsorsFor(o.chamber), committee: pick(committees),
      topics: [...new Set([pick(TOPICS_FOR[o.tax]), pick(TOPICS_FOR[o.tax])])], taxType: o.tax,
      hearings: (o.hearingMs ?? []).map(iso), versions, currentVersionId: versions[nv - 1].id, priorBillId: o.priorBillId,
      hasIssues: chance(0.25), inBudget: chance(0.35), enacted, draft: !!o.draft,
    }
    bills.push(b)
    return b
  }

  // prior sessions: 2025 (9 bills), 2026 (9 bills, 5 carried over with the same number)
  const bills25: Bill[] = [], bills26: Bill[] = []
  for (let i = 0; i < 9; i++) {
    const t = nextTitle(), ch = i % 2 === 0 ? 'House' : 'Senate'
    const number = ch === 'House' ? `HB ${6101 + i * 3}` : `SB ${9101 + i * 3}`
    bills25.push(makeBill({ session: '2025', number, chamber: ch, tax: t.tax, title: t.title, status: i < 4 ? 'Signed' : 'Died', nAmend: i % 3 === 0 ? 1 : 0, startMs: now - 620 * D + i * 4 * D }))
  }
  for (let i = 0; i < 9; i++) {
    const carried = i < 5 ? bills25[i + 3] : undefined
    const t = carried ? { tax: carried.taxType, title: carried.title } : nextTitle()
    const ch = carried ? carried.chamber : i % 2 === 0 ? 'House' : 'Senate'
    const number = carried ? carried.number! : ch === 'House' ? `HB ${6301 + i * 3}` : `SB ${9301 + i * 3}`
    bills26.push(makeBill({
      session: '2026', number, chamber: ch, tax: t.tax, title: t.title, status: i % 3 === 0 ? 'Signed' : 'Died',
      nAmend: i % 4 === 0 ? 1 : 0, startMs: now - 300 * D + i * 3 * D, priorBillId: carried?.id, text: carried ? carried.versions[carried.versions.length - 1].text : undefined,
    }))
  }

  // current session: 40 numbered bills + 2 agency drafts
  const statuses: BillStatus[] = ['Introduced', 'In committee', 'In committee', 'Passed committee', 'Passed first chamber', 'In second chamber', 'In second chamber', 'Introduced']
  const hearingSlots: number[] = [6 * H, 13 * H, 22 * H]
  for (let i = 0; i < 26; i++) hearingSlots.push(int(26, 240) * H + (chance(0.5) ? 30 * 60000 : 0))
  const current: Bill[] = []
  for (let i = 0; i < 40; i++) {
    const ch: 'House' | 'Senate' = i % 5 < 3 ? 'House' : 'Senate'
    const carried = i >= 8 && i < 16 ? bills26[i - 8 < bills26.length ? i - 8 : 0] : undefined
    const t = carried ? { tax: carried.taxType, title: carried.title } : nextTitle()
    const status: BillStatus = i < 12 ? pick(['Introduced', 'In committee', 'In second chamber']) : i >= 38 ? 'Signed' : pick(statuses)
    const number = ch === 'House' ? `HB ${7101 + i * 4}` : `SB ${9501 + i * 4}`
    const hasHearing = i < 3 || (i < 32 && ['Introduced', 'In committee', 'In second chamber'].includes(status))
    const h = hasHearing ? hearingSlots[Math.min(current.length, hearingSlots.length - 1)] : undefined
    const forceVersions = i === 3 ? 3 : i < 9 ? Math.max(2, 1) : undefined
    current.push(makeBill({
      session: '2027', number, chamber: ch, tax: t.tax, title: t.title, status: i < 3 ? 'In committee' : status,
      nv: forceVersions, nAmend: i === 3 ? 2 : chance(0.5) ? int(1, 2) : 0, startMs: now - int(4, 11) * D,
      priorBillId: carried?.id, hearingMs: h ? [now + h] : [],
    }))
    // a few bills have a second, later hearing (e.g. second-chamber committee)
    if (i % 9 === 4 && h) current[current.length - 1].hearings.push(iso(now + h + 5 * D))
  }
  // give hero bill 3 (compare scenario) a clean HB -> SHB -> 2SHB chain with a chamber of House
  for (let i = 0; i < 2; i++) {
    const t = nextTitle()
    const ch: 'House' | 'Senate' = i === 0 ? 'House' : 'Senate'
    current.push(makeBill({ session: '2027', number: null, chamber: ch, tax: t.tax, title: `Agency request: ${t.title.charAt(0).toLowerCase() + t.title.slice(1)}`, status: 'Draft request', nv: 1, startMs: now - 2 * D, draft: true }))
  }

  // ---- work items ----
  const items: WorkItem[] = []
  const counters: Record<string, number> = { FN: 0, FE: 0, DR: 0, BA: 0, PK: 0 }
  const YEARS = [2027, 2028, 2029, 2030]
  const FUNDS = ['General Fund-State', 'Workforce Education Investment Account', 'Education Legacy Trust Account', 'Local sales and use tax']
  const SECTION_NAMES = ['Taxpayer account administration', 'Information systems changes', 'Audit and compliance', 'Legal and rulemaking']
  const ACTIVE: Stage[] = ['Assigned', 'In progress', 'In review', 'Rework', 'Executive review']
  const wt = (): Stage => {
    const r = R()
    return r < 0.1 ? 'Assigned' : r < 0.32 ? 'In progress' : r < 0.5 ? 'In review' : r < 0.58 ? 'Rework' : r < 0.7 ? 'Executive review' : r < 0.77 ? 'Approved' : 'Delivered'
  }

  const nextId = (type: ItemType | 'PK') => `${type}-27-${pad(++counters[type])}`
  const priorFor = (b: Bill) => {
    const pool = bills.filter(x => x.session !== '2027' && x.taxType === b.taxType)
    const p = b.priorBillId ? bills.find(x => x.id === b.priorBillId)! : pool.length ? pick(pool) : bills25[0]
    return p
  }

  const makeFiscal = (b: Bill, stage: Stage, opts: { unassigned?: boolean; dueMs: number; preparerId: string }): FiscalData => {
    const mag = MAGNITUDE[b.taxType] * (0.4 + R() * 1.2)
    const sign = b.taxType === 'Cigarette and tobacco' || b.taxType === 'Estate tax' ? (chance(0.5) ? 1 : -1) : -1
    const active = [0, 1, chance(0.6) ? 2 : -1].filter(x => x >= 0)
    const revenue = FUNDS.map((fund, fi) => ({
      fund,
      values: YEARS.map((_, yi) => (active.includes(fi) ? Math.round((sign * mag * (fi === 0 ? 1 : 0.3) * (0.7 + yi * 0.12)) / 1000) * 1000 : 0)),
    }))
    const prior = priorFor(b)
    const expenditure: ExpSection[] = SECTION_NAMES.map((name, i) => ({
      id: `sec-${i + 1}`, name,
      assigneeId: opts.unassigned ? undefined : contributors[i % contributors.length].id,
      dueAt: iso(opts.dueMs - (4 - i) * H), status: opts.unassigned ? 'Not started' : stage === 'Assigned' ? 'Not started' : (i % 3 === 0 ? 'Complete' : 'In progress'),
      hours: YEARS.map((_, yi) => (i === 1 ? [1200, 320, 120, 120][yi] : [900, 600, 520, 520][yi]) + int(0, 4) * 40 * (i + 1)),
      salary: int(58, 96) * 1000, goods: i === 1 ? 24000 : 0, equipment: i === 1 ? 18000 : 0,
    }))
    const label = prior.number ? `${prior.versions[prior.versions.length - 1].label} (${prior.session} session)` : 'Prior request'
    return {
      years: YEARS,
      narrative: {
        summary: `This bill would create a ${PREF[b.taxType]} for qualifying taxpayers. The department estimates a change in state revenue beginning in fiscal year 2028, with administrative costs in the first two years.`,
        assumptions: `Estimates use the most recent economic forecast and department collection data. Take-up of the ${PREF[b.taxType]} is assumed to reach 60 percent of eligible taxpayers by fiscal year 2029. No behavioral response is assumed.`,
        methodology: 'Revenue effects are calculated from filed returns for the last four quarters, grown at the forecast rate. Workload estimates come from comparable past legislation.',
        prior: `See ${label} for a similar prior estimate.`,
      },
      revenue, revenueAssigneeId: opts.unassigned ? undefined : opts.preparerId, revenueDueAt: iso(opts.dueMs - 6 * H),
      expenditure,
      workPapers: stage === 'Assigned' ? [] : [
        { id: 'wp1', name: 'Collections extract FY2026.xlsx', size: '412 KB', by: opts.preparerId },
        { id: 'wp2', name: 'Take-up assumptions.docx', size: '58 KB', by: opts.preparerId },
      ],
      prior: {
        productId: `FN-${prior.session.slice(2)}-${pad(int(2, 88))}`, billLabel: label,
        narrative: `The prior estimate assumed a smaller eligible population and a first effective date one year earlier. Administrative work was estimated at ${(1.2 + R()).toFixed(1)} FTE in the first year.`,
        revenue: revenue.map(r => ({ fund: r.fund, values: r.values.map(v => Math.round((v * (0.75 + R() * 0.4)) / 1000) * 1000) })),
        totalFte: Math.round((1.4 + R() * 2.2) * 10) / 10,
      },
    }
  }

  const bodyFor = (b: Bill) => `<h3>Summary</h3><p>${b.title}. This analysis describes the bill as ${b.number ? b.versions[b.versions.length - 1].label : 'drafted'} and its likely effect on taxpayers and the department.</p><h3>Current law</h3><p>Under current law, qualifying taxpayers pay the full amount due with no ${PREF[b.taxType]}.</p><h3>Effect of the bill</h3><p>The bill allows a ${PREF[b.taxType]} for qualifying persons and requires the department to adopt rules and report on its use.</p><h3>Administrative impact</h3><p>The department would update returns and instructions and answer taxpayer questions.</p>`

  interface ItemOpts {
    stage?: Stage; preparerId?: string; reviewerId?: string; mode?: 'normal' | 'overdue' | 'soon'; onHold?: boolean; confidential?: boolean
    execReview?: boolean; packageId?: string; unassigned?: boolean; startMs?: number; dueMs?: number; execIndex?: number; requester?: string
  }
  const makeItem = (type: ItemType, b: Bill, o: ItemOpts = {}): WorkItem => {
    const stage = o.stage ?? wt()
    const preparerId = o.preparerId ?? pick(analysts).id
    const reviewerId = o.reviewerId ?? pick(reviewers).id
    const nextH = b.hearings.map(h => new Date(h).getTime()).filter(h => h > now).sort()[0]
    let start: number, due: number
    const done = stage === 'Delivered'
    if (o.dueMs !== undefined) { due = o.dueMs; start = o.startMs ?? due - CLOCK_HOURS[type] * H }
    else if (done) { start = now - int(3, 12) * D; due = start + CLOCK_HOURS[type] * H }
    else if (o.mode === 'overdue') { due = now - int(2, 30) * H; start = due - CLOCK_HOURS[type] * H }
    else if (o.mode === 'soon') { due = now + int(60, 220) * 60000; start = due - CLOCK_HOURS[type] * H }
    else { start = o.startMs ?? now - int(2, Math.round(CLOCK_HOURS[type] * 0.9)) * H; due = computeDue(type, start, nextH) }
    const priority = due - now < 24 * H ? 'Urgent' : due - now < 72 * H ? 'High' : chance(0.3) ? 'Low' : 'Normal'
    const execReview = o.execReview ?? (stage === 'Executive review' || (type !== 'BA' && chance(0.22)))
    const chain = execReview ? (chance(0.5) ? execs.map(e => e.id) : execs.slice(0, 2).map(e => e.id)) : []
    const reviewApproved = ['Executive review', 'Approved', 'Delivered'].includes(stage)
    const execIndex = stage === 'Approved' || done ? chain.length : stage === 'Executive review' ? (o.execIndex ?? Math.min(int(0, Math.max(0, chain.length - 1)), chain.length)) : 0
    const contribs = type === 'FN' ? contributors.map(c => c.id) : []
    const id = nextId(type)
    const comments: Comment[] = []
    if (['Rework', 'In review', 'Executive review', 'Approved', 'Delivered'].includes(stage)) {
      comments.push({ id: `${id}-c1`, by: preparerId, at: iso(start + 6 * H), text: 'Ready for review. Assumptions section updated with the latest forecast.', kind: 'system' })
    }
    if (stage === 'Rework') comments.push({ id: `${id}-c2`, by: reviewerId, at: iso(now - 3 * H), text: 'Please clarify the take-up assumption and confirm the effective date matches the current version.', kind: 'return', section: 'Assumptions' })
    const title = { FN: 'Fiscal note', FE: 'Fiscal estimate', DR: 'Data request', BA: 'Bill analysis' }[type]
    const label = b.number ? b.versions[b.versions.findIndex(v => v.id === b.currentVersionId)].label : 'agency request'
    const item: WorkItem = {
      id, type, billId: b.id, title: `${title}: ${label} ${b.title.length > 58 ? b.title.slice(0, 55) + '...' : b.title}`,
      stage, onHold: !!o.onHold, confidential: !!o.confidential, execReview, packageId: o.packageId,
      preparerId, reviewerId, assigneeIds: [preparerId, ...contribs.slice(0, o.unassigned ? 0 : 3)],
      startAt: iso(start), dueAt: iso(due), customerDueAt: iso(nextH ?? due + 6 * H), priority,
      billChanged: false, locked: done, version: done ? 1 : 0, execChain: chain, execIndex, reviewApproved, comments,
      history: done ? [{ id: `${id}-d1`, at: iso(due - 3 * H), by: reviewerId, channel: type === 'FN' ? 'OFM FNS' : type === 'FE' ? 'OFM BEARS' : type === 'BA' ? 'SharePoint' : 'Email', receipt: `RCPT-${int(100000, 999999)}`, version: 1 }] : [],
      savedAt: iso(now - int(2, 300) * 60000),
    }
    if (type === 'BA') {
      item.body = bodyFor(b); item.topics = [...b.topics]; item.hasIssues = b.hasIssues
      item.issueNotes = b.hasIssues ? 'Definition of "qualifying person" may conflict with the small business credit threshold. Confirm with policy staff.' : ''
      item.correspondence = chance(0.4) ? [{ id: `${id}-m1`, to: 'Legislative staff, fiscal committee', sent: iso(now - 2 * D), responseReceived: chance(0.5), note: 'Sent draft description for review.' }] : []
      if (done) item.publishedVersion = 1
    }
    if (type === 'FN') item.fiscal = makeFiscal(b, stage, { unassigned: o.unassigned, dueMs: due, preparerId })
    if (type === 'FE') { item.fiscal = makeFiscal(b, stage, { dueMs: due, preparerId }); item.fiscal.expenditure = item.fiscal.expenditure.slice(0, 2) }
    if (type === 'DR') { item.requester = o.requester ?? pick(['Senate committee staff', 'House fiscal staff', 'Governor policy office', 'Office of Financial Management']); item.question = `How many taxpayers claimed the ${PREF[b.taxType]} in calendar year 2026, and what was the total amount claimed?` }
    items.push(item)
    return item
  }

  const P = (role: Role) => byRole(role)[0].id
  const [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10] = current
  // scenario heroes
  makeItem('BA', b0, { stage: 'In progress', preparerId: P('Analyst'), mode: 'soon', dueMs: now + 2 * H }) // due inside 4 hours
  makeItem('FN', b2, { stage: 'Assigned', unassigned: true, startMs: now - 6 * H, preparerId: analysts[1].id, reviewerId: P('Reviewer'), execReview: true }) // scenario: assigner routes
  makeItem('FN', b4, { stage: 'In progress', preparerId: P('Analyst'), reviewerId: P('Reviewer'), execReview: true, startMs: now - 20 * H }) // scenario: FTE calc
  makeItem('BA', b3, { stage: 'In progress', preparerId: P('Analyst'), reviewerId: P('Reviewer'), startMs: now - 10 * H }) // scenario: compare and draft
  makeItem('FN', b5, { stage: 'In review', preparerId: P('Analyst'), reviewerId: P('Reviewer'), execReview: true, startMs: now - 30 * H }) // scenario: review, return, exec
  makeItem('FN', b6, { stage: 'Approved', preparerId: analysts[2].id, reviewerId: P('Reviewer'), execReview: true, startMs: now - 40 * H }) // scenario: transmit
  makeItem('FN', b7, { stage: 'In review', preparerId: P('Reviewer'), reviewerId: P('Reviewer'), startMs: now - 12 * H }) // preparer cannot approve own work
  makeItem('FN', b1, { stage: 'Executive review', preparerId: analysts[3].id, reviewerId: reviewers[1].id, execReview: true, execIndex: 0, startMs: now - 24 * H }) // phone exec review

  // packages: three bills each with several products
  const pkgs: Pkg[] = []
  const pkgDefs: [Bill, ItemType[]][] = [[b8, ['FN', 'FE', 'DR']], [b9, ['FN', 'FE']], [b10, ['FN', 'DR', 'FE']]]
  pkgDefs.forEach(([b, types], pi) => {
    const pid = nextId('PK')
    const ids = types.map((t, ti) => makeItem(t, b, { packageId: pid, stage: pi === 1 ? (ti === 0 ? 'Approved' : 'In review') : (['In progress', 'In review', 'Rework'] as Stage[])[ti % 3], execReview: false }).id)
    pkgs.push({ id: pid, name: `${b.number ?? 'Draft'} response package`, billId: b.id, itemIds: ids, dueAt: iso(now + (18 + pi * 20) * H), delivered: false })
  })

  // random fill to reach counts
  const targets: Record<ItemType, number> = { FN: 30, FE: 15, DR: 8, BA: 60 }
  const numbered = current.filter(b => !b.draft)
  const draftBills = current.filter(b => b.draft)
  let idx = 0
  const fillOrder: ItemType[] = []
  ;(['FN', 'FE', 'DR', 'BA'] as ItemType[]).forEach(t => { const have = items.filter(i => i.type === t).length; for (let k = have; k < targets[t]; k++) fillOrder.push(t) })
  for (let i = fillOrder.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [fillOrder[i], fillOrder[j]] = [fillOrder[j], fillOrder[i]] }
  const usedFn = new Set(items.filter(i => i.type === 'FN').map(i => i.billId))
  fillOrder.forEach(type => {
    idx++
    let b: Bill
    if (type === 'FN') b = numbered.find(x => !usedFn.has(x.id) && x.status !== 'Signed') ?? pick(numbered)
    else if (type === 'BA' && idx % 25 === 0) b = pick(draftBills)
    else b = pick(numbered)
    if (type === 'FN') usedFn.add(b.id)
    const stage = wt()
    const active = ACTIVE.includes(stage)
    makeItem(type, b, {
      stage, mode: active && idx % 11 === 0 ? 'overdue' : active && idx % 19 === 4 ? 'soon' : 'normal',
      onHold: active && idx % 16 === 7, confidential: (type === 'FN' || type === 'DR') && idx % 8 === 5 || (type === 'BA' && idx % 27 === 5),
    })
  })
  items.forEach(i => { if (i.stage === 'Executive review' && !i.execChain.length) { i.execChain = [execs[0].id, execs[1].id]; i.execReview = true; i.execIndex = 0 } })
  bills.forEach(b => { if (b.session === '2027' && items.some(i => i.billId === b.id && i.type === 'FN')) b.inBudget = b.inBudget || chance(0.5) })
  // ---- other seed collections ----
  const notifications: Notification[] = [
    { id: 'N01', at: iso(now - 25 * 60000), channel: 'In-app', toRoles: ['Analyst', 'Assigner', 'Manager'], subject: 'Hearing scheduled within 24 hours', body: `${b0.number ?? 'A bill'} has a public hearing in about 6 hours.`, link: `/bills/${b0.id}`, read: false, category: 'Hearings' },
    { id: 'N02', at: iso(now - 70 * 60000), channel: 'Email', toRoles: ['Reviewer'], subject: 'Fiscal note ready for your review', body: 'FN-27-005 was submitted for review.', link: '/fiscal/FN-27-005', read: false, category: 'Review' },
    { id: 'N03', at: iso(now - 2 * H), channel: 'Teams', toRoles: ['Executive Reviewer', 'Leadership'], subject: 'Executive review requested', body: 'FN-27-008 is waiting for the first executive reviewer.', link: '/review/FN-27-006', read: false, category: 'Review' },
    { id: 'N04', at: iso(now - 3 * H), channel: 'In-app', toRoles: ['Analyst'], subject: 'Rework requested on a fiscal note', body: 'A reviewer returned a work product with comments.', link: '/queue', read: false, category: 'Review' },
    { id: 'N05', at: iso(now - 5 * H), channel: 'Email', toRoles: ['Manager', 'Assigner'], subject: 'Work product overdue', body: 'Three work products are past their internal due date.', link: '/queue', read: true, category: 'Deadlines' },
    { id: 'N06', at: iso(now - 9 * H), channel: 'Teams', toRoles: ['Analyst', 'Reviewer', 'Assigner', 'Manager'], subject: 'New amendment filed', body: 'An amendment was filed on a bill you follow.', link: '/bills', read: true, category: 'Bills' },
    { id: 'N07', at: iso(now - 1 * D), channel: 'In-app', toRoles: ['Budget Office'], subject: 'Fiscal note delivered to OFM', body: 'A fiscal note was transmitted and locked.', read: true, category: 'Delivery' },
    { id: 'N08', at: iso(now - 1 * D - 3 * H), channel: 'In-app', toRoles: ['Expenditure Contributor'], subject: 'You were assigned an expenditure section', body: 'Please complete your section before the due date.', link: '/queue', read: false, category: 'Assignments' },
    { id: 'N09', at: iso(now - 2 * D), channel: 'Email', toRoles: ['Administrator'], subject: 'Integration health check passed', body: 'All simulated integrations responded normally.', link: '/admin/integrations', read: true, category: 'System' },
  ]
  const audit: AuditEntry[] = [
    ['S14', 'Manager', 'Reassigned', 'FN-27-012', 'Moved from one analyst to another'],
    ['S09', 'Reviewer', 'Returned for rework', 'FN-27-009', 'Comment added on Assumptions'],
    ['S01', 'Analyst', 'Edited', 'BA-27-004', 'Narrative updated'],
    ['S12', 'Assigner', 'Created', 'DR-27-006', 'Data request created from committee request'],
    ['S16', 'Executive Reviewer', 'Approved', 'FN-27-010', 'Executive review approved'],
    ['S23', 'Budget Office', 'Transmitted', 'FE-27-003', 'Transmitted to OFM BEARS'],
    ['S02', 'Analyst', 'Viewed confidential item', 'FN-27-013', 'Opened confidential fiscal note'],
    ['S25', 'Administrator', 'Edited', 'Admin', 'Updated pick-list: Topics'],
  ].map((r, i) => ({ id: `A${pad(i + 1)}`, at: iso(now - (i + 1) * 3 * H), userId: r[0], role: r[1] as Role, action: r[2], target: r[3], detail: r[4], confidential: r[2].includes('confidential') }))

  const enacted = bills.filter(b => b.enacted)
  const implTasks: ImplTask[] = enacted.slice(0, 5).flatMap((b, i) => [
    { id: `IT-${i}a`, billId: b.id, title: 'Update returns and instructions', owner: 'Leocadia Winthrop', division: 'Taxpayer Services' as Division, dueAt: iso(now + (10 + i * 6) * D), done: i % 2 === 0 },
    { id: `IT-${i}b`, billId: b.id, title: 'Configure system for new rate or credit', owner: 'Ferris Oakhurst', division: 'Information Services' as Division, dueAt: iso(now + (20 + i * 5) * D), done: false },
  ])
  const savedQueries = [
    { id: 'Q1', name: 'Capital gains notes over $5 million', taxType: 'Capital gains tax', minAmount: 5_000_000, sessions: ['2027', '2026', '2025'], by: 'S14' },
    { id: 'Q2', name: 'Property tax revenue losses', taxType: 'Property tax', minAmount: 1_000_000, sessions: ['2027'], by: 'S14' },
  ]
  const templates: Template[] = [
    { id: 'T1', name: 'Fiscal note (Word)', format: 'Word', body: 'FISCAL NOTE {{item.id}}\nBill: {{bill.label}} - {{bill.title}}\nSession: {{bill.session}}\nPrepared by: {{item.preparer}}\n\nSUMMARY\n{{fiscal.summary}}\n\nASSUMPTIONS\n{{fiscal.assumptions}}\n\nTOTAL REVENUE IMPACT (FY2027-FY2030): {{fiscal.total}}\nTOTAL EXPENDITURE (FY2027-FY2030): {{fiscal.expenditure}}\n\nDelivered {{delivery.date}}' },
    { id: 'T2', name: 'Fiscal note (PDF)', format: 'PDF', body: 'Washington State Department of Revenue\nFiscal Note {{item.id}}  |  {{bill.label}}\n{{bill.title}}\n\n{{fiscal.summary}}\n\nRevenue impact: {{fiscal.total}}\nDelivered {{delivery.date}}' },
    { id: 'T3', name: 'OFM XML export', format: 'OFM XML', body: '<FiscalNote id="{{item.id}}" session="{{bill.session}}">\n  <Bill number="{{bill.number}}" version="{{bill.label}}"/>\n  <Summary>{{fiscal.summary}}</Summary>\n  <RevenueTotal>{{fiscal.total}}</RevenueTotal>\n  <ExpenditureTotal>{{fiscal.expenditure}}</ExpenditureTotal>\n  <TransmittedOn>{{delivery.date}}</TransmittedOn>\n</FiscalNote>' },
    { id: 'T4', name: 'Bill analysis (Word)', format: 'Word', body: 'BILL ANALYSIS {{item.id}}\n{{bill.label}} - {{bill.title}}\nTopics: {{item.topics}}\n\n{{analysis.body}}' },
  ]
  const clauses: Clause[] = [
    { id: 'CL1', title: 'Effective date statement', text: 'This act takes effect on the date shown in the bill. Section-level effective dates are noted where they differ.' },
    { id: 'CL2', title: 'Department rulemaking authority', text: 'The bill requires the department to adopt rules to administer the new provisions.' },
    { id: 'CL3', title: 'Reporting requirement', text: 'The department must report to the fiscal committees of the legislature on the use of the preference.' },
    { id: 'CL4', title: 'Tax preference expiration', text: 'The tax preference expires on the date stated in the bill, and taxpayers may not claim it after that date.' },
    { id: 'CL5', title: 'Administrative impact statement', text: 'The department would update returns, instructions and systems, and answer taxpayer questions.' },
    { id: 'CL6', title: 'Current law summary', text: 'Under current law, taxpayers pay the full amount due with no adjustment for the activity described in the bill.' },
    { id: 'CL7', title: 'Retroactive application', text: 'The bill applies to periods beginning on or after its effective date. It does not apply retroactively.' },
    { id: 'CL8', title: 'Severability', text: 'If any provision is held invalid, the remainder of the act is not affected.' },
  ]
  const picklists: Record<string, string[]> = {
    Topics: ['Small business', 'Manufacturing', 'Housing', 'Agriculture', 'Health care', 'Education funding', 'Clean energy', 'Low-income relief', 'Local government', 'Nonprofits', 'Tax administration'],
    'Tax types': TAX_TYPES,
    Committees: [...COMMITTEES_H, ...COMMITTEES_S],
    Priorities: ['Low', 'Normal', 'High', 'Urgent'],
    Divisions: ['RFA', 'L&P', 'Executive', 'Budget Office', 'Audit', 'Taxpayer Services', 'Information Services', 'Property Tax'],
  }
  const workflow = [
    { id: 'W1', name: 'Assigned', slaHours: 4, who: 'Assigner' },
    { id: 'W2', name: 'In progress', slaHours: 48, who: 'Analyst / Expenditure Contributor' },
    { id: 'W3', name: 'In review', slaHours: 8, who: 'Reviewer' },
    { id: 'W4', name: 'Rework', slaHours: 8, who: 'Analyst' },
    { id: 'W5', name: 'Executive review', slaHours: 12, who: 'Executive Reviewers (in sequence)' },
    { id: 'W6', name: 'Approved', slaHours: 2, who: 'Final gate' },
    { id: 'W7', name: 'Delivered', slaHours: 0, who: 'System' },
  ]
  const presence: Record<string, string> = {
    'FN-27-003': analysts[1].id, 'FN-27-005': reviewers[2].id, 'BA-27-002': analysts[4].id, 'FN-27-001': assigners[0].id,
  }
  const counts = { ...counters }
  Object.keys(counts).forEach(k => (counts[k] += 1))

  return {
    now: iso(now), staff, sessions, bills, items, packages: pkgs, notifications, audit, implTasks, savedQueries, templates, clauses, picklists,
    costRules: { hoursPerFte: 2088, benefitsRate: 0.32, goodsPerFte: 9200, equipmentPerFte: 4300 }, workflow, presence, idCounters: counts,
    savedViews: [
      { id: 'V1', name: 'Urgent fiscal notes', filter: { type: 'FN', priority: 'Urgent' } },
      { id: 'V2', name: 'Executive review items', filter: { exec: '1' } },
      { id: 'V3', name: 'Confidential work', filter: { confidential: '1' } },
    ],
  }
}
