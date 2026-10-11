# Proposed Safety Platform — VinUni SafeLab

> Source: Notion — *VinUni - Ontology / Safety Checklist / Proposed Safety Platform* (Oct 2)
> https://app.notion.com/p/3bfc26401786823c855001fe5d48d466
> Exported: 2026-10-11

The lowest-effort architecture is:

**Google Sites + Google Forms + Google Sheets + Google Drive + n8n + Gmail + Looker Studio**

No custom web application is necessary initially.

### Vietnamese compliance context

- **OSH training** — Decree 44/2016/NĐ-CP remains partly in force and distinguishes six training groups, with training, retraining and record requirements. ([VBPL](https://vbpl.vn/TW/Pages/vbpq-thuoctinh.aspx?ItemID=117760))
- **Fire safety** — the 2024 Fire Prevention, Firefighting and Rescue Law (effective July 1, 2025) and Decree 105/2025/NĐ-CP require establishments to maintain fire-safety rules, plans, training records, inspection records and related documentation. ([VBPL](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=173974))
- **Chemicals** — Chemical Law 69/2025/QH15 and the 2026 implementing decrees are in effect: Decree 24/2026 defines chemical lists; Decrees 25/2026 and 26/2026 cover chemical safety/security and chemical activities. ([VBPL](https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=186571))

---

## 1. What to build

# **VinUni SafeLab**
### Research Safety, Training & Experimental Approval System

Home screen is a Google Site:

```text
────────────────────────────────────────────────
                 VINUNI SAFELAB
       Research Safety & Experiment Approval
────────────────────────────────────────────────

 MY SAFETY
 [ My Training ]       [ My SOPs ]
 [ My Experiments ]    [ My Authorization ]

 SUBMIT
 [ New Experiment ]
 [ Training Record ]
 [ SOP Acknowledgement ]
 [ Experiment Change ]
 [ Incident / Near Miss ]

 SAFETY RESOURCES
 [ Active SOPs ]
 [ Emergency Procedures ]
 [ Chemical SDS ]
 [ Equipment Safety ]

                       Dr. Simon Park
                       Final Approver
────────────────────────────────────────────────
```

Google Sites is useful because students see **one website**, not a collection of random Forms and Sheets.

---

## 2. Approval structure

**Dr. Simon Park is the final internal approver for every experiment**, but not the only reviewer.

### Low risk

```text
Researcher → Automatic compliance check → Supervisor / safety check → DR. SIMON PARK (FINAL APPROVAL)
```

### Medium risk

```text
Researcher → Automatic risk assessment → Lab Safety Reviewer → Technical/SOP review → DR. SIMON PARK (FINAL APPROVAL)
```

### High risk

```text
Researcher → Automatic risk assessment → Lab Safety / EHS → Relevant specialist
           → Institution/facility approval where required → DR. SIMON PARK (FINAL INTERNAL APPROVAL)
```

For legally controlled activities, Simon's approval is the **last internal authorization**, not a substitute for an externally required permit, institutional EHS approval, fire-safety approval, chemical authorization, equipment inspection or other statutory requirement.

**That rule should be hard-coded.**

---

## 3. Main Google Forms — only 7

| Code | Form | Purpose |
|---|---|---|
| F01 | Personnel Registration | Student/RA/staff registration |
| F02 | Training Record | Training and certificates |
| F03 | SOP Acknowledgement | Read/understood current SOP |
| F04 | Experimental Safety Approval | Main risk assessment |
| F05 | Experiment Modification | Change management |
| F06 | Incident/Near Miss | Safety reporting |
| F07 | Safety Inspection/CAPA | Inspection and corrective action |

Almost everything else is automated.

---

## 4. F04 is the heart of the system

### Experiment identification

```text
Experiment title
Project
Principal Investigator
Experiment leader
Researchers
Lab / room
Start date
Expected completion
Related SOP
Equipment
```

n8n automatically assigns an ID such as **EXP-2026-0047**.

---

## 5. Hazards

Checkboxes:

```text
☐ Chemical            ☐ Laser
☐ Flammable material  ☐ Gas
☐ Toxic material      ☐ Hydrogen
☐ Corrosive           ☐ Rotating machinery
☐ Battery             ☐ Stored energy
☐ High voltage        ☐ 3D printing
☐ High current        ☐ Electroplating
☐ Pressure            ☐ Drone
☐ Vacuum              ☐ Radiation
☐ Elevated temperature☐ Other
☐ Cryogenic
```

Conditional sections appear depending on the answer. Example — **Battery selected**:

```text
Chemistry:
Capacity:
Maximum voltage:
Maximum current:
Maximum temperature:

☐ Charging/discharging
☐ Overcharge
☐ External heating
☐ Penetration
☐ Crush
☐ Thermal propagation

Can thermal runaway occur?   YES / NO
Gas generation possible?     YES / NO
Remote operation?            YES / NO
Fire enclosure?              YES / NO
```

---

## 6. Chemical section queries Vietnamese requirements

Researcher enters:

```text
Chemical
CAS number
Concentration
Quantity
Storage quantity
SDS uploaded?
```

n8n compares the CAS number against a `VN_CHEMICAL_REGISTER` Sheet, e.g.:

```text
CAS       67-56-1
Chemical  Methanol

VN Chemical List      YES
Hazardous             YES
SDS                   YES
Special control       Check
Emergency plan        Determine threshold
```

Decree 24/2026/NĐ-CP establishes the relevant chemical lists, and Decree 25/2026 establishes chemical accident-prevention/response requirements, including threshold-based requirements for certain hazardous chemicals — so the software can flag this automatically.

---

## 7. Risk classification

Use **initial risk** and **residual risk**. Initial risk = **Severity × Likelihood**:

| | Rare | Unlikely | Possible | Likely | Frequent |
|---|---|---|---|---|---|
| Negligible | 1 | 2 | 3 | 4 | 5 |
| Minor | 2 | 4 | 6 | 8 | 10 |
| Moderate | 3 | 6 | 9 | 12 | 15 |
| Major | 4 | 8 | 12 | 16 | 20 |
| Catastrophic | 5 | 10 | 15 | 20 | 25 |

```text
1–4      LOW
5–12     MEDIUM
13–25    HIGH
```

Numerical scoring alone is not sufficient.

---

## 8. Mandatory escalation rules — `RISK_RULES` sheet

| Hazard | Condition | Minimum level |
|---|---|---|
| Li-ion | deliberate thermal runaway | HIGH |
| Battery | penetration/crush/overcharge | HIGH |
| Hydrogen | intentional generation | HIGH |
| Flammable gas | significant quantity | HIGH |
| Laser | Class 3B/4 | HIGH |
| High voltage | exposed conductors | MEDIUM |
| High pressure | above lab threshold | MEDIUM/HIGH |
| Toxic chemical | specified limit | HIGH |
| Rotating equipment | exposed high energy | MEDIUM |
| Drone | outdoor autonomous flight | MEDIUM |
| Routine FDM printing | enclosed standard operation | LOW |

n8n calculates:

> **Final Risk = MAX(calculated risk, mandatory minimum risk)**

This prevents users from manipulating likelihood to get easier approval.

---

## 9. Controls reduce residual risk

```text
INITIAL RISK
Severity = 5, Likelihood = 3  →  15 → HIGH
```

Researcher enters controls:

```text
✓ Explosion/fire enclosure
✓ Remote operation
✓ H2 detector
✓ Emergency shutdown
✓ Fire suppression
✓ Exclusion zone
✓ Second trained operator
```

```text
RESIDUAL RISK
Severity = 5, Likelihood = 1  →  5 → MEDIUM
```

But the **approval route remains High Risk**, because the inherent experiment is high risk.

---

## 10. Training classification for Vietnam

The personnel database has a field `Vietnam OSH Training Group` — Group 1 … Group 6.

Decree 44/2016 establishes these categories; e.g. Group 3 covers workers performing jobs subject to strict OSH requirements, Group 4 covers other workers including trainees/probationers. The decree also contains refresher/retraining requirements.

Don't classify students automatically as Group 4 merely because they are students. Classification depends on what they actually do and should be confirmed by the university's Vietnamese EHS/legal function.

---

## 11. Before Simon even receives an experiment

n8n checks automatically:

```text
EXP-2026-0047

Researchers registered?            ✓
Vietnam OSH training valid?        ✓
Required lab training valid?       ✓
Current SOP acknowledged?          ✓
Equipment authorization?           ✓
Chemical SDS available?            ✓
Chemical legal check?              ✓
Fire controls checked?             ✓
Emergency procedure?               ✓
Risk assessment complete?          ✓
Technical reviewer approved?       ✓
────────────────────────────────────
READY FOR FINAL APPROVAL → Dr. Simon Park
```

**n8n should reject incomplete submissions before they reach him.**

---

## 12. Simon's approval email

```text
┌─────────────────────────────────────────┐
│ SAFELAB – FINAL APPROVAL                │
│ EXP-2026-0047                           │
│ BESS Thermal Propagation Experiment     │
│ Owner: Dang Hai Dang                    │
│ Project: SKI BESS                       │
│                                         │
│ INHERENT RISK        HIGH               │
│ RESIDUAL RISK        MEDIUM             │
│                                         │
│ Training ✓  SOP ✓  Chemical check ✓     │
│ Equipment ✓  Safety review ✓            │
│ Emergency plan ✓                        │
│                                         │
│ [VIEW FULL ASSESSMENT]                  │
│ [ APPROVE ]                             │
│ [ APPROVE WITH CONDITIONS ]             │
│ [ CHANGES REQUIRED ]                    │
│ [ REJECT ]                              │
└─────────────────────────────────────────┘
```

The approval is written automatically into the audit log.

---

## 13. PI Safety Dashboard (priority)

```text
┌───────────────────────────────────────────────────────────────┐
│ VINUNI SAFELAB                            Dr. Simon Park      │
│ Research Safety Dashboard                    02 Oct 2026      │
├───────────────────────────────────────────────────────────────┤
│  PEOPLE       TRAINING       EXPERIMENTS       INCIDENTS      │
│    46           92%              23                2          │
│ Registered    Compliant         Active           Open         │
├───────────────────────────────────────────────────────────────┤
│ ACTION REQUIRED                                               │
│ 🔴 3 experiments waiting final approval                       │
│ 🟠 4 training records expiring <30 days                       │
│ 🔴 1 overdue corrective action                                │
│ 🟠 2 SOPs require annual review                               │
│ 🔴 1 high-risk experiment expires this week                   │
├───────────────────────────────────────────────────────────────┤
│ ACTIVE EXPERIMENTS                                            │
│ LOW        11 ███████████                                     │
│ MEDIUM      8 ████████                                        │
│ HIGH        4 ████                                            │
├───────────────────────────────────────────────────────────────┤
│ COMPLIANCE BY PROJECT                                         │
│ BESS          96%   PipeSnake 100%                            │
│ FeelGripper   88%   NanoSense  82%                            │
├───────────────────────────────────────────────────────────────┤
│ RECENT SAFETY                                                 │
│ 29 Sep   Near miss      Electroplating        OPEN            │
│ 27 Sep   SOP update     SOP-BESS-004          COMPLETE        │
│ 25 Sep   Training       Chemical Safety       14 persons      │
└───────────────────────────────────────────────────────────────┘
```

Built in **Looker Studio**, reading the master Google Sheet. No custom dashboard programming.

---

## 14. The most important panel: "My Approvals"

| ID | Experiment | Owner | Risk | Reviews | PI |
|---|---|---|---|---|---|
| EXP-047 | Battery propagation | Dang | 🔴 High | ✓ EHS | **Pending** |
| EXP-052 | CNT electroless plating | Tu | 🟠 Medium | ✓ Safety | **Pending** |
| EXP-053 | Pipe robot testing | Minh | 🟢 Low | ✓ | **Pending** |
| EXP-041 | Gas sensor calibration | Dang | 🟠 Medium | Changes | Hold |

Clicking an experiment opens: summary, risk assessment, researchers, training, SOPs, chemicals, equipment, controls, review comments, documents, previous versions, audit history — then **APPROVE / CONDITIONS / CHANGES / REJECT**.

---

## 15. People compliance dashboard

```text
PERSONNEL COMPLIANCE
                    Training    SOP       Experiment
Dang Hai Dang         ✓          ✓           ✓
Nguyen Tien Dat       ✓          ✓           ✓
Tu Nguyen             ⚠          ✓           BLOCKED
Minh Nguyen           ✓          ✕           BLOCKED
Kevin Hoang           ✕          ✓           BLOCKED
```

- **Green** — everything valid
- **Amber** — something expires soon
- **Red** — missing/expired

Equipment/experimental authorization follows automatically.

---

## 16. Training dashboard

```text
TRAINING COMPLIANCE
Total researchers        46
Fully compliant          42
Non-compliant             4

Vietnam OSH   Valid 43 · Expiring 2 · Expired 1
Fire Safety   Valid 45 · Missing 1
Chemical      Required 28 · Valid 26 · Missing/expired 2
BESS Safety   Required 15 · Valid 14 · Missing 1
```

Aligns with Vietnam's need to retain OSH training documentation and fire-safety training records (Decree 105/2025 includes training information in the PCCC/CNCH dossier).

---

## 17. Experiment risk heat map

```text
             LIKELIHOOD
          1    2    3    4    5
S     5   2    1    1    0    0
E     4   4    3    1    0    0
V     3   2    4    2    0    0
      2   1    1    0    0    0
      1   1    0    0    0    0
```

Click any cell to see the corresponding experiments.

---

## 18. Chemical dashboard

```text
CHEMICAL SAFETY
Chemicals registered               126
Hazardous                           73
Current SDS                         69
Missing SDS                          4
Vietnam controlled-list matches     12
Special-review chemicals             3
Storage issue                        1
Quantity threshold alerts            1
Chemical emergency plan   Applicable YES · Current YES
```

Store the **CAS number**, because names vary between English and Vietnamese.

---

## 19. Fire safety (PCCC) dashboard

```text
FIRE / PCCC
PCCC dossier              ✓
Emergency plan PC06       ✓
Self-inspection           ✓
Equipment checks          ✓
Fire training             ✓
Next inspection          15 Nov 2026
Open actions               1
```

Do not recreate the entire university's fire-compliance system. SafeLab should reference/link institutional records where appropriate.

---

## 20. SOP dashboard

```text
SOP CONTROL
Active SOPs                     37
Due review <90 days              4
Under revision                   3
Awaiting PI approval             2
Acknowledgement compliance      94%

Latest changes:
SOP-BESS-004     v3.1 → v3.2
SOP-CHEM-007     v1.0 → v1.1
SOP-3DP-002      v2.0 → v3.0
```

Clicking an SOP shows owner, current version, approval, effective/review dates, affected equipment/experiments, and acknowledgement status (required / acknowledged / outstanding).

---

## 21. Incident/CAPA dashboard

```text
SAFETY EVENTS – 12 MONTHS
Incidents 2 · Near misses 7 · Unsafe conditions 4
Open CAPA 5 · Overdue CAPA 1
By cause: Procedure 3 · Training 2 · Equipment 4 · Human factor 2 · Facility 2
```

The real value is the automatic chain:

```text
Incident → Cause → Corrective action → SOP revision → Retraining → Experiment reapproval
```

---

## 22. Database — still only Google Sheets

One protected workbook, **`SAFELAB_MASTER`**, with tabs:

```text
PEOPLE, PROJECTS, LABS, EQUIPMENT, TRAINING_TYPES, TRAINING_RECORDS,
SOP_MASTER, SOP_ACK, EXPERIMENTS, EXPERIMENT_PEOPLE, EXPERIMENT_EQUIPMENT,
HAZARDS, RISK_ASSESSMENTS, RISK_CONTROLS, APPROVALS, CHEMICALS,
VN_CHEMICAL_REGISTER, INCIDENTS, CAPA, PCCC_RECORDS, LEGAL_REGISTER,
CONFIG, AUDIT_LOG
```

Users never directly modify this Sheet.

---

## 23. Vietnam Legal Register — `LEGAL_REGISTER`

| Code | Regulation | Area | Requirement | Record |
|---|---|---|---|---|
| VN-OSH-001 | Decree 44/2016 | Training | OSH training | Training |
| VN-FIRE-001 | Law 55/2024 | Fire | Fire controls | PCCC |
| VN-FIRE-002 | Decree 105/2025 | Fire | PCCC dossier | PCCC |
| VN-CHEM-001 | Law 69/2025 | Chemical | Chemical safety | Chemical |
| VN-CHEM-002 | Decree 24/2026 | Chemical | Chemical lists | Chemical |
| VN-CHEM-003 | Decree 25/2026 | Chemical | Accident prevention | Experiment |
| VN-CHEM-004 | Decree 26/2026 | Chemical | Chemical management | Chemical |

Then add applicable **QCVN/TCVN** requirements as they are identified for specific equipment and activities.

**Do not put regulations directly in n8n logic. Put them in the database** — regulatory updates become much easier.

---

## 24. Only about 10 n8n workflows

```text
01 PERSON_ONBOARD
02 TRAINING_RECORD
03 TRAINING_EXPIRY
04 SOP_RELEASE
05 SOP_ACKNOWLEDGEMENT
06 EXPERIMENT_RISK
07 EXPERIMENT_APPROVAL
08 EXPERIMENT_CHANGE
09 INCIDENT_CAPA
10 AUDIT_LOG
```

And later perhaps `11 MONTHLY_COMPLIANCE`.

---

## 25. Experiment workflow

```text
             GOOGLE FORM
                  ↓
            EXPERIMENT ID
                  ↓
          HAZARD EXTRACTION
                  ↓
        VIETNAM LEGAL CHECK
                  ↓
           RISK CALCULATION
                  ↓
         TRAINING/SOP CHECK
                  ↓
       ┌──────────┼──────────┐
      LOW       MEDIUM      HIGH
 Supervisor    Safety       EHS /
 review        review       Specialist
       └──────────┼──────────┘
                  ↓
        DR. SIMON PARK — FINAL APPROVER
                  ↓
             APPROVED
                  ↓
           PDF GENERATED
                  ↓
            DRIVE RECORD
                  ↓
             AUDIT LOG
```

## 26. Build order

1. **Google Site + Forms**
2. **SafeLab Master Sheet**
3. **Personnel/Training/SOP system**
4. **Experiment risk Form**
5. **Risk rules + automated compliance checking**
6. **Approval workflow with Simon as final approver**
7. **Looker Studio PI Dashboard**
8. **Incident/CAPA**
9. **Chemical/PCCC/legal-register expansion**
10. **QR codes for equipment/labs**

Do not start with AI, PostgreSQL, a custom mobile app, a knowledge graph or elaborate equipment locking — attractive distractions at this stage. Once the basic system is actually used, they can be added.

### The three screens that matter most

1. **Action Dashboard** — "What requires my attention today?"
2. **Experiment Dashboard** — "What experiments are active, and which are High Risk?"
3. **Compliance Dashboard** — "Who is not trained/current/authorized?"

The PI should mostly see **exceptions and final approval requests**, while n8n handles routine checking, routing, reminders, record creation and audit logging.
