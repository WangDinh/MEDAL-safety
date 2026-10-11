/**
 * SafeLab — Google side: workbook SAFELAB_MASTER, forms F01–F07, DASHBOARD, demo data.
 *
 * How to use: create a blank Google Sheet → Extensions → Apps Script → paste this file
 * (and appsscript.json via Project Settings → "Show appsscript.json") → Save → run
 * setupSafeLab once (authorize) → reload the sheet and use the "SafeLab" menu.
 *
 * Contract: docs/SAFELAB_SPEC.md §3, §4, §6. Tab headers and form question titles are read
 * by n8n character-for-character — do not rename them.
 */

const DEMO_EMAIL = 'quangdinh2102@gmail.com';
const TZ = 'Asia/Ho_Chi_Minh';
const WORKBOOK_NAME = 'SAFELAB_MASTER';
const NONE_OF_THESE = 'None of these';
const DASH = ' — '; // em dash used in dropdown labels, e.g. "CORE — Core lab safety (videos A + quiz)"

// ---------------------------------------------------------------------------
// Schema (§3) — row 1 headers of every master tab
// ---------------------------------------------------------------------------
const TABS = {
  CONFIG: ['key', 'value', 'note'],
  PEOPLE: ['email', 'full_name', 'role', 'project', 'supervisor_email', 'vn_osh_group', 'status', 'registered_at', 'updated_at'],
  PROJECTS: ['project_code', 'name', 'lead_email'],
  LABS: ['lab_code', 'name', 'room', 'zone'],
  EQUIPMENT: ['equipment_id', 'name', 'lab_code', 'owner_email', 'sop_id', 'status', 'authorized_users', 'required_training'],
  TRAINING_TYPES: ['training_code', 'name', 'validity_months', 'required_for', 'link'],
  TRAINING_RECORDS: ['record_id', 'email', 'training_code', 'completed_on', 'expires_on', 'quiz_score', 'evidence_url', 'recorded_at'],
  SOP_MASTER: ['sop_id', 'title', 'version', 'owner_email', 'status', 'effective_date', 'review_date', 'doc_url'],
  SOP_ACK: ['ack_id', 'email', 'sop_id', 'version', 'acknowledged_at'],
  EXPERIMENTS: [
    'exp_id', 'title', 'project', 'pi_name', 'leader_email', 'researcher_emails', 'lab', 'start_date', 'end_date',
    'sop_ids', 'equipment_ids', 'hazards', 'escalation_conditions', 'hazard_details', 'chemicals_raw', 'sds_uploaded',
    'severity', 'likelihood', 'initial_score', 'calc_level', 'min_level', 'inherent_level', 'matched_rules',
    'controls', 'residual_severity', 'residual_likelihood', 'residual_score', 'residual_level',
    'emergency_procedure', 'legal_flags', 'compliance_summary', 'reviewer_email',
    'current_stage', 'status', 'submitted_by', 'submitted_at', 'updated_at',
  ],
  APPROVALS: ['approval_id', 'exp_id', 'stage', 'reviewer_email', 'decision', 'comment', 'decided_at'],
  CHEMICALS: ['exp_id', 'cas', 'name', 'quantity', 'unit', 'registered', 'vn_listed', 'hazardous', 'special_control', 'flags', 'recorded_at'],
  VN_CHEMICAL_REGISTER: ['cas', 'name_en', 'name_vi', 'vn_listed', 'hazardous', 'special_control', 'threshold_kg', 'legal_ref', 'note'],
  RISK_RULES: ['rule_id', 'hazard', 'condition', 'min_level'],
  INCIDENTS: ['incident_id', 'type', 'occurred_at', 'lab', 'reporter_email', 'description', 'injury', 'severity', 'immediate_action', 'related_exp_id', 'status', 'reported_at'],
  CAPA: ['capa_id', 'source', 'source_id', 'action', 'owner_email', 'due_date', 'status', 'created_at', 'closed_at'],
  PCCC_RECORDS: ['record_id', 'type', 'date', 'description', 'doc_url', 'next_due'],
  LEGAL_REGISTER: ['code', 'regulation', 'area', 'requirement', 'record'],
  AUDIT_LOG: ['ts', 'actor', 'action', 'entity', 'entity_id', 'details'],
};

// Columns kept as plain text (so "1.0" stays "1.0" and CAS numbers are never parsed as dates).
const TEXT_COLUMNS = {
  SOP_MASTER: ['version'],
  SOP_ACK: ['version'],
  CHEMICALS: ['cas'],
  VN_CHEMICAL_REGISTER: ['cas'],
};
// Columns shown as YYYY-MM-DD.
const DATE_COLUMNS = {
  TRAINING_RECORDS: ['completed_on', 'expires_on'],
  SOP_MASTER: ['effective_date', 'review_date'],
  EXPERIMENTS: ['start_date', 'end_date'],
  CAPA: ['due_date'],
  PCCC_RECORDS: ['date', 'next_due'],
};

// ---------------------------------------------------------------------------
// Seed data (§3.2) — written only into tabs that have no data rows yet.
// '{TODAY}' and '{TODAY+12M}' are replaced at setup time.
// ---------------------------------------------------------------------------
const VERIFY_NOTE = 'SAMPLE row for demo only — verify against Decree 24/2026 before real use';

const SEED = {
  CONFIG: [
    { key: 'PI_NAME', value: 'Dr. Simon Park', note: 'Final internal approver' },
    { key: 'PI_EMAIL', value: DEMO_EMAIL, note: 'demo' },
    { key: 'SAFETY_COORDINATOR_EMAIL', value: DEMO_EMAIL, note: 'incidents, CAPA, training summary' },
    { key: 'SUPERVISOR_EMAIL', value: DEMO_EMAIL, note: 'reviewer for LOW' },
    { key: 'SAFETY_REVIEWER_EMAIL', value: DEMO_EMAIL, note: 'reviewer for MEDIUM' },
    { key: 'EHS_REVIEWER_EMAIL', value: DEMO_EMAIL, note: 'reviewer for HIGH' },
    { key: 'EXPIRY_WARNING_DAYS', value: 30, note: 'training expiry reminder window' },
    { key: 'SHEET_URL', value: '', note: 'filled by setup' },
    { key: 'FORM_F01_URL', value: '', note: 'filled by setup (public link); note = edit link' },
    { key: 'FORM_F02_URL', value: '', note: 'filled by setup (public link); note = edit link' },
    { key: 'FORM_F03_URL', value: '', note: 'filled by setup (public link); note = edit link' },
    { key: 'FORM_F04_URL', value: '', note: 'filled by setup (public link); note = edit link' },
    { key: 'FORM_F05_URL', value: '', note: 'filled by setup (public link); note = edit link' },
    { key: 'FORM_F06_URL', value: '', note: 'filled by setup (public link); note = edit link' },
    { key: 'FORM_F07_URL', value: '', note: 'filled by setup (public link); note = edit link' },
  ],
  PROJECTS: [
    { project_code: 'BESS', name: 'Battery Energy Storage System', lead_email: DEMO_EMAIL },
    { project_code: 'PipeSnake', name: 'PipeSnake', lead_email: DEMO_EMAIL },
    { project_code: 'FeelGripper', name: 'FeelGripper', lead_email: DEMO_EMAIL },
    { project_code: 'NanoSense', name: 'NanoSense', lead_email: DEMO_EMAIL },
  ],
  LABS: [
    { lab_code: 'LAB-A', name: 'Clean / Electrical', room: 'TBD', zone: 'A' },
    { lab_code: 'LAB-D', name: 'Wet Chemical', room: 'TBD', zone: 'D' },
    { lab_code: 'LAB-E', name: 'Materials', room: 'TBD', zone: 'E' },
  ],
  EQUIPMENT: [
    { equipment_id: 'EQ-PSU-01', name: 'Bench power supply', lab_code: 'LAB-A', owner_email: DEMO_EMAIL, sop_id: 'SOP-ESP-01', status: 'GREEN', authorized_users: DEMO_EMAIL, required_training: 'E1' },
    { equipment_id: 'EQ-FURN-01', name: 'Tube furnace', lab_code: 'LAB-E', owner_email: DEMO_EMAIL, sop_id: 'SOP-GEN-01', status: 'YELLOW', authorized_users: DEMO_EMAIL, required_training: '' },
  ],
  TRAINING_TYPES: [
    { training_code: 'CORE', name: 'Core lab safety (videos A + quiz)', validity_months: 12, required_for: 'ALL', link: 'https://www.youtube.com/watch?v=TlhVR0xQLJQ' },
    { training_code: 'VN-OSH', name: 'Vietnam OSH training (Decree 44/2016)', validity_months: 24, required_for: 'ALL', link: '' },
    { training_code: 'FIRE', name: 'Fire safety / PCCC', validity_months: 12, required_for: 'ALL', link: 'https://www.youtube.com/watch?v=rPNQH3usdzI' },
    { training_code: 'E1', name: 'Electrical safety E1', validity_months: 24, required_for: 'High voltage, High current, Stored energy', link: 'https://www.youtube.com/watch?v=aMJ8XlBcshY' },
    { training_code: 'E2', name: 'Electrical safety E2 (hazardous energy)', validity_months: 24, required_for: 'High voltage, High current', link: 'https://www.youtube.com/watch?v=HFJq3BGm8Kw' },
    { training_code: 'M1', name: 'Fabrication shop M1', validity_months: 24, required_for: 'Rotating machinery', link: 'https://www.youtube.com/watch?v=Fb6oGz9gfIo' },
    { training_code: 'C1', name: 'Chemical safety C1', validity_months: 12, required_for: 'Chemical, Flammable material, Toxic material, Corrosive, Electroplating', link: 'https://www.youtube.com/watch?v=d6l-6rPtWMk' },
    { training_code: 'C3', name: 'Compressed gas C3', validity_months: 12, required_for: 'Gas, Hydrogen', link: 'https://www.youtube.com/watch?v=tGPlQvRtIG0' },
    { training_code: 'BAT', name: 'Li-ion battery safety', validity_months: 24, required_for: 'Battery', link: 'https://www.youtube.com/watch?v=ZavQDcGd2FU' },
    { training_code: 'N1', name: 'Nanomaterials N1', validity_months: 24, required_for: '', link: 'https://www.youtube.com/watch?v=w1pg0lXa31c' },
  ],
  SOP_MASTER: [
    { sop_id: 'SOP-GEN-01', title: 'General Lab Rules', version: '1.0', owner_email: DEMO_EMAIL, status: 'ACTIVE', effective_date: '{TODAY}', review_date: '{TODAY+12M}', doc_url: '' },
    { sop_id: 'SOP-ESP-01', title: 'Electrical Safety SOP', version: '1.0', owner_email: DEMO_EMAIL, status: 'ACTIVE', effective_date: '{TODAY}', review_date: '{TODAY+12M}', doc_url: '' },
  ],
  VN_CHEMICAL_REGISTER: [
    { cas: '67-56-1', name_en: 'Methanol', name_vi: 'Metanol', vn_listed: 'YES', hazardous: 'YES', special_control: 'NO', threshold_kg: 100, legal_ref: 'Decree 24/2026 (verify)', note: VERIFY_NOTE },
    { cas: '64-17-5', name_en: 'Ethanol', name_vi: 'Etanol', vn_listed: 'YES', hazardous: 'YES', special_control: 'NO', threshold_kg: '', legal_ref: 'Decree 24/2026 (verify)', note: VERIFY_NOTE },
    { cas: '67-64-1', name_en: 'Acetone', name_vi: 'Axeton', vn_listed: 'YES', hazardous: 'YES', special_control: 'NO', threshold_kg: '', legal_ref: 'Decree 24/2026 (verify)', note: VERIFY_NOTE },
    { cas: '7647-01-0', name_en: 'Hydrochloric acid', name_vi: 'Axit clohydric', vn_listed: 'YES', hazardous: 'YES', special_control: 'NO', threshold_kg: '', legal_ref: 'Decree 24/2026 (verify)', note: VERIFY_NOTE },
    { cas: '7664-93-9', name_en: 'Sulfuric acid', name_vi: 'Axit sunfuric', vn_listed: 'YES', hazardous: 'YES', special_control: 'YES', threshold_kg: 50, legal_ref: 'Decree 24/2026 (verify)', note: VERIFY_NOTE },
    { cas: '7697-37-2', name_en: 'Nitric acid', name_vi: 'Axit nitric', vn_listed: 'YES', hazardous: 'YES', special_control: 'YES', threshold_kg: 50, legal_ref: 'Decree 24/2026 (verify)', note: VERIFY_NOTE },
    { cas: '1333-74-0', name_en: 'Hydrogen', name_vi: 'Hydro', vn_listed: 'YES', hazardous: 'YES', special_control: 'YES', threshold_kg: 1, legal_ref: 'Decree 24/2026 (verify)', note: VERIFY_NOTE },
  ],
  RISK_RULES: [
    { rule_id: 'RR-01', hazard: 'Li-ion', condition: 'deliberate thermal runaway', min_level: 'HIGH' },
    { rule_id: 'RR-02', hazard: 'Battery', condition: 'penetration/crush/overcharge', min_level: 'HIGH' },
    { rule_id: 'RR-03', hazard: 'Hydrogen', condition: 'intentional generation', min_level: 'HIGH' },
    { rule_id: 'RR-04', hazard: 'Flammable gas', condition: 'significant quantity', min_level: 'HIGH' },
    { rule_id: 'RR-05', hazard: 'Laser', condition: 'Class 3B/4', min_level: 'HIGH' },
    { rule_id: 'RR-06', hazard: 'High voltage', condition: 'exposed conductors', min_level: 'MEDIUM' },
    { rule_id: 'RR-07', hazard: 'High pressure', condition: 'above lab threshold', min_level: 'HIGH' },
    { rule_id: 'RR-08', hazard: 'Toxic chemical', condition: 'above specified limit', min_level: 'HIGH' },
    { rule_id: 'RR-09', hazard: 'Rotating equipment', condition: 'exposed high energy', min_level: 'MEDIUM' },
    { rule_id: 'RR-10', hazard: 'Drone', condition: 'outdoor autonomous flight', min_level: 'MEDIUM' },
    { rule_id: 'RR-11', hazard: 'Routine FDM printing', condition: 'enclosed standard operation', min_level: 'LOW' },
  ],
  LEGAL_REGISTER: [
    { code: 'VN-OSH-001', regulation: 'Decree 44/2016', area: 'Training', requirement: 'OSH training', record: 'Training' },
    { code: 'VN-FIRE-001', regulation: 'Law 55/2024', area: 'Fire', requirement: 'Fire controls', record: 'PCCC' },
    { code: 'VN-FIRE-002', regulation: 'Decree 105/2025', area: 'Fire', requirement: 'PCCC dossier', record: 'PCCC' },
    { code: 'VN-CHEM-001', regulation: 'Law 69/2025', area: 'Chemical', requirement: 'Chemical safety', record: 'Chemical' },
    { code: 'VN-CHEM-002', regulation: 'Decree 24/2026', area: 'Chemical', requirement: 'Chemical lists', record: 'Chemical' },
    { code: 'VN-CHEM-003', regulation: 'Decree 25/2026', area: 'Chemical', requirement: 'Accident prevention', record: 'Experiment' },
    { code: 'VN-CHEM-004', regulation: 'Decree 26/2026', area: 'Chemical', requirement: 'Chemical management', record: 'Chemical' },
  ],
};

const DEMO_EQUIPMENT_IDS = ['EQ-PSU-01', 'EQ-FURN-01'];

// ---------------------------------------------------------------------------
// Forms (§4). Question titles are the response-sheet column names n8n reads.
// type: text | paragraph | choice | checkbox | list | date | datetime | scale | section | page
// source: choices filled by refreshFormChoices() from a master tab.
// ---------------------------------------------------------------------------
const SEVERITY_LABELS = ['Negligible', 'Catastrophic'];
const LIKELIHOOD_LABELS = ['Rare', 'Frequent'];

const HAZARDS = [
  'Chemical', 'Flammable material', 'Toxic material', 'Corrosive', 'Battery', 'High voltage', 'High current',
  'Pressure', 'Vacuum', 'Elevated temperature', 'Cryogenic', 'Laser', 'Gas', 'Hydrogen', 'Rotating machinery',
  'Stored energy', '3D printing', 'Electroplating', 'Drone', 'Radiation', 'Other',
];

const FORMS = [
  {
    code: 'F01',
    title: 'SafeLab F01 – Personnel Registration',
    description: 'Register once before working in the lab. You will receive an email listing your required trainings and SOPs.',
    items: [
      { type: 'text', title: 'Full name', required: true },
      { type: 'choice', title: 'Role', required: true, choices: ['Student', 'UROP student', 'Research assistant', 'Staff', 'Faculty'] },
      { type: 'text', title: 'Project', help: 'e.g. BESS, PipeSnake, FeelGripper, NanoSense' },
      { type: 'text', title: 'Supervisor email', email: true },
      {
        type: 'choice', title: 'Vietnam OSH training group', required: true,
        choices: ['Group 1', 'Group 2', 'Group 3', 'Group 4', 'Group 5', 'Group 6', 'Not yet classified'],
        help: 'Decree 44/2016 training group. If unsure choose "Not yet classified" — EHS will confirm.',
      },
    ],
  },
  {
    code: 'F02',
    title: 'SafeLab F02 – Training Record',
    description: 'Record a safety training you have completed (one submission per training).',
    items: [
      { type: 'list', title: 'Training', required: true, source: 'TRAINING' },
      { type: 'date', title: 'Completion date', required: true },
      { type: 'text', title: 'Quiz score (%)', percent: true, help: 'Number 0–100, e.g. 90' },
      { type: 'text', title: 'Evidence link', help: 'Link to a certificate or screenshot (Google Drive, etc.)' },
    ],
  },
  {
    code: 'F03',
    title: 'SafeLab F03 – SOP Acknowledgement',
    description: 'Confirm that you have read the current version of an SOP (one submission per SOP).',
    items: [
      { type: 'list', title: 'SOP', required: true, source: 'SOP' },
      { type: 'checkbox', title: 'Acknowledgement', required: true, choices: ['I have read and understood the current version of this SOP'] },
    ],
  },
  {
    code: 'F04',
    title: 'SafeLab F04 – Experimental Safety Approval',
    description: 'Submit a new experiment for safety review. Automatic checks run first (registration, training, SOPs, ' +
      'equipment, chemicals, risk). If they pass, the reviewer for the risk level and then Dr. Simon Park decide.',
    items: [
      { type: 'section', title: 'Identification' },
      { type: 'text', title: 'Experiment title', required: true },
      { type: 'text', title: 'Project', required: true, help: 'e.g. BESS' },
      { type: 'text', title: 'Principal Investigator', required: true, help: 'e.g. Dr. Simon Park' },
      { type: 'text', title: 'Experiment leader email', required: true, email: true },
      { type: 'text', title: 'Researcher emails (comma-separated)', required: true, help: 'Everyone doing hands-on work, including the leader, e.g. a@vinuni.edu.vn, b@vinuni.edu.vn' },
      { type: 'text', title: 'Lab / room', required: true, help: 'e.g. LAB-A' },
      { type: 'date', title: 'Start date', required: true },
      { type: 'date', title: 'Expected completion', required: true },
      { type: 'text', title: 'Related SOP IDs (comma-separated)', help: 'e.g. SOP-GEN-01, SOP-ESP-01' },
      { type: 'text', title: 'Equipment IDs (comma-separated)', help: 'e.g. EQ-PSU-01, EQ-FURN-01' },
      { type: 'page', title: 'Hazards' },
      { type: 'checkbox', title: 'Hazards', required: true, choices: HAZARDS },
      { type: 'checkbox', title: 'Escalation conditions', required: true, source: 'RISK_RULES', help: 'Tick every condition that applies, or "None of these".' },
      { type: 'paragraph', title: 'Hazard details', help: 'Battery chemistry/capacity/voltage, gas and pressure, laser class, temperatures, … e.g. NMC 18650 cells, 4S2P, 14.8 V, 5 Ah' },
      { type: 'page', title: 'Chemicals' },
      {
        type: 'paragraph', title: 'Chemicals (one per line: CAS, name, quantity, unit)',
        help: 'One chemical per line; units kg or g are checked against legal thresholds. Example:\n67-56-1, Methanol, 2, kg\n7664-93-9, Sulfuric acid, 500, g',
      },
      { type: 'choice', title: 'SDS uploaded for all chemicals?', required: true, choices: ['Yes', 'No', 'Not applicable'] },
      { type: 'page', title: 'Risk assessment' },
      { type: 'scale', title: 'Severity (1-5)', required: true, labels: SEVERITY_LABELS },
      { type: 'scale', title: 'Likelihood (1-5)', required: true, labels: LIKELIHOOD_LABELS },
      { type: 'paragraph', title: 'Controls', required: true, help: 'Engineering controls, PPE, procedures, supervision, e.g. fume hood, nitrile gloves + goggles, two-person rule, current-limited supply' },
      { type: 'scale', title: 'Residual severity (1-5)', required: true, labels: SEVERITY_LABELS, help: 'After the controls above' },
      { type: 'scale', title: 'Residual likelihood (1-5)', required: true, labels: LIKELIHOOD_LABELS, help: 'After the controls above' },
      { type: 'paragraph', title: 'Emergency procedure', required: true, help: 'e.g. Cut power at the E-stop, evacuate, use CO2 extinguisher, call security and the PI' },
      {
        type: 'checkbox', title: 'Legal acknowledgement', required: true,
        choices: ['I understand that PI approval does not replace external permits or institutional EHS approvals required by law'],
      },
    ],
  },
  {
    code: 'F05',
    title: 'SafeLab F05 – Experiment Modification',
    description: 'Report a change to an approved experiment. New hazards, chemicals, people or equipment require a new F04.',
    items: [
      { type: 'text', title: 'Experiment ID', required: true, help: 'e.g. EXP-2026-0001' },
      { type: 'paragraph', title: 'What is changing?', required: true },
      { type: 'choice', title: 'Does the change add new hazards, chemicals, people or equipment?', required: true, choices: ['Yes', 'No'] },
    ],
  },
  {
    code: 'F06',
    title: 'SafeLab F06 – Incident / Near Miss',
    description: 'Report an incident, near miss or unsafe condition. In an emergency, act first (call for help) and report afterwards.',
    items: [
      { type: 'choice', title: 'Type', required: true, choices: ['Incident', 'Near miss', 'Unsafe condition'] },
      { type: 'datetime', title: 'Date and time of event', required: true },
      { type: 'text', title: 'Lab / room', required: true, help: 'e.g. LAB-D' },
      { type: 'paragraph', title: 'What happened?', required: true, help: 'e.g. Methanol bottle tipped over in the fume hood, ~50 mL spilled, contained with spill kit' },
      { type: 'choice', title: 'Was anyone injured?', required: true, choices: ['Yes', 'No'] },
      { type: 'choice', title: 'Severity', required: true, choices: ['LOW', 'MEDIUM', 'HIGH'] },
      { type: 'paragraph', title: 'Immediate action taken', help: 'e.g. Area ventilated, spill absorbed, waste labelled' },
      { type: 'text', title: 'Related experiment ID', help: 'e.g. EXP-2026-0001 (if any)' },
    ],
  },
  {
    code: 'F07',
    title: 'SafeLab F07 – Safety Inspection / CAPA',
    description: 'Record a lab inspection. A corrective action (CAPA) is created when "Corrective action required" is filled in.',
    items: [
      { type: 'text', title: 'Lab / room', required: true, help: 'e.g. LAB-A' },
      { type: 'date', title: 'Inspection date', required: true },
      { type: 'paragraph', title: 'Findings', required: true, help: 'e.g. Fire extinguisher inspection tag expired; extension cord daisy-chained at bench 3' },
      { type: 'paragraph', title: 'Corrective action required', help: 'Leave empty if none, e.g. Replace extinguisher and remove daisy-chained cords' },
      { type: 'text', title: 'Action owner email', email: true },
      { type: 'date', title: 'Due date' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SafeLab')
    .addItem('Setup', 'setupSafeLab')
    .addItem('Refresh form choices', 'refreshFormChoices')
    .addItem('Add demo data', 'seedDemoData')
    .addSeparator()
    .addItem('Show form links', 'showFormLinks')
    .addToUi();
}

// ---------------------------------------------------------------------------
// Setup (idempotent)
// ---------------------------------------------------------------------------
function setupSafeLab() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = [];

  ss.rename(WORKBOOK_NAME);
  ss.setSpreadsheetLocale('en_US');
  ss.setSpreadsheetTimeZone(TZ);

  Object.keys(TABS).forEach(name => {
    ensureTab_(ss, name, TABS[name], log);
    seedTab_(ss, name, log);
  });
  setConfig_(ss, 'SHEET_URL', ss.getUrl());

  FORMS.forEach(def => ensureForm_(ss, def, log));
  refreshChoices_(ss).forEach(line => log.push(line));

  buildDashboard_(ss);
  protectTabs_(ss);
  deleteDefaultSheet_(ss);
  audit_(ss, 'SETUP', 'WORKBOOK', ss.getId(), log.join(' | '));

  notify_('SafeLab setup complete', log.join('\n') +
    '\n\nNext: SafeLab → Add demo data (optional), then SafeLab → Show form links.');
}

function ensureTab_(ss, name, headers, log) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name, ss.getNumSheets());
    log.push(`Created tab ${name}`);
  }
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const current = headerRange.getValues()[0].map(v => String(v).trim());
  if (current.join('|') !== headers.join('|')) {
    if (sheet.getLastRow() > 1) {
      log.push(`WARNING: ${name} has data and its headers differ from the spec — not changed`);
    } else {
      headerRange.setValues([headers]);
    }
  }
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
  formatColumns_(sheet, headers, TEXT_COLUMNS[name], '@');
  formatColumns_(sheet, headers, DATE_COLUMNS[name], 'yyyy-mm-dd');
  return sheet;
}

function formatColumns_(sheet, headers, columns, format) {
  (columns || []).forEach(h => {
    const col = headers.indexOf(h) + 1;
    if (col > 0) sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setNumberFormat(format);
  });
}

function seedTab_(ss, name, log) {
  if (!SEED[name]) return;
  const table = readTable_(ss, name);
  if (table.rows.length) return;
  const today = today_();
  SEED[name].forEach(row => {
    const resolved = {};
    Object.keys(row).forEach(k => {
      resolved[k] = row[k] === '{TODAY}' ? today : row[k] === '{TODAY+12M}' ? addMonths_(today, 12) : row[k];
    });
    appendObj_(table, resolved);
  });
  log.push(`Seeded ${name} (${SEED[name].length} rows)`);
}

function protectTabs_(ss) {
  Object.keys(TABS).concat(['DASHBOARD']).forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).length === 0) {
      sheet.protect()
        .setDescription('SafeLab master tab — normally written by forms/n8n. Edit by hand only if you know why.')
        .setWarningOnly(true);
    }
  });
}

function deleteDefaultSheet_(ss) {
  const sheet = ss.getSheetByName('Sheet1');
  if (sheet && sheet.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sheet);
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------
function ensureForm_(ss, def, log) {
  const props = PropertiesService.getDocumentProperties();
  const propKey = 'FORM_ID_' + def.code;
  const responseTab = def.code + '_RESPONSES';

  // 1) remembered id (only if it still points here), 2) the form linked to Fxx_RESPONSES, 3) create
  let form = openFormById_(props.getProperty(propKey));
  if (form && !destinationIs_(form, ss.getId())) form = null; // e.g. this sheet is a copy
  if (!form) {
    const linked = ss.getSheetByName(responseTab);
    const url = linked ? linked.getFormUrl() : null;
    form = url ? openFormById_(formIdFromUrl_(url)) : null;
  }
  if (form) {
    log.push(`${def.code}: existing form kept`);
  } else {
    form = createForm_(def);
    log.push(`${def.code}: form created`);
  }
  props.setProperty(propKey, form.getId());

  // (Re)link when there is no destination yet or its response tab was deleted.
  if (!destinationIs_(form, ss.getId()) || !findResponseSheet_(ss, form.getId())) {
    try { form.removeDestination(); } catch (e) { /* had none */ }
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  }
  linkResponseSheet_(ss, form, responseTab, log);
  setConfig_(ss, `FORM_${def.code}_URL`, form.getPublishedUrl(), form.getEditUrl());
  return form;
}

function createForm_(def) {
  const form = FormApp.create(def.title);
  form.setDescription(def.description)
    .setCollectEmail(true)
    .setProgressBar(def.items.some(q => q.type === 'page'))
    .setConfirmationMessage('Thank you — SafeLab has recorded your response. You will receive an email if action is needed.');
  def.items.forEach(q => addItem_(form, q));
  try {
    // Newer Forms can be created unpublished; publish if the API supports it.
    if (form.isPublished && !form.isPublished()) form.setPublished(true);
  } catch (e) {
    Logger.log(`Could not publish ${def.code}: ${e}`);
  }
  form.setAcceptingResponses(true);
  return form;
}

function addItem_(form, q) {
  if (q.type === 'section') return form.addSectionHeaderItem().setTitle(q.title);
  if (q.type === 'page') return form.addPageBreakItem().setTitle(q.title);

  let item;
  switch (q.type) {
    case 'text': item = form.addTextItem(); break;
    case 'paragraph': item = form.addParagraphTextItem(); break;
    case 'choice': item = form.addMultipleChoiceItem().setChoiceValues(q.choices); break;
    case 'checkbox': item = form.addCheckboxItem(); break;
    case 'list': item = form.addListItem(); break;
    case 'date': item = form.addDateItem(); break;
    case 'datetime': item = form.addDateTimeItem(); break;
    case 'scale': item = form.addScaleItem().setBounds(1, 5).setLabels(q.labels[0], q.labels[1]); break;
    default: throw new Error(`Unknown question type ${q.type} (${q.title})`);
  }
  if (q.type === 'checkbox' && q.choices) item.setChoiceValues(q.choices);
  item.setTitle(q.title);
  if (q.help) item.setHelpText(q.help);
  item.setRequired(!!q.required);
  if (q.email) item.setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  if (q.percent) item.setValidation(FormApp.createTextValidation().requireNumberBetween(0, 100).build());
  return item;
}

function linkResponseSheet_(ss, form, responseTab, log) {
  for (let attempt = 0; attempt < 10; attempt++) {
    SpreadsheetApp.flush();
    const sheet = findResponseSheet_(ss, form.getId());
    if (sheet) {
      if (sheet.getName() !== responseTab) {
        const clash = ss.getSheetByName(responseTab);
        if (clash) clash.setName(`${responseTab}_OLD_${Date.now()}`);
        sheet.setName(responseTab);
        ss.setActiveSheet(sheet);
        ss.moveActiveSheet(ss.getNumSheets());
        log.push(`Response tab ${responseTab} linked`);
      }
      return sheet;
    }
    Utilities.sleep(1000);
  }
  log.push(`WARNING: response tab for ${responseTab} not found — run Setup again`);
  return null;
}

function findResponseSheet_(ss, formId) {
  return ss.getSheets().find(s => formIdFromUrl_(s.getFormUrl()) === formId) || null;
}

function formIdFromUrl_(url) {
  if (!url) return '';
  const m = /\/forms\/d\/([\w-]+)/.exec(url);
  if (m && m[1] !== 'e') return m[1];
  try {
    return FormApp.openByUrl(url).getId(); // published "/d/e/..." style URL
  } catch (e) {
    return '';
  }
}

function openFormById_(id) {
  if (!id) return null;
  try {
    return FormApp.openById(id);
  } catch (e) {
    return null;
  }
}

function destinationIs_(form, ssId) {
  try {
    return form.getDestinationId() === ssId;
  } catch (e) {
    return false; // no destination set
  }
}

function openForm_(code) {
  return openFormById_(PropertiesService.getDocumentProperties().getProperty('FORM_ID_' + code));
}

// ---------------------------------------------------------------------------
// Dynamic choices (F02 Training, F03 SOP, F04 Escalation conditions)
// ---------------------------------------------------------------------------
function refreshFormChoices() {
  const lines = refreshChoices_(SpreadsheetApp.getActiveSpreadsheet());
  notify_('SafeLab form choices refreshed', lines.join('\n'));
}

function refreshChoices_(ss) {
  const training = readTable_(ss, 'TRAINING_TYPES').rows
    .filter(r => String(r.training_code).trim())
    .map(r => `${String(r.training_code).trim()}${DASH}${String(r.name).trim()}`);
  const sops = readTable_(ss, 'SOP_MASTER').rows
    .filter(r => String(r.sop_id).trim() && String(r.status).trim().toUpperCase() === 'ACTIVE')
    .map(r => `${String(r.sop_id).trim()}${DASH}${String(r.title).trim()}`);
  const rules = readTable_(ss, 'RISK_RULES').rows
    .filter(r => String(r.hazard).trim())
    .map(r => `${String(r.hazard).trim()}: ${String(r.condition).trim()}`)
    .concat([NONE_OF_THESE]);

  return [
    setChoices_('F02', 'list', 'Training', training),
    setChoices_('F03', 'list', 'SOP', sops),
    setChoices_('F04', 'checkbox', 'Escalation conditions', rules),
  ];
}

function setChoices_(code, kind, title, values) {
  const form = openForm_(code);
  if (!form) return `${code}: form not found — run Setup`;
  const type = kind === 'list' ? FormApp.ItemType.LIST : FormApp.ItemType.CHECKBOX;
  const item = form.getItems(type).find(i => i.getTitle() === title);
  if (!item) return `${code}: question "${title}" not found`;
  if (!values.length) return `${code} "${title}": no source rows — choices left unchanged`;
  (kind === 'list' ? item.asListItem() : item.asCheckboxItem()).setChoiceValues(values);
  return `${code} "${title}": ${values.length} choices`;
}

// ---------------------------------------------------------------------------
// DASHBOARD (§6) — labels in A, live formulas in B
// ---------------------------------------------------------------------------
function buildDashboard_(ss) {
  let sheet = ss.getSheetByName('DASHBOARD');
  if (!sheet) sheet = ss.insertSheet('DASHBOARD', 0);
  sheet.clear();
  const rows = dashboardRows_();
  sheet.getRange(1, 1, 2, 1).setValues([['SafeLab dashboard'], ['Live formulas — recalculates automatically. Rebuilt by SafeLab → Setup.']]);
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sheet.getRange(4, 1, 1, 3).setValues([['metric', 'value', 'note']]).setFontWeight('bold');
  sheet.getRange(5, 1, rows.length, 1).setValues(rows.map(r => [r[0]]));
  sheet.getRange(5, 2, rows.length, 1).setFormulas(rows.map(r => [r[1]]));
  sheet.getRange(5, 3, rows.length, 1).setValues(rows.map(r => [r[2] || '']));
  sheet.setColumnWidth(1, 330);
  sheet.setColumnWidth(3, 380);
}

function dashboardRows_() {
  const col = (tab, header) => {
    const letter = colLetter_(TABS[tab].indexOf(header) + 1);
    return `${tab}!${letter}2:${letter}`;
  };
  // Cell may hold a real date or a date-like string (ISO / M/D/YYYY); blank or invalid → 0.
  const asDate = r => `IF(ISNUMBER(${r}),${r},IFERROR(DATEVALUE(${r}),0))`;
  const activeStatuses = '{"PENDING_REVIEW","PENDING_PI","APPROVED","APPROVED_WITH_CONDITIONS","CHANGE_PENDING"}';

  const expStatus = col('EXPERIMENTS', 'status');
  const expLevel = col('EXPERIMENTS', 'inherent_level');
  const trExpiry = asDate(col('TRAINING_RECORDS', 'expires_on'));
  const capaStatus = col('CAPA', 'status');
  const capaDue = asDate(col('CAPA', 'due_date'));
  const sopStatus = col('SOP_MASTER', 'status');
  const sopReview = asDate(col('SOP_MASTER', 'review_date'));
  const activeByLevel = level =>
    `=ARRAYFORMULA(SUM(COUNTIFS(${expLevel},"${level}",${expStatus},${activeStatuses})))`;

  return [
    ['People — ACTIVE', `=COUNTIF(${col('PEOPLE', 'status')},"ACTIVE")`],
    ['Experiments — PENDING_REVIEW', `=COUNTIF(${expStatus},"PENDING_REVIEW")`],
    ['Experiments — PENDING_PI', `=COUNTIF(${expStatus},"PENDING_PI")`],
    ['Experiments — APPROVED*', `=COUNTIF(${expStatus},"APPROVED*")`, 'APPROVED + APPROVED_WITH_CONDITIONS'],
    ['Experiments — REJECTED_INCOMPLETE', `=COUNTIF(${expStatus},"REJECTED_INCOMPLETE")`],
    ['Active experiments — LOW', activeByLevel('LOW'), 'active = pending, approved or change pending; by inherent_level'],
    ['Active experiments — MEDIUM', activeByLevel('MEDIUM')],
    ['Active experiments — HIGH', activeByLevel('HIGH')],
    ['Training records — expiring ≤ 30 days', `=ARRAYFORMULA(SUMPRODUCT((${trExpiry}>=TODAY())*(${trExpiry}<=TODAY()+30)))`],
    ['Training records — expired', `=ARRAYFORMULA(SUMPRODUCT((${trExpiry}>0)*(${trExpiry}<TODAY())))`, 'counts records; a renewed training still leaves its old expired record'],
    ['Incidents — OPEN', `=COUNTIF(${col('INCIDENTS', 'status')},"OPEN")`],
    ['CAPA — OPEN', `=COUNTIF(${capaStatus},"OPEN")`],
    ['CAPA — overdue', `=ARRAYFORMULA(SUMPRODUCT((${capaStatus}="OPEN")*(${capaDue}>0)*(${capaDue}<TODAY())))`],
    ['SOPs — review due ≤ 90 days', `=ARRAYFORMULA(SUMPRODUCT((${sopStatus}="ACTIVE")*(${sopReview}>0)*(${sopReview}<=TODAY()+90)))`, 'ACTIVE SOPs, including overdue reviews'],
  ];
}

function colLetter_(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = (n - m - 1) / 26;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Demo data: makes DEMO_EMAIL fully compliant so a demo F04 passes the checks
// ---------------------------------------------------------------------------
function seedDemoData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const email = DEMO_EMAIL;
  const today = today_();
  const now = nowIso_();
  const year = today.slice(0, 4);
  const log = [];

  // PEOPLE
  const people = readTable_(ss, 'PEOPLE');
  const person = people.rows.find(r => normEmail_(r.email) === email);
  if (!person) {
    appendObj_(people, {
      email, full_name: 'Demo Researcher', role: 'Research assistant', project: 'BESS', supervisor_email: email,
      vn_osh_group: 'Group 4', status: 'ACTIVE', registered_at: now, updated_at: now,
    });
    log.push('PEOPLE: demo person added');
  } else {
    setCell_(people, person, 'status', 'ACTIVE');
    const group = String(person.vn_osh_group).trim();
    if (!group || group === 'Not yet classified') setCell_(people, person, 'vn_osh_group', 'Group 4');
    setCell_(people, person, 'updated_at', now);
    log.push('PEOPLE: demo person set ACTIVE');
  }

  // TRAINING_RECORDS — one valid record per training code (not expiring within 30 days)
  const types = readTable_(ss, 'TRAINING_TYPES').rows.filter(r => String(r.training_code).trim());
  const records = readTable_(ss, 'TRAINING_RECORDS');
  const trIds = records.rows.map(r => r.record_id);
  const okUntil = addDays_(today, 30);
  let added = 0;
  types.forEach(t => {
    const code = String(t.training_code).trim();
    const valid = records.rows.some(r => normEmail_(r.email) === email && String(r.training_code).trim() === code &&
      (String(r.expires_on).trim() === '' || toYmd_(r.expires_on) > okUntil));
    if (valid) return;
    const months = Number(t.validity_months) || 0;
    const id = nextId_('TR', year, trIds);
    trIds.push(id);
    appendObj_(records, {
      record_id: id, email, training_code: code, completed_on: today,
      expires_on: months > 0 ? addMonths_(today, months) : '', quiz_score: 100,
      evidence_url: 'demo data (SafeLab.gs)', recorded_at: now,
    });
    added++;
  });
  log.push(`TRAINING_RECORDS: ${added} added`);

  // SOP_ACK — current version of every ACTIVE SOP
  const sops = readTable_(ss, 'SOP_MASTER').rows.filter(r => String(r.status).trim().toUpperCase() === 'ACTIVE');
  const acks = readTable_(ss, 'SOP_ACK');
  const ackIds = acks.rows.map(r => r.ack_id);
  added = 0;
  sops.forEach(s => {
    const sopId = String(s.sop_id).trim();
    const version = String(s.version).trim();
    const done = acks.rows.some(a => normEmail_(a.email) === email && String(a.sop_id).trim() === sopId &&
      String(a.version).trim() === version);
    if (done) return;
    const id = nextId_('ACK', year, ackIds);
    ackIds.push(id);
    appendObj_(acks, { ack_id: id, email, sop_id: sopId, version, acknowledged_at: now });
    added++;
  });
  log.push(`SOP_ACK: ${added} added`);

  // EQUIPMENT — demo person authorized on both demo devices
  const equipment = readTable_(ss, 'EQUIPMENT');
  DEMO_EQUIPMENT_IDS.forEach(eqId => {
    const row = equipment.rows.find(r => String(r.equipment_id).trim() === eqId);
    if (!row) {
      appendObj_(equipment, SEED.EQUIPMENT.find(r => r.equipment_id === eqId));
      log.push(`EQUIPMENT: ${eqId} re-added`);
      return;
    }
    const users = String(row.authorized_users).split(/[,;\n]/).map(normEmail_).filter(Boolean);
    if (users.indexOf(email) === -1) {
      const current = String(row.authorized_users).trim();
      setCell_(equipment, row, 'authorized_users', current ? `${current}, ${email}` : email);
      log.push(`EQUIPMENT: ${email} authorized on ${eqId}`);
    }
  });

  audit_(ss, 'SEED_DEMO', 'PEOPLE', email, log.join(' | '));
  notify_('SafeLab demo data', log.join('\n'));
}

// ---------------------------------------------------------------------------
// Form links dialog
// ---------------------------------------------------------------------------
function showFormLinks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = {};
  readTable_(ss, 'CONFIG').rows.forEach(r => { config[String(r.key).trim()] = r; });
  const items = FORMS.map(def => {
    const row = config[`FORM_${def.code}_URL`] || {};
    const url = String(row.value || '');
    const edit = String(row.note || '');
    const link = url ? `<a href="${esc_(url)}" target="_blank">${esc_(url)}</a>` : '<i>not created — run Setup</i>';
    const editLink = /^https?:/.test(edit) ? ` &middot; <a href="${esc_(edit)}" target="_blank">edit</a>` : '';
    return `<li><b>${esc_(def.title)}</b><br>${link}${editLink}</li>`;
  });
  const html = `<div style="font-family:Arial,sans-serif;font-size:13px">
    <ol style="padding-left:18px;line-height:1.5">${items.join('')}</ol>
    <p>Sheet: ${esc_(String((config.SHEET_URL || {}).value || ''))}</p></div>`;
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(720).setHeight(480), 'SafeLab form links');
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function readTable_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Tab ${name} is missing — run SafeLab → Setup first`);
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(h => String(h).trim());
  const rows = values.slice(1)
    .map((v, i) => {
      const row = { _row: i + 2 };
      headers.forEach((h, j) => { if (h) row[h] = v[j]; });
      return row;
    })
    .filter(row => headers.some(h => h && row[h] !== '' && row[h] !== null && row[h] !== undefined));
  return { sheet, headers, rows };
}

function appendObj_(table, obj) {
  const values = table.headers.map(h => (obj[h] === undefined || obj[h] === null ? '' : obj[h]));
  table.sheet.appendRow(values);
  table.rows.push(Object.assign({ _row: table.sheet.getLastRow() }, obj));
}

function setCell_(table, row, header, value) {
  const col = table.headers.indexOf(header) + 1;
  if (col < 1) throw new Error(`Column ${header} missing`);
  table.sheet.getRange(row._row, col).setValue(value);
  row[header] = value;
}

function setConfig_(ss, key, value, note) {
  const table = readTable_(ss, 'CONFIG');
  const row = table.rows.find(r => String(r.key).trim() === key);
  if (!row) {
    appendObj_(table, { key, value, note: note || '' });
    return;
  }
  setCell_(table, row, 'value', value);
  if (note !== undefined) setCell_(table, row, 'note', note);
}

function audit_(ss, action, entity, entityId, details) {
  const table = readTable_(ss, 'AUDIT_LOG');
  appendObj_(table, { ts: nowIso_(), actor: 'SafeLab.gs', action, entity, entity_id: entityId, details: String(details).slice(0, 45000) });
}

function nextId_(prefix, year, existing) {
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  const max = existing.reduce((m, id) => {
    const match = re.exec(String(id).trim());
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

function normEmail_(s) {
  return String(s || '').trim().toLowerCase();
}

function today_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function nowIso_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

// Date cell (Date object) or ISO / M/D/YYYY string → 'YYYY-MM-DD' ('' if unknown).
function toYmd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return '';
}

function addMonths_(ymd, months) {
  const [y, m, d] = ymd.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

function addDays_(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function notify_(title, message) {
  Logger.log(`${title}\n${message}`);
  try {
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // Run from the script editor with no open sheet UI — the log above is enough.
  }
}
