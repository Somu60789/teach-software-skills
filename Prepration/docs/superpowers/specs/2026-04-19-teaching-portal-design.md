# Teaching Portal — Design Spec
**Date:** 2026-04-19  
**Status:** Approved

---

## Overview

A dual-format teaching resource for the Tata Motors Enterprise Platform (TML_Repos) stack. Every skill domain in `SKILLS_REQUIRED.md` gets a standalone Markdown file (readable in any editor, GitHub, or VS Code) **and** a React web app that renders those same files as an interactive learning portal.

**Goal:** Take anyone — from fresh graduate to mid-level developer — from zero to expert in all 24 skill domains used across the 56+ repos in this codebase.

---

## Folder Structure

```
TML_Repos/
└── docs/
    └── teaching/
        ├── md/                          # Raw Markdown files (standalone readable)
        │   ├── 01-react.md
        │   ├── 02-spring-boot.md
        │   ├── 03-kotlin.md
        │   ├── 04-python-django.md
        │   ├── 05-nodejs.md
        │   ├── 06-android.md
        │   ├── 07-tauri-rust.md
        │   ├── 08-postgresql.md
        │   ├── 09-kafka.md
        │   ├── 10-authentication-keycloak.md
        │   ├── 11-aws.md
        │   ├── 12-docker.md
        │   ├── 13-kubernetes-helm.md
        │   ├── 14-terraform.md
        │   ├── 15-github-actions.md
        │   ├── 16-jenkins.md
        │   ├── 17-argocd.md
        │   ├── 18-ansible.md
        │   ├── 19-observability.md
        │   ├── 20-testing.md
        │   ├── 21-code-quality.md
        │   ├── 22-data-export.md
        │   ├── 23-external-integrations.md
        │   └── 24-shared-patterns.md
        └── portal/                      # React 18 + Vite + MUI v5 web app
            ├── public/
            ├── src/
            │   ├── components/
            │   │   ├── Sidebar.jsx
            │   │   ├── DocViewer.jsx
            │   │   ├── SearchBar.jsx
            │   │   ├── ProgressBar.jsx
            │   │   └── TopicCard.jsx
            │   ├── pages/
            │   │   ├── Home.jsx
            │   │   └── Topic.jsx
            │   ├── hooks/
            │   │   ├── useProgress.js
            │   │   └── useSearch.js
            │   ├── constants/
            │   │   └── curriculum.js
            │   └── App.jsx
            ├── vite.config.js
            └── package.json
```

---

## Tech Stack — Portal

| Concern | Choice | Reason |
|---------|--------|--------|
| Framework | React 18 | Same as TML frontend projects |
| Build tool | Vite 5 | Same as TML frontend projects |
| UI library | MUI v5 | Same as TML frontend projects |
| MD rendering | `react-markdown` + `remark-gfm` | Tables, strikethrough, GFM support |
| Syntax highlighting | `react-syntax-highlighter` (VS Code Dark+) | Familiar theme, copy button |
| Search | `fuse.js` | Lightweight client-side fuzzy search |
| Routing | React Router v6 | Standard TML pattern |
| State | React `useState` + `localStorage` | No Redux needed — progress is local |
| Theming | MUI `ThemeProvider` | Dark/light mode toggle |

---

## Features

### Sidebar
- All 24 topics listed in curriculum order
- Colored status dot per topic: grey (not started), yellow (in progress), green (complete)
- Active topic highlighted
- Collapsible on mobile

### DocViewer
- Fetches MD file from `../md/{id}.md` at runtime via `fetch()`
- Renders with `react-markdown` + `remark-gfm`
- Code blocks: `react-syntax-highlighter` with one-click copy button
- Headings auto-generate anchor links for deep linking

### Search
- `Ctrl+K` opens search modal
- `fuse.js` indexes all 24 MD files client-side at app load
- Results show topic name + matching line snippet

### Progress Tracking
- Three states per topic: Not Started → In Progress → Completed
- Reader manually marks state via button at top and bottom of each doc
- Persisted in `localStorage` (key: `tml-teaching-progress`)
- Home page shows `X / 24 completed` with a MUI LinearProgress bar

### Home Page
- Grid of 24 TopicCards: title, estimated read time, difficulty badge (Beginner / Intermediate / Advanced), status dot
- Shows prerequisite hints (e.g., "Read React first")
- Overall progress summary at top

### Navigation
- React Router v6: `/` → Home, `/topic/:id` → single doc
- Prev / Next buttons at bottom of every doc for linear reading
- Dark / light mode toggle in top navbar

---

## Teaching Doc Template (per MD file)

Every one of the 24 files follows this exact linear structure:

```markdown
# [Topic Name]

## Prerequisites
## What & Why
## Core Concepts
## Installation & Setup
## Beginner
## Intermediate
## Advanced
## Expert
## In the TML Codebase
## Quick Reference
```

**Content rules:**
- Generic examples first (Todo, User, Product entities)
- TML-specific examples in the "In the TML Codebase" section only
- Every code block has a language tag for syntax highlighting
- Estimated length: 2,000–6,000 words per file (Kafka, Spring Boot longest; Tauri, SAP JCo shortest)

---

## Curriculum Map & Prerequisites

| # | Topic | Prerequisites | Difficulty |
|---|-------|--------------|------------|
| 01 | React | None | Beginner→Expert |
| 02 | Spring Boot (Java) | None | Beginner→Expert |
| 03 | Kotlin | 02 Spring Boot | Intermediate→Expert |
| 04 | Python / Django | None | Beginner→Expert |
| 05 | Node.js | None | Beginner→Advanced |
| 06 | Android (Jetpack Compose) | 03 Kotlin | Intermediate→Expert |
| 07 | Tauri & Rust | 01 React | Intermediate→Advanced |
| 08 | PostgreSQL | None | Beginner→Expert |
| 09 | Apache Kafka | 08 PostgreSQL | Intermediate→Expert |
| 10 | Authentication & Keycloak | 01 React, 02 Spring Boot | Intermediate→Expert |
| 11 | AWS Cloud Services | None | Beginner→Advanced |
| 12 | Docker | None | Beginner→Advanced |
| 13 | Kubernetes & Helm | 12 Docker | Intermediate→Expert |
| 14 | Terraform | 11 AWS, 13 Kubernetes | Intermediate→Expert |
| 15 | GitHub Actions | 12 Docker | Beginner→Advanced |
| 16 | Jenkins | 12 Docker | Intermediate→Advanced |
| 17 | ArgoCD | 13 Kubernetes | Intermediate→Advanced |
| 18 | Ansible | None | Beginner→Advanced |
| 19 | Observability & Monitoring | 13 Kubernetes | Intermediate→Advanced |
| 20 | Testing | 01 React, 02 Spring Boot | Beginner→Expert |
| 21 | Code Quality & Linting | 01 React, 02 Spring Boot | Beginner→Intermediate |
| 22 | Data Export & File Processing | 01 React, 02 Spring Boot | Beginner→Intermediate |
| 23 | External Integrations (SAP, IoT) | 02 Spring Boot, 09 Kafka | Advanced→Expert |
| 24 | Shared Patterns & Conventions | All of the above | Expert |

---

## Portal Commands

```bash
cd docs/teaching/portal
npm install
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build
npm run preview    # Preview production build
```

---

## Out of Scope

- Backend for the portal (all static / localStorage — no server)
- User accounts or cloud-synced progress
- Video content
- Auto-grading or quizzes
- Versioning of docs (single latest version)
