// Builds docs/SafeLab_User_Guide.docx. Needs the npm package docx: run `npm install docx` (or `bun add docx`) in docs/src, then `node build_user_guide.js`.
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, ExternalHyperlink, PageBreak, Header, Footer,
  PageNumber, TableOfContents, TabStopType, VerticalAlign,
} = require('docx');

const OUT = require('path').join(__dirname, '..', 'SafeLab_User_Guide.docx');
const NAVY = '1F3864', TEAL = '1B7A8C', GREY = '595959', LIGHT = 'EEF4F8', HEAD = 'D9E5F0';
const WARN_BG = 'FFF4E5', WARN_BORDER = 'E08A00', RED_BG = 'FDECEC', RED_BORDER = 'C0392B';
const WIDTH = 9026; // A4 with 1" margins
const SERVER = '[SafeLab server address — to be confirmed when the lab VM is ready]';

const FORMS = {
  F01: ['Personnel Registration', 'https://docs.google.com/forms/d/e/1FAIpQLSeh-ZPcDx8HK4-BpOEI8umcdRWtkTsfHKQvOJC5hqfvHSQrrQ/viewform'],
  F02: ['Training Record', 'https://docs.google.com/forms/d/e/1FAIpQLSdLn6jzhw0_nBsFSjmc05r4SEiKaBk8f1yhAKwnGsI6r1MGjA/viewform'],
  F03: ['SOP Acknowledgement', 'https://docs.google.com/forms/d/e/1FAIpQLSf4o6Yx6ffD44pDGGOQqv4B0X1O-xE375wMg6lI0F_30HQDsA/viewform'],
  F04: ['Experimental Safety Approval', 'https://docs.google.com/forms/d/e/1FAIpQLSfRbZNITvBzE-QYljCvFB1KhS19q5do88q72geSo5pzp1MYZg/viewform'],
  F05: ['Experiment Modification', 'https://docs.google.com/forms/d/e/1FAIpQLSfPMEjbuGgAhGS8l0PGqoBPwf5dEmiDky1I1bDvLu1W0QW0Ig/viewform'],
  F06: ['Incident / Near Miss', 'https://docs.google.com/forms/d/e/1FAIpQLSeTmJFjmq1P0s_962b0yr41L5e2e-esVpj5DytH16AsXeGTLA/viewform'],
  F07: ['Safety Inspection / CAPA', 'https://docs.google.com/forms/d/e/1FAIpQLScDdwCKn3eTJqXO64Db9qcAScER8Fo55uRP4ktg7bWTbiuiqA/viewform'],
};

// ---------- inline markup: **bold**, `code`, [label](url) ----------
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else if (t.startsWith('*')) out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    else if (t.startsWith('`')) out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', size: 19, color: '333333', ...base }));
    else {
      const [, label, url] = /\[([^\]]+)\]\(([^)]+)\)/.exec(t);
      out.push(new ExternalHyperlink({ link: url, children: [new TextRun({ text: label, style: 'Hyperlink', ...base })] }));
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const P = (text, opts = {}) => new Paragraph({ children: runs(text, opts.run), spacing: { after: 120 }, ...opts.para });
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)], pageBreakBefore: true });
const H1n = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const H3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
const SP = () => new Paragraph({ children: [], spacing: { after: 60 } });

const bullets = (items, level = 0) => items.map((t) => new Paragraph({ numbering: { reference: 'bullets', level }, children: runs(t), spacing: { after: 60 } }));

const numberingConfigs = [{
  reference: 'bullets',
  levels: [
    { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
    { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } },
  ],
}];
let numCount = 0;
function steps(items) {
  const ref = `num${++numCount}`;
  numberingConfigs.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] });
  return items.map((t) => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 80 } }));
}

function callout(title, lines, kind = 'info') {
  const [bg, border] = kind === 'warn' ? [WARN_BG, WARN_BORDER] : kind === 'red' ? [RED_BG, RED_BORDER] : [LIGHT, TEAL];
  const style = { shading: { type: ShadingType.CLEAR, fill: bg, color: 'auto' }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: border, space: 8 } }, indent: { left: 200, right: 200 } };
  const out = [];
  if (title) out.push(new Paragraph({ ...style, spacing: { before: 120, after: 40 }, children: [new TextRun({ text: title, bold: true, color: border })] }));
  lines.forEach((l, i) => out.push(new Paragraph({ ...style, spacing: { after: i === lines.length - 1 ? 160 : 40 }, children: runs(l) })));
  return out;
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const mk = (text, i, header) => new TableCell({
    borders, width: { size: widths[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: header ? { type: ShadingType.CLEAR, fill: HEAD, color: 'auto' } : undefined,
    children: String(text).split('\n').map((line) => new Paragraph({ children: runs(line, header ? { bold: true, color: NAVY } : {}), spacing: { after: 20 } })),
  });
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => mk(h, i, true)) }), ...rows.map((r) => new TableRow({ children: r.map((c, i) => mk(c, i, false)) }))],
  });
}
const T = (...a) => [table(...a), SP()];
const formLink = (code) => `[Open ${code} – ${FORMS[code][0]}](${FORMS[code][1]})`;

// ======================================================================
const body = [];
const add = (...xs) => xs.flat().forEach((x) => body.push(x));

// ---------- cover ----------
add(
  new Paragraph({ spacing: { before: 2400, after: 120 }, children: [new TextRun({ text: 'VinUni SafeLab', bold: true, size: 64, color: NAVY })] }),
  new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: 'Research Safety, Training & Experiment Approval', size: 32, color: TEAL })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 4 } }, children: [] }),
  new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text: 'User Guide', bold: true, size: 40, color: NAVY })] }),
  P('For all lab members, reviewers, the PI and the Lab Safety Coordinator.', { run: { size: 24, color: GREY } }),
  new Paragraph({ spacing: { before: 2400 }, children: [new TextRun({ text: 'Version 1.0  ·  October 2026', color: GREY })] }),
  P('Final internal approver: Dr. Simon Park  ·  Questions: Lab Safety Coordinator (Hau)', { run: { color: GREY } }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---------- quick start ----------
add(
  H1n('Quick start'),
  P('SafeLab is how our lab registers people, records safety training and SOPs, and approves experiments before they start. You fill in **Google Forms**; SafeLab checks your submission automatically and emails you at every step. **No approval email = no experiment.**'),
  H3('Your first week'),
  ...steps([
    `**Register** — submit ${formLink('F01')}.`,
    '**Do your training** — watch the videos for the trainings you need (section 3), then submit **F02 Training Record** once per training.',
    '**Read the SOPs** you will work under, then submit **F03 SOP Acknowledgement** for each one.',
    '**Before any experiment** — submit **F04 Experimental Safety Approval** and wait for the email *“[SafeLab] Approved”*.',
  ]),
  H3('Three rules that always apply'),
  ...bullets([
    '**No approval, no experiment.** Do not start until you receive the final approval email.',
    '**Anyone can stop an experiment** because of a safety concern. Restart needs the hazard resolved — not just someone telling you to continue.',
    '**Report every incident and near miss** with **F06**, after the emergency is under control.',
  ]),
  H3('All SafeLab forms'),
  ...T(['Form', 'Use it when…', 'Link'], [
    ['F01 Personnel Registration', 'you join the lab', `[Open F01](${FORMS.F01[1]})`],
    ['F02 Training Record', 'you complete or renew a training', `[Open F02](${FORMS.F02[1]})`],
    ['F03 SOP Acknowledgement', 'you have read an SOP (or a new version)', `[Open F03](${FORMS.F03[1]})`],
    ['F04 Experimental Safety Approval', 'you plan a new experiment', `[Open F04](${FORMS.F04[1]})`],
    ['F05 Experiment Modification', 'an approved experiment changes', `[Open F05](${FORMS.F05[1]})`],
    ['F06 Incident / Near Miss', 'something went wrong or almost did', `[Open F06](${FORMS.F06[1]})`],
    ['F07 Safety Inspection / CAPA', 'safety inspections (coordinator / leads)', `[Open F07](${FORMS.F07[1]})`],
  ], [3300, 3726, 2000]),
  ...callout('In an emergency', [
    'SafeLab is **not** an emergency system. Follow the lab emergency procedure and call for help first.',
    'Emergency number: **[to be added]**  ·  Assembly point / escape route: **[to be added]**',
  ], 'red'),
);

// ---------- contents ----------
add(
  new Paragraph({ pageBreakBefore: true, spacing: { before: 240, after: 160 }, children: [new TextRun({ text: 'Contents', bold: true, size: 34, color: NAVY })] }),
  new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
  P('If the list above is empty, right-click it in Word and choose **Update Field**.', { run: { color: GREY, italics: true } }),
);

// ---------- PART 1 ----------
add(
  H1('Part 1 — For all lab members'),
  H2('1. How SafeLab works'),
  P('Everything starts with a Google Form. Your answers are stored in the lab’s SafeLab sheet, and an automation (n8n) checks them within about a minute.'),
  ...T(['Step', 'What happens'], [
    ['1. You submit F04', 'Your experiment gets an ID, e.g. `EXP-2026-0007`.'],
    ['2. Automatic check', 'SafeLab calculates the risk level and checks that everyone is registered, trained, has acknowledged the SOPs and is authorized on the equipment. If anything is missing you get *“Submission incomplete”* with the list — nobody else is bothered.'],
    ['3. Reviewer', 'A reviewer is chosen by risk level: **LOW** → supervisor, **MEDIUM** → lab safety reviewer, **HIGH** → EHS / specialist.'],
    ['4. Final approval', '**Dr. Simon Park** gives the final internal approval for every experiment.'],
    ['5. Result', 'You receive the outcome by email. Everything is recorded in an audit log.'],
  ], [2400, 6626]),
  ...callout('Use one email address everywhere', [
    'Google Forms record the email you submit with. The address you register with in F01 is your SafeLab identity — use **exactly the same address** in every form and when other people list you as a researcher.',
  ]),

  H2('2. Register (F01)'),
  P(`${formLink('F01')} — do this once, when you join the lab.`),
  ...T(['Question', 'What to enter'], [
    ['Full name', 'Your name as on your university record.'],
    ['Role', 'Student, UROP student, Research assistant, Staff or Faculty.'],
    ['Project', 'Your main project, e.g. BESS, PipeSnake, FeelGripper, NanoSense.'],
    ['Supervisor email', 'Your direct supervisor’s email.'],
    ['Vietnam OSH training group', 'Group 1–6 under Decree 44/2016. **If you are not sure, choose “Not yet classified”** — the safety coordinator will confirm it with you. Do not guess: it depends on the work you actually do, not on being a student.'],
  ], [2700, 6326]),
  P('You then get a welcome email listing the trainings everybody must complete.'),

  H2('3. Training (F02)'),
  P('Training happens in five steps. **“Training completed” and “authorized to operate” are different things** — videos alone never authorize you to use a machine.'),
  ...steps(['Watch the training videos', 'Pass the short quiz (≥ 80%)', 'Lab-specific orientation', 'Hands-on demonstration to the equipment owner', 'Authorization recorded (equipment owner / coordinator)']),
  H3('Which trainings do I need?'),
  P('Everyone needs the first three. The others are required automatically when your experiment lists the matching hazard in F04 (or uses equipment that requires them).'),
  ...T(['Code', 'Training', 'Required for', 'Valid for', 'Start with'], [
    ['CORE', 'Core lab safety', 'Everyone', '12 months', '[OSU EHS – Lab Safety Training](https://www.youtube.com/watch?v=TlhVR0xQLJQ)\n[CSB – Experimenting with Danger](https://www.youtube.com/watch?v=ALBWxGik64A)\n[ACS – RAMP](https://www.youtube.com/watch?v=DWSymRPCDN4)'],
    ['VN-OSH', 'Vietnam OSH training (Decree 44/2016)', 'Everyone', '24 months', 'Organized by the university / coordinator'],
    ['FIRE', 'Fire safety / PCCC', 'Everyone', '12 months', '[ACS – Emergencies in the Lab](https://www.youtube.com/watch?v=rPNQH3usdzI)\n[UCR – Fire Extinguishers](https://www.youtube.com/watch?v=l9_SmUU5FoQ)'],
    ['E1', 'Electrical safety E1', 'High voltage, High current, Stored energy', '24 months', '[Iowa State – Electrical Safety](https://www.youtube.com/watch?v=aMJ8XlBcshY)'],
    ['E2', 'Electrical safety E2 (hazardous energy)', 'High voltage, High current', '24 months', '[OSU – Lockout/Tagout](https://www.youtube.com/watch?v=HFJq3BGm8Kw)'],
    ['M1', 'Fabrication shop M1', 'Rotating machinery', '24 months', '[UB – Machine Shop Orientation](https://www.youtube.com/watch?v=Fb6oGz9gfIo)'],
    ['C1', 'Chemical safety C1', 'Chemical, Flammable, Toxic, Corrosive, Electroplating', '12 months', '[USC – Fume Hood](https://www.youtube.com/watch?v=d6l-6rPtWMk)\n[UCR – Spill Response](https://www.youtube.com/watch?v=18Kmo-1U1fc)'],
    ['C3', 'Compressed gas C3', 'Gas, Hydrogen', '12 months', '[USC – Gas Regulator](https://www.youtube.com/watch?v=tGPlQvRtIG0)'],
    ['BAT', 'Li-ion battery safety', 'Battery', '24 months', '[UT Austin – Li-ion Safety](https://www.youtube.com/watch?v=ZavQDcGd2FU)'],
    ['N1', 'Nanomaterials N1', 'Assigned via equipment / supervisor', '24 months', '[NNIN – Nano Safety Culture](https://www.youtube.com/watch?v=w1pg0lXa31c)'],
  ], [1050, 1900, 2150, 1100, 2826]),
  P('The full playlist (with explanations) is in the lab’s *Videos to watch* page.', { run: { color: GREY, italics: true } }),
  H3('Recording a training'),
  P(`After each training submit ${formLink('F02')}: choose the training, the completion date, your quiz score (optional) and a link to your certificate or quiz result (optional but recommended). SafeLab calculates the expiry date and emails you a confirmation.`),
  ...callout('Expiry reminders', ['SafeLab checks every morning at 08:00. You get an email when a training expires within 30 days. **Expired training blocks new experiment approvals** — renew it and submit a new F02.'], 'warn'),

  H2('4. SOPs (F03)'),
  P(`Read each SOP you will work under — the ones for your experiment and for the equipment you use — then submit ${formLink('F03')}, choose the SOP and tick the confirmation.`),
  ...bullets([
    'SafeLab records which **version** you acknowledged.',
    'When an SOP is updated to a new version, you must acknowledge it again before your next experiment is approved.',
    'If your acknowledgement could not be recorded (e.g. the SOP was retired), you get an email explaining why.',
  ]),
);

// ---------- F04 ----------
add(
  H2('5. Requesting experiment approval (F04)'),
  P(`${formLink('F04')} — submit it **before** the experiment starts, and allow time for two reviews. The form has four sections.`),
  H3('Section 1 — Identification'),
  ...T(['Question', 'Tips'], [
    ['Experiment title / Project', 'Short, specific title, e.g. “BESS module thermal propagation test”.'],
    ['Principal Investigator', 'Normally Dr. Simon Park.'],
    ['Experiment leader email', 'The person responsible day-to-day. Receives all emails.'],
    ['Researcher emails', 'Everyone who will do the work, comma-separated. **Each person is checked** (registered, trained, SOPs, equipment).'],
    ['Lab / room, dates', 'Where and when.'],
    ['Related SOP IDs', 'e.g. `SOP-ESP-01`, comma-separated. Everyone listed must have acknowledged the current version.'],
    ['Equipment IDs', 'e.g. `EQ-PSU-01`. Everyone listed must be an authorized user of that equipment.'],
  ], [2700, 6326]),
  H3('Section 2 — Hazards'),
  ...bullets([
    '**Hazards** — tick every hazard that applies. This decides which trainings are required.',
    '**Escalation conditions** — tick any that apply (e.g. *Li-ion: deliberate thermal runaway*, *Laser: Class 3B/4*), or *None of these*. Each one sets a **minimum** risk level that cannot be lowered (Appendix B).',
    '**Hazard details** — e.g. battery chemistry, capacity, voltage, current; gas type; laser class; maximum temperature.',
  ]),
  H3('Section 3 — Chemicals'),
  P('One chemical per line, in the format **CAS, name, quantity, unit**. Use the CAS number — chemical names differ between English and Vietnamese.'),
  new Paragraph({ indent: { left: 540 }, spacing: { after: 120 }, children: [new TextRun({ text: '67-56-1, Methanol, 2, kg', font: 'Consolas', size: 19 }), new TextRun({ break: 1, text: '7647-01-0, Hydrochloric acid, 500, g', font: 'Consolas', size: 19 })] }),
  ...bullets([
    'SafeLab checks each CAS number against the Vietnamese chemical register (Decree 24/2026) and flags controlled chemicals and quantities above legal thresholds.',
    'Use **kg** or **g** so thresholds can be checked. Upload the SDS for every chemical and answer **Yes**; with no chemicals answer **Not applicable**.',
  ]),
  H3('Section 4 — Risk assessment'),
  P('Rate the **initial** risk (before your controls), describe your controls, then rate the **residual** risk (with controls in place).'),
  ...T(['Score', 'Severity — worst credible outcome', 'Likelihood'], [
    ['1', 'Negligible — no injury, no damage', 'Rare — practically never'],
    ['2', 'Minor — first aid, minor damage', 'Unlikely — not expected during the project'],
    ['3', 'Moderate — medical treatment, lost time, local damage', 'Possible — could happen occasionally'],
    ['4', 'Major — serious injury, fire, significant release', 'Likely — expected to happen at some point'],
    ['5', 'Catastrophic — fatality, permanent disability, major fire/explosion', 'Frequent — expected to happen often'],
  ], [900, 4563, 3563]),
  P('**Risk = Severity × Likelihood:** 1–4 **LOW**, 5–12 **MEDIUM**, 13–25 **HIGH** (matrix in Appendix A).'),
  ...callout('How the final risk level is decided', [
    '**Final risk = the higher of** your calculated score and the minimum set by any escalation condition or controlled chemical.',
    'Your controls lower the **residual** risk, but the **approval route follows the inherent risk** — a high-risk experiment is always reviewed as HIGH, however good the controls.',
  ]),
  ...bullets([
    '**Controls** — be specific: “Cell inside steel fire enclosure, remote operation, H₂ detector with automatic shutdown, second trained operator”, not “PPE”.',
    '**Emergency procedure** — what you will do if it fails anyway: stop/isolate, evacuate, who to call.',
    '**Legal acknowledgement** — PI approval is the final *internal* approval only. External permits and university EHS approvals required by law are still needed.',
  ]),
);

// ---------- after submit ----------
add(
  H2('6. After you submit — the emails'),
  P('All emails come from the lab’s SafeLab address and start with **[SafeLab]**. If you don’t see one within a few minutes, check **Spam** and **Promotions**.'),
  ...T(['Email subject', 'Meaning', 'What to do'], [
    ['[SafeLab] Received – …', 'Passed the automatic checks; sent to the reviewer.', 'Wait. Do not start.'],
    ['[SafeLab] Submission incomplete – …', 'Stopped by the automatic checks. Lists what failed.', 'Fix each item (section 7), then submit F04 again.'],
    ['[SafeLab] Approved – EXP-…', 'Final approval by Dr. Simon Park.', 'You may start, as described in F04.'],
    ['[SafeLab] Approved with conditions – EXP-…', 'Approved, with conditions in the email.', 'Start only while meeting every condition.'],
    ['[SafeLab] Changes required – submit a new F04 – EXP-…', 'The reviewer or PI needs changes.', 'Read the comment, submit a new F04.'],
    ['[SafeLab] Rejected – EXP-…', 'Not approved.', 'Talk to your supervisor before resubmitting.'],
  ], [3300, 3126, 2600]),
  H3('Experiment status'),
  ...T(['Status', 'Meaning'], [
    ['PENDING_REVIEW', 'Waiting for the reviewer.'],
    ['PENDING_PI', 'Reviewer approved; waiting for Dr. Simon Park.'],
    ['APPROVED / APPROVED_WITH_CONDITIONS', 'Final. You may start (meeting any conditions).'],
    ['CHANGES_REQUIRED / REJECTED', 'Final for this submission. Submit a new F04 if needed.'],
    ['REJECTED_INCOMPLETE', 'Stopped by the automatic checks — never reached a reviewer.'],
    ['CHANGE_PENDING', 'A modification (F05) needs a new approval. Do not continue the changed work.'],
  ], [3600, 5426]),

  H2('7. Why was my submission marked incomplete?'),
  P('The *Submission incomplete* email lists each check. **FAIL** blocks the submission; **WARN** is shown to the reviewer but does not block.'),
  ...T(['Check', 'Fails when…', 'How to fix'], [
    ['Researchers registered', 'Someone listed has not submitted F01, or used a different email.', 'They submit F01 with the same email you listed.'],
    ['Vietnam OSH group (warn)', 'Group is “Not yet classified”.', 'Ask the safety coordinator to confirm your group.'],
    ['Required training valid', 'A required training is missing or expired.', 'Complete it and submit F02.'],
    ['Current SOP acknowledged', 'Someone has not acknowledged the current version of a listed SOP (or the equipment’s SOP).', 'Read the SOP and submit F03.'],
    ['Equipment authorization', 'Equipment is unknown or out of service (RED), or someone is not an authorized user. YELLOW = supervisor required (warn).', 'Ask the equipment owner for authorization; check the equipment ID.'],
    ['Chemical SDS available', 'Chemicals listed but SDS not answered “Yes”.', 'Upload the SDS, answer Yes.'],
    ['Chemical legal check', 'A chemical line is not in the format CAS, name, quantity, unit. Unregistered CAS = warn.', 'Fix the line format.'],
    ['Risk assessment complete', 'Scores, controls or emergency procedure missing.', 'Fill in every risk field.'],
    ['External approvals acknowledged', 'Legal acknowledgement not ticked.', 'Tick it.'],
  ], [2400, 3826, 2800]),

  H2('8. Changing an approved experiment (F05)'),
  P(`Submit ${formLink('F05')} with the experiment ID and what is changing.`),
  ...bullets([
    '**New hazards, chemicals, people or equipment → “Yes”.** The experiment becomes `CHANGE_PENDING` and you must submit a **new F04**. Do not continue the changed work until it is approved.',
    '**Minor change, nothing new → “No”.** The reviewer is informed (*“FYI change”*).',
  ]),

  H2('9. Reporting incidents and near misses (F06)'),
  ...callout('Emergency first', ['Make the area safe, get help and get medical attention **before** filling in any form.'], 'red'),
  P(`Then submit ${formLink('F06')} as soon as possible — even if nobody was hurt.`),
  ...T(['Type', 'Example'], [
    ['Incident', 'Injury, fire, spill, electrical shock, equipment damage.'],
    ['Near miss', 'Something that almost caused harm — a battery that started venting, a dropped cylinder.'],
    ['Unsafe condition', 'Blocked exit, missing guard, unlabeled container, broken fume hood.'],
  ], [2400, 6626]),
  P('The safety coordinator is notified immediately and a corrective action (CAPA) is opened. **If someone was injured or severity is HIGH, Dr. Simon Park also receives an [URGENT] email.** Reporting is about fixing the system, not blaming people.'),
);

// ---------- PART 2: reviewers ----------
add(
  H1('Part 2 — For reviewers'),
  P('Reviewers are the supervisor (LOW risk), the lab safety reviewer (MEDIUM) and EHS / the relevant specialist (HIGH). You only receive experiments that already **passed every automatic check**.'),
  H2('Reviewing an experiment'),
  ...steps([
    'You receive **“[SafeLab] Review required – EXP-… (LOW / MEDIUM / HIGH)”**.',
    `Click the link in the email. It opens the SafeLab approval page at ${SERVER}.`,
    'Read the full assessment: hazards, matched escalation rules, chemicals and legal flags, compliance results, controls and emergency procedure.',
    'Choose a decision, add a comment, and click **Submit**. The page confirms your decision.',
  ]),
  ...T(['Decision', 'Effect'], [
    ['Approve', 'Goes to Dr. Simon Park for final approval.'],
    ['Approve with conditions', 'Goes to Dr. Simon Park with your conditions. **Comment required.**'],
    ['Changes required', 'Returned to the researcher, who must submit a new F04. **Comment required.**'],
    ['Reject', 'Stops the experiment.'],
  ], [2800, 6226]),
  H3('What to look for'),
  ...bullets([
    'Are all real hazards ticked? Is anything obviously missing (pressure, stored energy, gas)?',
    'Are severity and likelihood realistic — not lowered to get an easier route?',
    'Are the controls engineering controls first (enclosure, interlock, extraction), not only PPE?',
    'Is the emergency procedure specific to this experiment?',
    'Any **WARN** items (unregistered chemical, YELLOW equipment, OSH group) — are they acceptable?',
  ]),
  ...callout(null, [
    'Opening the link never changes anything — only clicking **Submit** does. If the page says the experiment is **“not awaiting this decision”**, someone has already decided at that stage.',
  ]),
);

// ---------- PART 3: PI ----------
add(
  H1('Part 3 — For Dr. Simon Park (final approver)'),
  P('You only receive experiments that have **passed every automatic check and a reviewer**, so you see exceptions and approval requests, not paperwork.'),
  H2('Final approval'),
  ...steps([
    'You receive **“[SafeLab] FINAL APPROVAL – EXP-… <title>”** with the inherent and residual risk, the checks and the reviewer’s decision and comment.',
    'Click the link, review, choose **Approve / Approve with conditions / Changes required / Reject**, and submit.',
    'The researcher and reviewer are informed automatically; the decision is written to the audit log.',
  ]),
  ...callout('Your approval is the final internal approval', [
    'For HIGH-risk or legally controlled work it does **not** replace external permits, university EHS approval, fire-safety approval, chemical authorization or equipment inspection. SafeLab adds this reminder to every HIGH-risk approval.',
  ], 'warn'),
  H2('Urgent incidents'),
  P('You receive **“[SafeLab] [URGENT] …”** whenever an incident involves an injury or is reported as HIGH severity.'),
  H2('Overview'),
  P('The **DASHBOARD** tab of the SafeLab sheet shows, live: active people, experiments waiting for review or for you, active experiments by risk level, training expiring or expired, open incidents and corrective actions, and SOPs due for review.'),
);

// ---------- PART 4: coordinator ----------
add(
  H1('Part 4 — For the Lab Safety Coordinator'),
  H2('What you receive'),
  ...T(['Email', 'When', 'Action'], [
    ['Training expiry summary', 'Daily 08:00, when something expires within 30 days', 'Follow up with the people listed.'],
    ['[SafeLab] Incident reported – INC-…', 'Each F06', 'Investigate. A CAPA is created automatically, due in 14 days.'],
    ['[SafeLab] Corrective action assigned', 'Each F07 with a corrective action', 'Track it to completion.'],
  ], [3000, 3026, 3000]),
  H2('Your regular tasks'),
  ...bullets([
    '**Inspections** — record each with **F07**. A corrective action creates a CAPA row and emails its owner.',
    '**Close corrective actions** — in the `CAPA` tab set `status` to `CLOSED` and fill `closed_at`.',
    '**Confirm Vietnam OSH groups** for people registered as “Not yet classified” (update `PEOPLE`).',
    '**New SOP version** — bump `version` in `SOP_MASTER` and tell people to re-acknowledge with F03.',
    '**Equipment authorization** — add people to `authorized_users` in `EQUIPMENT` after their hands-on demonstration.',
  ]),
  P('Changes to rules, trainings, reviewers or the chemical register are described in the **SafeLab Admin Guide** (`docs/ADMIN_GUIDE.md`). Do not edit the EXPERIMENTS, APPROVALS or AUDIT_LOG tabs by hand — they are the audit trail.'),
);

// ---------- appendices ----------
add(
  H1('Appendices'),
  H2('Appendix A — Risk matrix'),
  P('Risk score = Severity × Likelihood.'),
  ...T(['Severity \\ Likelihood', '1 Rare', '2 Unlikely', '3 Possible', '4 Likely', '5 Frequent'], [
    ['5 Catastrophic', '5', '10', '15', '20', '25'],
    ['4 Major', '4', '8', '12', '16', '20'],
    ['3 Moderate', '3', '6', '9', '12', '15'],
    ['2 Minor', '2', '4', '6', '8', '10'],
    ['1 Negligible', '1', '2', '3', '4', '5'],
  ], [2026, 1400, 1400, 1400, 1400, 1400]),
  ...T(['Score', 'Level', 'Reviewer before the PI'], [
    ['1–4', 'LOW', 'Supervisor'],
    ['5–12', 'MEDIUM', 'Lab safety reviewer'],
    ['13–25', 'HIGH', 'EHS / relevant specialist'],
  ], [2000, 2000, 5026]),

  H2('Appendix B — Mandatory minimum risk levels'),
  P('Ticking one of these escalation conditions in F04 sets a minimum level, whatever the score.'),
  ...T(['Hazard', 'Condition', 'Minimum level'], [
    ['Li-ion', 'deliberate thermal runaway', 'HIGH'],
    ['Battery', 'penetration / crush / overcharge', 'HIGH'],
    ['Hydrogen', 'intentional generation', 'HIGH'],
    ['Flammable gas', 'significant quantity', 'HIGH'],
    ['Laser', 'Class 3B/4', 'HIGH'],
    ['High pressure', 'above lab threshold', 'HIGH'],
    ['Toxic chemical', 'above specified limit', 'HIGH'],
    ['High voltage', 'exposed conductors', 'MEDIUM'],
    ['Rotating equipment', 'exposed high energy', 'MEDIUM'],
    ['Drone', 'outdoor autonomous flight', 'MEDIUM'],
    ['Routine FDM printing', 'enclosed standard operation', 'LOW'],
  ], [3000, 4026, 2000]),
  P('Controlled chemicals also raise the level: hazardous → at least MEDIUM; special-control or above the legal threshold → HIGH.'),

  H2('Appendix C — FAQ'),
  ...[
    ['I submitted a form but got no email.', 'Wait 2–3 minutes and check Spam/Promotions. Still nothing? Tell the safety coordinator the form, time and your email.'],
    ['I’m trained but my F04 says my training is missing.', 'Check that your F02 used the same email as F04, and that the training has not expired.'],
    ['Can I start while my experiment is PENDING?', 'No. Only APPROVED or APPROVED_WITH_CONDITIONS (meeting the conditions).'],
    ['My experiment changed slightly.', 'Submit F05. If anything new is added (hazard, chemical, person, equipment) a new F04 is required.'],
    ['I made a mistake in a form.', 'Submit the form again with the correct information; for F04 a new submission gets a new ID.'],
    ['How long is an approval valid?', 'For the dates in your F04. If the work continues beyond them, or the SOP changes, submit a new F04.'],
  ].flatMap(([q, a]) => [new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: q, bold: true, color: NAVY })] }), P(a)]),

  H2('Appendix D — Contacts and glossary'),
  ...T(['Role', 'Person', 'Ask about'], [
    ['PI / Lab Director — final approver', 'Dr. Simon Park', 'High-risk research, final approvals'],
    ['Lab Safety Coordinator', 'Hau', 'SafeLab questions, training records, inspections, incidents'],
    ['Chemical Safety Officer / Materials Safety Lead', 'Hau', 'Chemical inventory, SDS, storage, waste; powders, nano, furnaces, 3D printing'],
    ['Electrical Safety Lead', 'Duong', 'Electrical equipment and E1–E3 authorization'],
    ['Fabrication Safety Lead', 'Dang', 'Machine shop and fabrication authorization'],
  ], [3300, 1700, 4026]),
  ...T(['Term', 'Meaning'], [
    ['SOP', 'Standard Operating Procedure — the approved way to do a task or use equipment.'],
    ['SDS', 'Safety Data Sheet — the supplier’s hazard information for a chemical.'],
    ['CAS number', 'Unique chemical identifier, e.g. 67-56-1 (methanol).'],
    ['CAPA', 'Corrective And Preventive Action — what we change after an incident or inspection.'],
    ['LOTO', 'Lockout/Tagout — isolating energy before maintenance.'],
    ['PCCC', 'Phòng cháy chữa cháy — fire prevention and fighting.'],
    ['Inherent / residual risk', 'Risk before / after your controls.'],
  ], [2400, 6626]),
);

// ======================================================================
const doc = new Document({
  creator: 'MEDAL Lab', title: 'VinUni SafeLab — User Guide', description: 'SafeLab user guide for lab members, reviewers, PI and safety coordinator',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 34, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, color: TEAL }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, color: NAVY }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: numberingConfigs },
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }, titlePage: true },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'VinUni SafeLab — User Guide', color: GREY, size: 18 })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], color: GREY, size: 18 })] })] }) },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('wrote', OUT, buf.length, 'bytes'); });
