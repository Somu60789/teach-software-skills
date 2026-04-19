# Skills Required — Tata Motors Enterprise Platform (TML_Repos)

This document covers every technical skill required to work across the 56+ repositories in this monorepo collection. Organised by domain, then technology depth.

---

## Table of Contents

1. [Frontend Development](#1-frontend-development)
2. [Backend — Java / Kotlin (Spring Boot)](#2-backend--java--kotlin-spring-boot)
3. [Backend — Python (Django / FastAPI)](#3-backend--python-django--fastapi)
4. [Backend — Node.js](#4-backend--nodejs)
5. [Mobile — Android](#5-mobile--android)
6. [Desktop — Tauri (Rust + React)](#6-desktop--tauri-rust--react)
7. [Databases](#7-databases)
8. [Messaging — Apache Kafka](#8-messaging--apache-kafka)
9. [Authentication & Security](#9-authentication--security)
10. [AWS Cloud Services](#10-aws-cloud-services)
11. [Containerisation — Docker](#11-containerisation--docker)
12. [Kubernetes & Helm](#12-kubernetes--helm)
13. [Infrastructure as Code — Terraform](#13-infrastructure-as-code--terraform)
14. [CI/CD — GitHub Actions](#14-cicd--github-actions)
15. [CI/CD — Jenkins](#15-cicd--jenkins)
16. [GitOps — ArgoCD](#16-gitops--argocd)
17. [Configuration Management — Ansible](#17-configuration-management--ansible)
18. [Observability & Monitoring](#18-observability--monitoring)
19. [Testing](#19-testing)
20. [Code Quality & Linting](#20-code-quality--linting)
21. [Data Export & File Processing](#21-data-export--file-processing)
22. [External System Integrations](#22-external-system-integrations)
23. [Shared Patterns & Conventions](#23-shared-patterns--conventions)
24. [Skills Summary Matrix](#24-skills-summary-matrix)

---

## 1. Frontend Development

### React (Core)
- **Versions in use:** 16 (legacy CRA), 17, 18, 19
- **Build tools:** Create React App (legacy), Vite 5/6/7 + SWC (modern)
- **TypeScript:** Used selectively; required for `sadhan-auto-rep-web-portal-ui`, `ep-iqms-cv-ui`, `ep-shrishrti`
- **JSX skills:** Functional components, hooks (useState, useEffect, useCallback, useMemo, useRef, useContext)
- **Required skills:**
  - React Router v5, v6, v7 (lazy loading, protected routes, nested routes)
  - `React.lazy()` + `Suspense` for code-splitting
  - Custom hooks for API calls, websocket subscriptions, debounce
  - Performance: `react-virtuoso`, `react-virtualized` for large list rendering
  - Drag and drop: `react-beautiful-dnd` (assembly support, warehouse UI)

### State Management
| Library | Projects |
|---------|---------|
| Redux Toolkit (RTK) | IQMS-*, ep-assembly-support-ui, ep-prolife-service-ui, ep-production-planning-ui, pv-sadhan, sadhan-auto-rep |
| Recoil | control-tower-web-frontend (Sampravah) |
| Redux (classic) | ep-home-ui, ep-asset-management-ui, ep-reconciliation-ui |

- **RTK skills:** `createSlice`, `createAsyncThunk`, `configureStore`, `RTK Query` pattern
- **Recoil skills:** atoms, selectors, `recoil-persist` (localStorage sync), `useRecoilState`, `useRecoilValue`

### UI Component Libraries
| Library | Version | Projects |
|---------|---------|---------|
| Material-UI (MUI) | v4 (legacy), v5, v7 | Most projects |
| Ant Design (Antd) | v5 | control-tower-web-frontend |
| Tailwind CSS | v4 | ep-iqms-cv-ui |
| avant-garde-components-library | 1.23.x | ep-home-ui, ep-asset-management-ui, ep-reconciliation-ui |

- **MUI v4 vs v5 migration:** Different import paths (`@material-ui/core` vs `@mui/material`), theme API changes
- **MUI theming:** `createTheme`, `ThemeProvider`, custom palette, typography, component overrides
- **Emotion:** CSS-in-JS (`sx` prop, `styled`, `css`) — used under the hood by MUI v5+

### Data Visualisation
| Library | Projects |
|---------|---------|
| ECharts (`echarts-for-react`) | pv-sadhan-logistics-*, control-tower-web-frontend |
| Highcharts | ep-asset-management-ui, ep-asset-management-cv-ui |
| Nivo | ep-production-planning-ui |
| FullCalendar 6 | ep-asset-management-ui, ep-asset-management-cv-ui |

- Skills: chart configuration objects, responsive containers, custom tooltips, real-time data updates, React wrappers

### HTTP & API Layer
- **Axios:** All projects — interceptors, timeout (60 s default), bearer token injection, error normalisation
- **Pattern:** Single shared wrapper (`getApiResponse(url, body, method)`) — no per-component fetch calls
- **Base URL config:** Environment variable (`BACKEND_URL` / `REACT_APP_BACKEND_URL` / Vite env)
- **Real-time:** WebSockets via `socket.io-client` (assembly UI) or native `ws`

### Styling
- **SCSS/Sass:** Global utilities (Colors.scss, Flex.scss, Grid.scss, Spacing.scss, Typography.scss)
- **CSS Modules:** Some legacy components
- Path aliases: `@` or `src/` aliased in `vite.config.js` + `jsconfig.json` / `tsconfig.json`

### Forms
- `react-select` (searchable dropdowns), `react-date-picker`, `react-date-range`
- File upload: `multer` (Node side), FormData API (React side)

### Lottie Animations
- `lottie-react` — used in IQMS-Frontend-Services for loading/status animations

### Storybook
- Component development and visual regression in `ep-production-broadcast` adjacent UI projects
- `npm run storybook` on port 6006

### Bundler & Dev Server
- **Vite config skills:** `vite.config.js/ts`, proxy setup, env variables (`import.meta.env`), path aliases, build output config
- **CRA projects:** `react-scripts`, `.env` files, `REACT_APP_*` prefix convention

---

## 2. Backend — Java / Kotlin (Spring Boot)

### Core Framework
- **Spring Boot versions:** 2.5, 2.6, 2.7 (primary), 3.1, 3.2
- **JDK:** 11 (SAP JCo constraint), 17 (primary), 21 (selective)
- **Build system:** Gradle with Kotlin DSL (`build.gradle.kts`) + `gradlew` wrapper
- **Embedded server:** Jetty (most services; not Tomcat)
- **Package convention:** `com.tml.{service-name}.{layer}` (controller, service, repository, entity, dto, config)

### Spring Ecosystem Modules (must know all)
| Module | Usage |
|--------|-------|
| `spring-boot-starter-web` | REST controllers |
| `spring-boot-starter-data-jpa` | JPA + Hibernate ORM |
| `spring-boot-starter-security` | OAuth2 resource server, method security |
| `spring-boot-starter-actuator` | Health, metrics, Prometheus endpoints |
| `spring-boot-starter-validation` | Bean Validation (Jakarta / `javax`) |
| `spring-boot-starter-mail` | Email via AWS SES SMTP |
| `spring-kafka` | Kafka consumers and producers |
| `spring-boot-starter-batch` | Spring Batch jobs (`ep-reconciliation`) |
| `spring-boot-starter-thymeleaf` | Email HTML templates |
| `springdoc-openapi` | Swagger UI auto-generation |

### Java Skills
- REST controllers: `@RestController`, `@RequestMapping`, path variables, query params, multipart upload
- Service layer: `@Service`, `@Transactional`, `@Async`
- JPA: `@Entity`, `@Table`, composite keys (`@EmbeddedId`, `@IdClass`), relationships (`@OneToMany`, `@ManyToOne`, `@ManyToMany`)
- Spring Data: `JpaRepository`, `@Query` (JPQL + native), Specifications, Projections
- Exception handling: `@ControllerAdvice`, `@ExceptionHandler`, `ProblemDetail` (Spring 6)
- Configuration: `@ConfigurationProperties`, `@Value`, multi-profile `application.yaml`
- Scheduling: `@Scheduled` for cron-style tasks

### Kotlin Skills
- Kotlin repositories (Spring Data JPA written in Kotlin, services in Java)
- Data classes as DTOs and entities
- Extension functions, coroutines (selective)
- Arrow-kt: `Either<L,R>`, `Option<A>`, `IO` monad for functional error handling
- Kotest: spec-style tests (`FunSpec`, `DescribeSpec`)
- MockK: Kotlin-native mocking (`every`, `coEvery`, `verify`, `coVerify`)
- Exposed ORM (`ep-reconciliation`): `Table` objects, `transaction {}`, `selectAll`, `insertIgnore`

### Vavr (Functional Java)
Required in: `ep-authorization`, `ep-asset-tracker`, `ep-prolife-service`, `ep-machine-integration`
- `Try<T>`: wraps exceptions as values, `.map()`, `.recover()`, `.getOrElseThrow()`
- `Either<L,R>`: `Either.right()`, `Either.left()`, `.fold()`, `.map()`
- `Option<T>`: null-safe alternative

### Database Migrations — Flyway
- Naming convention: `V{YYYYMMDDhhmm}__{description}.sql` (timestamp prefix)
- Features used: out-of-order migration, auto-baseline on first run
- Test override: Flyway disabled (`spring.flyway.enabled=false`) with H2 + JPA `create-drop`

### Logging
- SLF4J + Logback (default Spring Boot)
- Log4j2 (ep-sap-connector)
- MDC for correlation IDs across Kafka consumer threads

### Metrics
- Micrometer Prometheus registry — custom meters, `@Timed`, Prometheus scrape endpoint at actuator `/prometheus`

### OpenAPI / Swagger
- `springdoc-openapi-ui` auto-generates Swagger UI at `/swagger-ui.html`
- `@Operation`, `@ApiResponse`, `@Schema` annotations

---

## 3. Backend — Python (Django / FastAPI)

### Django & Django REST Framework
- **Versions:** Django 3.2, 4.1, 4.2, 5.0
- **DRF versions:** 3.14, 3.15
- **Required skills:**
  - Models, migrations, QuerySets, ORM (select_related, prefetch_related)
  - Serializers (ModelSerializer, nested, read-only, write-only fields)
  - ViewSets, APIView, `@api_view`
  - Authentication: JWT (`rest_framework_simplejwt`), Keycloak (`python-keycloak`)
  - Pagination, filtering, ordering
  - Custom management commands
  - `settings.py` per-environment overrides

### Projects Using Python
| Project | Django Version | Specialty |
|---------|---------------|-----------|
| control-tower-backend | 5.0.7 | Manufacturing KPI aggregation |
| dock-management-backend | 4.2 | Dock traffic, file uploads (Pillow) |
| ep-assembly-configurator-2 | 4.1.3 | Assembly config, Excel imports |
| pv-vtdms-backend-service | 3.2 | Vehicle telematics, ML (gensim) |
| pv-vtdms-backend-integration-service | 3.2 | Integration bridge |
| sadhan-auto-rep-backend | 3.2 | Auto replenishment, Keycloak |
| sadhan-logistics-packaging-backend | 3.2 | Logistics management |
| pv-sadhan-logistics-and-packaging-backend | 3.2 | PV logistics |
| ep-asset-management | — | Flask/FastAPI (asset lifecycle) |
| TYV-Backend-Service | 3.2 | Vehicle lifecycle, ML (BeautifulSoup) |

### Python Libraries
| Library | Purpose |
|---------|---------|
| `kafka-python` (2.0.2 – 2.2.10) | Kafka producer/consumer |
| `psycopg2` (2.9.x) | PostgreSQL adapter |
| `pandas` | Data transformation, Excel ingestion |
| `openpyxl` / `XlsxWriter` | Excel read/write |
| `PyJWT` | JWT encode/decode |
| `python-keycloak` | Keycloak admin & OIDC token validation |
| `cryptography` | Data encryption |
| `requests` | HTTP client |
| `Pillow` | Image processing |
| `gensim` | ML — word embeddings (TYV) |
| `BeautifulSoup4` | HTML parsing |
| `Docker SDK` | Docker API calls from Python |
| `coverage` | Test coverage reporting |
| `inflection` | ORM string utilities |

### Testing (Python)
- Django Test Client, `pytest-django`
- Mocking: `unittest.mock`, `patch`
- Coverage: `coverage run`, `coverage report`

---

## 4. Backend — Node.js

### ep-eloto (Express.js)
- Node.js 20, Express.js
- **WebSockets:** `ws` 8.18 (real-time data push)
- **PostgreSQL:** `pg` 8.11 (direct query, not ORM)
- **Authentication:** `jsonwebtoken`, `bcryptjs`
- **File handling:** `multer` (upload), `exceljs` (Excel generation)
- **Utilities:** `moment`, `nodemailer`, `dotenv`, `cors`
- Skills: REST API, WebSocket server events, connection pooling, JWT middleware, file streaming

---

## 5. Mobile — Android

### ep-prolife-service-hht-ui
- **Language:** Kotlin (100%)
- **JDK:** 21
- **UI:** Jetpack Compose (declarative UI, `@Composable`, `State`, `remember`, `LaunchedEffect`)
- **DI:** Hilt (Dagger 2 under the hood — `@HiltViewModel`, `@Inject`, `@Module`)
- **HTTP:** Ktor Client (async, coroutine-based, serialisation via `kotlinx.serialization`)
- **Auth:** AppAuth (OAuth2/OIDC, PKCE flow), Keycloak as OIDC provider
- **Local storage:** DataStore Preferences (encrypted)
- **Security:** Certificate pinning (HTTPS), encrypted DataStore
- **Testing:** JUnit 4, Espresso, Compose testing (`createComposeRule`), Hilt test components, MockK
- **Coverage:** JaCoCo

---

## 6. Desktop — Tauri (Rust + React)

### ep-prolife-service-ui
- **Frontend:** React 19 + Vite 7 + TypeScript + MUI 7
- **Desktop backend:** Tauri 2 (Rust)
- **IPP Printing:** Rust backend communicates with label printers via IPP protocol
- **Skills required:**
  - Tauri commands (`#[tauri::command]`), IPC (invoke from React to Rust)
  - Cargo.toml dependency management, `cargo build`
  - Basic Rust: structs, error handling (`Result<T,E>`), async with Tokio
  - Cross-platform packaging (Windows installer, Linux AppImage)
- **Build commands:**
  ```bash
  npm run tauri dev      # Dev mode (hot reload + Rust)
  npm run tauri build    # Production desktop binary
  ```

---

## 7. Databases

### PostgreSQL
- Primary datastore for all backends
- **Skills:**
  - Schema design: normalisation, composite primary keys, foreign keys, indexes
  - SQL: complex JOINs, CTEs, window functions, UPSERT (`INSERT ... ON CONFLICT`)
  - Partitioning (for large tables like archive tables)
  - Connection pooling (HikariCP in Spring Boot)
  - AWS RDS configuration: parameter groups, subnet groups, security groups
- **Flyway migrations:** One-directional, timestamped SQL scripts — never modify existing migrations

### H2 (Test Only)
- In-memory database with PostgreSQL dialect for Spring Boot integration tests
- `spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL`
- Flyway disabled for tests; schema created via JPA `create-drop`

### Amazon RDS
- Managed PostgreSQL instances per environment (dev / pre-prod / prod)
- Configured via Terraform modules

---

## 8. Messaging — Apache Kafka

### Core Skills
- Producer API: `KafkaTemplate<String, Object>`, topic routing, error handling
- Consumer API: `@KafkaListener`, consumer groups, `Acknowledgment.acknowledge()` (manual commit)
- Consumer config: `concurrency=1`, `max.poll.records=10`, `auto.offset.reset=latest`, `enable.auto.commit=false`
- Kafka Streams: used in `ep-sap-connector` (2.6), `ep-gmes-integration` (3.6) for stream processing
- Embedded test broker: `@EmbeddedKafka` in Spring Kafka Test
- Schema management: plain JSON (no Avro/Schema Registry in this stack)
- Dead letter topics / retry topics (custom implementation per service)

### Topic Naming Convention
```
{domain}-{entity}-{event-type}-v{version}
e.g. material-master-updated-v1
     machine-raw-temperature-data-v1
     asn-created-v1
     replenishment-notification-v1
```

### Key Topics (Cross-Service)
| Topic | Producer | Consumers |
|-------|---------|-----------|
| `material-master-v1` | ep-material-master | ep-production-broadcast, ep-required-material |
| `purchase-order-*-v1` | SAP Connector | ep-production-broadcast |
| `asn-*-v1` | SAP Connector | ep-production-broadcast |
| `machine-raw-*-data-v1` | ep-machine-integration | ep-gmes-integration |
| `requirement-created-v1` | ep-required-material | ep-production-broadcast |
| `stock-delta-v1` | ep-production-broadcast | ep-replenishment |
| `replenishment-*-v1` | ep-replenishment | ep-production-broadcast |

### Kafka Infrastructure
- **AMQ Streams** (Red Hat) — production Kafka in IPMS4 Kubernetes cluster
- **Community Kafka** — MES4 / MES4-EV
- Managed via Terraform + Kubernetes operators

---

## 9. Authentication & Security

### Keycloak
- **Versions:** 19.0 (older services), 26.2 (modern — ep-prolife-service-ui, HHT app)
- **Skills:**
  - Realm configuration, client scopes, roles, groups
  - OAuth2 Authorization Code flow (browser apps)
  - OAuth2 PKCE flow (Android HHT app via AppAuth)
  - Client credentials grant (service-to-service)
  - Keycloak Admin Client (`keycloak-admin-client` Java lib): user management, group membership, role assignment via API
  - JavaScript adapter (`keycloak-js`) for React apps
  - `python-keycloak` for Django services
  - JWT token structure: claims (`sub`, `preferred_username`, `realm_access.roles`, `resource_access`)

### Spring Security (JWT / OAuth2 Resource Server)
- `spring-boot-starter-security` + `spring-boot-starter-oauth2-resource-server`
- `SecurityContextFilter` extracts JWT, builds `Authentication` from claims
- `JwtUtil`: token decoding, claim extraction, expiry validation
- Method-level security: `@PreAuthorize("hasRole('ROLE_ADMIN')")`
- Stateless sessions (`SessionCreationPolicy.STATELESS`)
- CORS configuration: per-service allow-list

### ep-authorization Service
- Centralised service called by other microservices to validate plant-scoped permissions
- REST endpoint: `POST /api/authorize` — takes userId + plantId, returns allowed operations
- All services call this before executing plant-sensitive operations

### Certificate Pinning
- `ep-prolife-service-hht-ui` (Android): pins HTTPS certificate for Keycloak & backend calls to prevent MITM on shop-floor networks

---

## 10. AWS Cloud Services

### Services Used
| Service | Projects | Usage |
|---------|---------|-------|
| ECR | All | Docker image registry (ap-south-1) |
| S3 | ep-machine-integration, ep-reconciliation | Machine data storage, file ingestion |
| SES | ep-production-broadcast, ep-prolife-service, ep-production-planning | Transactional email (adherence reports, notifications) |
| Secrets Manager | All (via ESO) | Runtime secrets injection into pods |
| RDS (PostgreSQL) | All backends | Managed database |
| IoT Core | ep-machine-integration | MQTT broker for machine sensor data |
| EC2 + ALB | Infrastructure | Kubernetes nodes, load balancing |
| IAM | Infrastructure | OIDC-based GitHub Actions auth, pod service accounts |

### AWS SDK (Java)
- `software.amazon.awssdk:s3` — `S3Client`, `PutObjectRequest`, `GetObjectRequest`
- `software.amazon.awssdk:ses` — `SesClient`, `SendEmailRequest`
- `com.amazonaws:aws-iot-device-sdk-java` — MQTT publish/subscribe

### AWS SDK (Python)
- `boto3` — S3, SES operations in Python services

### IAM & OIDC
- GitHub Actions authenticates to AWS via OIDC (no long-lived credentials)
- Pod service accounts use IRSA (IAM Roles for Service Accounts) for Secrets Manager access

---

## 11. Containerisation — Docker

### Skills
- Multi-stage Dockerfile authoring:
  - Stage 1 (build): `node:20-alpine` / `gradle:7-jdk17` — compile + package
  - Stage 2 (runtime): custom ECR base images (`ep-openjdk`, `ep-nginx`) — production image
- `docker-compose.yml` for local dev:
  - PostgreSQL on `:5432`
  - Kafka on `:9092`
  - Zookeeper on `:2181`
- `docker-compose-tools.yml` — tools-only compose (Spring Boot projects)
- Image tagging strategy: `<ecr-repo>:<commit-sha>`, environment re-tagging (`dev-{sha}`, `prod-{sha}`)
- `nginx.conf` authoring for React SPA reverse proxy (history API fallback, gzip, cache headers)
- `.dockerignore` to exclude `node_modules`, build artifacts, `.env`

---

## 12. Kubernetes & Helm

### Kubernetes Skills
- Pod specs, Deployments, Services, Ingress, ConfigMaps, Secrets
- Namespace isolation (per product-line: ipms4-dev, ipms4-prod, etc.)
- HPA (Horizontal Pod Autoscaler), resource requests/limits
- CronJobs (scheduled tasks in Python backends)
- `kubectl` commands: apply, rollout status, logs, exec, port-forward
- External Secrets Operator: `ExternalSecret` CRD — syncs AWS Secrets Manager to Kubernetes Secrets
- KOPS: cluster creation, upgrades, node group management (versions 1.24 – 1.28)

### Helm
- **Chart:** Single generic `ep-app` chart used across all services
- Chart structure: `Chart.yaml`, `values.yaml`, `templates/` (deployment, service, ingress, hpa)
- Per-environment values: `values-dev.yaml`, `values-prod.yaml`
- Values templating with Ansible Jinja2 before `helm upgrade --install`
- Commands:
  ```bash
  helm upgrade --install <release> ./helm/app -f values-<env>.yaml -n <namespace>
  helm rollback <release> <revision>
  helm history <release>
  ```

### KOPS (Kubernetes Operations)
- Used to provision and manage self-managed Kubernetes clusters on AWS EC2
- Skills: cluster YAML manifests, `kops update cluster`, `kops rolling-update cluster`, instance group management
- Makefile targets wrap common KOPS operations (`ep-assembly-root/Makefile`)

---

## 13. Infrastructure as Code — Terraform

### Structure
```
terraform/
  modules/            # Reusable modules
  {service}/          # e.g., kafka, keycloak, kops-cluster
    {context}/        # ipms4, mes4, mes4-ev
      {environment}/  # dev, pre-prod, prod
        main.tf, variables.tf, outputs.tf, backend.tf
```

### Skills
- Module authoring and composition
- Remote state: S3 backend + DynamoDB locking
- AWS provider (5.x): VPC, subnets, security groups, ALB, EC2, RDS, S3, IAM, Secrets Manager, ECR
- Kubernetes provider: namespace, service account, role bindings
- Helm provider: Helm releases managed by Terraform
- Kafka / AMQ Streams resources
- Keycloak provider: realm, client, roles, groups
- `terraform workspace` for environment isolation
- `terraform plan` / `apply` / `destroy` lifecycle
- Variable precedence: `.tfvars` files per environment
- `terraform fmt`, `terraform validate`

---

## 14. CI/CD — GitHub Actions

### Skills
- Workflow YAML authoring (`.github/workflows/*.yml`)
- Triggers: `push`, `pull_request`, `workflow_dispatch`, `schedule`
- Branch-based conditions (`if: github.ref == 'refs/heads/master'`)
- OIDC-based AWS authentication (no stored secrets):
  ```yaml
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::...:role/github-actions-role
      aws-region: ap-south-1
  ```
- ECR login + Docker build/push:
  ```yaml
  - uses: aws-actions/amazon-ecr-login@v2
  - run: docker build -t $ECR_REPO:${{ github.sha }} .
  - run: docker push $ECR_REPO:${{ github.sha }}
  ```
- Reusable workflows (`ep-github-workflows` repo): `workflow_call` trigger, shared steps
- Matrix builds for multi-environment deployments
- Secrets: `${{ secrets.X }}` for stored secrets, OIDC for AWS

---

## 15. CI/CD — Jenkins

### ep-pipelines — Jenkins Shared Library
- **Groovy DSL:** Declarative and scripted pipeline syntax
- **Shared library structure:** `vars/` (global pipeline steps), `src/` (utility classes), `resources/`
- **Job DSL:** Seed jobs dynamically generate per-app jobs from YAML definitions
- **Pipeline steps:** checkout, build (Gradle/npm), Docker build/push, Ansible deploy trigger
- **Plugins knowledge required:**
  - Git plugin, Docker plugin, Kubernetes plugin (dynamic agents)
  - Blue Ocean, AnsiColor, Timestamper
  - Credentials binding plugin (secrets injection)
- **Jenkinsfile patterns:** shared library imports (`@Library('ep-pipeline')`), parallel stages, post-build notifications (Slack)

---

## 16. GitOps — ArgoCD

### Usage in IPMS4
- ArgoCD watches ECR image tags (via `image-updater`) or Git manifests
- **Skills:**
  - `Application` CRD authoring
  - Sync policies: automated vs manual, prune, self-heal
  - ArgoCD CLI: `argocd app sync`, `argocd app get`, `argocd app rollback`
  - Repo structure: `argocd/deploy/{env}/{app}/` with Helm values
  - Multi-cluster management (ArgoCD in one cluster managing others)
  - ApplicationSet for templating multiple environments from one definition

---

## 17. Configuration Management — Ansible

### Usage
- Jinja2 templates for per-environment Helm values (replaces hardcoded env configs)
- Ansible Vault for encrypted secrets at rest in the repository
- Playbook execution from Jenkins pipeline or GitHub Actions

### Skills
- Playbook authoring: tasks, handlers, roles, includes
- Inventory: static and dynamic (AWS EC2 inventory plugin)
- Modules: `template`, `copy`, `file`, `shell`, `command`, `ansible.builtin.vault`
- Vault: `ansible-vault encrypt`, `ansible-vault decrypt`, vault password via CI secret
- Jinja2 templating: filters, conditionals, loops for config generation
- `ansible.cfg` configuration

---

## 18. Observability & Monitoring

### Prometheus & Grafana
- Micrometer Prometheus endpoint exposed by all Spring Boot services at `/actuator/prometheus`
- Custom metrics: counters (`Counter.builder(...).register(registry)`), gauges, timers
- Grafana dashboards for: JVM metrics, Kafka consumer lag, HTTP request rates
- Alertmanager rules for consumer lag, error rate spikes

### EFK Stack (Logging)
- **Elasticsearch:** Log storage and search
- **Fluent Bit:** DaemonSet log collector in Kubernetes
- **Kibana:** Log visualisation and query
- Skills: Fluent Bit config (parser, filter, output), Kibana index patterns, KQL queries

### Spring Boot Actuator
- Endpoints: `/health` (liveness/readiness), `/metrics`, `/prometheus`, `/info`, `/env`
- Kubernetes probes map to `/actuator/health/liveness` and `/actuator/health/readiness`

### OpenTelemetry (ep-gmes-integration)
- Distributed tracing via OTLP exporter
- `opentelemetry-spring-boot-starter` auto-instrumentation
- Trace context propagation across Kafka messages (W3C TraceContext)

---

## 19. Testing

### Spring Boot (Java/Kotlin)
| Tool | Usage |
|------|-------|
| JUnit 4 / 5 | Test runner |
| `@SpringBootTest` | Full application context integration tests |
| `@WebMvcTest` | Controller layer unit tests |
| `@DataJpaTest` | Repository layer with H2 |
| Mockito / MockK | Mocking dependencies |
| WireMock | HTTP stub server for external API mocking |
| `@EmbeddedKafka` | In-memory Kafka broker for consumer/producer tests |
| Testcontainers | Real PostgreSQL / Keycloak in Docker during tests |
| Kotest | Kotlin-idiomatic test DSL (`FunSpec`, `DescribeSpec`, `BehaviorSpec`) |
| JaCoCo | Code coverage reports |
| Gatling | Load testing (`ep-replenishment`) |

### React (JavaScript/TypeScript)
| Tool | Usage |
|------|-------|
| Jest | Test runner, assertion library |
| React Testing Library | Component rendering and interaction |
| `@testing-library/user-event` | User interaction simulation |
| Storybook | Visual component development |
| MSW (Mock Service Worker) | API mocking (selective) |
| Husky + lint-staged | Pre-commit test/lint gates |

### Python
| Tool | Usage |
|------|-------|
| Django Test Client | HTTP-level integration tests |
| pytest / pytest-django | Test runner |
| `unittest.mock` | Mocking |
| Coverage.py | Coverage measurement |

### Android
| Tool | Usage |
|------|-------|
| JUnit 4 | Unit tests |
| Espresso | UI instrumentation tests |
| Compose Test | `createComposeRule`, semantics-based assertions |
| Hilt testing | `@HiltAndroidTest`, test application component |
| MockK | Kotlin mocking |

---

## 20. Code Quality & Linting

### Java / Kotlin
| Tool | Config | Enforcement |
|------|--------|-------------|
| Spotless | Google Java Format | Pre-commit hook (`.githooks/pre-commit`) |
| Checkstyle | `checkstyle.xml` (selective) | Gradle check task |
| Detekt | `detekt.yml` (selective) | Kotlin static analysis |
| SonarQube | `sonar-project.properties` | CI pipeline |

**Setup:** Run `./setup.sh` once after cloning to install `.githooks/pre-commit` — this runs `./gradlew spotlessApply` before every commit.

### JavaScript / TypeScript
| Tool | Config | Enforcement |
|------|--------|-------------|
| ESLint | `.eslintrc.cjs`, `eslint.config.js` | `npm run lint` (max-warnings 0) |
| Prettier | `.prettierrc`, `.prettierrc.json` | `npm run format` |
| TypeScript compiler | `tsconfig.json` | Build time (`tsc --noEmit`) |
| Husky | `.husky/pre-commit` | Pre-commit lint + format |

### Python
- PEP 8 compliance (manual / flake8 selective)
- No ruff/black configuration found — linting is informal in Python services

---

## 21. Data Export & File Processing

### Excel
| Library | Language | Projects |
|---------|---------|---------|
| Apache POI 5.2 | Java | ep-production-broadcast, ep-prolife-service |
| OpenPyXL | Python | sadhan-auto-rep-backend, ep-assembly-configurator-2, dock-management-backend |
| XlsxWriter | Python | pv-sadhan-logistics-and-packaging-backend |
| exceljs | Node.js/Browser | ep-eloto, ep-prolife-service-ui |
| xlsx (SheetJS) | Browser JS | Most React UIs |

### PDF
- `jspdf` + `jspdf-autotable` — PDF generation from React (reports, QR code sheets)
- `react-to-pdf` — Component-to-PDF conversion

### CSV
- `opencsv` (Java) — CSV parsing in ep-material-master
- `papaparse` (JavaScript) — CSV parsing in React UIs

### QR Codes
- `qrcode` (JavaScript) — QR code generation in React UIs

---

## 22. External System Integrations

### SAP (via ep-sap-connector)
- **SAP JCo 3.1.2:** Java Connector for RFC calls (requires JDK 11 for native library compatibility)
- **RFC function:** `ZPPRFC_MES_MARDSTOCK` — fetches material stock from SAP
- **Constraints:** Max 500 materials per call; 120-minute minimum interval between successive calls for same plant+BU
- **Kafka bridge:** SAP connector consumes Kafka requests, calls SAP RFC, publishes response to Kafka
- **BUs:** CVBU (Commercial), PVBU (Passenger), EVBU (Electric) — separate SAP endpoints and credentials

### Keycloak Admin Integration
- `keycloak-admin-client` (Java) — used in `ep-prolife-service` and `ep-production-broadcast`
- Operations: create users, assign roles, add to groups, reset passwords, send verification emails
- Auth: service-account client credentials grant to Keycloak

### Freight Tiger API
- REST-based logistics partner API
- Used in `ep-production-broadcast` for trip create and close operations
- Custom HTTP client (OkHttp3) with credentials from `application.yaml`

### AWS IoT Core (MQTT)
- `ep-machine-integration`: subscribes to MQTT topics from shop-floor machines
- `com.amazonaws:aws-iot-device-sdk-java 1.3.7` — MQTT client
- Topics: machine sensor data (temperature, vibration, production counts)
- S3 upload of raw machine data files, then Kafka publication of cleaned data

### GMES Integration (ep-gmes-integration)
- GMES = Generic Manufacturing Execution System
- Spring Boot 3.2 + Kafka Streams for real-time machine data processing
- OpenTelemetry tracing for cross-service observability

### IPMS Integration (ep-ipms-integration)
- IPMS = Integrated Plant Management System
- Spring Boot 2.7 + Kafka for plant-level data exchange
- OkHttp3 for outbound HTTP calls

### Avant-garde Component Library
- Internal NPM package (`avant-garde-components-library@1.23.x`)
- Shared React UI components for TML applications
- Published to a private npm registry
- Projects using it: `ep-home-ui`, `ep-asset-management-ui`, `ep-reconciliation-ui`

---

## 23. Shared Patterns & Conventions

### Environment Configuration
```
Local dev  → .envrc + direnv (copy .envrc.sample → .envrc)
CI/CD      → GitHub Actions secrets (OIDC for AWS)
Production → AWS Secrets Manager + External Secrets Operator
Jenkins    → Ansible Vault encrypted vars
```

### API Response Convention (Backend)
- Success: HTTP 200 with body `{ data: ..., message: "OK" }`
- Validation error: HTTP 400 with `{ errors: [...] }`
- Auth error: HTTP 401/403
- Server error: HTTP 500 with generic message (no stack traces in production)

### Kafka Message Envelope (JSON)
```json
{
  "eventType": "material-master-updated",
  "version": "v1",
  "timestamp": "2026-04-19T10:00:00Z",
  "payload": { ... }
}
```

### Multi-BU Routing
- Business Unit codes: CVBU, PVBU, EVBU (also numeric: 5101, 5201, 5301)
- Services read BU from Kafka message headers or REST request params
- BU-specific config in `application.yaml` under `sap-connector.bu-specific-connection`

### Plant-Scoped Authorization
- Every sensitive operation takes `plantCode` as parameter
- All services call `ep-authorization` to verify the requesting user has access to that plant
- JWT contains user's allowed plant list in custom claim

### Archive Pattern (Spring Boot)
- Fulfilled or expired records moved to `*_archive` tables (via archive repositories)
- Keeps main operational tables lean for query performance
- Example: `DistributionRepository` → `DistributionArchiveRepository`

### Feature Toggles
- `application.yaml` boolean flags (e.g., `feature-toggle.dsob-distribution-enabled: false`)
- No dedicated feature flag platform — just config properties

---

## 24. Skills Summary Matrix

| Skill Area | Depth Required | Projects |
|-----------|---------------|---------|
| React 18/19 + Vite | Advanced | 15+ frontend repos |
| Redux Toolkit | Advanced | 10+ frontend repos |
| TypeScript | Intermediate | 4 frontend repos |
| Tailwind CSS | Intermediate | ep-iqms-cv-ui |
| MUI v4/v5/v7 | Advanced | 12+ frontend repos |
| Recoil | Intermediate | control-tower-web-frontend |
| Spring Boot 2.7 | Expert | 15+ backend repos |
| Spring Boot 3.x | Advanced | ep-replenishment, ep-gmes-integration |
| Java 17 | Expert | All Java backends |
| Kotlin | Advanced | 6+ repos (ep-prolife-service, ep-reconciliation, ep-replenishment, HHT) |
| Vavr (Functional Java) | Intermediate | 4 repos |
| Arrow-kt | Intermediate | ep-prolife-service, ep-production-broadcast |
| Django 3.2–5.0 | Advanced | 8 Python backends |
| Django REST Framework | Advanced | 8 Python backends |
| pandas / openpyxl | Intermediate | 3 Python backends |
| Node.js + Express | Intermediate | ep-eloto |
| Kotlin + Jetpack Compose | Intermediate | ep-prolife-service-hht-ui |
| Tauri 2 + Rust (basic) | Basic | ep-prolife-service-ui |
| PostgreSQL | Advanced | All backends |
| Flyway | Intermediate | All Spring Boot backends |
| Apache Kafka | Expert | All backends |
| Kafka Streams | Intermediate | ep-sap-connector, ep-gmes-integration |
| Keycloak (admin + OIDC) | Advanced | 10+ services |
| Spring Security / OAuth2 | Advanced | All Spring Boot backends |
| AWS S3 | Intermediate | ep-machine-integration, ep-reconciliation |
| AWS SES | Intermediate | ep-production-broadcast, ep-prolife-service |
| AWS IoT | Intermediate | ep-machine-integration |
| AWS Secrets Manager + ESO | Intermediate | Infrastructure |
| Docker (multi-stage) | Advanced | All projects |
| Kubernetes | Advanced | All deployed services |
| Helm | Advanced | All deployed services |
| KOPS | Intermediate | ep-assembly-root, ep-infrastructure |
| Terraform | Advanced | ep-infrastructure |
| GitHub Actions | Advanced | All IPMS4 projects |
| Jenkins Shared Library (Groovy) | Intermediate | ep-pipelines |
| ArgoCD | Intermediate | IPMS4 deployments |
| Ansible + Vault | Intermediate | ep-pipelines |
| Prometheus + Grafana | Intermediate | All backends |
| EFK Stack | Basic | Infrastructure |
| OpenTelemetry | Basic | ep-gmes-integration |
| Apache POI | Intermediate | ep-production-broadcast, ep-prolife-service |
| SAP JCo (RFC) | Intermediate | ep-sap-connector |
| WireMock | Intermediate | Spring Boot tests |
| Kotest + MockK | Intermediate | Kotlin services |
| Gatling | Basic | ep-replenishment |
| Testcontainers | Intermediate | Spring Boot integration tests |
| JaCoCo | Basic | Java/Kotlin/Android projects |
| Spotless / ESLint / Prettier | Intermediate | All projects |
| git hooks | Basic | All projects |
