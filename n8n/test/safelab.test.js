'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../lib/safelab.js');

const TODAY = '2026-10-11';

// ---------- fixtures (headers per SAFELAB_SPEC §3) ----------
const RISK_RULES = [
  { rule_id: 'RR-01', hazard: 'Li-ion', condition: 'deliberate thermal runaway', min_level: 'HIGH' },
  { rule_id: 'RR-06', hazard: 'High voltage', condition: 'exposed conductors', min_level: 'MEDIUM' },
  { rule_id: 'RR-03', hazard: 'Hydrogen', condition: 'intentional generation', min_level: 'HIGH' },
  { rule_id: 'RR-11', hazard: 'Routine FDM printing', condition: 'enclosed standard operation', min_level: 'LOW' },
];
const CHEM_REGISTER = [
  { cas: '67-56-1', name_en: 'Methanol', vn_listed: 'YES', hazardous: 'YES', special_control: 'NO', threshold_kg: '100' },
  { cas: '64-17-5', name_en: 'Ethanol', vn_listed: 'YES', hazardous: 'YES', special_control: 'NO', threshold_kg: '' },
  { cas: '7664-93-9', name_en: 'Sulfuric acid', vn_listed: 'YES', hazardous: 'YES', special_control: 'YES', threshold_kg: 50 },
  { cas: '1333-74-0', name_en: 'Hydrogen', vn_listed: 'YES', hazardous: 'YES', special_control: 'YES', threshold_kg: '1' },
  { cas: '50-00-0', name_en: 'Test chem', vn_listed: 'NO', hazardous: 'NO', special_control: 'NO', threshold_kg: '2' },
];

const ALICE = 'alice@uni.edu';
const BOB = 'bob@uni.edu';

function f04Row(over) {
  return Object.assign({
    'Timestamp': '10/11/2026 9:05:03',
    'Email Address': ' Alice@Uni.edu ',
    'Experiment title': 'Bench PSU characterisation',
    'Project': 'BESS',
    'Principal Investigator': 'Dr. Simon Park',
    'Experiment leader email': 'Alice@uni.edu',
    'Researcher emails (comma-separated)': 'bob@uni.edu; alice@uni.edu',
    'Lab / room': 'LAB-A',
    'Start date': '10/20/2026',
    'Expected completion': '2026-12-31',
    'Related SOP IDs (comma-separated)': 'sop-gen-01',
    'Equipment IDs (comma-separated)': 'EQ-PSU-01',
    'Hazards': 'High voltage',
    'Escalation conditions': 'None of these',
    'Hazard details': '30 V bench supply',
    'Chemicals (one per line: CAS, name, quantity, unit)': '',
    'SDS uploaded for all chemicals?': 'Not applicable',
    'Severity (1-5)': '2',
    'Likelihood (1-5)': '2',
    'Controls': 'Current limit, insulated probes',
    'Residual severity (1-5)': '1',
    'Residual likelihood (1-5)': '1',
    'Emergency procedure': 'Hit the E-stop, call 115',
    'Legal acknowledgement': 'I understand that PI approval does not replace external permits or institutional EHS approvals required by law',
  }, over || {});
}

function baseData() {
  const codes = ['CORE', 'VN-OSH', 'FIRE', 'E1'];
  const trainingRecords = [];
  [ALICE, BOB].forEach((email) => codes.forEach((code) => trainingRecords.push({
    record_id: 'TR', email, training_code: code, completed_on: '2026-06-01', expires_on: '2027-06-01',
  })));
  return {
    people: [
      { email: ALICE, full_name: 'Alice', status: 'ACTIVE', vn_osh_group: 'Group 4' },
      { email: 'BOB@uni.edu', full_name: 'Bob', status: 'ACTIVE', vn_osh_group: 'Group 3' },
    ],
    trainingTypes: [
      { training_code: 'CORE', name: 'Core lab safety', validity_months: '12', required_for: 'ALL' },
      { training_code: 'VN-OSH', name: 'Vietnam OSH', validity_months: 24, required_for: 'ALL' },
      { training_code: 'FIRE', name: 'Fire safety', validity_months: '12', required_for: 'ALL' },
      { training_code: 'E1', name: 'Electrical E1', validity_months: '24', required_for: 'High voltage, High current, Stored energy' },
      { training_code: 'C1', name: 'Chemical C1', validity_months: '12', required_for: 'Chemical, Flammable material, Toxic material' },
      { training_code: 'N1', name: 'Nanomaterials', validity_months: '24', required_for: '' },
    ],
    trainingRecords,
    sops: [
      { sop_id: 'SOP-GEN-01', title: 'General', version: '1.0', status: 'ACTIVE' },
      { sop_id: 'SOP-ESP-01', title: 'Electrical', version: '1.0', status: 'ACTIVE' },
      { sop_id: 'SOP-OLD-01', title: 'Old', version: '2.0', status: 'RETIRED' },
    ],
    sopAcks: [
      { email: ALICE, sop_id: 'SOP-GEN-01', version: '1.0' },
      { email: ALICE, sop_id: 'SOP-ESP-01', version: 1 }, // Sheets turned "1.0" into a number
      { email: BOB, sop_id: 'SOP-GEN-01', version: '1.0' },
      { email: BOB, sop_id: 'SOP-ESP-01', version: '1.0' },
    ],
    equipment: [
      { equipment_id: 'EQ-PSU-01', sop_id: 'SOP-ESP-01', status: 'GREEN', authorized_users: `${ALICE}, ${BOB}`, required_training: 'E1' },
      { equipment_id: 'EQ-FURN-01', sop_id: 'SOP-GEN-01', status: 'YELLOW', authorized_users: `${ALICE}\n${BOB}`, required_training: '' },
      { equipment_id: 'EQ-NANO-01', sop_id: '', status: 'GREEN', authorized_users: `${ALICE}, ${BOB}`, required_training: 'N1' },
      { equipment_id: 'EQ-BROKEN', sop_id: '', status: 'RED', authorized_users: `${ALICE}, ${BOB}`, required_training: '' },
    ],
  };
}

function run(rowOver, mutate) {
  const exp = S.normalizeExperiment(f04Row(rowOver));
  const data = baseData();
  if (mutate) mutate(data, exp);
  const risk = S.assessRisk(exp, RISK_RULES, CHEM_REGISTER);
  return { exp, risk, data, compliance: S.checkCompliance(exp, risk, data, TODAY) };
}
const check = (c, id) => c.checks.find((x) => x.id === id);

// ---------- levels ----------
test('scoreToLevel boundaries', () => {
  assert.equal(S.scoreToLevel(1), 'LOW');
  assert.equal(S.scoreToLevel(4), 'LOW');
  assert.equal(S.scoreToLevel(5), 'MEDIUM');
  assert.equal(S.scoreToLevel('12'), 'MEDIUM');
  assert.equal(S.scoreToLevel(13), 'HIGH');
  assert.equal(S.scoreToLevel(25), 'HIGH');
  for (const bad of [0, 26, -1, '', null, undefined, 'abc']) assert.equal(S.scoreToLevel(bad), null);
});

test('maxLevel picks highest and ignores falsy', () => {
  assert.equal(S.maxLevel('LOW', 'HIGH', 'MEDIUM'), 'HIGH');
  assert.equal(S.maxLevel(null, 'low', '', undefined), 'LOW');
  assert.equal(S.maxLevel(['MEDIUM', 'LOW']), 'MEDIUM');
  assert.equal(S.maxLevel(), null);
  assert.equal(S.maxLevel(null, ''), null);
  assert.deepEqual(S.LEVELS, ['LOW', 'MEDIUM', 'HIGH']);
});

test('parseList / parseEmails', () => {
  assert.deepEqual(S.parseList(' a, b;c\nd ,a,, '), ['a', 'b', 'c', 'd']);
  assert.deepEqual(S.parseList(''), []);
  assert.deepEqual(S.parseList(null), []);
  assert.deepEqual(S.parseEmails('A@x.com, a@x.com ;B@X.com'), ['a@x.com', 'b@x.com']);
});

// ---------- dates ----------
test('parseDate formats', () => {
  assert.equal(S.parseDate('2026-10-11'), '2026-10-11');
  assert.equal(S.parseDate('2026-10-11T08:30:00.000Z'), '2026-10-11');
  assert.equal(S.parseDate('10/11/2026'), '2026-10-11');
  assert.equal(S.parseDate('1/5/2026'), '2026-01-05');
  assert.equal(S.parseDate('1/5/2026 9:07:03'), '2026-01-05');
  assert.equal(S.parseDate('12/31/2026 23:59:59'), '2026-12-31');
  assert.equal(S.parseDate(new Date(2026, 1, 3, 12, 0, 0)), '2026-02-03');
  for (const bad of ['garbage', '', null, undefined, '13/40/2026', '2026-02-30', new Date('x')]) {
    assert.equal(S.parseDate(bad), '');
  }
});

test('addMonths and daysBetween', () => {
  assert.equal(S.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(S.addMonths('2026-10-11', 12), '2027-10-11');
  assert.equal(S.addMonths('10/11/2026', '24'), '2028-10-11');
  assert.equal(S.addMonths('', 1), '');
  assert.equal(S.daysBetween('2026-10-11', '2026-10-21'), 10);
  assert.equal(S.daysBetween('2026-10-21', '2026-10-11'), -10);
  assert.equal(S.daysBetween('2026-03-01', '2026-03-31'), 30);
  assert.equal(S.daysBetween('bad', '2026-03-31'), null);
});

// ---------- ids ----------
test('nextId', () => {
  assert.equal(S.nextId('EXP', 2026, []), 'EXP-2026-0001');
  assert.equal(S.nextId('EXP', 2026, undefined), 'EXP-2026-0001');
  assert.equal(S.nextId('EXP', 2026, ['EXP-2026-0007']), 'EXP-2026-0008');
  assert.equal(S.nextId('EXP', 2026, ['EXP-2026-0003', 'EXP-2025-0099', 'INC-2026-0050', '', 'EXP-2026-0010']), 'EXP-2026-0011');
  assert.equal(S.nextId('INC', '2027', ['INC-2026-0005']), 'INC-2027-0001');
});

// ---------- normalizeExperiment ----------
test('normalizeExperiment maps F04 row', () => {
  const e = S.normalizeExperiment(f04Row({ 'Escalation conditions': 'High voltage: exposed conductors, None of these' }));
  assert.equal(e.submitted_by, ALICE);
  assert.equal(e.submitted_at, '2026-10-11T09:05:03');
  assert.equal(e.leader_email, ALICE);
  assert.deepEqual(e.researcher_emails, [ALICE, BOB]);
  assert.equal(e.start_date, '2026-10-20');
  assert.equal(e.end_date, '2026-12-31');
  assert.deepEqual(e.sop_ids, ['SOP-GEN-01']);
  assert.deepEqual(e.equipment_ids, ['EQ-PSU-01']);
  assert.deepEqual(e.hazards, ['High voltage']);
  assert.deepEqual(e.escalation_conditions, ['High voltage: exposed conductors']);
  assert.equal(e.severity, 2);
  assert.equal(e.residual_likelihood, 1);
  assert.equal(e.legal_ack, true);
  assert.equal(e.sds_uploaded, 'Not applicable');
  const blank = S.normalizeExperiment(f04Row({ 'Severity (1-5)': '', 'Legal acknowledgement': '' }));
  assert.equal(blank.severity, null);
  assert.equal(blank.legal_ack, false);
});

// ---------- parseChemicals ----------
test('parseChemicals', () => {
  const out = S.parseChemicals('67-56-1, Methanol, 2, kg\n\n64-17-5, Ethanol\nnot a chemical line\n7664-93-9, Sulfuric acid, lots, L\n1333-74-0, Hydrogen, 500 g');
  assert.equal(out.length, 5);
  assert.deepEqual(out[0], { cas: '67-56-1', name: 'Methanol', quantity: 2, unit: 'kg', raw: '67-56-1, Methanol, 2, kg', parseError: false });
  assert.equal(out[1].cas, '64-17-5');
  assert.equal(out[1].quantity, null);
  assert.equal(out[1].parseError, false);
  assert.equal(out[2].parseError, true);
  assert.equal(out[3].parseError, true);
  assert.equal(out[4].quantity, 500);
  assert.equal(out[4].unit, 'g');
  assert.deepEqual(S.parseChemicals(''), []);
});

// ---------- assessRisk ----------
test('assessRisk: Notion example 5x3=15 HIGH, residual 5x1 MEDIUM keeps HIGH route', () => {
  const exp = { severity: 5, likelihood: 3, residual_severity: 5, residual_likelihood: 1, escalation_conditions: [], chemicals_raw: '' };
  const r = S.assessRisk(exp, RISK_RULES, CHEM_REGISTER);
  assert.equal(r.initial_score, 15);
  assert.equal(r.calc_level, 'HIGH');
  assert.equal(r.residual_score, 5);
  assert.equal(r.residual_level, 'MEDIUM');
  assert.equal(r.inherent_level, 'HIGH');
  assert.equal(r.route_level, 'HIGH');
  assert.equal(r.min_level, null);
  assert.ok(r.legal_flags.some((f) => f.includes('PI approval is the final INTERNAL approval only')));
});

test('assessRisk: escalation rule raises LOW calc to HIGH', () => {
  const exp = { severity: 1, likelihood: 2, residual_severity: 1, residual_likelihood: 1,
    escalation_conditions: ['Li-ion: deliberate thermal runaway', 'High voltage: exposed conductors'], chemicals_raw: '' };
  const r = S.assessRisk(exp, RISK_RULES, CHEM_REGISTER);
  assert.equal(r.calc_level, 'LOW');
  assert.deepEqual(r.matched_rules.map((m) => m.rule_id), ['RR-01', 'RR-06']);
  assert.equal(r.matched_rules[0].label, 'Li-ion: deliberate thermal runaway');
  assert.equal(r.min_level, 'HIGH');
  assert.equal(r.inherent_level, 'HIGH');
  assert.equal(r.route_level, 'HIGH');
  assert.ok(r.legal_flags.includes('PI approval is the final INTERNAL approval only; external permits/EHS approvals still required'));
});

test('assessRisk: LOW with no flags has no HIGH legal flag', () => {
  const r = S.assessRisk({ severity: 1, likelihood: 1, residual_severity: 1, residual_likelihood: 1 }, RISK_RULES, CHEM_REGISTER);
  assert.equal(r.inherent_level, 'LOW');
  assert.deepEqual(r.legal_flags, []);
  assert.deepEqual(r.chemicals, []);
});

test('assessRisk: hazardous chemical -> MEDIUM, special control -> HIGH', () => {
  const base = { severity: 1, likelihood: 1, residual_severity: 1, residual_likelihood: 1, escalation_conditions: [] };
  const m = S.assessRisk({ ...base, chemicals_raw: '67-56-1, Methanol, 2, kg' }, RISK_RULES, CHEM_REGISTER);
  assert.equal(m.chem_min_level, 'MEDIUM');
  assert.equal(m.inherent_level, 'MEDIUM');
  assert.ok(m.legal_flags.includes('67-56-1 Methanol: on VN chemical list (Decree 24/2026 — verify)'));
  assert.equal(m.chemicals[0].threshold_exceeded, false);

  const h = S.assessRisk({ ...base, chemicals_raw: '7664-93-9, Sulfuric acid, 1, L' }, RISK_RULES, CHEM_REGISTER);
  assert.equal(h.chemicals[0].special_control, true);
  assert.equal(h.chem_min_level, 'HIGH');
  assert.equal(h.inherent_level, 'HIGH');
  assert.ok(h.chemicals[0].flags.includes('quantity unit not comparable — check threshold manually'));
});

test('assessRisk: threshold exceeded in g and kg', () => {
  const base = { severity: 1, likelihood: 1, residual_severity: 1, residual_likelihood: 1, escalation_conditions: [] };
  const g = S.assessRisk({ ...base, chemicals_raw: '50-00-0, Test chem, 2500, g' }, RISK_RULES, CHEM_REGISTER);
  assert.equal(g.chemicals[0].threshold_kg, 2);
  assert.equal(g.chemicals[0].threshold_exceeded, true);
  assert.equal(g.chem_min_level, 'HIGH');
  assert.equal(g.route_level, 'HIGH');
  const under = S.assessRisk({ ...base, chemicals_raw: '50-00-0, Test chem, 1500, g' }, RISK_RULES, CHEM_REGISTER);
  assert.equal(under.chemicals[0].threshold_exceeded, false);
  assert.equal(under.inherent_level, 'LOW');

  const kg = S.assessRisk({ ...base, chemicals_raw: '1333-74-0, Hydrogen, 3, kg' }, RISK_RULES, CHEM_REGISTER);
  assert.equal(kg.chemicals[0].threshold_exceeded, true);
  assert.ok(kg.legal_flags.includes('1333-74-0 Hydrogen: quantity exceeds threshold 1 kg — chemical emergency plan required (Decree 25/2026)'));
});

test('assessRisk: unregistered CAS flag', () => {
  const r = S.assessRisk({ severity: 1, likelihood: 1, residual_severity: 1, residual_likelihood: 1,
    chemicals_raw: '99-99-9, Mystery, 1, kg' }, RISK_RULES, CHEM_REGISTER);
  assert.equal(r.chemicals[0].registered, false);
  assert.ok(r.legal_flags.includes('99-99-9 Mystery: not in VN_CHEMICAL_REGISTER — manual legal check required'));
  assert.equal(r.inherent_level, 'LOW');
});

// ---------- checkCompliance ----------
test('checkCompliance: all-pass fixture', () => {
  const { compliance } = run();
  for (const c of compliance.checks) assert.equal(c.status, 'PASS', `${c.id}: ${c.detail}`);
  assert.equal(compliance.ok, true);
  assert.deepEqual(compliance.checks.map((c) => c.id),
    ['registered', 'osh_group', 'training', 'sop', 'equipment', 'sds', 'chemical_legal', 'risk_complete', 'legal_ack']);
});

const FAIL_CASES = {
  'registered: unknown person': ['registered', null, (d) => { d.people.splice(1, 1); }],
  'registered: inactive person': ['registered', null, (d) => { d.people[1].status = 'INACTIVE'; }],
  'training: missing record': ['training', null, (d) => { d.trainingRecords = d.trainingRecords.filter((r) => !(r.email === BOB && r.training_code === 'E1')); }],
  'training: expired record': ['training', null, (d) => { d.trainingRecords[0].expires_on = '2026-10-10'; }],
  'sop: unknown SOP': ['sop', { 'Related SOP IDs (comma-separated)': 'SOP-NOPE-99' }],
  'sop: retired SOP': ['sop', { 'Related SOP IDs (comma-separated)': 'SOP-OLD-01' }],
  'sop: ack of old version only': ['sop', null, (d) => { d.sops[0].version = '2.0'; }],
  'equipment: unknown': ['equipment', { 'Equipment IDs (comma-separated)': 'EQ-PSU-01, EQ-GHOST' }],
  'equipment: RED': ['equipment', { 'Equipment IDs (comma-separated)': 'EQ-BROKEN' }],
  'equipment: not authorized': ['equipment', null, (d) => { d.equipment[0].authorized_users = ALICE; }],
  'sds: chemicals without SDS': ['sds', { 'Chemicals (one per line: CAS, name, quantity, unit)': '64-17-5, Ethanol, 1, L', 'SDS uploaded for all chemicals?': 'No' }],
  'chemical_legal: parse error': ['chemical_legal', { 'Chemicals (one per line: CAS, name, quantity, unit)': 'ethanol a bit', 'SDS uploaded for all chemicals?': 'Yes' }],
  'risk_complete: missing residual': ['risk_complete', { 'Residual severity (1-5)': '' }],
  'risk_complete: blank controls': ['risk_complete', { 'Controls': '  ' }],
  'risk_complete: blank emergency procedure': ['risk_complete', { 'Emergency procedure': '' }],
  'legal_ack: not acknowledged': ['legal_ack', { 'Legal acknowledgement': '' }],
};
for (const [name, [id, over, mutate]] of Object.entries(FAIL_CASES)) {
  test(`checkCompliance FAIL ${name}`, () => {
    const { compliance } = run(over, mutate);
    const failed = compliance.checks.filter((c) => c.status === 'FAIL').map((c) => c.id);
    assert.deepEqual(failed, [id], JSON.stringify(compliance.checks, null, 1));
    assert.equal(compliance.ok, false);
  });
}

test('checkCompliance WARN: YELLOW equipment, blank OSH group, expiring training', () => {
  let { compliance } = run({ 'Equipment IDs (comma-separated)': 'EQ-PSU-01, EQ-FURN-01' });
  assert.equal(check(compliance, 'equipment').status, 'WARN');
  assert.equal(compliance.ok, true);

  ({ compliance } = run(null, (d) => { d.people[0].vn_osh_group = ''; }));
  assert.equal(check(compliance, 'osh_group').status, 'WARN');
  assert.match(check(compliance, 'osh_group').detail, /alice@uni\.edu/);
  ({ compliance } = run(null, (d) => { d.people[1].vn_osh_group = 'Not yet classified'; }));
  assert.equal(check(compliance, 'osh_group').status, 'WARN');
  assert.equal(compliance.ok, true);

  ({ compliance } = run(null, (d) => { d.trainingRecords[0].expires_on = '2026-10-30'; }));
  assert.equal(check(compliance, 'training').status, 'WARN');
  assert.equal(compliance.ok, true);
});

test('checkCompliance WARN: unregistered CAS, legal flags; residual > initial', () => {
  let { compliance } = run({ 'Chemicals (one per line: CAS, name, quantity, unit)': '99-99-9, Mystery, 1, kg', 'SDS uploaded for all chemicals?': 'Yes' });
  assert.equal(check(compliance, 'chemical_legal').status, 'WARN');
  assert.equal(check(compliance, 'sds').status, 'PASS');
  ({ compliance } = run({ 'Residual severity (1-5)': '3', 'Residual likelihood (1-5)': '3' }));
  assert.equal(check(compliance, 'risk_complete').status, 'WARN');
});

test('checkCompliance: required training from hazards + equipment', () => {
  // Chemical hazard -> C1 required, nobody has it
  let { compliance } = run({ 'Hazards': 'High voltage, chemical' });
  assert.equal(check(compliance, 'training').status, 'FAIL');
  assert.match(check(compliance, 'training').detail, /C1 missing/);
  // Equipment EQ-NANO-01 requires N1 (required_for blank in TRAINING_TYPES)
  ({ compliance } = run({ 'Equipment IDs (comma-separated)': 'EQ-PSU-01, EQ-NANO-01' }));
  assert.equal(check(compliance, 'training').status, 'FAIL');
  assert.match(check(compliance, 'training').detail, /N1 missing/);
  // Without High voltage hazard and without EQ-PSU-01, E1 is not required
  ({ compliance } = run({ 'Hazards': 'Other', 'Equipment IDs (comma-separated)': '' },
    (d) => { d.trainingRecords = d.trainingRecords.filter((r) => r.training_code !== 'E1'); }));
  assert.equal(check(compliance, 'training').status, 'PASS');
  // Never-expiring record (blank expires_on, type with blank validity) is valid
  ({ compliance } = run({ 'Equipment IDs (comma-separated)': 'EQ-PSU-01, EQ-NANO-01' }, (d) => {
    d.trainingTypes.find((t) => t.training_code === 'N1').validity_months = '';
    [ALICE, BOB].forEach((email) => d.trainingRecords.push({ email, training_code: 'N1', completed_on: '2020-01-01', expires_on: '' }));
  }));
  assert.equal(check(compliance, 'training').status, 'PASS');
});

// ---------- routing / state ----------
test('reviewerKeyFor and configMap', () => {
  assert.equal(S.reviewerKeyFor('LOW'), 'SUPERVISOR_EMAIL');
  assert.equal(S.reviewerKeyFor('MEDIUM'), 'SAFETY_REVIEWER_EMAIL');
  assert.equal(S.reviewerKeyFor('HIGH'), 'EHS_REVIEWER_EMAIL');
  assert.deepEqual(S.configMap([{ key: 'PI_NAME', value: 'Dr. Simon Park', note: 'x' }, { key: ' EXPIRY_WARNING_DAYS ', value: 30 }, { key: '', value: 'skip' }]),
    { PI_NAME: 'Dr. Simon Park', EXPIRY_WARNING_DAYS: 30 });
});

test('nextState full table', () => {
  const table = [
    ['PENDING_REVIEW', 'REVIEW', 'APPROVE', 'PENDING_PI', 'PI'],
    ['PENDING_REVIEW', 'REVIEW', 'APPROVE_WITH_CONDITIONS', 'PENDING_PI', 'PI'],
    ['PENDING_REVIEW', 'REVIEW', 'CHANGES_REQUIRED', 'CHANGES_REQUIRED', ''],
    ['PENDING_REVIEW', 'REVIEW', 'REJECT', 'REJECTED', ''],
    ['PENDING_PI', 'PI', 'APPROVE', 'APPROVED', ''],
    ['PENDING_PI', 'PI', 'APPROVE_WITH_CONDITIONS', 'APPROVED_WITH_CONDITIONS', ''],
    ['PENDING_PI', 'PI', 'CHANGES_REQUIRED', 'CHANGES_REQUIRED', ''],
    ['PENDING_PI', 'PI', 'REJECT', 'REJECTED', ''],
  ];
  for (const [status, stage, decision, to, cs] of table) {
    assert.deepEqual(S.nextState({ status }, stage, decision), { ok: true, status: to, current_stage: cs }, `${status}/${stage}/${decision}`);
  }
  const invalid = [
    ['PENDING_REVIEW', 'PI', 'APPROVE'],
    ['PENDING_PI', 'REVIEW', 'APPROVE'],
    ['APPROVED', 'PI', 'APPROVE'],
    ['REJECTED_INCOMPLETE', 'REVIEW', 'APPROVE'],
    ['CHANGE_PENDING', 'REVIEW', 'APPROVE'],
    ['PENDING_REVIEW', 'REVIEW', 'MAYBE'],
    ['', 'REVIEW', 'APPROVE'],
  ];
  for (const [status, stage, decision] of invalid) {
    const r = S.nextState({ status, current_stage: 'X' }, stage, decision);
    assert.equal(r.ok, false);
    assert.equal(r.error, 'Experiment is not awaiting this decision');
    assert.equal(r.status, status);
  }
});

// ---------- tokens ----------
test('makeToken / verifyToken round-trip and tamper', () => {
  const t = S.makeToken('s3cret', 'EXP-2026-0001', 'REVIEW');
  assert.match(t, /^[0-9a-f]{32}$/);
  assert.equal(t, require('crypto').createHmac('sha256', 's3cret').update('EXP-2026-0001|REVIEW').digest('hex').slice(0, 32));
  assert.equal(S.verifyToken('s3cret', 'EXP-2026-0001', 'REVIEW', t), true);
  assert.equal(S.verifyToken('s3cret', 'EXP-2026-0001', 'PI', t), false);
  assert.equal(S.verifyToken('s3cret', 'EXP-2026-0002', 'REVIEW', t), false);
  assert.equal(S.verifyToken('other', 'EXP-2026-0001', 'REVIEW', t), false);
  const tampered = (t[0] === 'a' ? 'b' : 'a') + t.slice(1);
  assert.equal(S.verifyToken('s3cret', 'EXP-2026-0001', 'REVIEW', tampered), false);
  assert.equal(S.verifyToken('s3cret', 'EXP-2026-0001', 'REVIEW', t.slice(0, 31)), false);
  assert.equal(S.verifyToken('s3cret', 'EXP-2026-0001', 'REVIEW', undefined), false);
});

// ---------- training expiry ----------
test('trainingExpiry', () => {
  assert.equal(S.trainingExpiry('2026-01-15', 12), '2027-01-15');
  assert.equal(S.trainingExpiry('1/15/2026', '24'), '2028-01-15');
  assert.equal(S.trainingExpiry('2026-01-15', ''), '');
  assert.equal(S.trainingExpiry('2026-01-15', 0), '');
  assert.equal(S.trainingExpiry('2026-01-15', '0'), '');
  assert.equal(S.trainingExpiry('', 12), '');
});

test('expiringTraining: latest record per person+code wins; EXPIRED vs EXPIRING', () => {
  const types = baseData().trainingTypes;
  const records = [
    // CORE for alice: old one expired, but newer renewal is valid → not reported
    { email: ALICE, training_code: 'CORE', completed_on: '2025-01-01', expires_on: '2026-01-01' },
    { email: 'ALICE@uni.edu', training_code: 'core', completed_on: '2026-09-01', expires_on: '2027-09-01' },
    // FIRE for alice expires in 10 days → EXPIRING
    { email: ALICE, training_code: 'FIRE', completed_on: '2025-10-21', expires_on: '2026-10-21' },
    // E1 for bob expired → EXPIRED; expires_on blank → computed from validity (24 months)
    { email: BOB, training_code: 'E1', completed_on: '2024-09-01', expires_on: '' },
    // VN-OSH for bob: newer record expired, older one valid — latest (by completed_on) wins → EXPIRED
    { email: BOB, training_code: 'VN-OSH', completed_on: '2020-01-01', expires_on: '2030-01-01' },
    { email: BOB, training_code: 'VN-OSH', completed_on: '2024-01-01', expires_on: '2026-01-01' },
    // N1 never expires (validity blank) → skipped
    { email: BOB, training_code: 'N1', completed_on: '2020-01-01', expires_on: '' },
    // outside window
    { email: BOB, training_code: 'CORE', completed_on: '2026-01-01', expires_on: '2026-12-31' },
  ];
  types.find((t) => t.training_code === 'N1').validity_months = '';
  const out = S.expiringTraining(records, types, TODAY, 30);
  const key = (x) => `${x.email}|${x.training_code}|${x.status}`;
  assert.deepEqual(out.map(key).sort(), [
    `${ALICE}|FIRE|EXPIRING`, `${BOB}|E1|EXPIRED`, `${BOB}|VN-OSH|EXPIRED`,
  ].sort());
  const fire = out.find((x) => x.training_code === 'FIRE');
  assert.equal(fire.days_left, 10);
  assert.equal(fire.expires_on, '2026-10-21');
  assert.equal(fire.name, 'Fire safety');
  const e1 = out.find((x) => x.training_code === 'E1');
  assert.equal(e1.expires_on, '2026-09-01');
  assert.equal(e1.days_left, -40);
  assert.equal(S.expiringTraining([], types, TODAY, 30).length, 0);
});

// ---------- html / row ----------
test('escapeHtml and experimentSummaryHtml escapes user text', () => {
  assert.equal(S.escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(S.escapeHtml(null), '');
  const { exp, risk, compliance } = run({ 'Experiment title': '<script>alert(1)</script>', 'Controls': 'a & b\nline2' });
  const html = S.experimentSummaryHtml(exp, risk, compliance, { exp_id: 'EXP-2026-0001', reviewer_comment: '<b>hi</b>' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;b&gt;hi&lt;/b&gt;'));
  assert.ok(html.includes('EXP-2026-0001'));
  assert.ok(html.includes('a &amp; b<br>line2'));
  assert.ok(html.startsWith('<table'));
  // tolerant of a flat EXPERIMENTS row with no risk/compliance objects
  const row = S.toExperimentRow(exp, risk, compliance, { exp_id: 'EXP-2026-0001' });
  const html2 = S.experimentSummaryHtml(row);
  assert.ok(html2.includes('&lt;script&gt;'));
  assert.ok(!html2.includes('<script>'));
});

test('toExperimentRow has every §3.1 header key', () => {
  const headers = `exp_id, title, project, pi_name, leader_email, researcher_emails, lab, start_date, end_date,
sop_ids, equipment_ids, hazards, escalation_conditions, hazard_details, chemicals_raw, sds_uploaded,
severity, likelihood, initial_score, calc_level, min_level, inherent_level, matched_rules,
controls, residual_severity, residual_likelihood, residual_score, residual_level,
emergency_procedure, legal_flags, compliance_summary, reviewer_email,
current_stage, status, submitted_by, submitted_at, updated_at`.split(/[,\s]+/).filter(Boolean);
  const { exp, risk, compliance } = run({
    'Escalation conditions': 'Li-ion: deliberate thermal runaway',
    'Chemicals (one per line: CAS, name, quantity, unit)': '67-56-1, Methanol, 2, kg',
    'SDS uploaded for all chemicals?': 'Yes',
  });
  const row = S.toExperimentRow(exp, risk, compliance, {
    exp_id: 'EXP-2026-0001', status: 'PENDING_REVIEW', current_stage: 'REVIEW',
    reviewer_email: 'ehs@uni.edu', updated_at: '2026-10-11T09:06:00Z', not_a_header: 'x',
  });
  assert.deepEqual(Object.keys(row), headers);
  assert.deepEqual(S.EXPERIMENT_HEADERS, headers);
  for (const v of Object.values(row)) assert.ok(v !== null && v !== undefined && !Array.isArray(v));
  assert.equal(row.researcher_emails, `${ALICE}, ${BOB}`);
  assert.equal(row.exp_id, 'EXP-2026-0001');
  assert.equal(row.inherent_level, 'HIGH');
  assert.equal(row.matched_rules, 'RR-01');
  assert.equal(risk.legal_flags.length, 2);
  assert.equal(row.legal_flags, risk.legal_flags.join('; '));
  assert.match(row.compliance_summary, /WARN Chemical legal check/);
  assert.equal(row.status, 'PENDING_REVIEW');
  assert.equal(row.min_level, 'HIGH');
  assert.equal(row.initial_score, 4);
  // all-pass compliance summary
  const ok = run();
  assert.equal(S.toExperimentRow(ok.exp, ok.risk, ok.compliance, {}).compliance_summary, 'All checks passed');
});
