# 24 — Shared Patterns & Conventions

## 1. Prerequisites

This document assumes you have worked through all prior documents (01–23). It synthesises cross-cutting patterns that appear in every TML repository. If you are new to a specific technology referenced here, consult the relevant numbered document first.

---

## 2. What & Why

Individual technology expertise is necessary but not sufficient. A developer who knows Spring Boot and Kafka perfectly can still spend a week confused in a TML codebase if they do not understand how those technologies are wired together in TML's specific way.

**Convention over configuration** — every TML service follows the same project layout, the same branch strategy, the same API response shape, and the same Kafka message envelope. You do not configure these things from scratch: you follow the convention. The value is that any engineer who has worked in one TML service can navigate any other TML service in minutes rather than hours.

**Defensive coding at boundaries only** — validate inputs at the API surface (controllers, Kafka consumer entry points). Trust internal service code. Do not scatter null checks and defensive validation throughout business logic — that obscures the real logic. Validate once, handle the error once, proceed with clean data.

**Separation of concerns** — each service owns its bounded context. ep-production-broadcast owns broadcast and adherence. ep-replenishment owns reorder point calculation. ep-sap-connector owns SAP communication. Services do not call each other synchronously across domain boundaries — they communicate via Kafka topics. This prevents coupling and allows independent deployment.

---

## 3. Core Concepts

**Product line architecture** — TML products are grouped by the vehicle business unit or business function they serve:
- `ep-` — Enterprise Platform: cross-cutting services (authentication, SAP connector, machine integration)
- `pv-` — Passenger Vehicle: PV-specific production and logistics portals
- `sadhan-` — Sadhan logistics platform: supply chain and replenishment
- `esakha-` — eSakha supply chain collaboration portal
- `nirman-` — Assembly and production tracking
- `IQMS-` — Integrated Quality Management System

**BU segmentation** — Business Unit codes appear in every Kafka message header, every REST request parameter, and every database row that is BU-specific. BU code drives which SAP system to connect to, which plant set to include in reports, and which feature flags are active.

**GitOps deployment model** — code changes trigger automated deployments. The branch you push to determines which environment receives the deployment. This is not optional: there is no manual deployment process.

---

## 4. Installation & Setup

No new tools are required for this document. These are patterns you apply when working inside existing repositories.

**First steps after cloning any Spring Boot service:**

```bash
git clone git@github.com:tata-motors/<service-name>.git
cd <service-name>
./setup.sh            # Install pre-commit hook (required, do this once)
cp .envrc.example .envrc  # Fill in local dev credentials
direnv allow          # Load environment variables
./gradlew test        # Verify everything compiles and tests pass
```

**Read CLAUDE.md before making changes.** Every repo has a `CLAUDE.md` at the root with service-specific notes: which modules exist, which environment variables are required, any non-obvious constraints. These notes are maintained by the team and take precedence over general patterns in this document.

---

## 5. Beginner

### Project naming convention

All repository names follow the pattern: `{product-line}-{service-name}`:

```
ep-production-broadcast        Enterprise Platform — broadcast and adherence tracking
ep-sap-connector               Enterprise Platform — SAP JCo RFC bridge
ep-machine-integration         Enterprise Platform — IoT MQTT subscriber
ep-replenishment               Enterprise Platform — reorder point calculation
pv-sadhan-logistics-and-packaging-web-portal    PV — logistics management portal
sadhan-auto-rep-backend        Sadhan — automatic replenishment backend
sadhan-auto-rep-frontend       Sadhan — automatic replenishment React UI
esakha-supply-chain-portal     eSakha — vendor collaboration portal
nirman-assembly-tracker        Nirman — assembly line tracking
IQMS-quality-portal            IQMS — quality management
```

React frontend repositories follow `{service-name}-ui` or `{service-name}-frontend` or match the backend service name with `-web-portal` suffix. Check the product team's conventions in their CLAUDE.md.

### Branch strategy and deployment triggers

Every Spring Boot and React service uses the same three-branch strategy:

| Branch | Trigger | Deploys to |
|---|---|---|
| `development` | Any push | dev environment |
| `master` | Any push | pre-prod environment |
| `pre-prod` | Manual trigger or tag | production environment |

**Important**: `master` is NOT production. Production is `pre-prod`. A feature merged to `master` reaches pre-prod automatically but requires a separate action to promote to production. This gives QA time to verify on pre-prod before production release.

```bash
# Typical feature workflow
git checkout development
git checkout -b feature/EP-1234-material-import
# ... make changes ...
git push origin feature/EP-1234-material-import
# Open PR to development → merge → auto-deploys to dev
# QA approves on dev → merge development into master → auto-deploys to pre-prod
# Product owner approves on pre-prod → merge master into pre-prod → auto-deploys to prod
```

---

## 6. Intermediate

### Multi-BU routing pattern

BU codes drive routing at every layer. In Kafka:

```java
// Producer: attach BU code to message header
ProducerRecord<String, String> record =
    new ProducerRecord<>("material-events", key, payload);
record.headers().add("bu", buCode.getBytes(StandardCharsets.UTF_8));

// Consumer: read BU code from header to route processing
@KafkaListener(topics = "material-events")
public void onMaterialEvent(
        @Payload String payload,
        @Header("bu") String buCode) {
    SapConnectionProperties conn = buConfig.getConnectionFor(buCode);
    sapClient.processWithConnection(conn, payload);
}
```

In REST controllers:

```java
@GetMapping("/api/stock")
public ResponseEntity<ApiResponse<List<StockLevel>>> getStock(
        @RequestParam String materialCode,
        @RequestParam String plantCode,
        @RequestParam String buCode) {   // BU code always explicit in request

    SapConnectionProperties conn = buConfig.getConnectionFor(buCode);
    List<StockLevel> levels = sapClient.getStockLevels(plantCode,
        List.of(materialCode), conn);

    return ResponseEntity.ok(ApiResponse.success(levels));
}
```

### Plant-scoped authorisation

Every operation that reads or modifies plant-specific data validates that the authenticated user has access to that plant. This check happens in the service layer, not the controller, so it cannot be bypassed by calling the service directly.

```java
@Service
public class MaterialService {

    private final AuthorizationClient authorizationClient;
    private final MaterialRepository materialRepository;

    public Material getMaterial(String materialCode, String plantCode, String userId) {
        // Always validate plant access before any data access
        AuthorizationResult result = authorizationClient.authorize(
            userId, plantCode, "MATERIAL_READ");

        if (!result.isAllowed()) {
            throw new ForbiddenException(
                "User " + userId + " does not have MATERIAL_READ access for plant " + plantCode);
        }

        return materialRepository.findByCodeAndPlant(materialCode, plantCode)
            .orElseThrow(() -> new NotFoundException(
                "Material " + materialCode + " not found at plant " + plantCode));
    }
}
```

### Kafka message envelope

Every Kafka message published by a TML service uses this envelope structure:

```json
{
  "eventType": "material-master-updated",
  "version": "v1",
  "timestamp": "2026-04-19T10:00:00Z",
  "correlationId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "sourceService": "ep-production-broadcast",
  "payload": {
    "materialCode": "MAT-001",
    "plantCode": "1001",
    "description": "Steel Rod 12mm",
    "updatedFields": ["description", "unitOfMeasure"]
  }
}
```

The envelope class in Java:

```java
@Data
@Builder
public class EventEnvelope<T> {
    private String eventType;
    private String version;
    private Instant timestamp;
    private String correlationId;
    private String sourceService;
    private T payload;

    public static <T> EventEnvelope<T> of(String eventType, T payload) {
        return EventEnvelope.<T>builder()
            .eventType(eventType)
            .version("v1")
            .timestamp(Instant.now())
            .correlationId(UUID.randomUUID().toString())
            .sourceService(System.getenv("SERVICE_NAME"))
            .payload(payload)
            .build();
    }
}
```

### API response envelope

All REST responses from TML services use this structure:

```json
{
  "status": "SUCCESS",
  "message": "Order created successfully",
  "data": {
    "id": 42,
    "materialCode": "MAT-001",
    "quantity": 50,
    "status": "PENDING"
  },
  "timestamp": "2026-04-19T10:00:00Z"
}
```

Error response:

```json
{
  "status": "ERROR",
  "message": "Validation failed",
  "errors": [
    { "field": "quantity", "message": "must be greater than 0" },
    { "field": "materialCode", "message": "must not be blank" }
  ],
  "timestamp": "2026-04-19T10:00:00Z"
}
```

The response envelope class:

```java
@Data
@Builder
public class ApiResponse<T> {
    private String status;
    private String message;
    private T data;
    private List<FieldError> errors;
    private Instant timestamp;

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
            .status("SUCCESS")
            .data(data)
            .timestamp(Instant.now())
            .build();
    }

    public static ApiResponse<Void> error(String message, List<FieldError> errors) {
        return ApiResponse.<Void>builder()
            .status("ERROR")
            .message(message)
            .errors(errors)
            .timestamp(Instant.now())
            .build();
    }
}
```

---

## 7. Advanced

### Archive table pattern

Active data tables are kept small for query performance. When a record completes its lifecycle, it is moved to an archive table rather than deleted. Archive tables are rarely queried and can be stored on cheaper storage tiers.

```java
@Transactional
public void archiveCompletedDistribution(Long distributionId) {
    Distribution dist = distributionRepository.findById(distributionId)
        .orElseThrow(() -> new NotFoundException(distributionId));

    if (dist.getStatus() != DistributionStatus.FULFILLED) {
        throw new IllegalStateException(
            "Can only archive FULFILLED distributions, got: " + dist.getStatus());
    }

    // Copy to archive table
    DistributionArchive archive = DistributionArchive.from(dist);
    archive.setArchivedAt(Instant.now());
    distributionArchiveRepository.save(archive);

    // Remove from active table
    distributionRepository.delete(dist);

    log.info("Distribution {} archived", distributionId);
}
```

Archive entity mirrors the original but lives in a separate table:

```java
@Entity
@Table(name = "distribution_archive")
public class DistributionArchive {
    // Same fields as Distribution, plus:
    private Instant archivedAt;

    public static DistributionArchive from(Distribution d) {
        DistributionArchive a = new DistributionArchive();
        a.setOriginalId(d.getId());
        a.setMaterialCode(d.getMaterialCode());
        a.setQuantity(d.getQuantity());
        a.setPlantCode(d.getPlantCode());
        a.setFulfilledAt(d.getUpdatedAt());
        return a;
    }
}
```

### Feature toggle pattern

Feature toggles control whether new functionality is active without a code deployment. Toggles live in `application.yaml` and are injected with `@Value`:

```java
@Service
public class DistributionService {

    @Value("${feature-toggle.dsob-distribution-enabled:false}")
    private boolean dsobEnabled;

    @Value("${feature-toggle.new-replenishment-algorithm-enabled:false}")
    private boolean newReplenishmentEnabled;

    public DistributionPlan generatePlan(PlanningContext context) {
        if (dsobEnabled) {
            return generateDsobPlan(context);
        }
        return generateStandardPlan(context);
    }
}
```

```yaml
# application.yaml — defaults to false (safe)
feature-toggle:
  dsob-distribution-enabled: false
  new-replenishment-algorithm-enabled: false

# Override per environment in the environment-specific config:
# dev: dsob-distribution-enabled: true
# pre-prod: dsob-distribution-enabled: true
# prod: dsob-distribution-enabled: false (not yet released to prod)
```

### UI flow configuration in application.yaml

Which workflow steps a vendor sees depends on their supply arrangement (JIS — Just In Sequence, JIT — Just In Time). These steps are configured in `application.yaml` rather than hardcoded so the product team can adjust the flow without a code change.

```yaml
ui:
  flow:
    vendor:
      jis:
        steps:
          - plan
          - drop
          - dispatch
          - replenishment
      jit:
        steps:
          - plan
          - dispatch
    plant:
      default:
        steps:
          - receive
          - inspect
          - putaway
```

```java
@ConfigurationProperties(prefix = "ui.flow")
@Configuration
public class UiFlowConfig {

    private Map<String, Map<String, List<String>>> vendor = new HashMap<>();
    private Map<String, Map<String, List<String>>> plant = new HashMap<>();

    public List<String> getVendorSteps(String flowType) {
        return vendor.getOrDefault("vendor", Map.of())
                     .getOrDefault(flowType, List.of());
    }
}
```

### Adherence report plant exclusion

Some plants are excluded from adherence reporting (e.g. newly onboarded plants not yet ready for measurement). Exclusions are config-driven:

```yaml
adherence-report:
  plant:
    disabled:
      - "1001"
      - "1002"
```

```java
@Value("${adherence-report.plant.disabled:}")
private List<String> disabledPlants;

public boolean isPlantEligibleForReport(String plantCode) {
    return !disabledPlants.contains(plantCode);
}
```

---

## 8. Expert

### Environment configuration hierarchy

Credentials and configuration are managed at different levels depending on sensitivity and scope. The hierarchy from most specific to least:

```
1. AWS Secrets Manager  ← production secrets (DB password, API keys)
        │  Retrieved at pod startup via External Secrets Operator (ESO)
        │  Mounted as Kubernetes Secret → environment variable
        ▼
2. Ansible Vault  ← pipeline credentials, Kubernetes manifests secrets
        │  Stored in ep-pipelines repo, encrypted with ansible-vault
        │  Decrypted by CI/CD pipeline at deploy time
        ▼
3. GitHub Actions Secrets  ← CI/CD credentials (Docker registry, AWS role ARN)
        │  Available as ${{ secrets.SECRET_NAME }} in workflow YAML
        ▼
4. application.yaml (per environment)  ← non-secret configuration
        │  Committed to repo, no sensitive values
        │  Profile-specific: application-dev.yaml, application-prod.yaml
        ▼
5. .envrc (local dev only)  ← developer machine secrets
        │  NEVER committed — in .gitignore
        │  Loaded by direnv into shell environment
        ▼
6. Hardcoded defaults  ← safe fallbacks only (e.g. port: 8080)
```

**The rule**: if a value would cause a security incident if it leaked into a public GitHub repository, it belongs at level 1 or 2. Never put real credentials in `application.yaml`, never commit `.envrc`, never use `-e SECRET=value` in docker-compose checked into the repo.

### Multi-context Terraform workspace structure

Infrastructure is managed as independent Terraform workspaces, one per context and environment:

```
terraform/
  kafka/
    ipms4/
      dev/          ← independent workspace, own state file
        main.tf
        variables.tf
        terraform.tfvars
      prod/
        main.tf
        variables.tf
        terraform.tfvars
    mes4/
      dev/
      prod/
    mes4-ev/
      dev/
      prod/
  eks/
    ipms4/
      dev/
      prod/
  rds/
    ipms4/
      dev/
      prod/
```

Each folder is applied independently: `terraform -chdir=terraform/kafka/ipms4/dev apply`. This means a Kafka topic change in dev cannot accidentally affect prod state, and each environment can be at a different version of the infrastructure.

### GitOps vs Jenkins model

TML is mid-migration from Jenkins to GitHub Actions + ArgoCD:

**IPMS4 (new model):**
```
Git push → GitHub Actions (build + test + push image)
                    ↓
         ArgoCD detects image tag change in Helm values
                    ↓
         ArgoCD syncs Kubernetes manifests
                    ↓
         Kubernetes rolling update
```

**MES4, MES4-EV (legacy model):**
```
Git push → Jenkins pipeline (build + test + push image + deploy)
                    ↓
         Jenkins SSH into server OR kubectl apply directly
```

When working on MES4 services, look for a `Jenkinsfile` at the repo root. When working on IPMS4 services, look for `.github/workflows/` and ArgoCD application definitions in the `ep-pipelines` repo.

### IRSA pod identity (no AWS credentials in env vars)

TML services running on EKS use IRSA (IAM Roles for Service Accounts) for AWS credentials. The pod never has `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in its environment:

```yaml
# kubernetes/service-account.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ep-machine-integration
  namespace: production
  annotations:
    # This annotation binds the K8s ServiceAccount to an IAM Role
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/ep-machine-integration-role
```

```yaml
# kubernetes/deployment.yaml
spec:
  template:
    spec:
      serviceAccountName: ep-machine-integration  # references the ServiceAccount above
      containers:
        - name: app
          # AWS SDK automatically detects the projected token and assumes the IAM role
          # No AWS_ environment variables needed
```

The IAM role's trust policy allows the specific Kubernetes ServiceAccount to assume it via OIDC federation. The AWS SDK in the service automatically retrieves temporary credentials from the pod's projected token without any configuration.

---

## 9. In the TML Codebase

All patterns in this document are TML codebase patterns. Each section above shows real patterns extracted from production repositories. When you open an unfamiliar TML service and see these patterns, you are seeing TML conventions at work — not accidental coincidence.

**Where to find each pattern:**

| Pattern | Representative repo |
|---|---|
| Multi-BU routing with Kafka headers | ep-sap-connector |
| Plant-scoped authorisation | ep-production-broadcast, ep-replenishment |
| Kafka event envelope | All Kafka producers in ep-* services |
| API response envelope | All REST controllers in ep-* and sadhan-* services |
| Archive table | ep-production-broadcast (DistributionArchive) |
| Feature toggles | ep-replenishment (new algorithm flag) |
| UI flow configuration | pv-sadhan-logistics (JIS vs JIT steps) |
| Adherence report exclusion | ep-production-broadcast |
| IRSA pod identity | ep-machine-integration, ep-sap-connector |
| GitOps ArgoCD | IPMS4 product family |
| Jenkins pipeline | MES4, MES4-EV product families |
| Terraform per-context workspaces | ep-pipelines/terraform/ |

---

## 10. Quick Reference

### BU code reference

| BU Code | BU Name | SAP System | Description |
|---|---|---|---|
| 5101 | CVBU | sap-01.tml.com | Commercial Vehicles Business Unit |
| 5201 | PVBU | sap-02.tml.com | Passenger Vehicles Business Unit |
| 5301 | EVBU | sap-03.tml.com | Electric Vehicles Business Unit |

### Branch to environment mapping

| Branch | Auto-deploy target | URL pattern |
|---|---|---|
| `development` | dev | `*.dev.tml-internal.com` |
| `master` | pre-prod | `*.preprod.tml-internal.com` |
| `pre-prod` | production | `*.tml-internal.com` |

### Product line prefix reference

| Prefix | Product | Primary language | Typical services |
|---|---|---|---|
| `ep-` | Enterprise Platform | Java/Kotlin | Cross-cutting: SAP, auth, IoT, broadcast |
| `pv-` | Passenger Vehicle | Java + React | PV-specific portals and tracking |
| `sadhan-` | Sadhan logistics | Java + Python + React | Replenishment, packaging, logistics |
| `esakha-` | eSakha supply chain | Java + React | Vendor collaboration |
| `nirman-` | Assembly | Java + React | Assembly line tracking |
| `IQMS-` | Quality | Java + React | Quality management |

### Environment secret hierarchy (ASCII)

```
┌─────────────────────────────────────────┐
│         Most sensitive / most specific  │
│                                         │
│  1. AWS Secrets Manager (prod secrets)  │
│       ↓ ESO → K8s Secret               │
│  2. Ansible Vault (pipeline secrets)    │
│       ↓ decrypted at deploy time        │
│  3. GitHub Actions Secrets (CI/CD)      │
│       ↓ ${{ secrets.X }}               │
│  4. application.yaml (non-secrets)      │
│       ↓ committed to git               │
│  5. .envrc (local dev only — GITIGNORE) │
│       ↓ direnv allow                   │
│  6. Hardcoded safe defaults (e.g. 8080) │
│                                         │
│       Least sensitive / most general    │
└─────────────────────────────────────────┘
```

### Port conventions

| Port | Service |
|---|---|
| `:8080` | Spring Boot application (HTTP) |
| `:9090` | Alternative application port (some services) |
| `:9096` | Spring Boot Actuator (health, metrics, info) |
| `:9092` | Apache Kafka broker |
| `:5432` | PostgreSQL |
| `:8180` | Keycloak identity provider |
| `:1883` | MQTT broker (Mosquitto / AWS IoT Core local) |
| `:3000` | React development server (Vite default) |
| `:5601` | Kibana (log exploration) |
| `:9090` | Prometheus (metrics scraping — separate from app) |
| `:3100` | Grafana Loki (log aggregation) |

### Common Kafka topic naming pattern

```
{product-line}.{domain}.{event-type}

Examples:
  ep.material-master.updated
  ep.stock-levels.refreshed
  sadhan.replenishment.order-created
  ep.sap.stock-requests      ← request topic
  ep.sap.stock-responses     ← reply topic
  ep.machines.sensor-readings
  ep.broadcast.adherence-calculated
```

### When to use which deployment model

| Scenario | Model | Action |
|---|---|---|
| Feature work | GitOps (IPMS4) or Jenkins | Push to `development` branch |
| Production hotfix | Same as above, expedited | PR directly to `master`, then `pre-prod` |
| Terraform infrastructure change | Manual apply | CD to correct workspace folder, `terraform plan` then `apply` |
| Rollback | ArgoCD (IPMS4) | Set previous image tag in Helm values → ArgoCD syncs |
| Rollback (MES4) | Jenkins | Trigger previous build's deploy job |
