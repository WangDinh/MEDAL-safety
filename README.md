# MEDAL-safety

**VinUni SafeLab** — research safety, training and experiment-approval system built from
Google Forms + Google Sheets + n8n + Gmail.

## Repository layout

```text
docker-compose.yml   n8n (single container)
.env.example         copy to .env (secrets, public URL)
google/              Apps Script: builds the master sheet + 7 forms + dashboard
n8n/                 logic library, tests, workflows, build script
docs/                user guide, build spec, Notion design notes
```

## Docs

### SafeLab system
- [docs/SafeLab_User_Guide.docx](docs/SafeLab_User_Guide.docx) — user guide for lab members, reviewers, the PI and the safety coordinator (**hand this out**)
- [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) — install, configure and maintain SafeLab (for the system maintainer)
- [docs/SAFELAB_SPEC.md](docs/SAFELAB_SPEC.md) — build spec: sheet tabs, form questions, risk/compliance rules, workflows

### Design notes exported from Notion (VinUni - Ontology / Safety Checklist)
- [Safety Checklist](docs/notion/safety-checklist.md) — six-document safety system (LSP-00, ESP-01, MSP-01, CSP-01, MAT-01, ERP-01), lab zoning, permits
- [Proposed Safety Platform](docs/notion/proposed-safety-platform.md) — VinUni SafeLab architecture (the system built here)
- [Videos to watch](docs/notion/videos-to-watch.md) — training playlists and the 5-step certification
- [Forms](docs/notion/forms.md) · [Safety Documents](docs/notion/safety-documents.md) · [Safety Incident Reports](docs/notion/safety-incident-reports.md) · [Safety Management](docs/notion/safety-management.md)

### Attachments
- [SOP - ESP-01.docx](docs/SOP%20-%20ESP-01.docx) — Electrical Safety SOP
