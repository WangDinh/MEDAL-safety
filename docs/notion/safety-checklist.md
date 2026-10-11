# 💀 Safety Checklist

> Source: Notion — *VinUni - Ontology / Safety Checklist*
> https://app.notion.com/p/3f6c26401786800897c9f4283b36ea4c
> Exported: 2026-10-11

Subpages (exported alongside this file):

- [Proposed Safety Platform](proposed-safety-platform.md)
- [Safety Incident Reports](safety-incident-reports.md)
- [Safety Documents](safety-documents.md)
- [Safety Management](safety-management.md)
- [Videos to watch](videos-to-watch.md)
- [Forms](forms.md)

## Action items

1. Communicate these to UROP students
2. Update the forms and instructions for individual personnel — **by end of Aug.**
3. Have regular weekly safety meetings
4. Information needed:
   1. Emergency contact number
   2. Emergency escape routing
   3. Fire controlling plan (equipment, plan, department for maintenance, …)

---

## 1. Overall architecture

Create these controlled documents:

| ID | Safety plan | Applies to |
|---|---|---|
| **LSP-00** | Master Laboratory Safety Plan | Everyone entering/working in the lab |
| **ESP-01** | Electrical Safety Plan | Circuits, power electronics, sensors, batteries, electrical test systems |
| **MSP-01** | Mechanical & Fabrication Safety Plan | CNC, lathe, mill, drill, cutting, grinding, welding, robots |
| **CSP-01** | Chemical Safety / Chemical Hygiene Plan | Chemicals, gases, solvents, electrochemistry, coatings |
| **MAT-01** | Materials Processing Safety Plan | Powders, nanoparticles, composites, furnaces, 3D printing, resins |
| **ERP-01** | Emergency & Incident Response Plan | Fire, spill, electrical incident, injury, gas release, evacuation |

This separation matters because OSHA's laboratory framework treats chemical laboratory safety through a written **Chemical Hygiene Plan**, while machinery, electrical systems and emergency response are covered by different safety frameworks.

These are good international benchmark principles; university EHS requirements and Vietnamese regulations should be layered on top.

---

## LSP-00 — Master Laboratory Safety Plan

The umbrella document. Keep it short (roughly 10–15 pages) and refer to the four technical plans rather than repeating them.

### Governance

| Role | Responsibility |
|---|---|
| **PI / Lab Director (Simon Park)** | Ultimate responsibility; approves high-risk research |
| **Lab Safety Coordinator (Hau)** | Training records, inspections, incident tracking |
| **Electrical Safety Lead (Duong)** | Electrical equipment and authorization |
| **Fabrication Safety Lead (Dang)** | Machine shop/fabrication authorization |
| **Chemical Safety Officer (Hau)** | Chemical inventory, SDS, storage, waste |
| **Materials Safety Lead (Hau)** | Powders, nano, furnace, additive manufacturing |
| **Equipment Owner (TBD)** | SOP, maintenance, users authorized for each machine |
| **Researcher/student** | Follow SOP, stop unsafe work, report hazards/near misses |

### Every experiment gets a risk classification

| Level | Example | Requirement |
|---|---|---|
| **R1 – Low** | Computer work, low-energy sensors, simple assembly | General lab training |
| **R2 – Moderate** | Soldering, benchtop chemicals, 3D printers, machine tools | Specific training + SOP |
| **R3 – High** | Energized exposed circuits, high-energy batteries, welding, pressure systems, reactive/toxic gases, hazardous chemistry | Written risk assessment + authorized user + supervisor approval |

**R3 work should never become routine merely because somebody has done it many times.**

For R3 experiments, require a one-page **Pre-Experiment Risk Assessment**:

**Hazard → Failure scenario → Consequence → Existing control → Additional control → Emergency response → Approval.**

That forces researchers to think about what can actually go wrong rather than simply ticking PPE boxes.

---

## ESP-01 — Electrical Safety Plan (Duong)

Goal: design the system so researchers normally **cannot contact hazardous energized parts**. OSHA electrical requirements emphasize safeguarding workers from recognized electrical hazards, and electrical equipment must be suitable and safe for its intended installation/use.

### Major hazards

| Hazard | Primary prevention |
|---|---|
| Electric shock | Enclosures, insulation, grounding, barriers |
| Short circuit | Proper fusing/current limitation |
| Stored capacitor energy | Discharge circuits + verification |
| High-current systems | Current limiting, enclosure, emergency isolation |
| Unexpected energization | Lockout/tagout |
| Electrical fire | Correct protection, wiring, inspection |
| Battery thermal event | Separation, monitoring, containment |
| Modified experimental equipment | Engineering review before operation |

### Mandatory rules

**De-energized work is the default.** Exposed energized testing requires justification and specific authorization.

Provide:

- master emergency disconnects
- clearly labelled isolation switches
- appropriate circuit protection
- grounding/earthing
- insulated terminals
- guarded busbars
- emergency stops where appropriate
- interlocks on experimental equipment
- current-limited supplies during development

Electrical cabinets should remain closed during normal operation.

Any equipment that has been substantially modified should undergo a documented inspection before being returned to service.

For servicing equipment where unexpected energization or stored energy can injure someone, use a formal **lockout/tagout procedure**. OSHA addresses control of hazardous energy separately from ordinary machine guarding.

### Authorization

- **E0:** general lab user
- **E1:** low-energy electrical systems
- **E2:** trained electrical experimentalist
- **E3:** authorized hazardous-energy/energized-work researcher

Only E3 personnel should perform justified work around exposed hazardous energized systems.

Attachment: `SOP - ESP-01.docx` (copy in [`../SOP - ESP-01.docx`](../SOP%20-%20ESP-01.docx))

---

## MSP-01 — Mechanical & Fabrication Safety Plan

This needs to operate more like a **professional machine shop** than a general student laboratory. OSHA machine-safety requirements emphasize guarding workers from points of operation, rotating parts, flying chips/sparks and other mechanical hazards.

### Segregate fabrication activities

- **Machining zone** — lathe, mill, CNC, drill press
- **Cutting/grinding zone** — saw, grinder, abrasive equipment
- **Hot-work zone** — welding, brazing, torch cutting
- **Assembly/test zone** — fixtures, robotics, mechanical testing

Do not intermingle welding/grinding with chemical-storage areas.

### Machine authorization

Put a QR code or card on every machine:

> GREEN — authorized users
> YELLOW — supervisor required
> RED — out of service

Every major machine has:

**Machine ID → Owner → SOP → hazards → required PPE → authorized users → maintenance history.**

Training alone should not constitute authorization. A researcher should demonstrate competency to an equipment owner before independent operation.

### Critical controls

- Machine guards and interlocks should never be bypassed simply because they interfere with an experiment.
- Use formal LOTO for maintenance where hazardous energy can unexpectedly activate equipment.
- For welding/cutting, provide source ventilation, screens, appropriate PPE and a designated hot-work area. Welding and cutting are addressed as separate hazardous operations in OSHA's general-industry framework.
- Compressed cylinders should be properly identified, inspected and secured; compressed-gas systems require their own controlled handling practices.

---

## CSP-01 — Chemical Safety Plan

This should be a real **Chemical Hygiene Plan**, not merely a collection of SDS files. OSHA's laboratory standard calls for a written Chemical Hygiene Plan covering procedures, equipment, PPE and work practices that protect laboratory personnel from hazardous chemicals.

The plan should control the chemical through its entire lifecycle:

**Purchase → Receipt → Inventory → Storage → Experiment → Waste → Disposal.**

### Chemical segregation

| Group | Storage |
|---|---|
| Flammable solvents | Approved flammable-storage location |
| Acids | Corrosive storage |
| Bases | Separate from acids |
| Oxidizers | Away from incompatible organics/reducers |
| Toxic substances | Controlled designated location |
| Water-reactive/reactive chemicals | Dedicated controlled storage |
| Compressed gases | Appropriate secured cylinder location |
| Chemical waste | Designated secondary containment |

Do not alphabetically store the entire chemical inventory together.

All containers — including secondary containers — should be identifiable, and current SDS information needs to remain accessible to workers. OSHA's Hazard Communication requirements address labeling, SDS availability and training.

### Engineering controls first

Where exposure is possible:

**closed system → fume hood/local extraction → administrative control → PPE.**

A respirator should not become the routine solution to a badly ventilated chemical process.

### Chemical approval categories

- **C1:** routine chemicals
- **C2:** hazardous chemicals requiring additional controls
- **C3:** highly hazardous/reactive/toxic processes

C3 work requires a written experiment-specific SOP and PI/safety approval before starting.

---

## MAT-01 — Materials Processing Safety Plan

Many research labs get this wrong because they assume a **material is safer than a chemical** — frequently false from a risk-management standpoint.

Materials research can introduce: fine powders, nanoparticles, conductive particles, metal powders, carbon materials, fibers, resins, adhesives, solvents, high-temperature furnaces, pressure/vacuum, lasers, UV curing, additive manufacturing emissions.

Engineered nanomaterials deserve specific controls because their properties and exposure behavior may differ substantially from bulk material. NIOSH recommends engineering controls and laboratory-specific safe work practices for engineered nanomaterials.

### Powder/nanomaterial station

Dedicated area with:

**enclosure / local extraction → contained weighing → sealed transport → controlled cleaning → labelled waste.**

Do not allow powder weighing to migrate randomly from bench to bench.

### Furnace / thermal processing

Every furnace gets:

- maximum approved temperature
- acceptable material types
- ventilation requirements
- restricted-zone marking
- over-temperature protection
- emergency shutdown procedure
- cooling procedure
- equipment owner

### Additive manufacturing

Do not put research-scale printers wherever there is desk space. Separate printing/material preparation from ordinary office/electronics areas where processes generate particles, fumes, powders, resins or elevated temperatures.

---

## Physical segregation of the lab

| Zone | Activities |
|---|---|
| **A — Clean / Electrical** | electronics, sensors, DAQ, control systems |
| **B — Fabrication** | machining, CNC, cutting, drilling |
| **C — Hot Work** | welding, grinding, brazing |
| **D — Wet Chemical** | chemistry, electrochemistry, coatings |
| **E — Materials** | powders, CNT/nano, composites, 3D printing |
| **F — Thermal** | furnaces, ovens, thermal processing |
| **G — Hazard storage** | chemical/gas/waste storage |
| **H — Clean desk area** | computers, meetings, documentation |

The biggest mistake would be trying to make every bench multifunctional. A bench that handles nanopowders on Monday, electronics Tuesday, acids Wednesday and student demonstrations Thursday is an unnecessary contamination and safety problem.

---

## University-specific rule: authorization by activity

Students should have **authorization by activity**, not simply "lab access." A person's access record could show:

| Permission | Authorized? |
|---|---|
| General lab | ✓ |
| Chemical handling | ✓ |
| CNC | ✗ |
| Welding | ✗ |
| Electrical E2 | ✓ |
| Nanomaterials | ✓ |
| Furnace | ✗ |
| R3 experiments | ✗ |

Considerably more defensible than assuming an annual online safety course qualifies somebody to use everything in the lab.

---

## High-risk work permit

Require a short permit before: **energized hazardous electrical work; bypassing an interlock; welding outside the designated welding area; pressure-system commissioning; new gas systems; reactive chemistry; significant chemical scale-up; unfamiliar nanopowders; unattended high-temperature experiments; or major modification of equipment.**

One page is enough:

> What are we doing?
> What can fail?
> What prevents it?
> What happens if it fails anyway?
> Who is authorized?
> Who approved it?

---

## ERP-01 — Emergency and Incident Response

This should **not** be buried inside the chemical manual. A written emergency action system should identify emergency reporting, evacuation, accounting for personnel, responsible personnel and emergency duties — core elements of OSHA's Emergency Action Plan framework.

Separate response cards for:

- **Electrical shock / electrical fire** → isolate power if safely possible → emergency response → medical evaluation
- **Machine injury** → emergency stop → isolate energy → emergency response
- **Chemical splash/exposure** → eyewash/shower as appropriate → remove contaminated material → emergency response → SDS information
- **Chemical spill** → distinguish minor trained-user cleanup from major spill requiring evacuation/EHS response
- **Gas leak** → do not investigate an unknown hazardous atmosphere → evacuate/isolate according to the gas-specific emergency procedure
- **Fire** → alarm → evacuate → trained personnel only use extinguishers if institutional policy permits

Extinguishers must be appropriate to the anticipated fire hazards, and personnel expected to use them need appropriate training.

---

## The prevention system matters more than the manual

Run the lab around this loop:

**Hazard identification → risk assessment → engineering control → SOP → competency training → authorization → pre-use inspection → experiment → near-miss/incident reporting → corrective action → update SOP/risk assessment.**

And one rule above everything:

> **Any researcher can stop an experiment because of a safety concern. Restart requires the hazard to be resolved — not simply the PI telling them to continue.**

### What to implement

A **six-document safety system**, not a 100-page generic manual:

- **LSP-00 Master Lab Safety Plan** → ~12 pages
- **ESP-01 Electrical** → ~8–10 pages
- **MSP-01 Mechanical/Fabrication** → ~10 pages
- **CSP-01 Chemical** → ~15 pages + chemical inventory
- **MAT-01 Materials** → ~10 pages
- **ERP-01 Emergency Response** → ~6 pages

Underneath them, each machine/process gets a **1–2 page SOP + risk assessment**.
