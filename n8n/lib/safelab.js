/* SafeLab pure logic library — see docs/SAFELAB_SPEC.md §5.
 * Plain ES2020, no imports. Pasted verbatim into n8n Code nodes (build.mjs) and
 * loaded with require() by the unit tests. Only top-level identifier: SafeLab. */
const SafeLab = (function () {
  'use strict';

  const LEVELS = ['LOW', 'MEDIUM', 'HIGH'];
  const HIGH_ROUTE_FLAG =
    'PI approval is the final INTERNAL approval only; external permits/EHS approvals still required';

  const EXPERIMENT_HEADERS = [
    'exp_id', 'title', 'project', 'pi_name', 'leader_email', 'researcher_emails', 'lab', 'start_date', 'end_date',
    'sop_ids', 'equipment_ids', 'hazards', 'escalation_conditions', 'hazard_details', 'chemicals_raw', 'sds_uploaded',
    'severity', 'likelihood', 'initial_score', 'calc_level', 'min_level', 'inherent_level', 'matched_rules',
    'controls', 'residual_severity', 'residual_likelihood', 'residual_score', 'residual_level',
    'emergency_procedure', 'legal_flags', 'compliance_summary', 'reviewer_email',
    'current_stage', 'status', 'submitted_by', 'submitted_at', 'updated_at',
  ];

  // ---------- small helpers ----------
  function str(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function up(v) { return str(v).toUpperCase(); }
  function lower(v) { return str(v).toLowerCase(); }
  function isYes(v) { return v === true || ['YES', 'Y', 'TRUE', '1'].includes(up(v)); }
  function num(v) {
    if (v === null || v === undefined || str(v) === '') return null;
    const n = Number(str(v));
    return Number.isFinite(n) ? n : null;
  }
  function pad(n, w) { return String(n).padStart(w || 2, '0'); }
  function ymd(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function validYmd(y, m, d) {
    return y >= 1900 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? ymd(y, m, d) : '';
  }
  function asList(v) { return Array.isArray(v) ? v : parseList(v); }
  function joinList(v, sep) { return Array.isArray(v) ? v.join(sep || ', ') : str(v); }
  // Read a form/sheet column by title: exact key first, then trimmed case-insensitive match.
  function col(row, title) {
    if (!row) return '';
    if (row[title] !== undefined) return row[title];
    const want = title.trim().toLowerCase();
    const key = Object.keys(row).find((k) => k.trim().toLowerCase() === want);
    return key === undefined ? '' : row[key];
  }
  function sameVersion(a, b) {
    const na = num(a), nb = num(b);
    if (na !== null && nb !== null) return na === nb; // Sheets may turn "1.0" into 1
    return str(a) === str(b);
  }

  // ---------- levels ----------
  function scoreToLevel(score) {
    const n = num(score);
    if (n === null || n < 1 || n > 25) return null;
    return n <= 4 ? 'LOW' : n <= 12 ? 'MEDIUM' : 'HIGH';
  }

  function maxLevel(...levels) {
    let best = -1;
    levels.flat().forEach((l) => { best = Math.max(best, LEVELS.indexOf(up(l))); });
    return best < 0 ? null : LEVELS[best];
  }

  // ---------- lists ----------
  function parseList(s) {
    if (Array.isArray(s)) s = s.join(',');
    const out = [];
    str(s).split(/[,;\n\r]+/).forEach((x) => {
      const t = x.trim();
      if (t && !out.includes(t)) out.push(t);
    });
    return out;
  }

  function parseEmails(s) {
    return [...new Set(parseList(s).map((e) => e.toLowerCase()))];
  }

  // ---------- dates ----------
  function parseDate(v) {
    if (v instanceof Date) {
      return isNaN(v.getTime()) ? '' : ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
    }
    const s = str(v);
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T ])/);
    if (m) return validYmd(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?$/i);
    if (m) return validYmd(+m[3], +m[1], +m[2]);
    return '';
  }

  // Timestamp as ISO-ish text: M/D/YYYY H:mm:ss → YYYY-MM-DDTHH:mm:ss; ISO kept; else raw text.
  function toTimestamp(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString();
    const s = str(v);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return s;
    const d = validYmd(+m[3], +m[1], +m[2]);
    if (!d) return s;
    return m[4] === undefined ? d : `${d}T${pad(m[4])}:${m[5]}:${pad(m[6] || 0)}`;
  }

  function addMonths(dateStr, n) {
    const d = parseDate(dateStr);
    const k = num(n);
    if (!d || k === null) return '';
    const [y, m, day] = d.split('-').map(Number);
    const total = m - 1 + Math.trunc(k);
    const ny = y + Math.floor(total / 12);
    const nm = ((total % 12) + 12) % 12 + 1;
    return ymd(ny, nm, Math.min(day, daysInMonth(ny, nm)));
  }

  function daysBetween(a, b) {
    const da = parseDate(a), db = parseDate(b);
    if (!da || !db) return null;
    const t = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((t(db) - t(da)) / 86400000);
  }

  // ---------- ids ----------
  function nextId(prefix, year, existingIds) {
    const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    let max = 0;
    (existingIds || []).forEach((id) => {
      const m = str(id).match(re);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `${prefix}-${year}-${pad(max + 1, 4)}`;
  }

  // ---------- experiment intake ----------
  function normalizeExperiment(row) {
    const leader = lower(col(row, 'Experiment leader email'));
    const researchers = parseEmails(col(row, 'Researcher emails (comma-separated)'));
    const ack = col(row, 'Legal acknowledgement');
    return {
      submitted_at: toTimestamp(col(row, 'Timestamp')),
      submitted_by: lower(col(row, 'Email Address')),
      title: str(col(row, 'Experiment title')),
      project: str(col(row, 'Project')),
      pi_name: str(col(row, 'Principal Investigator')),
      leader_email: leader,
      researcher_emails: [...new Set([leader, ...researchers].filter(Boolean))],
      lab: str(col(row, 'Lab / room')),
      start_date: parseDate(col(row, 'Start date')),
      end_date: parseDate(col(row, 'Expected completion')),
      sop_ids: parseList(col(row, 'Related SOP IDs (comma-separated)')).map((x) => x.toUpperCase()),
      equipment_ids: parseList(col(row, 'Equipment IDs (comma-separated)')).map((x) => x.toUpperCase()),
      hazards: parseList(col(row, 'Hazards')),
      escalation_conditions: parseList(col(row, 'Escalation conditions'))
        .filter((x) => x.toLowerCase() !== 'none of these'),
      hazard_details: str(col(row, 'Hazard details')),
      chemicals_raw: str(col(row, 'Chemicals (one per line: CAS, name, quantity, unit)')),
      sds_uploaded: str(col(row, 'SDS uploaded for all chemicals?')),
      severity: num(col(row, 'Severity (1-5)')),
      likelihood: num(col(row, 'Likelihood (1-5)')),
      residual_severity: num(col(row, 'Residual severity (1-5)')),
      residual_likelihood: num(col(row, 'Residual likelihood (1-5)')),
      controls: str(col(row, 'Controls')),
      emergency_procedure: str(col(row, 'Emergency procedure')),
      legal_ack: ack === true || (ack !== false && str(ack) !== ''),
    };
  }

  // "CAS, name, quantity, unit" per line. Also accepts "CAS, name, 2 kg" and "CAS, name".
  function parseChemicals(text) {
    const out = [];
    str(text).split(/\r?\n/).forEach((line) => {
      const raw = line.trim();
      if (!raw) return;
      const parts = raw.split(',').map((p) => p.trim());
      const c = { cas: parts[0] || '', name: '', quantity: null, unit: '', raw, parseError: false };
      if (!/^\d{2,7}-\d{2}-\d$/.test(c.cas)) { c.parseError = true; out.push(c); return; }
      let qtyText = '';
      if (parts.length >= 4) {
        c.name = parts.slice(1, -2).join(', ');
        qtyText = parts[parts.length - 2];
        c.unit = parts[parts.length - 1];
      } else if (parts.length === 3) {
        c.name = parts[1];
        const m = parts[2].match(/^([\d.]+)\s*([^\d\s.].*)?$/);
        if (m) { qtyText = m[1]; c.unit = (m[2] || '').trim(); } else qtyText = parts[2];
      } else {
        c.name = parts[1] || '';
      }
      if (qtyText !== '') {
        const q = Number(qtyText);
        if (Number.isFinite(q) && q >= 0) c.quantity = q; else c.parseError = true;
      }
      out.push(c);
    });
    return out;
  }

  // ---------- risk ----------
  function assessRisk(exp, riskRules, chemRegister) {
    const initial = num(exp.severity) !== null && num(exp.likelihood) !== null
      ? num(exp.severity) * num(exp.likelihood) : null;
    const residual = num(exp.residual_severity) !== null && num(exp.residual_likelihood) !== null
      ? num(exp.residual_severity) * num(exp.residual_likelihood) : null;
    const calc_level = scoreToLevel(initial);

    const chosen = asList(exp.escalation_conditions).map((x) => x.toLowerCase());
    const matched_rules = [];
    (riskRules || []).forEach((r) => {
      const label = `${str(r.hazard)}: ${str(r.condition)}`;
      if (chosen.includes(label.toLowerCase())) {
        matched_rules.push({ rule_id: str(r.rule_id), label, min_level: up(r.min_level) });
      }
    });

    const register = {};
    (chemRegister || []).forEach((c) => { if (str(c.cas)) register[str(c.cas)] = c; });
    const legal_flags = [];
    const chemLevels = [];
    const chemicals = parseChemicals(exp.chemicals_raw).map((p) => {
      const reg = register[p.cas];
      const c = {
        cas: p.cas, name: p.name, quantity: p.quantity, unit: p.unit,
        registered: !!reg, vn_listed: false, hazardous: false, special_control: false,
        threshold_kg: null, threshold_exceeded: false, flags: [], raw: p.raw, parseError: p.parseError,
      };
      if (p.parseError) {
        c.flags.push('line not understood — expected "CAS, name, quantity, unit"');
        return c;
      }
      if (!reg) {
        c.flags.push('not in VN_CHEMICAL_REGISTER — manual legal check required');
      } else {
        c.name = c.name || str(reg.name_en);
        c.vn_listed = isYes(reg.vn_listed);
        c.hazardous = isYes(reg.hazardous);
        c.special_control = isYes(reg.special_control);
        c.threshold_kg = num(reg.threshold_kg);
        if (c.vn_listed) c.flags.push('on VN chemical list (Decree 24/2026 — verify)');
        if (c.special_control) c.flags.push('special-control chemical (Decree 24/2026 — verify)');
        if (c.threshold_kg !== null) {
          const unit = c.unit.toLowerCase();
          if (c.quantity === null) {
            c.flags.push('quantity missing — check threshold manually');
          } else if (unit === 'kg' || unit === 'g') {
            const kg = unit === 'g' ? c.quantity / 1000 : c.quantity;
            c.threshold_exceeded = kg >= c.threshold_kg;
            if (c.threshold_exceeded) {
              c.flags.push(`quantity exceeds threshold ${c.threshold_kg} kg — chemical emergency plan required (Decree 25/2026)`);
            }
          } else {
            c.flags.push('quantity unit not comparable — check threshold manually');
          }
        }
        if (c.hazardous) chemLevels.push('MEDIUM');
        if (c.special_control || c.threshold_exceeded) chemLevels.push('HIGH');
      }
      const who = c.name ? `${c.cas} ${c.name}` : c.cas;
      c.flags.forEach((f) => legal_flags.push(`${who}: ${f}`));
      return c;
    });

    const chem_min_level = maxLevel(chemLevels);
    const min_level = maxLevel(matched_rules.map((r) => r.min_level), chem_min_level);
    const inherent_level = maxLevel(calc_level, min_level);
    if (inherent_level === 'HIGH') legal_flags.push(HIGH_ROUTE_FLAG);

    return {
      initial_score: initial, calc_level, matched_rules, chemicals, chem_min_level, min_level, inherent_level,
      residual_score: residual, residual_level: scoreToLevel(residual),
      route_level: inherent_level,
      legal_flags: [...new Set(legal_flags)],
    };
  }

  // ---------- training ----------
  function trainingExpiry(completedOn, validityMonths) {
    const n = num(validityMonths);
    if (!n || n <= 0) return '';
    return addMonths(completedOn, n);
  }

  function typeIndex(trainingTypes) {
    const idx = {};
    (trainingTypes || []).forEach((t) => { if (str(t.training_code)) idx[up(t.training_code)] = t; });
    return idx;
  }

  // Expiry of a record: its expires_on, else computed from the type's validity; '' = never expires.
  function recordExpiry(rec, types) {
    const d = parseDate(rec.expires_on);
    if (d) return d;
    const t = types[up(rec.training_code)];
    return t ? trainingExpiry(rec.completed_on, t.validity_months) : '';
  }

  function expiringTraining(records, trainingTypes, today, days) {
    const types = typeIndex(trainingTypes);
    const horizon = num(days) === null ? 30 : num(days);
    const latest = {};
    (records || []).forEach((r) => {
      const email = lower(r.email), code = up(r.training_code);
      if (!email || !code) return;
      const key = `${email}|${code}`;
      const prev = latest[key];
      const done = parseDate(r.completed_on);
      if (!prev || done >= parseDate(prev.completed_on)) latest[key] = r;
    });
    const out = [];
    Object.values(latest).forEach((r) => {
      const expires_on = recordExpiry(r, types);
      if (!expires_on) return;
      const days_left = daysBetween(today, expires_on);
      if (days_left === null || days_left > horizon) return;
      const code = up(r.training_code);
      out.push({
        email: lower(r.email), training_code: code, name: types[code] ? str(types[code].name) : code,
        expires_on, days_left, status: days_left < 0 ? 'EXPIRED' : 'EXPIRING',
      });
    });
    return out.sort((a, b) => a.days_left - b.days_left || a.email.localeCompare(b.email));
  }

  // ---------- compliance ----------
  function checkCompliance(exp, risk, data, today) {
    data = data || {};
    risk = risk || {};
    today = parseDate(today);
    const checks = [];
    const add = (id, label, problems, warnings, okDetail) => {
      const status = problems.length ? 'FAIL' : warnings.length ? 'WARN' : 'PASS';
      const detail = problems.length ? problems.join('; ') : warnings.length ? warnings.join('; ') : okDetail;
      checks.push({ id, label, status, detail });
    };

    const emails = parseEmails(exp.researcher_emails);
    const people = {};
    (data.people || []).forEach((p) => { if (lower(p.email)) people[lower(p.email)] = p; });
    const eqIndex = {};
    (data.equipment || []).forEach((e) => { if (str(e.equipment_id)) eqIndex[up(e.equipment_id)] = e; });
    const eqIds = asList(exp.equipment_ids).map(up);
    const knownEq = eqIds.map((id) => eqIndex[id]).filter(Boolean);

    // registered
    const unregistered = emails.filter((e) => !people[e] || up(people[e].status) !== 'ACTIVE');
    add('registered', 'Researchers registered',
      unregistered.length ? [`Not registered/active in PEOPLE: ${unregistered.join(', ')}`] : [], [],
      `${emails.length} researcher(s) registered`);

    // osh_group
    const unclassified = emails.filter((e) => people[e] &&
      (!str(people[e].vn_osh_group) || lower(people[e].vn_osh_group) === 'not yet classified'));
    add('osh_group', 'Vietnam OSH group classified', [],
      unclassified.length ? [`OSH group not classified: ${unclassified.join(', ')}`] : [], 'All classified');

    // training
    const types = typeIndex(data.trainingTypes);
    const hazards = asList(exp.hazards).map((h) => h.toLowerCase());
    const required = [];
    const need = (code) => { code = up(code); if (code && !required.includes(code)) required.push(code); };
    (data.trainingTypes || []).forEach((t) => {
      const rf = parseList(t.required_for).map((x) => x.toLowerCase());
      if (rf.includes('all') || rf.some((h) => hazards.includes(h))) need(t.training_code);
    });
    knownEq.forEach((e) => parseList(e.required_training).forEach(need));
    const missing = [], expiring = [];
    emails.forEach((email) => {
      required.forEach((code) => {
        let best = null; // null = no record, '' = never expires, else the latest expiry date
        (data.trainingRecords || []).forEach((r) => {
          if (lower(r.email) !== email || up(r.training_code) !== code || best === '') return;
          const e = recordExpiry(r, types);
          if (e === '' || best === null || e > best) best = e;
        });
        if (best === null) missing.push(`${email}: ${code} missing`);
        else if (best !== '' && best < today) missing.push(`${email}: ${code} expired ${best}`);
        else if (best !== '' && daysBetween(today, best) <= 30) expiring.push(`${email}: ${code} expires ${best}`);
      });
    });
    add('training', 'Required training valid', missing, expiring,
      required.length ? `Valid: ${required.join(', ')}` : 'No training required');

    // sop
    const sopIndex = {};
    (data.sops || []).forEach((s) => { if (str(s.sop_id)) sopIndex[up(s.sop_id)] = s; });
    const sopIds = [...new Set([...asList(exp.sop_ids).map(up), ...knownEq.map((e) => up(e.sop_id)).filter(Boolean)])];
    const sopProblems = [];
    sopIds.forEach((id) => {
      const s = sopIndex[id];
      if (!s) { sopProblems.push(`${id} not in SOP_MASTER`); return; }
      if (up(s.status) !== 'ACTIVE') { sopProblems.push(`${id} is not ACTIVE (${str(s.status) || 'blank'})`); return; }
      emails.forEach((email) => {
        const acked = (data.sopAcks || []).some((a) => lower(a.email) === email && up(a.sop_id) === id &&
          sameVersion(a.version, s.version));
        if (!acked) sopProblems.push(`${email}: no acknowledgement of ${id} v${str(s.version)}`);
      });
    });
    add('sop', 'Current SOP acknowledged', sopProblems, [],
      sopIds.length ? `Acknowledged: ${sopIds.join(', ')}` : 'No SOPs listed');

    // equipment
    const eqProblems = [], eqWarnings = [];
    eqIds.forEach((id) => {
      const e = eqIndex[id];
      if (!e) { eqProblems.push(`${id} not in EQUIPMENT`); return; }
      const st = up(e.status);
      if (st === 'RED') eqProblems.push(`${id} is out of service (RED)`);
      const authorized = parseEmails(e.authorized_users);
      const notAuth = emails.filter((x) => !authorized.includes(x));
      if (notAuth.length) eqProblems.push(`${id}: not authorized: ${notAuth.join(', ')}`);
      if (st === 'YELLOW') eqWarnings.push(`${id} requires supervisor presence (YELLOW)`);
    });
    add('equipment', 'Equipment authorization', eqProblems, eqWarnings,
      eqIds.length ? `Authorized: ${eqIds.join(', ')}` : 'No equipment listed');

    // sds
    const chems = risk.chemicals || parseChemicals(exp.chemicals_raw);
    const hasChems = chems.length > 0;
    add('sds', 'Chemical SDS available',
      hasChems && str(exp.sds_uploaded) !== 'Yes' ? [`SDS uploaded = "${str(exp.sds_uploaded) || 'blank'}"`] : [], [],
      hasChems ? 'SDS uploaded' : 'No chemicals listed');

    // chemical_legal
    const bad = chems.filter((c) => c.parseError).map((c) => `cannot parse "${c.raw}"`);
    const legalWarn = chems.filter((c) => !c.parseError && (c.registered === false || (c.flags || []).length))
      .map((c) => `${c.cas}${c.name ? ' ' + c.name : ''}: ${(c.flags || []).join(', ') || 'not registered'}`);
    add('chemical_legal', 'Chemical legal check', bad, legalWarn,
      hasChems ? 'No legal flags' : 'No chemicals listed');

    // risk_complete
    const riskProblems = [];
    ['severity', 'likelihood', 'residual_severity', 'residual_likelihood'].forEach((k) => {
      if (num(exp[k]) === null) riskProblems.push(`${k} missing`);
    });
    if (!str(exp.controls)) riskProblems.push('controls blank');
    if (!str(exp.emergency_procedure)) riskProblems.push('emergency procedure blank');
    const rs = num(risk.residual_score), is = num(risk.initial_score);
    add('risk_complete', 'Risk assessment complete', riskProblems,
      rs !== null && is !== null && rs > is ? [`residual score ${rs} > initial score ${is}`] : [], 'Complete');

    // legal_ack
    add('legal_ack', 'External approvals acknowledged',
      exp.legal_ack === true || isYes(exp.legal_ack) ? [] : ['Legal acknowledgement not given'], [], 'Acknowledged');

    return { ok: checks.every((c) => c.status !== 'FAIL'), checks };
  }

  // ---------- routing / workflow ----------
  function reviewerKeyFor(level) {
    const l = up(level);
    if (l === 'LOW') return 'SUPERVISOR_EMAIL';
    if (l === 'MEDIUM') return 'SAFETY_REVIEWER_EMAIL';
    return 'EHS_REVIEWER_EMAIL'; // HIGH, and anything unexpected routes to the strictest reviewer
  }

  function configMap(rows) {
    const out = {};
    (rows || []).forEach((r) => { if (r && str(r.key)) out[str(r.key)] = r.value === undefined || r.value === null ? '' : r.value; });
    return out;
  }

  function nextState(exp, stage, decision) {
    const status = up(exp && exp.status), s = up(stage), d = up(decision);
    const fail = { ok: false, error: 'Experiment is not awaiting this decision',
      status: str(exp && exp.status), current_stage: str(exp && exp.current_stage) };
    const done = (st, cs) => ({ ok: true, status: st, current_stage: cs || '' });
    if (status === 'PENDING_REVIEW' && s === 'REVIEW') {
      if (d === 'APPROVE' || d === 'APPROVE_WITH_CONDITIONS') return done('PENDING_PI', 'PI');
      if (d === 'CHANGES_REQUIRED') return done('CHANGES_REQUIRED');
      if (d === 'REJECT') return done('REJECTED');
    }
    if (status === 'PENDING_PI' && s === 'PI') {
      if (d === 'APPROVE') return done('APPROVED');
      if (d === 'APPROVE_WITH_CONDITIONS') return done('APPROVED_WITH_CONDITIONS');
      if (d === 'CHANGES_REQUIRED') return done('CHANGES_REQUIRED');
      if (d === 'REJECT') return done('REJECTED');
    }
    return fail;
  }

  // ---------- tokens ----------
  function makeToken(secret, expId, stage) {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', String(secret)).update(`${expId}|${stage}`).digest('hex').slice(0, 32);
  }

  function verifyToken(secret, expId, stage, token) {
    if (typeof token !== 'string' || !/^[0-9a-f]{32}$/i.test(token) || !secret) return false;
    // Constant-time compare of two 32-char hex strings (no Buffer needed in Code nodes).
    const a = makeToken(secret, expId, stage), b = token.toLowerCase();
    let diff = 0;
    for (let i = 0; i < 32; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // ---------- html ----------
  function escapeHtml(s) {
    return (s === null || s === undefined ? '' : String(s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function experimentSummaryHtml(exp, risk, compliance, extra) {
    exp = exp || {};
    const r = risk || {};
    const pick = (k) => (r[k] !== undefined && r[k] !== null ? r[k] : exp[k]);
    const cell = (v) => escapeHtml(Array.isArray(v) ? v.join(', ') : v).replace(/\r?\n/g, '<br>');
    const pretty = (k) => k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    const rows = [];
    const row = (label, v) => rows.push(
      `<tr><th style="text-align:left;vertical-align:top;padding:4px 8px;background:#f3f4f6;border:1px solid #ddd">${escapeHtml(label)}</th>` +
      `<td style="padding:4px 8px;border:1px solid #ddd">${v}</td></tr>`);
    const ex = extra || {};

    row('Experiment ID', cell(ex.exp_id || exp.exp_id || ''));
    Object.keys(ex).filter((k) => k !== 'exp_id').forEach((k) => row(pretty(k), cell(ex[k])));
    if (exp.status) row('Status', cell(exp.status));
    row('Title', cell(exp.title));
    row('Project', cell(exp.project));
    row('Principal Investigator', cell(exp.pi_name));
    row('Leader', cell(exp.leader_email));
    row('Researchers', cell(exp.researcher_emails));
    row('Lab / room', cell(exp.lab));
    row('Dates', cell(`${str(exp.start_date)} → ${str(exp.end_date)}`));
    row('SOPs', cell(exp.sop_ids));
    row('Equipment', cell(exp.equipment_ids));
    row('Hazards', cell(exp.hazards));
    row('Escalation conditions', cell(exp.escalation_conditions));
    row('Hazard details', cell(exp.hazard_details));
    row('Chemicals', cell(exp.chemicals_raw));
    row('SDS uploaded', cell(exp.sds_uploaded));
    row('Initial risk', cell(`S${str(exp.severity)} × L${str(exp.likelihood)} = ${str(pick('initial_score'))} → ${str(pick('calc_level'))}`));
    const rules = Array.isArray(r.matched_rules)
      ? r.matched_rules.map((m) => `${m.rule_id} ${m.label} (${m.min_level})`) : exp.matched_rules;
    row('Matched escalation rules', cell(rules));
    row('Mandatory minimum', cell(pick('min_level') || '—'));
    row('Inherent (route) level', `<b>${cell(pick('inherent_level'))}</b>`);
    row('Residual risk', cell(`S${str(exp.residual_severity)} × L${str(exp.residual_likelihood)} = ${str(pick('residual_score'))} → ${str(pick('residual_level'))}`));
    row('Controls', cell(exp.controls));
    row('Emergency procedure', cell(exp.emergency_procedure));
    const flags = pick('legal_flags');
    row('Legal flags', Array.isArray(flags) ? flags.map(cell).join('<br>') : cell(flags));
    if (compliance && Array.isArray(compliance.checks)) {
      const color = { PASS: '#15803d', WARN: '#b45309', FAIL: '#b91c1c' };
      row('Compliance checks', compliance.checks.map((c) =>
        `<span style="color:${color[c.status] || '#000'};font-weight:bold">${escapeHtml(c.status)}</span> ` +
        `${escapeHtml(c.label)}: ${escapeHtml(c.detail)}`).join('<br>'));
    } else if (exp.compliance_summary) {
      row('Compliance checks', cell(exp.compliance_summary));
    }
    return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows.join('')}</table>`;
  }

  function complianceSummary(compliance) {
    if (!compliance || !Array.isArray(compliance.checks)) return '';
    const issues = compliance.checks.filter((c) => c.status !== 'PASS');
    return issues.length ? issues.map((c) => `${c.status} ${c.label}: ${c.detail}`).join('; ') : 'All checks passed';
  }

  function toExperimentRow(exp, risk, compliance, fields) {
    exp = exp || {};
    const r = risk || {};
    const f = fields || {};
    const src = {
      ...exp,
      researcher_emails: joinList(exp.researcher_emails),
      sop_ids: joinList(exp.sop_ids),
      equipment_ids: joinList(exp.equipment_ids),
      hazards: joinList(exp.hazards),
      escalation_conditions: joinList(exp.escalation_conditions),
      initial_score: r.initial_score,
      calc_level: r.calc_level,
      min_level: r.min_level,
      inherent_level: r.inherent_level,
      matched_rules: Array.isArray(r.matched_rules) ? r.matched_rules.map((m) => m.rule_id).join(', ') : '',
      residual_score: r.residual_score,
      residual_level: r.residual_level,
      legal_flags: joinList(r.legal_flags, '; '),
      compliance_summary: complianceSummary(compliance),
    };
    const out = {};
    EXPERIMENT_HEADERS.forEach((h) => {
      const v = f[h] !== undefined ? f[h] : src[h];
      out[h] = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : v;
    });
    return out;
  }

  return {
    LEVELS, EXPERIMENT_HEADERS,
    scoreToLevel, maxLevel, parseList, parseEmails, parseDate, addMonths, daysBetween, nextId,
    normalizeExperiment, parseChemicals, assessRisk, checkCompliance, reviewerKeyFor, configMap,
    nextState, makeToken, verifyToken, trainingExpiry, expiringTraining, escapeHtml,
    experimentSummaryHtml, toExperimentRow,
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SafeLab;
