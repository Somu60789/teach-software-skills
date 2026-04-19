# ArgoCD

## Prerequisites

- **Kubernetes & Helm (doc 13):** You must understand `kubectl`, namespaces, deployments, services, and how Helm charts package Kubernetes manifests. ArgoCD deploys Kubernetes resources — if you can't read a `Deployment` YAML, ArgoCD will be opaque.
- **Git fundamentals:** GitOps requires understanding branches, commits, and how repository state maps to deployed state. ArgoCD watches a Git repository and reconciles the cluster to match it.
- **Basic understanding of YAML:** ArgoCD is configured entirely via YAML Custom Resources. The `Application` CRD is the central concept you'll work with constantly.

---

## What & Why

ArgoCD implements **GitOps**: the idea that Git is the single source of truth for the desired state of your Kubernetes cluster. You do not run `kubectl apply` or `helm upgrade` in a pipeline. Instead, you push changes to Git, and ArgoCD — running inside the cluster — continuously watches that Git repository and applies any changes it detects.

**Why GitOps matters:**

1. **Auditability.** Every deployment is a Git commit. You know exactly what changed, who changed it, and when. `git log` is your deployment history.
2. **Drift detection.** If someone runs `kubectl edit` and changes a deployment manually, ArgoCD detects the drift immediately and (if configured) automatically reverts it. The cluster always reflects Git.
3. **Rollback is `git revert`.** Revert the Git commit and ArgoCD resyncs the cluster to the previous state. No separate rollback command, no tribal knowledge.
4. **Pull-based model.** Jenkins/GitHub Actions push to the cluster (requires kubeconfig credentials in CI). ArgoCD pulls from Git (only needs Git credentials, no external access to the cluster). This is a security improvement — your cluster doesn't expose an API to every CI runner.

**TML uses ArgoCD for:** All IPMS4 deployments. The `argocd-image-updater` watches ECR for new commit-SHA-tagged images and automatically creates Git commits that update the Helm `values.yaml`, which triggers ArgoCD to roll out the new container.

---

## Core Concepts

| Concept | Description |
|---|---|
| **Application CRD** | The central ArgoCD object. Defines a Git source (repo + path) and a Kubernetes destination (cluster + namespace). |
| **Sync** | The act of applying manifests from Git to the cluster. Can be manual or automated. |
| **Self-Heal** | When the cluster drifts from Git (e.g., manual `kubectl edit`), ArgoCD automatically reverts to the Git state. |
| **Prune** | Delete Kubernetes resources that exist in the cluster but have been removed from Git. Disabled by default. |
| **Synced** | The cluster state matches Git exactly. |
| **OutOfSync** | The cluster state differs from Git (new commit in Git, or manual change in cluster). |
| **Healthy** | All managed resources are in a healthy state (pods running, deployments ready). |
| **Progressing** | Resources are being updated (rolling deployment in progress). |
| **Degraded** | One or more resources are in a failed state. |
| **AppProject** | RBAC isolation boundary. Restricts which repos an Application can source from and which clusters/namespaces it can deploy to. |
| **ApplicationSet** | A higher-level controller that generates multiple Application objects from a template using generators (list, git, cluster, matrix). |

---

## Installation & Setup

### Install ArgoCD in Your Cluster

```bash
# Create namespace
kubectl create namespace argocd

# Apply the official ArgoCD install manifest
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for all pods to be ready
kubectl wait --for=condition=Ready pod --all -n argocd --timeout=120s

# Check what's running
kubectl get pods -n argocd
```

### Access the ArgoCD UI

```bash
# Port-forward the ArgoCD server (it serves HTTPS on 443)
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Get the initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo
```

Open `https://localhost:8080`, login with username `admin` and the password above.

### Install and Configure the ArgoCD CLI

```bash
# Install argocd CLI (Linux)
curl -sSL -o argocd \
  https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x argocd && sudo mv argocd /usr/local/bin/

# Login
argocd login localhost:8080 --username admin --insecure

# List applications
argocd app list

# Get cluster info
argocd cluster list
```

---

## Beginner

### Your First Application YAML

Instead of using the CLI or UI to create applications, define them as YAML and commit them to Git. This makes your ArgoCD configuration itself version-controlled.

```yaml
# argocd/apps/ep-production-broadcast.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ep-production-broadcast
  namespace: argocd          # Application CRD always lives in argocd namespace
  labels:
    product: ipms4
    env: production
spec:
  project: ipms4             # AppProject for RBAC isolation

  source:
    repoURL: https://github.com/tata-motors/ep-infrastructure.git
    targetRevision: HEAD      # track latest commit on default branch
    path: helm/ep-production-broadcast/overlays/production

  destination:
    server: https://kubernetes.default.svc   # in-cluster destination
    namespace: ipms4-production

  syncPolicy:
    syncOptions:
      - CreateNamespace=true   # create namespace if it doesn't exist
```

Apply it:
```bash
kubectl apply -f argocd/apps/ep-production-broadcast.yaml
```

The application will appear in the ArgoCD UI as **OutOfSync** until you trigger the first sync.

### Essential ArgoCD CLI Commands

```bash
# List all applications
argocd app list

# Describe an application (shows sync status, health, resources)
argocd app get ep-production-broadcast

# Show diff between Git state and cluster state
argocd app diff ep-production-broadcast

# Manually trigger sync
argocd app sync ep-production-broadcast

# Sync and wait for it to complete
argocd app sync ep-production-broadcast --timeout 120

# Roll back to a previous revision
argocd app rollback ep-production-broadcast 3

# View rollout history
argocd app history ep-production-broadcast

# Force a hard refresh (re-read Git, ignore cache)
argocd app get ep-production-broadcast --hard-refresh

# Delete application (does not delete cluster resources by default)
argocd app delete ep-production-broadcast
```

`argocd app rollback` uses the ArgoCD history, not Git history — it re-deploys the manifests from a previous ArgoCD sync operation. For a full rollback with Git audit trail, use `git revert`.

---

## Intermediate

### Automated Sync with Self-Heal and Prune

```yaml
spec:
  syncPolicy:
    automated:
      prune: true        # delete resources removed from Git
      selfHeal: true     # revert manual cluster changes automatically
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground   # wait for deleted pods to terminate
      - ApplyOutOfSyncOnly=true             # only apply changed resources (faster)
    retry:
      limit: 3           # retry failed syncs up to 3 times
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

With `selfHeal: true`, if someone runs `kubectl scale deployment ep-production-broadcast --replicas=1` directly, ArgoCD will revert it within minutes. This enforces the "Git is the source of truth" contract.

**Warning:** Enable `prune: true` carefully. If you accidentally remove a resource from Git, ArgoCD will delete it from the cluster. Always review ArgoCD diffs on PRs before merging.

### Resource Hooks: Pre/Post-Sync Jobs

Hooks let you run Jobs at specific points in the sync lifecycle. The most common use case is running database migrations before deploying a new application version.

```yaml
# A Job with the PreSync hook annotation
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: 123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast:abc123
          command: ["java", "-jar", "app.jar", "--spring.batch.job.enabled=true", "--migrate-only"]
          env:
            - name: SPRING_DATASOURCE_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: url
```

```yaml
# A PostSync smoke-test Job
apiVersion: batch/v1
kind: Job
metadata:
  name: smoke-test
  annotations:
    argocd.argoproj.io/hook: PostSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: smoke
          image: curlimages/curl:latest
          command:
            - sh
            - -c
            - |
              curl -sf http://ep-production-broadcast:9096/actuator/health || exit 1
              echo "Smoke test passed"
```

Hook delete policies:
- `HookSucceeded` — delete the Job after it completes successfully
- `HookFailed` — delete the Job if it fails (useful when you want failures to remain for debugging)
- `BeforeHookCreation` — delete the Job before creating a new hook (prevents stale hook pods)

### App of Apps Pattern

The App of Apps pattern uses a single "parent" Application that points to a directory containing other Application manifests. This bootstraps an entire environment with a single ArgoCD application.

```
argocd/
└── environments/
    └── production/
        ├── ep-production-broadcast.yaml   # Application manifest
        ├── ep-iot-service.yaml
        ├── ep-gmes-integration.yaml
        └── ep-data-lake.yaml
```

```yaml
# argocd/apps/production-root.yaml — the "app of apps" root
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: production-root
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/tata-motors/ep-infrastructure.git
    targetRevision: HEAD
    path: argocd/environments/production     # directory of Application manifests
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

When `production-root` syncs, ArgoCD creates all the `Application` objects found in the directory, and each of those Applications then syncs their respective services. Adding a new service to production means adding an Application manifest to `argocd/environments/production/` and committing.

---

## Advanced

### ApplicationSet with List Generator

ApplicationSet generates multiple Application objects from a template. The **list generator** is the simplest: you provide a list of key-value pairs and one Application is generated per list entry.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: ipms4-services
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - service: ep-production-broadcast
            namespace: ipms4-production
            env: production
          - service: ep-production-broadcast
            namespace: ipms4-staging
            env: staging
          - service: ep-iot-service
            namespace: ipms4-production
            env: production

  template:
    metadata:
      name: '{{service}}-{{env}}'
      labels:
        service: '{{service}}'
        env: '{{env}}'
    spec:
      project: ipms4
      source:
        repoURL: https://github.com/tata-motors/ep-infrastructure.git
        targetRevision: HEAD
        path: 'helm/{{service}}/overlays/{{env}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{namespace}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

This single ApplicationSet YAML generates 3 Applications. Adding an environment or service is a one-line YAML change.

### ApplicationSet with Git Directory Generator

The **git generator** scans a Git repository's directory structure and generates one Application per directory that matches a pattern:

```yaml
spec:
  generators:
    - git:
        repoURL: https://github.com/tata-motors/ep-infrastructure.git
        revision: HEAD
        directories:
          - path: argocd/deploy/production/*   # one Application per subdirectory
```

With this configuration, if you create `argocd/deploy/production/ep-new-service/`, ArgoCD automatically creates an Application for it on the next sync. No ApplicationSet YAML change required.

### argocd-image-updater

`argocd-image-updater` watches an image registry (ECR) for new tags matching a pattern. When it finds a new tag, it updates the Helm `values.yaml` file in Git via a commit (write-back method), which then triggers ArgoCD to sync the new image.

```yaml
# Annotation on the Application CRD
metadata:
  annotations:
    argocd-image-updater.argoproj.io/image-list: >
      ep-production-broadcast=123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast
    argocd-image-updater.argoproj.io/ep-production-broadcast.update-strategy: digest
    argocd-image-updater.argoproj.io/ep-production-broadcast.helm.image-name: image.repository
    argocd-image-updater.argoproj.io/ep-production-broadcast.helm.image-tag: image.tag
    argocd-image-updater.argoproj.io/write-back-method: git
    argocd-image-updater.argoproj.io/git-branch: main
```

The `write-back` method means the image updater commits to the Git repository directly, updating `values.yaml` with the new image tag. This creates a complete audit trail: you can see in Git exactly when each image tag was deployed.

### Multi-Cluster: Register External Clusters

```bash
# Add a remote cluster's kubeconfig context to ArgoCD
argocd cluster add my-production-cluster-context \
  --name production-ap-south-1

# Verify the cluster is registered
argocd cluster list

# Now Applications can target this cluster
spec:
  destination:
    server: https://api.production-ap-south-1.example.com
    namespace: ipms4-production
```

The ArgoCD `argocd-manager` service account is created in the target cluster with the necessary permissions. ArgoCD's application controller then manages that cluster from the central ArgoCD installation.

---

## Expert

### ArgoCD High Availability

For production ArgoCD, run multiple replicas of critical components:

```yaml
# Scale ArgoCD components for HA
kubectl scale deployment argocd-server -n argocd --replicas=3
kubectl scale deployment argocd-repo-server -n argocd --replicas=2
kubectl scale statefulset argocd-application-controller -n argocd --replicas=3
```

In HA mode, the application controller uses a sharding algorithm to distribute Applications across controller replicas. Each controller only manages a subset of Applications, preventing memory and CPU bottlenecks as the Application count grows.

For production ArgoCD installations, also configure:
- Redis Sentinel or Redis Cluster for HA redis
- Shared filesystem (EFS/NFS) for repo-server cache
- PostgreSQL (instead of SQLite) for ArgoCD data persistence

### AppProject RBAC

`AppProject` defines a security boundary around a set of Applications. It restricts which Git repositories Applications can source from and which clusters/namespaces they can deploy to.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: ipms4
  namespace: argocd
spec:
  description: IPMS4 product line applications

  # Only these repositories can be sources
  sourceRepos:
    - https://github.com/tata-motors/ep-infrastructure.git
    - https://github.com/tata-motors/ep-helm-charts.git

  # Only these destinations are allowed
  destinations:
    - server: https://kubernetes.default.svc
      namespace: ipms4-*          # wildcard: ipms4-production, ipms4-staging, etc.

  # Cluster-scoped resources Applications in this project cannot manage
  clusterResourceBlacklist:
    - group: ''
      kind: Namespace              # prevent creating arbitrary namespaces

  # RBAC roles within this project
  roles:
    - name: developer
      description: Read-only access plus ability to sync
      policies:
        - p, proj:ipms4:developer, applications, get, ipms4/*, allow
        - p, proj:ipms4:developer, applications, sync, ipms4/*, allow
      groups:
        - tata-motors:ipms4-developers

    - name: admin
      description: Full access to ipms4 applications
      policies:
        - p, proj:ipms4:admin, applications, *, ipms4/*, allow
      groups:
        - tata-motors:platform-team
```

### Custom Health Checks with Lua

ArgoCD has built-in health checks for standard Kubernetes resources. For custom CRDs, define health logic in Lua:

```yaml
# In argocd-cm ConfigMap
data:
  resource.customizations.health.argoproj.io_Rollout: |
    hs = {}
    if obj.status ~= nil then
      if obj.status.phase == "Healthy" then
        hs.status = "Healthy"
        hs.message = obj.status.message
        return hs
      end
      if obj.status.phase == "Degraded" then
        hs.status = "Degraded"
        hs.message = obj.status.message
        return hs
      end
    end
    hs.status = "Progressing"
    hs.message = "Waiting for rollout"
    return hs
```

### SSO with Keycloak OIDC

```yaml
# In argocd-cm ConfigMap
data:
  url: https://argocd.internal.tataml.com
  oidc.config: |
    name: Keycloak
    issuer: https://keycloak.internal.tataml.com/realms/tataml
    clientID: argocd
    clientSecret: $oidc.keycloak.clientSecret     # references argocd-secret
    requestedScopes: ["openid", "profile", "email", "groups"]
    requestedIDTokenClaims: {"groups": {"essential": true}}
```

```yaml
# In argocd-rbac-cm ConfigMap
data:
  policy.csv: |
    g, /tataml:platform-team, role:admin
    g, /tataml:ipms4-developers, role:readonly
  policy.default: role:readonly
  scopes: '[groups]'
```

---

## In the TML Codebase

**IPMS4 platform:** ArgoCD is the deployment mechanism for all IPMS4 microservices. No `kubectl apply` or `helm upgrade` commands run in CI pipelines. GitHub Actions builds and pushes the Docker image; ArgoCD handles the rest.

**Directory layout:**
```
ep-infrastructure/
└── argocd/
    └── deploy/
        ├── dev/
        │   ├── ep-production-broadcast/   # Helm values for dev
        │   └── ep-iot-service/
        ├── staging/
        └── prod/
            ├── ep-production-broadcast/
            └── ep-gmes-integration/
```

Each leaf directory contains a Helm `values.yaml` (or Kustomize overlay) that ArgoCD uses as the source for that Application.

**`argocd-image-updater` workflow:**
1. GitHub Actions pushes `ep-production-broadcast:{commit-sha}` to ECR
2. `argocd-image-updater` polls ECR, detects the new tag
3. It commits `image.tag: {commit-sha}` to `argocd/deploy/prod/ep-production-broadcast/values.yaml`
4. ArgoCD detects the Git change (OutOfSync), syncs, deploys the new image

This creates a full loop: push code → CI builds image → image updater commits → ArgoCD deploys. Every deployment is traceable back to a specific Git commit in both the application repository and the infrastructure repository.

**ApplicationSet:** A single ApplicationSet generates Applications for all environments (dev, staging, prod) for each service. Adding a new environment requires adding an entry to the ApplicationSet generator list.

**RBAC isolation:** Each product line (ipms4, mes4-ev) has its own AppProject. Developers in the IPMS4 team can sync IPMS4 Applications but cannot touch MES4-EV resources, and vice versa.

**Transition status:** Legacy MES4/MES4-EV services still use Jenkins + Ansible deploy. IPMS4 is fully on GitOps. When MES4 services are eventually containerized, they will migrate to ArgoCD.

---

## Quick Reference

### Application YAML Skeleton

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: MY-APP
  namespace: argocd
spec:
  project: MY-PROJECT
  source:
    repoURL: https://github.com/ORG/REPO.git
    targetRevision: HEAD
    path: helm/MY-APP/overlays/ENV
  destination:
    server: https://kubernetes.default.svc
    namespace: MY-NAMESPACE
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### ArgoCD CLI Reference Table

| Command | Description |
|---|---|
| `argocd app list` | List all applications |
| `argocd app get NAME` | Show application details and health |
| `argocd app diff NAME` | Show diff between Git and cluster |
| `argocd app sync NAME` | Manually trigger sync |
| `argocd app sync NAME --dry-run` | Preview what sync would do |
| `argocd app rollback NAME N` | Roll back to history entry N |
| `argocd app history NAME` | Show sync history |
| `argocd app set NAME --sync-policy automated` | Enable auto-sync |
| `argocd app delete NAME --cascade` | Delete app and all cluster resources |
| `argocd cluster list` | Show registered clusters |
| `argocd cluster add CONTEXT` | Register a new cluster |
| `argocd repo list` | Show registered Git repositories |

### ApplicationSet Generator Examples

```yaml
# List generator
generators:
  - list:
      elements:
        - env: dev
        - env: staging
        - env: prod

# Git directory generator
generators:
  - git:
      repoURL: https://github.com/org/repo.git
      revision: HEAD
      directories:
        - path: argocd/deploy/prod/*
```
