# MEDAL-safety

**VinUni SafeLab** — research safety, training and experiment-approval system built from
Google Forms + Google Sheets + n8n + Gmail.

- Setup and usage: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- Build spec: [docs/SAFELAB_SPEC.md](docs/SAFELAB_SPEC.md)
- Design notes (from Notion): [docs/](docs/README.md)

```text
safelab/
  docker-compose.yml   n8n
  google/SafeLab.gs    Apps Script: builds the master sheet + 7 forms
  n8n/                 logic library, tests, workflows, build script
```
