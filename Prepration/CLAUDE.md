# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This directory is a collection of ~58 independent microservice/UI repositories for Tata Motors' manufacturing platform (Enterprise Platform / EP). Each subdirectory is a self-contained project — not a traditional monorepo. Most subdirectories have their own `CLAUDE.md` with project-specific commands and architecture detail; read that first when working inside a specific project.

## Technology Landscape

| Domain | Stack |
|--------|-------|
| Frontend UIs | React 18/19 + Vite, MUI 5/6, Recoil/Redux Toolkit, TypeScript |
| Desktop app | React 19 + Tauri (Rust backend) — `ep-prolife-service-ui` |
| Backend services | Spring Boot 2.7 / JDK 17 (Java + Kotlin repos), Python Flask/FastAPI |
| Database | PostgreSQL (production), H2 (test), AWS RDS |
| Messaging | Apache Kafka + Zookeeper |
| Auth | Keycloak (OAuth2 JWT) |
| IaC | Terraform, KOPS, Kubernetes, Helm, Ansible |
| CI/CD | GitHub Actions → AWS ECR, ArgoCD (GitOps), Jenkins (legacy) |

## Common Commands Per Stack

### Spring Boot (Gradle)
```bash
./setup.sh                          # Once after clone — installs git pre-commit hooks
./gradlew build
./gradlew bootRun                   # App on :9090, actuator on :9096
./gradlew test
./gradlew test --tests "com.tml.SomeTest"   # Single test class
./gradlew spotlessApply             # Fix formatting (enforced by pre-commit hook)
./gradlew spotlessCheck

# Local infra (PostgreSQL :5432, Kafka :9092, Zookeeper :2181)
docker-compose -f docker-compose-tools.yml up -d
```

### React / Vite (npm)
```bash
npm install
npm run dev        # Vite dev server (typically :3000 or :5173)
npm run build
npm run lint       # ESLint — max-warnings 0, failures block CI
npm run storybook  # Component dev server on :6006
```

### Infrastructure (ep-assembly-root, ep-infrastructure)
```bash
# Copy and fill in env vars before any infra commands
cp .envrc.sample .envrc && direnv allow

# Terraform (from terraform/{module}/{context}/{env}/)
terraform init && terraform plan && terraform apply

# Kubernetes via Makefile targets
make <target>   # See Makefile in ep-assembly-root, ep-assembly-comms, etc.
```

## Cross-Project Architecture

### Product Lines
- **ep-*** — Enterprise Platform: assembly, production, BOM, prolife, pipelines, infrastructure
- **pv-*** — Passenger Vehicle
- **sadhan-*** — Logistics and packaging
- **esakha-*** — Supply chain / e-Sakha
- **nirman-*** — Assembly station
- **IQMS-*** — Quality management
- **control-tower-*** — Sampravah manufacturing dashboard

### Common Backend Patterns (Spring Boot services)
- Package root: `com.tml`; layers: `controller`, `service`, `repository`, `entity`, `dto`, `config`
- Kotlin is used for JPA repositories; Java for controllers and services
- Flyway migrations: `src/main/resources/migrations/` named `VYYYYMMDDhhmm__description.sql`; out-of-order enabled
- Tests: H2 in-memory (PostgreSQL dialect), Flyway disabled, JPA `create-drop`, WireMock for HTTP stubs
- Kafka consumers: single-threaded (`concurrency=1`), manual commit, 10 poll records, offset reset `latest`
- Functional error handling: Vavr `Try<T>` / `Either<L,R>` throughout service layers
- Security: stateless OAuth2 JWT via `SecurityContextFilter` + `JwtUtil`

### Common Frontend Patterns (React + Vite)
- All API calls go through a shared Axios wrapper (60 s timeout, bearer token, error → toast)
- `src/` aliased as `src/` in both `vite.config.js` and `jsconfig.json`
- Global SCSS utilities (`Colors.scss`, `Flex.scss`, `Spacing.scss`) — import rather than hardcode
- Route constants consolidated in `src/constants/constants.jsx`

### CI/CD
- GitHub Actions triggers on pushes to `development`, `master`, `pre-prod`
- Builds Docker image and pushes to AWS ECR (`ap-south-1`) tagged with `<commit-sha>`
- ArgoCD watches ECR tags for GitOps deployments (IPMS4 platform)
- Jenkins pipelines still active for legacy platforms

### Secrets & Environment
- Local dev: `.envrc` / `direnv` (copy from `.envrc.sample`)
- Production: AWS Secrets Manager via External Secrets Operator; Ansible Vault for infra secrets
- Never commit `.envrc` — it is gitignored

## Per-Project CLAUDE.md Files

The following projects have detailed CLAUDE.md guidance already:

| Project | Focus |
|---------|-------|
| `ep-production-broadcast/` | Spring Boot supply chain, Kafka, SAP integration |
| `ep-prolife-service/` | Spring Boot + Kotlin, Vavr patterns |
| `ep-prolife-service-ui/` | React 19 + Tauri desktop app |
| `ep-prolife-service-hht-ui/` | HHT (handheld terminal) variant |
| `control-tower-web-frontend/` | Sampravah React dashboard, Recoil state |
| `ep-infrastructure/` | Terraform, KOPS, Kafka, Keycloak, AWS |
| `ep-pipelines/` | Jenkins shared library, Helm, ArgoCD, Ansible |
| `ep-reconciliation/` | Reconciliation service |
| `ep-machine-integration/` | Machine integration service |
