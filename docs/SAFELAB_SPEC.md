# SafeLab MVP — Build Spec (contract)

This is the single source of truth that every component is built against. It is a deliberately
simple implementation of [notion/proposed-safety-platform.md](notion/proposed-safety-platform.md)
(build-order steps 1–6 + 8: Forms, Master Sheet, Personnel/Training/SOP, Experiment risk form,
risk rules + compliance checks, approval workflow, incident/CAPA).

**Stack:** Google Forms + Google Sheets (via one Apps Script) → n8n (Docker, SQLite) → Gmail.
No custom web app, no extra database.

**Out of scope for MVP** (documented as next steps): Google Site page, Looker Studio dashboard
(a simple `DASHBOARD` tab with formulas is provided instead), PDF generation, SOP_RELEASE workflow,
QR codes, conditional per-hazard form sections.

**Demo email:** every role in `CONFIG` and the demo person use `quangdinh2102@gmail.com`.

---

## 1. Repository layout

```text
safelab/
  docker-compose.yml          n8n (single container, SQLite volume)
  .env.example
  google/
    SafeLab.gs                Apps Script: builds workbook + 7 forms + dashboard + demo data
    appsscript.json
  n8n/
    package.json              "test": "node --test"   (no dependencies)
    lib/safelab.js            pure logic library (risk, compliance, ids, tokens, html)
    test/safelab.test.js      node:test unit tests
    build.mjs                 injects lib + sheet id into workflows → workflows/dist/
    workflows/src/*.json      workflow sources (contain placeholders)
    workflows/dist/*.json     generated, importable into n8n
docs/
  SAFELAB_SPEC.md             this file
  USER_GUIDE.md               setup + usage guide
  notion/                     exported design pages
```

---

## 2. Conventions

- **Dates** written by n8n: `YYYY-MM-DD`; timestamps: ISO 8601. The spreadsheet locale is set to
  `en_US` and timezone `Asia/Ho_Chi_Minh`, so values read back may be `M/D/YYYY` or
  `M/D/YYYY H:mm:ss`. `SafeLab.parseDate` must accept ISO, `M/D/YYYY` and `M/D/YYYY H:mm:ss`.
- **Emails** are compared lower-cased and trimmed.
- **Lists in a cell** (emails, SOP ids, equipment ids, training codes): separated by comma,
  semicolon or newline.
- **Risk levels:** `LOW` < `MEDIUM` < `HIGH`.
- **IDs:** `EXP-YYYY-NNNN`, `INC-YYYY-NNNN`, `CAPA-YYYY-NNNN`, `TR-YYYY-NNNN`, `ACK-YYYY-NNNN`,
  `APR-YYYY-NNNN` (4-digit zero-padded, sequence per prefix per year = max existing + 1).
- Every workflow appends at least one row to `AUDIT_LOG`.

---

## 3. Workbook `SAFELAB_MASTER` — tabs and exact headers

Row 1 = headers exactly as below. Tabs marked *(seed)* get initial rows from the Apps Script.

| Tab | Headers |
|---|---|
| `CONFIG` *(seed)* | `key`, `value`, `note` |
| `PEOPLE` | `email`, `full_name`, `role`, `project`, `supervisor_email`, `vn_osh_group`, `status`, `registered_at`, `updated_at` |
| `PROJECTS` *(seed)* | `project_code`, `name`, `lead_email` |
| `LABS` *(seed)* | `lab_code`, `name`, `room`, `zone` |
| `EQUIPMENT` *(seed)* | `equipment_id`, `name`, `lab_code`, `owner_email`, `sop_id`, `status`, `authorized_users`, `required_training` |
| `TRAINING_TYPES` *(seed)* | `training_code`, `name`, `validity_months`, `required_for`, `link` |
| `TRAINING_RECORDS` | `record_id`, `email`, `training_code`, `completed_on`, `expires_on`, `quiz_score`, `evidence_url`, `recorded_at` |
| `SOP_MASTER` *(seed)* | `sop_id`, `title`, `version`, `owner_email`, `status`, `effective_date`, `review_date`, `doc_url` |
| `SOP_ACK` | `ack_id`, `email`, `sop_id`, `version`, `acknowledged_at` |
| `EXPERIMENTS` | see §3.1 |
| `APPROVALS` | `approval_id`, `exp_id`, `stage`, `reviewer_email`, `decision`, `comment`, `decided_at` |
| `CHEMICALS` | `exp_id`, `cas`, `name`, `quantity`, `unit`, `registered`, `vn_listed`, `hazardous`, `special_control`, `flags`, `recorded_at` |
| `VN_CHEMICAL_REGISTER` *(seed)* | `cas`, `name_en`, `name_vi`, `vn_listed`, `hazardous`, `special_control`, `threshold_kg`, `legal_ref`, `note` |
| `RISK_RULES` *(seed)* | `rule_id`, `hazard`, `condition`, `min_level` |
| `INCIDENTS` | `incident_id`, `type`, `occurred_at`, `lab`, `reporter_email`, `description`, `injury`, `severity`, `immediate_action`, `related_exp_id`, `status`, `reported_at` |
| `CAPA` | `capa_id`, `source`, `source_id`, `action`, `owner_email`, `due_date`, `status`, `created_at`, `closed_at` |
| `PCCC_RECORDS` | `record_id`, `type`, `date`, `description`, `doc_url`, `next_due` |
| `LEGAL_REGISTER` *(seed)* | `code`, `regulation`, `area`, `requirement`, `record` |
| `AUDIT_LOG` | `ts`, `actor`, `action`, `entity`, `entity_id`, `details` |
| `DASHBOARD` | formulas only (see §6) |
| `F01_RESPONSES` … `F07_RESPONSES` | created by the linked Google Forms (§4) |

Enumerations:

- `PEOPLE.status`: `ACTIVE` | `INACTIVE`
- `EQUIPMENT.status`: `GREEN` (authorized users) | `YELLOW` (supervisor required) | `RED` (out of service)
- `SOP_MASTER.status`: `ACTIVE` | `DRAFT` | `RETIRED`
- `TRAINING_TYPES.validity_months`: integer; blank or `0` = never expires
- `TRAINING_TYPES.required_for`: `ALL`, or comma-separated hazard names from §4 F04 *Hazards*
- `APPROVALS.stage`: `REVIEW` | `PI`
- `APPROVALS.decision`: `APPROVE` | `APPROVE_WITH_CONDITIONS` | `CHANGES_REQUIRED` | `REJECT`
- `INCIDENTS.status`, `CAPA.status`: `OPEN` | `CLOSED`

### 3.1 `EXPERIMENTS` headers

```text
exp_id, title, project, pi_name, leader_email, researcher_emails, lab, start_date, end_date,
sop_ids, equipment_ids, hazards, escalation_conditions, hazard_details, chemicals_raw, sds_uploaded,
severity, likelihood, initial_score, calc_level, min_level, inherent_level, matched_rules,
controls, residual_severity, residual_likelihood, residual_score, residual_level,
emergency_procedure, legal_flags, compliance_summary, reviewer_email,
current_stage, status, submitted_by, submitted_at, updated_at
```

`status` values:

| status | meaning | current_stage |
|---|---|---|
| `REJECTED_INCOMPLETE` | failed automatic checks, never reached a human | `` |
| `PENDING_REVIEW` | waiting for reviewer (by inherent level) | `REVIEW` |
| `PENDING_PI` | reviewer approved, waiting for Dr. Simon Park | `PI` |
| `APPROVED` / `APPROVED_WITH_CONDITIONS` | final | `` |
| `CHANGES_REQUIRED` / `REJECTED` | final for this submission (resubmit F04) | `` |
| `CHANGE_PENDING` | an F05 modification adding hazards/people/equipment was filed | `` |

### 3.2 Seed data

**CONFIG**

| key | value | note |
|---|---|---|
| `PI_NAME` | `Dr. Simon Park` | Final internal approver |
| `PI_EMAIL` | `quangdinh2102@gmail.com` | demo |
| `SAFETY_COORDINATOR_EMAIL` | `quangdinh2102@gmail.com` | incidents, CAPA, training summary |
| `SUPERVISOR_EMAIL` | `quangdinh2102@gmail.com` | reviewer for LOW |
| `SAFETY_REVIEWER_EMAIL` | `quangdinh2102@gmail.com` | reviewer for MEDIUM |
| `EHS_REVIEWER_EMAIL` | `quangdinh2102@gmail.com` | reviewer for HIGH |
| `EXPIRY_WARNING_DAYS` | `30` | training expiry reminder window |
| `SHEET_URL` | *(filled by setup)* | |
| `FORM_F01_URL` … `FORM_F07_URL` | *(filled by setup)* | public form links |

**TRAINING_TYPES**

| training_code | name | validity_months | required_for |
|---|---|---|---|
| `CORE` | Core lab safety (videos A + quiz) | 12 | `ALL` |
| `VN-OSH` | Vietnam OSH training (Decree 44/2016) | 24 | `ALL` |
| `FIRE` | Fire safety / PCCC | 12 | `ALL` |
| `E1` | Electrical safety E1 | 24 | `High voltage, High current, Stored energy` |
| `E2` | Electrical safety E2 (hazardous energy) | 24 | `High voltage, High current` |
| `M1` | Fabrication shop M1 | 24 | `Rotating machinery` |
| `C1` | Chemical safety C1 | 12 | `Chemical, Flammable material, Toxic material, Corrosive, Electroplating` |
| `C3` | Compressed gas C3 | 12 | `Gas, Hydrogen` |
| `BAT` | Li-ion battery safety | 24 | `Battery` |
| `N1` | Nanomaterials N1 | 24 | *(blank — assigned via equipment)* |

`link` = the matching playlist URL from [notion/videos-to-watch.md](notion/videos-to-watch.md) (first video is enough).

**RISK_RULES** (form label for each rule = `"<hazard>: <condition>"`)

| rule_id | hazard | condition | min_level |
|---|---|---|---|
| RR-01 | Li-ion | deliberate thermal runaway | HIGH |
| RR-02 | Battery | penetration/crush/overcharge | HIGH |
| RR-03 | Hydrogen | intentional generation | HIGH |
| RR-04 | Flammable gas | significant quantity | HIGH |
| RR-05 | Laser | Class 3B/4 | HIGH |
| RR-06 | High voltage | exposed conductors | MEDIUM |
| RR-07 | High pressure | above lab threshold | HIGH |
| RR-08 | Toxic chemical | above specified limit | HIGH |
| RR-09 | Rotating equipment | exposed high energy | MEDIUM |
| RR-10 | Drone | outdoor autonomous flight | MEDIUM |
| RR-11 | Routine FDM printing | enclosed standard operation | LOW |

(The Notion page lists high pressure as "MEDIUM/HIGH"; the MVP takes the conservative HIGH.)

**LEGAL_REGISTER** — the 7 rows of the Notion table (§23 of the proposal).

**VN_CHEMICAL_REGISTER** — **SAMPLE rows for demo only; must be verified against Decree 24/2026
before real use** (`note` column says so on every row):

| cas | name_en | name_vi | vn_listed | hazardous | special_control | threshold_kg | legal_ref |
|---|---|---|---|---|---|---|---|
| 67-56-1 | Methanol | Metanol | YES | YES | NO | 100 | Decree 24/2026 (verify) |
| 64-17-5 | Ethanol | Etanol | YES | YES | NO | | Decree 24/2026 (verify) |
| 67-64-1 | Acetone | Axeton | YES | YES | NO | | Decree 24/2026 (verify) |
| 7647-01-0 | Hydrochloric acid | Axit clohydric | YES | YES | NO | | Decree 24/2026 (verify) |
| 7664-93-9 | Sulfuric acid | Axit sunfuric | YES | YES | YES | 50 | Decree 24/2026 (verify) |
| 7697-37-2 | Nitric acid | Axit nitric | YES | YES | YES | 50 | Decree 24/2026 (verify) |
| 1333-74-0 | Hydrogen | Hydro | YES | YES | YES | 1 | Decree 24/2026 (verify) |

**SOP_MASTER**: `SOP-GEN-01` General Lab Rules v1.0 ACTIVE; `SOP-ESP-01` Electrical Safety SOP v1.0 ACTIVE
(owner = demo email, effective today, review +12 months).

**PROJECTS**: `BESS`, `PipeSnake`, `FeelGripper`, `NanoSense` (lead = demo email).
**LABS**: `LAB-A` Clean/Electrical, `LAB-D` Wet Chemical, `LAB-E` Materials (zones A/D/E from the checklist).
**EQUIPMENT**: `EQ-PSU-01` Bench power supply (LAB-A, SOP-ESP-01, GREEN, authorized: demo email, required_training `E1`);
`EQ-FURN-01` Tube furnace (LAB-E, SOP-GEN-01, YELLOW, authorized: demo email, required_training blank).

---

## 4. Google Forms — exact question titles

All forms: `setCollectEmail(true)` → response column `Email Address`; first column `Timestamp`.
Response tab for form `Fxx` is renamed to `Fxx_RESPONSES`. **n8n reads columns by these exact titles.**

### F01 Personnel Registration
| Title | Type | Req |
|---|---|---|
| `Full name` | text | ✓ |
| `Role` | multiple choice: Student, UROP student, Research assistant, Staff, Faculty | ✓ |
| `Project` | text | |
| `Supervisor email` | text | |
| `Vietnam OSH training group` | multiple choice: Group 1 … Group 6, Not yet classified | ✓ |

### F02 Training Record
| Title | Type | Req |
|---|---|---|
| `Training` | dropdown: `"<training_code> — <name>"` from TRAINING_TYPES | ✓ |
| `Completion date` | date | ✓ |
| `Quiz score (%)` | text | |
| `Evidence link` | text | |

### F03 SOP Acknowledgement
| Title | Type | Req |
|---|---|---|
| `SOP` | dropdown: `"<sop_id> — <title>"` for ACTIVE SOPs | ✓ |
| `Acknowledgement` | checkbox: `I have read and understood the current version of this SOP` | ✓ |

### F04 Experimental Safety Approval
Section *Identification*:
| Title | Type | Req |
|---|---|---|
| `Experiment title` | text | ✓ |
| `Project` | text | ✓ |
| `Principal Investigator` | text | ✓ |
| `Experiment leader email` | text | ✓ |
| `Researcher emails (comma-separated)` | text | ✓ |
| `Lab / room` | text | ✓ |
| `Start date` | date | ✓ |
| `Expected completion` | date | ✓ |
| `Related SOP IDs (comma-separated)` | text | |
| `Equipment IDs (comma-separated)` | text | |

Section *Hazards*:
| Title | Type | Req |
|---|---|---|
| `Hazards` | checkbox: Chemical, Flammable material, Toxic material, Corrosive, Battery, High voltage, High current, Pressure, Vacuum, Elevated temperature, Cryogenic, Laser, Gas, Hydrogen, Rotating machinery, Stored energy, 3D printing, Electroplating, Drone, Radiation, Other | ✓ |
| `Escalation conditions` | checkbox: one per RISK_RULES row `"<hazard>: <condition>"` + `None of these` | ✓ |
| `Hazard details` | paragraph (battery chemistry/capacity/voltage, gas, laser class, …) | |

Section *Chemicals*:
| Title | Type | Req |
|---|---|---|
| `Chemicals (one per line: CAS, name, quantity, unit)` | paragraph | |
| `SDS uploaded for all chemicals?` | multiple choice: Yes, No, Not applicable | ✓ |

Section *Risk assessment*:
| Title | Type | Req |
|---|---|---|
| `Severity (1-5)` | scale 1–5 (Negligible … Catastrophic) | ✓ |
| `Likelihood (1-5)` | scale 1–5 (Rare … Frequent) | ✓ |
| `Controls` | paragraph | ✓ |
| `Residual severity (1-5)` | scale 1–5 | ✓ |
| `Residual likelihood (1-5)` | scale 1–5 | ✓ |
| `Emergency procedure` | paragraph | ✓ |
| `Legal acknowledgement` | checkbox: `I understand that PI approval does not replace external permits or institutional EHS approvals required by law` | ✓ |

Chemical line example: `67-56-1, Methanol, 2, kg`. Units understood for threshold checks: `kg`, `g`
(others → flag "quantity unit not comparable — check threshold manually").

### F05 Experiment Modification
| Title | Type | Req |
|---|---|---|
| `Experiment ID` | text | ✓ |
| `What is changing?` | paragraph | ✓ |
| `Does the change add new hazards, chemicals, people or equipment?` | multiple choice: Yes, No | ✓ |

### F06 Incident / Near Miss
| Title | Type | Req |
|---|---|---|
| `Type` | multiple choice: Incident, Near miss, Unsafe condition | ✓ |
| `Date and time of event` | date-time | ✓ |
| `Lab / room` | text | ✓ |
| `What happened?` | paragraph | ✓ |
| `Was anyone injured?` | multiple choice: Yes, No | ✓ |
| `Severity` | multiple choice: LOW, MEDIUM, HIGH | ✓ |
| `Immediate action taken` | paragraph | |
| `Related experiment ID` | text | |

### F07 Safety Inspection / CAPA
| Title | Type | Req |
|---|---|---|
| `Lab / room` | text | ✓ |
| `Inspection date` | date | ✓ |
| `Findings` | paragraph | ✓ |
| `Corrective action required` | paragraph | |
| `Action owner email` | text | |
| `Due date` | date | |

---

## 5. Library `safelab/n8n/lib/safelab.js`

Plain ES2020, **no top-level `require`**, no `import`/`export`. Wrapped as:

```js
const SafeLab = (function () {
  // ...
  return { /* public API */ };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SafeLab;
```

`build.mjs` pastes the whole file into n8n Code nodes in place of the line `/*@@SAFELAB_LIB@@*/`,
so code nodes call `SafeLab.xxx(...)`. `crypto` is required lazily inside the token functions
(n8n runs with `NODE_FUNCTION_ALLOW_BUILTIN=crypto`).

Public API (all pure, `today` is always passed in as `YYYY-MM-DD`):

| Function | Returns |
|---|---|
| `LEVELS` | `['LOW','MEDIUM','HIGH']` |
| `scoreToLevel(score)` | 1–4 LOW, 5–12 MEDIUM, 13–25 HIGH; invalid → `null` |
| `maxLevel(...levels)` | highest; ignores falsy |
| `parseList(str)` | trimmed, de-duplicated array (split on `,` `;` newline) |
| `parseEmails(str)` | `parseList` + lower-case |
| `parseDate(str)` | `YYYY-MM-DD` or `''` (accepts ISO, `M/D/YYYY`, `M/D/YYYY H:mm:ss`, Date objects) |
| `addMonths(dateStr, n)` | `YYYY-MM-DD` |
| `daysBetween(a, b)` | integer `b - a` in days |
| `nextId(prefix, year, existingIds)` | e.g. `nextId('EXP', 2026, ['EXP-2026-0007']) → 'EXP-2026-0008'` |
| `normalizeExperiment(row)` | maps an `F04_RESPONSES` row (titles in §4) to the experiment object below |
| `parseChemicals(text)` | `[{cas, name, quantity:Number|null, unit, raw, parseError:bool}]` |
| `assessRisk(exp, riskRules, chemRegister)` | risk object below |
| `checkCompliance(exp, risk, data, today)` | `{ ok, checks:[{id,label,status:'PASS'|'WARN'|'FAIL',detail}] }` |
| `reviewerKeyFor(level)` | `LOW→'SUPERVISOR_EMAIL'`, `MEDIUM→'SAFETY_REVIEWER_EMAIL'`, `HIGH→'EHS_REVIEWER_EMAIL'` |
| `configMap(rows)` | `{key: value}` from CONFIG rows |
| `nextState(exp, stage, decision)` | `{ ok, error?, status, current_stage }` (§5.3) |
| `makeToken(secret, expId, stage)` | first 32 hex chars of HMAC-SHA256(secret, `${expId}|${stage}`) |
| `verifyToken(secret, expId, stage, token)` | boolean (constant-time compare) |
| `trainingExpiry(completedOn, validityMonths)` | `YYYY-MM-DD` or `''` (never expires) |
| `expiringTraining(records, trainingTypes, today, days)` | latest record per (email, code) whose expiry ≤ today+days: `[{email, training_code, name, expires_on, days_left, status:'EXPIRING'|'EXPIRED'}]` |
| `escapeHtml(s)` | |
| `experimentSummaryHtml(exp, risk, compliance, extra?)` | HTML block (table) for emails/pages; all user text escaped |
| `toExperimentRow(exp, risk, compliance, fields)` | flat object with the §3.1 headers (arrays joined with `, `, flags with `; `) |

### 5.1 Experiment object (`normalizeExperiment`)

```js
{
  submitted_at, submitted_by,            // Timestamp, Email Address
  title, project, pi_name, leader_email,
  researcher_emails: [],                 // includes leader_email, de-duplicated
  lab, start_date, end_date,             // YYYY-MM-DD
  sop_ids: [], equipment_ids: [],
  hazards: [], escalation_conditions: [],// 'None of these' removed
  hazard_details, chemicals_raw, sds_uploaded,  // 'Yes' | 'No' | 'Not applicable'
  severity, likelihood, residual_severity, residual_likelihood, // Number or null
  controls, emergency_procedure,
  legal_ack: boolean
}
```

### 5.2 `assessRisk` rules

```js
{
  initial_score,            // severity × likelihood
  calc_level,               // scoreToLevel(initial_score)
  matched_rules: [{rule_id, label, min_level}],   // label = "<hazard>: <condition>" matched to escalation_conditions
  chemicals: [{cas, name, quantity, unit, registered, vn_listed, hazardous, special_control,
               threshold_kg, threshold_exceeded, flags: []}],
  chem_min_level,           // hazardous YES → MEDIUM; special_control YES or threshold exceeded → HIGH
  min_level,                // max(matched rule levels, chem_min_level)
  inherent_level,           // maxLevel(calc_level, min_level)   ← "Final Risk = MAX(calculated, mandatory minimum)"
  residual_score, residual_level,
  route_level,              // = inherent_level (residual never lowers the route)
  legal_flags: []           // human-readable strings, e.g.
                            // "67-56-1 Methanol: on VN chemical list (Decree 24/2026 — verify)"
                            // "1333-74-0 Hydrogen: quantity exceeds threshold 1 kg — chemical emergency plan required (Decree 25/2026)"
                            // "99-99-9: not in VN_CHEMICAL_REGISTER — manual legal check required"
                            // HIGH route always adds: "PI approval is the final INTERNAL approval only; external permits/EHS approvals still required"
}
```

Threshold: compare only when unit is `kg` or `g` (g ÷ 1000) and `threshold_kg` is set.

### 5.3 Compliance checks (`checkCompliance`)

`data = { people, trainingTypes, trainingRecords, sops, sopAcks, equipment }` (arrays of row
objects with the §3 headers). People checked = `exp.researcher_emails`.

| id | label | FAIL when | WARN when |
|---|---|---|---|
| `registered` | Researchers registered | any email not in PEOPLE with status ACTIVE | |
| `osh_group` | Vietnam OSH group classified | | `vn_osh_group` blank or `Not yet classified` |
| `training` | Required training valid | a required training has no record with `expires_on` ≥ today (or never-expiring) | a required training expires within 30 days |
| `sop` | Current SOP acknowledged | a listed SOP (exp.sop_ids ∪ equipment.sop_id) is missing/not ACTIVE, or a person has no SOP_ACK for its **current** version | |
| `equipment` | Equipment authorization | equipment unknown, status RED, or a person not in `authorized_users` | status YELLOW (supervisor required) |
| `sds` | Chemical SDS available | chemicals listed and `sds_uploaded` ≠ `Yes` | |
| `chemical_legal` | Chemical legal check | a chemical line has a parse error | unregistered CAS, or any legal flag |
| `risk_complete` | Risk assessment complete | severity/likelihood/residual missing, or controls/emergency procedure blank | residual score > initial score |
| `legal_ack` | External approvals acknowledged | `legal_ack` false | |

Required trainings per person = TRAINING_TYPES rows with `required_for` = `ALL` or intersecting
`exp.hazards` (case-insensitive) ∪ `required_training` of each listed equipment.
`ok` = no FAIL. A FAIL → status `REJECTED_INCOMPLETE`; the experiment never reaches a reviewer.

### 5.4 Approval state machine (`nextState`)

| current status | stage | decision | → status | → current_stage |
|---|---|---|---|---|
| `PENDING_REVIEW` | `REVIEW` | `APPROVE` / `APPROVE_WITH_CONDITIONS` | `PENDING_PI` | `PI` |
| `PENDING_REVIEW` | `REVIEW` | `CHANGES_REQUIRED` | `CHANGES_REQUIRED` | `` |
| `PENDING_REVIEW` | `REVIEW` | `REJECT` | `REJECTED` | `` |
| `PENDING_PI` | `PI` | `APPROVE` | `APPROVED` | `` |
| `PENDING_PI` | `PI` | `APPROVE_WITH_CONDITIONS` | `APPROVED_WITH_CONDITIONS` | `` |
| `PENDING_PI` | `PI` | `CHANGES_REQUIRED` | `CHANGES_REQUIRED` | `` |
| `PENDING_PI` | `PI` | `REJECT` | `REJECTED` | `` |
| anything else | | | `ok:false, error:'Experiment is not awaiting this decision'` | |

`APPROVE_WITH_CONDITIONS` and `CHANGES_REQUIRED` require a non-empty comment (enforced in the workflow).

---

## 6. `DASHBOARD` tab (Apps Script, formulas only)

Small KPI block, recalculates live: people ACTIVE; experiments by status (PENDING_REVIEW,
PENDING_PI, APPROVED*, REJECTED_INCOMPLETE); active experiments by inherent level (LOW/MEDIUM/HIGH);
training records expiring ≤ 30 days and expired; open incidents; open CAPA and overdue CAPA;
SOPs due for review ≤ 90 days. Labels in column A, formulas in column B. (Looker Studio can be
pointed at the workbook later.)

---

## 7. n8n

### 7.1 Environment (`docker-compose.yml`)

```text
N8N_HOST=localhost, N8N_PORT=5678, N8N_PROTOCOL=http, WEBHOOK_URL=${SAFELAB_PUBLIC_URL}/
GENERIC_TIMEZONE=Asia/Ho_Chi_Minh, TZ=Asia/Ho_Chi_Minh
N8N_ENCRYPTION_KEY, SAFELAB_SECRET, SAFELAB_PUBLIC_URL (default http://localhost:5678)
NODE_FUNCTION_ALLOW_BUILTIN=crypto
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

Code nodes read `$env.SAFELAB_SECRET` and `$env.SAFELAB_PUBLIC_URL`.

### 7.2 Credentials (created by the user in the n8n UI, referenced by name)

| Credential name | Type | Used by |
|---|---|---|
| `SafeLab Google Sheets` | `googleSheetsOAuth2Api` | Google Sheets nodes |
| `SafeLab Sheets Trigger` | `googleSheetsTriggerOAuth2Api` | Google Sheets Trigger nodes |
| `SafeLab Gmail` | `gmailOAuth2` | Gmail nodes (`appendAttribution: false`) |

Workflow sources use credential id placeholders `__CRED_SHEETS__`, `__CRED_SHEETS_TRIGGER__`,
`__CRED_GMAIL__` with the names above; the document id placeholder is `__SAFELAB_SHEET_ID__`.
`node build.mjs --sheet-id <ID>` (or env `SAFELAB_SHEET_ID`) writes `workflows/dist/`.

### 7.3 Workflows

Intake is by **Google Sheets Trigger (poll every minute, event "row added")** on the `Fxx_RESPONSES`
tab — no public URL needed for form intake. Read-all-rows Sheets nodes use **Execute Once** and
**Always Output Data**; Code nodes filter out the empty item.

| File | Trigger | Behaviour |
|---|---|---|
| `01_person_onboard.json` | F01 row | upsert PEOPLE by email (status ACTIVE), audit, welcome email listing required trainings (`required_for = ALL`) and the F02/F03 form URLs from CONFIG |
| `02_training_record.json` | F02 row | parse code from `"<code> — <name>"`, compute `expires_on` via `trainingExpiry`, append TRAINING_RECORDS (`TR-` id), audit, confirmation email |
| `03_training_expiry.json` | schedule daily 08:00 | `expiringTraining(..., EXPIRY_WARNING_DAYS)`; one email per person + one summary to SAFETY_COORDINATOR_EMAIL; nothing sent if empty; audit |
| `05_sop_ack.json` | F03 row | parse sop_id, look up **current version** in SOP_MASTER, append SOP_ACK (`ACK-` id), audit |
| `06_experiment_submit.json` | F04 row | `normalizeExperiment` → `nextId('EXP')` → `assessRisk` → `checkCompliance` → append EXPERIMENTS + CHEMICALS rows → **FAIL**: status `REJECTED_INCOMPLETE`, email submitter+leader with the failed checks. **PASS**: status `PENDING_REVIEW`, reviewer = CONFIG[`reviewerKeyFor(route_level)`], email reviewer the summary + link `${SAFELAB_PUBLIC_URL}/webhook/safelab-decision?exp=…&stage=REVIEW&token=…`, email leader "received, ID, inherent/residual level, next step". Audit. |
| `07_experiment_decision.json` | Webhook `GET /webhook/safelab-decision` + `POST /webhook/safelab-decision` | **GET**: verify token, load experiment, respond with an HTML page (summary + decision radio buttons + comment textarea + submit) — no state change (email scanners prefetch links). **POST** (form-urlencoded `exp, stage, token, decision, comment`): verify token, `nextState`, require comment for conditions/changes, update EXPERIMENTS row, append APPROVALS (`APR-` id) + audit. REVIEW→PI: email PI (Dr. Simon Park) the "SAFELAB – FINAL APPROVAL" summary with link `stage=PI` and the reviewer's decision/comment. Final: email leader + reviewer the outcome (HIGH adds the external-permit reminder). Respond with a confirmation HTML page. Invalid token / wrong state → 4xx HTML page. |
| `08_experiment_change.json` | F05 row | find experiment; if not found email submitter; if "Yes" set status `CHANGE_PENDING` and email reviewer + PI + leader ("new F04 required"); if "No" email reviewer FYI; audit |
| `09_incident_capa.json` | F06 row **and** F07 row (two triggers) | F06: `INC-` id, append INCIDENTS (OPEN), auto-create CAPA "Investigate <INC> and define corrective action" owner = SAFETY_COORDINATOR_EMAIL due +14 days, email coordinator; if injured = Yes or severity HIGH also email PI with subject prefix `[URGENT]`. F07: if `Corrective action required` non-empty append CAPA (source INSPECTION, owner = `Action owner email` or coordinator) and email owner. Audit both. |

Email subjects start with `[SafeLab]`. All user-supplied text in HTML is escaped.
