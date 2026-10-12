# SafeLab — Admin & Setup Guide

> For the person who installs and maintains SafeLab. Lab members use the Word user guide instead.

SafeLab is the lab's safety-approval system: researchers fill in **Google Forms**, everything is
stored in one **Google Sheet** (`SAFELAB_MASTER`), and **n8n** checks, routes and emails
automatically. Dr. Simon Park is the final internal approver for every experiment.

Design background: [notion/proposed-safety-platform.md](notion/proposed-safety-platform.md) ·
exact rules and field names: [SAFELAB_SPEC.md](SAFELAB_SPEC.md)

```text
Google Form ──► SAFELAB_MASTER (Fxx_RESPONSES tab)
                     │  n8n polls every minute
                     ▼
                n8n workflow ── risk score + mandatory rules + VN chemical check + compliance check
                     │
        ┌────────────┴─────────────┐
   checks FAIL                checks PASS
   email: what's missing      email reviewer (LOW → supervisor, MEDIUM → safety, HIGH → EHS)
                                   │ approve
                                   ▼
                              email Dr. Simon Park — FINAL APPROVAL
                                   │
                              email researcher the outcome · APPROVALS + AUDIT_LOG rows
```

---

## Part 1 — Setup (one time, ~45 min)

You need: Docker Desktop, a Google account (demo: `quangdinh2102@gmail.com`).
All commands below are run in **PowerShell** from the repo folder (`D:\VinUni\code\MEDAL-safety`).

### 1. Create the master sheet and the 7 forms

1. Go to <https://sheets.new> to create a blank Google Sheet.
2. **Extensions → Apps Script**. Delete the sample code and paste all of [`google/SafeLab.gs`](../google/SafeLab.gs).
3. **Project Settings (⚙) → tick "Show appsscript.json manifest file"**, open `appsscript.json` in the editor, and replace it with [`google/appsscript.json`](../google/appsscript.json).
4. Back in the editor, select the function **`setupSafeLab`** and click **Run**.
   Google shows an "unverified app" warning because this is your own script: **Advanced → Go to project → Allow**.
5. Reload the spreadsheet. A **SafeLab** menu appears. Then:
   - **SafeLab → Add demo data** — makes `quangdinh2102@gmail.com` a fully trained, authorized demo researcher.
   - **SafeLab → Show form links** — the 7 form links (also in the `CONFIG` tab).
6. Open each form once from its edit link (`CONFIG` → `note` column). If a form says it is not accepting responses, click **Publish**.
7. Copy the **sheet ID** from the URL: `https://docs.google.com/spreadsheets/d/`**`<THIS_PART>`**`/edit`.

The setup script is safe to re-run: it doesn't duplicate tabs, seed rows or forms.

### 2. Start n8n

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set `N8N_ENCRYPTION_KEY` and `SAFELAB_SECRET` to two different long random strings. You can generate them with:

```powershell
-join ((48..57)+(97..122) | Get-Random -Count 40 | % {[char]$_})
```

```powershell
docker compose up -d
```

Open <http://localhost:5678> and create the n8n owner account.

### 3. Create a Google OAuth client (lets n8n read the sheet and send Gmail)

In <https://console.cloud.google.com>:

1. Create a project, e.g. `safelab`.
2. **APIs & Services → Library**: enable **Google Sheets API**, **Google Drive API**, **Gmail API**.
3. **OAuth consent screen**: User type **External**, app name `SafeLab`, add **`quangdinh2102@gmail.com` as a test user**.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   Authorized redirect URI: `http://localhost:5678/rest/oauth2-credential/callback`
5. Copy the **Client ID** and **Client secret**.

### 4. Create the 3 credentials in n8n — names must match exactly

In n8n: **Credentials → Add credential** (paste the Client ID/secret, then **Sign in with Google**):

| Credential type | Name (exact) |
|---|---|
| Google Sheets OAuth2 API | `SafeLab Google Sheets` |
| Google Sheets Trigger OAuth2 API | `SafeLab Sheets Trigger` |
| Gmail OAuth2 API | `SafeLab Gmail` |

Create them **before** importing the workflows; then n8n links every node to them automatically by name.

### 5. Build and import the workflows

```powershell
docker run --rm -v "${PWD}/n8n:/w" -w /w node:20-alpine node build.mjs --sheet-id <YOUR_SHEET_ID>
```

```powershell
docker exec safelab-n8n n8n import:workflow --separate --input=/workflows
```

Re-running both commands later updates the same 8 workflows (fixed IDs), it does not duplicate them.

### 6. Activate

In n8n, open each **SafeLab 0x …** workflow and switch it **Active**.

> ⚠️ Do **not** click "Test workflow" on the workflows that start with a Sheets trigger: a manual test
> processes *all* existing form rows again (duplicate records and emails). Activate them instead —
> after activation only rows added from then on are processed.

You're done. The next section is a 10-minute demo to prove it works.

---

## Part 2 — Demo walkthrough

Everything goes to `quangdinh2102@gmail.com`, which plays every role. Allow ~1 minute after each
form submission (n8n polls the sheet every minute).

**A. An experiment that passes and gets approved**

1. Open **F04 – Experimental Safety Approval** and submit:
   - Researcher emails: `quangdinh2102@gmail.com` · Leader email: same
   - Related SOP IDs: `SOP-ESP-01` · Equipment IDs: `EQ-PSU-01`
   - Hazards: **High voltage** · Escalation conditions: **High voltage: exposed conductors**
   - Chemicals: leave empty, SDS: **Not applicable**
   - Severity 3, Likelihood 2 (→ 6 = MEDIUM), Residual severity 3, Residual likelihood 1
   - Controls, Emergency procedure: any text · tick the legal acknowledgement
2. You receive **"[SafeLab] Received – …"** (as researcher) and **"[SafeLab] Review required – … (MEDIUM)"** (as safety reviewer).
3. Click the link in the review request → a page with the full assessment → choose **Approve** → Submit.
4. You receive **"[SafeLab] FINAL APPROVAL – EXP-2026-0001 …"** (as Dr. Simon Park) → open → **Approve**.
5. You receive the final outcome. Check the sheet: `EXPERIMENTS` (status `APPROVED`), `APPROVALS` (2 rows), `AUDIT_LOG`, `DASHBOARD`.

**B. An experiment that is stopped automatically**

Submit F04 again but add `someone@example.com` to the researcher emails. You get a
**"[SafeLab] Submission incomplete – …"** email listing what failed (person not registered, no training, …).
No reviewer is bothered: this is the "n8n rejects incomplete submissions before they reach Simon" rule.

**C. The mandatory minimum rule**

Submit with Severity 1, Likelihood 2 (score 2 = LOW) but tick **Li-ion: deliberate thermal runaway**
(and hazard **Battery**). The experiment is routed as **HIGH** anyway — "Final Risk = MAX(calculated, mandatory minimum)".

**D. Incident**

Submit **F06 – Incident / Near Miss** with *Was anyone injured? = Yes*. The safety coordinator gets
the report, the PI gets an **[URGENT]** email, and a CAPA ("Investigate INC-…") is created with a 14-day due date.

> Approval links point to `http://localhost:5678`, so in the local demo they only work on the machine
> running Docker. See Part 5 for making them work for everyone.

---

## Part 3 — Everyday use

### Researchers / students
| When | Do |
|---|---|
| Joining the lab | Submit **F01 Personnel Registration**. You get an email listing the mandatory trainings. |
| After each training | Watch the videos (links in `TRAINING_TYPES`), then submit **F02 Training Record** with a link to your certificate/quiz. |
| Before using an SOP / equipment | Read the SOP, then submit **F03 SOP Acknowledgement**. A new SOP version needs a new acknowledgement. |
| Before any experiment | Submit **F04 Experimental Safety Approval**. Wait for the final approval email before starting. |
| Something changes | Submit **F05 Experiment Modification** with the EXP ID. New hazards/people/equipment → the experiment goes to `CHANGE_PENDING` and needs a new F04. |
| Incident, near miss, unsafe condition | Submit **F06** immediately (after dealing with the emergency). |

If F04 is rejected as incomplete, the email lists each failed check; fix it (e.g. submit the missing
training record) and submit F04 again.

**Any researcher can stop an experiment because of a safety concern. Restart requires the hazard to be resolved.**

### Reviewers (supervisor / safety reviewer / EHS)
You receive *"[SafeLab] Review required – …"* emails. The link opens the full assessment with
Approve / Approve with conditions / Changes required / Reject. Conditions and changes need a comment.
Your decision is recorded in `APPROVALS` and `AUDIT_LOG`; if you approve it goes to Dr. Simon Park.

### Dr. Simon Park (PI)
You only receive experiments that already passed all automatic checks and a reviewer.
Decide from the *"FINAL APPROVAL"* email. For HIGH-risk work, your approval is the final
**internal** approval only — external permits and institutional EHS approvals are still required.
Daily overview: the `DASHBOARD` tab (pending approvals, expiring training, open incidents/CAPA).

### Safety coordinator (Hau)
- Daily 08:00: a summary email of training that expires within 30 days (each person also gets their own reminder).
- Incident and inspection emails; corrective actions live in the `CAPA` tab — set `status` to `CLOSED` and fill `closed_at` when done.
- Inspections: submit **F07 Safety Inspection / CAPA**; a corrective action creates a CAPA row and emails its owner.

---

## Part 4 — Administration

Edit these tabs directly (they have warning-only protection, so Sheets asks you to confirm):

| To change… | Edit | Then |
|---|---|---|
| Who reviews / approves, reminder window | `CONFIG` | nothing |
| Mandatory risk rules | `RISK_RULES` | **SafeLab → Refresh form choices** |
| Trainings, validity, who needs them | `TRAINING_TYPES` (`required_for` = `ALL` or hazard names) | **Refresh form choices** |
| Publish a new SOP version | `SOP_MASTER` → bump `version` | everyone must re-acknowledge (F03) before their next F04 passes |
| Add an SOP | `SOP_MASTER` row, status `ACTIVE` | **Refresh form choices** |
| Equipment + who may use it | `EQUIPMENT` (`authorized_users`, `status` GREEN/YELLOW/RED, `required_training`) | nothing |
| Vietnamese chemical rules | `VN_CHEMICAL_REGISTER` | nothing |
| Laws | `LEGAL_REGISTER` | nothing |

Rules live in the sheet, not in n8n — regulatory updates are a sheet edit.

> ⚠️ `VN_CHEMICAL_REGISTER` contains **sample demo rows only**. Verify every row against Decree 24/2026
> (and thresholds against Decree 25/2026) with VinUni EHS/legal before real use.

Never edit `EXPERIMENTS`, `APPROVALS` or `AUDIT_LOG` by hand except to correct an obvious error — they are the audit trail.

---

## Part 5 — From demo to real use

1. **Real people:** in `CONFIG`, set `PI_EMAIL` (Dr. Simon Park: `simon.p@vinuni.edu.vn`), `SUPERVISOR_EMAIL`, `SAFETY_REVIEWER_EMAIL`, `EHS_REVIEWER_EMAIL`, `SAFETY_COORDINATOR_EMAIL`. Until go-live these stay on the demo address `quangdinh2102@gmail.com`.
2. **Approval links reachable by everyone:** run n8n on the lab VM (planned) behind HTTPS — e.g. a Cloudflare Tunnel or a reverse proxy (Caddy) — and set `SAFELAB_PUBLIC_URL=https://safelab.your-domain` in `.env`, then `docker compose up -d`. Add `https://safelab.your-domain/rest/oauth2-credential/callback` as a redirect URI in Google Cloud.
3. **Google consent screen:** while the app is in "Testing", Google expires the n8n sign-in after 7 days. Publish the consent screen (or use a Google Workspace *Internal* app) for long-term use.
4. **Pin n8n:** set `N8N_VERSION` in `.env` to a specific version.
5. **Back up:** the `n8n_data` Docker volume and `N8N_ENCRYPTION_KEY`. The sheet is backed up by Google (File → Version history).
6. **Remove demo and test data:** delete the demo rows from `PEOPLE`, `TRAINING_RECORDS`, `SOP_ACK`, the test experiments from `EXPERIMENTS`/`APPROVALS`, and the demo email from `EQUIPMENT.authorized_users`.
7. **Next steps from the Notion build order (not built yet):** Google Site home page linking the 7 forms, Looker Studio dashboard on top of the sheet, PDF approval record in Drive, QR codes on equipment.

### Rolling out to the lab

| Phase | What | Who |
|---|---|---|
| 0. Go-live prep | Steps 1–6 above; fill the placeholders in the user guide (emergency number, escape route, SafeLab server address) | Maintainer, Hau |
| 1. Pilot (1 week) | 2–3 lab members go through F01 → F02 → F03 → F04 → approval; collect confusing points, fix the guide | Pilot group |
| 2. Launch (weekly safety meeting, ~30 min) | Walk through the Quick start page of the user guide; everyone submits F01 on the spot | Whole lab |
| 3. Backfill (2 weeks) | Everyone records past trainings (F02) and acknowledges current SOPs (F03); Hau confirms Vietnam OSH groups and equipment authorizations | Everyone, Hau |
| 4. Enforce | From an announced date, every new experiment needs an approved F04 | PI |

Hand out [`SafeLab_User_Guide.docx`](SafeLab_User_Guide.docx) (one guide for everyone, with chapters for reviewers, the PI and the coordinator).
To change it, edit and run [`src/build_user_guide.js`](src/build_user_guide.js) (form links are at the top of the file), or edit the Word file directly.

---

## Part 6 — Troubleshooting

| Symptom | Check |
|---|---|
| Form submitted, nothing happens | Workflow **Active**? n8n → **Executions** for errors. Wait 1–2 min (polling). The trigger only sees rows added *after* activation. |
| Executions fail with Google auth errors | Re-connect the credential (Sign in with Google). In Testing mode tokens expire after 7 days. |
| `SAFELAB_SECRET` error | Set it in `.env`, then `docker compose up -d`. |
| Approval link: "Invalid link" | The link was changed/copied partially, or `SAFELAB_SECRET` changed since the email was sent. |
| Approval link: "not awaiting this decision" | Someone already decided at that stage — check `EXPERIMENTS.status`. |
| Experiment rejected but the person *is* trained | `TRAINING_RECORDS.expires_on` in the past? `SOP_ACK.version` older than `SOP_MASTER.version`? Email spelled differently? |
| Approval link doesn't open on another PC | Expected with `localhost` — see Part 5 step 2. |
| Form dropdowns out of date | **SafeLab → Refresh form choices**. |

---

## Developer notes

- Logic library: `n8n/lib/safelab.js` (risk, compliance, ids, tokens, email HTML), unit tests in `n8n/test/`:
  ```powershell
  docker run --rm -v "${PWD}/n8n:/w" -w /w node:20-alpine node --test test/
  ```
- Workflow sources: `n8n/workflows/src/*.json`. Code nodes start with `/*@@SAFELAB_LIB@@*/`, which `build.mjs` replaces with the library. Edit `src`, never `dist`, then rebuild and re-import.
- Field names and rules are fixed in [SAFELAB_SPEC.md](SAFELAB_SPEC.md); the Apps Script, the library and the workflows all follow it.
