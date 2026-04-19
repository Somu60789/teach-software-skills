# Kubernetes & Helm

## Prerequisites

- **Docker (12-docker.md)** — images, containers, Dockerfile, ECR
- Basic networking: DNS, ports, HTTP request routing
- YAML syntax (indentation-sensitive key-value config)

---

## What & Why

When you run one Docker container on one server, life is simple. When you run 20+ services across 50+ containers — and some need to restart when they crash, scale up under load, get updated without downtime, and communicate with each other — you need an orchestrator.

**Kubernetes (K8s)** is the industry-standard container orchestrator. You describe *desired state* in YAML ("I want 3 replicas of this service running"), and Kubernetes makes it so — continuously. If a container crashes, Kubernetes restarts it. If a node fails, containers move to healthy nodes.

| Manual Docker | Kubernetes |
|---|---|
| Manual container restart on crash | Automatic restart (restartPolicy, liveness probes) |
| Manual deployment steps | `kubectl apply -f` — declarative desired state |
| Hand-crafted nginx for load balancing | Built-in Service and Ingress |
| "Which server is this running on?" | Kubernetes handles placement transparently |
| No built-in secrets management | Secrets + External Secrets Operator |

**Helm** is the package manager for Kubernetes. Instead of maintaining 10 near-identical YAML files per service, you write one parameterised Helm chart and override values per service/environment.

---

## Core Concepts

```
Kubernetes Cluster
├── Node 1 (EC2 instance)
│   ├── Pod: ep-production-broadcast-7d8f9 (2 containers: app + sidecar)
│   └── Pod: ep-sap-connector-6c5b4
├── Node 2 (EC2 instance)
│   ├── Pod: ep-production-broadcast-4a3b2
│   └── Pod: ep-machine-integration-1f2e3
└── Control Plane
    ├── API Server  (kubectl talks to this)
    ├── etcd        (cluster state database)
    ├── Scheduler   (decides which node gets a pod)
    └── Controller  (ensures desired state is maintained)
```

- **Pod** — smallest deployable unit. Usually one container, sometimes two (app + sidecar). Has its own IP.
- **Deployment** — manages a set of identical Pods. Handles rolling updates, rollbacks, and scaling.
- **Service** — stable DNS name and IP that load-balances across Pods. Pods come and go; the Service IP is permanent.
- **Ingress** — routes external HTTP/HTTPS traffic to Services based on hostname/path rules.
- **ConfigMap** — non-sensitive configuration data (env vars, config files) stored in K8s.
- **Secret** — sensitive data (passwords, tokens) stored base64-encoded in K8s (use External Secrets for real security).
- **Namespace** — logical isolation within a cluster. `ipms4-prod`, `ipms4-dev`, `kafka`, etc.
- **Node** — a virtual machine (EC2 instance) that runs Pods.

---

## Installation & Setup

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
kubectl version --client

# Configure kubeconfig (from KOPS or EKS)
# KOPS exports kubeconfig automatically:
kops export kubeconfig --admin ipms4.k8s.tml.com

# Verify cluster access
kubectl get nodes
# NAME                                          STATUS   ROLES    AGE   VERSION
# ip-10-0-1-101.ap-south-1.compute.internal    Ready    node     14d   v1.27.x
# ip-10-0-1-102.ap-south-1.compute.internal    Ready    node     14d   v1.27.x

# Set default namespace for your session
kubectl config set-context --current --namespace=ipms4-dev

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version
```

---

## Beginner

### Deployment YAML

```yaml
# ep-production-broadcast-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ep-production-broadcast
  namespace: ipms4-dev
  labels:
    app: ep-production-broadcast
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ep-production-broadcast
  template:
    metadata:
      labels:
        app: ep-production-broadcast
    spec:
      serviceAccountName: ep-production-broadcast   # for IRSA
      containers:
        - name: ep-production-broadcast
          image: 123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast:abc1234
          ports:
            - containerPort: 8080
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: dev
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: ep-production-broadcast-secrets
                  key: DB_PASSWORD
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "500m"
              memory: "768Mi"
```

### Service YAML

```yaml
# ep-production-broadcast-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: ep-production-broadcast
  namespace: ipms4-dev
spec:
  type: ClusterIP         # internal only; use LoadBalancer for external
  selector:
    app: ep-production-broadcast
  ports:
    - protocol: TCP
      port: 80            # port other services call
      targetPort: 8080    # port the container listens on
```

### Essential kubectl Commands

```bash
# Apply configuration
kubectl apply -f deployment.yaml
kubectl apply -f ./k8s/   # apply all files in directory

# Observe state
kubectl get pods -n ipms4-dev
kubectl get pods -n ipms4-dev -w          # watch for changes
kubectl describe pod ep-production-broadcast-7d8f9 -n ipms4-dev
kubectl logs ep-production-broadcast-7d8f9 -n ipms4-dev
kubectl logs -f ep-production-broadcast-7d8f9 -n ipms4-dev   # follow

# Debug
kubectl exec -it ep-production-broadcast-7d8f9 -n ipms4-dev -- sh

# Deployment operations
kubectl rollout status deployment/ep-production-broadcast -n ipms4-dev
kubectl rollout history deployment/ep-production-broadcast -n ipms4-dev
kubectl rollout undo deployment/ep-production-broadcast -n ipms4-dev

# Port-forward for local access (bypasses Ingress)
kubectl port-forward pod/ep-production-broadcast-7d8f9 8080:8080 -n ipms4-dev
kubectl port-forward svc/ep-production-broadcast 8080:80 -n ipms4-dev
```

---

## Intermediate

### Liveness and Readiness Probes

```yaml
containers:
  - name: ep-production-broadcast
    livenessProbe:
      httpGet:
        path: /actuator/health/liveness
        port: 8080
      initialDelaySeconds: 60    # wait for JVM startup
      periodSeconds: 15
      failureThreshold: 3        # restart after 3 consecutive failures
    readinessProbe:
      httpGet:
        path: /actuator/health/readiness
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
      failureThreshold: 3        # remove from Service endpoints after 3 failures
```

Liveness failure → pod is **restarted**. Readiness failure → pod is removed from Service endpoints (stops receiving traffic) but not restarted.

### Horizontal Pod Autoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ep-production-broadcast
  namespace: ipms4-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ep-production-broadcast
  minReplicas: 2
  maxReplicas: 8
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70    # scale up when avg CPU > 70%
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Resource Requests and Limits

```yaml
resources:
  requests:
    cpu: "250m"       # 0.25 CPU cores — used for scheduling decisions
    memory: "512Mi"   # 512MB — node must have this free to schedule the pod
  limits:
    cpu: "500m"       # hard cap — CPU throttled above this
    memory: "768Mi"   # hard cap — pod OOMKilled if exceeded
```

Always set both requests and limits. Without requests, the scheduler can overpack nodes. Without limits, a memory leak in one pod starves all others.

### CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: adherence-report-generator
  namespace: ipms4-prod
spec:
  schedule: "0 6 * * *"    # 6 AM UTC = 11:30 AM IST
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: report-generator
              image: 123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-report-generator:abc1234
              env:
                - name: REPORT_DATE
                  value: "yesterday"
```

### Rollback to a Previous Revision

```bash
# View deployment history
kubectl rollout history deployment/ep-production-broadcast -n ipms4-prod

# Roll back to the previous version
kubectl rollout undo deployment/ep-production-broadcast -n ipms4-prod

# Roll back to a specific revision
kubectl rollout undo deployment/ep-production-broadcast \
  --to-revision=3 -n ipms4-prod
```

---

## Advanced

### External Secrets Operator

The External Secrets Operator reads secrets from AWS Secrets Manager and creates native K8s Secrets. No manual secret copying required.

```yaml
# ClusterSecretStore — cluster-wide reference to AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-south-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
            namespace: external-secrets
```

```yaml
# ExternalSecret — syncs specific secrets from AWS SM to K8s
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: ep-production-broadcast-secrets
  namespace: ipms4-prod
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: ep-production-broadcast-secrets   # K8s Secret name created by ESO
    creationPolicy: Owner
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: /ipms4/prod/ep-production-broadcast
        property: db_password
    - secretKey: KAFKA_BOOTSTRAP_SERVERS
      remoteRef:
        key: /ipms4/prod/ep-production-broadcast
        property: kafka_bootstrap_servers
```

### KOPS Cluster Operations

```bash
# Create cluster (generates K8s resources, does NOT apply yet)
kops create cluster \
  --name=ipms4.k8s.tml.com \
  --cloud=aws \
  --zones=ap-south-1a,ap-south-1b \
  --master-count=3 \
  --node-count=5 \
  --node-size=m5.xlarge \
  --master-size=m5.large \
  --kubernetes-version=1.27.0 \
  --state=s3://tml-kops-state

# Apply cluster creation
kops update cluster ipms4.k8s.tml.com --yes --state=s3://tml-kops-state

# Validate cluster
kops validate cluster --state=s3://tml-kops-state

# Rolling update (after changing instance type, K8s version)
kops rolling-update cluster ipms4.k8s.tml.com \
  --yes \
  --node-interval 3m \
  --state=s3://tml-kops-state
```

### Namespace Isolation and Resource Quotas

```bash
kubectl create namespace ipms4-prod
```

```yaml
# ResourceQuota — limits total resource consumption in a namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: ipms4-prod-quota
  namespace: ipms4-prod
spec:
  hard:
    requests.cpu: "20"
    requests.memory: "40Gi"
    limits.cpu: "40"
    limits.memory: "80Gi"
    pods: "100"
```

### RBAC

```yaml
# Role — allows reading pods/logs in ipms4-dev
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: dev-readonly
  namespace: ipms4-dev
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]

# RoleBinding — grants the role to a user
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: john-doe-readonly
  namespace: ipms4-dev
subjects:
  - kind: User
    name: john.doe
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: dev-readonly
  apiGroup: rbac.authorization.k8s.io
```

---

## Expert

### etcd Backup

```bash
# Run on a control plane node
ETCDCTL_API=3 etcdctl snapshot save /tmp/etcd-snapshot-$(date +%Y%m%d).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Verify snapshot
ETCDCTL_API=3 etcdctl snapshot status /tmp/etcd-snapshot-$(date +%Y%m%d).db
```

KOPS also handles automated etcd backups to S3 via the etcd-manager component.

### Cluster Upgrade with KOPS

```bash
# Step 1: Check available upgrades
kops upgrade cluster ipms4.k8s.tml.com --state=s3://tml-kops-state

# Step 2: Apply version change to KOPS state
kops update cluster ipms4.k8s.tml.com \
  --kubernetes-version=1.28.0 \
  --yes \
  --state=s3://tml-kops-state

# Step 3: Rolling update — replaces nodes one at a time (3-minute intervals)
kops rolling-update cluster ipms4.k8s.tml.com \
  --yes \
  --node-interval 3m \
  --state=s3://tml-kops-state
```

### OOMKilled: Detect and Fix

```bash
# Step 1: Check if pod was OOMKilled
kubectl describe pod ep-production-broadcast-xxx -n ipms4-prod
# Look for:
# Last State: Terminated
#   Reason:    OOMKilled
#   Exit Code: 137

# Step 2: Check current memory usage
kubectl top pods -n ipms4-prod

# Step 3: Fix options
# Option A: Increase memory limit in Deployment
#   limits.memory: "768Mi" → "1Gi"

# Option B: Fix JVM tuning (prevents JVM from ignoring container limits)
#   ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", ...]

# Option C: Profile and fix memory leak
#   kubectl exec -it pod-xxx -- jmap -dump:format=b,file=/tmp/heap.bin 1
#   kubectl cp pod-xxx:/tmp/heap.bin ./heap.bin
#   # Analyse with Eclipse MAT
```

### PodDisruptionBudget

Ensures at least N replicas are always available during voluntary disruptions (node drains, rolling updates):

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ep-production-broadcast-pdb
  namespace: ipms4-prod
spec:
  minAvailable: 1    # at least 1 replica must remain available
  selector:
    matchLabels:
      app: ep-production-broadcast
```

---

## Helm

### Chart Structure

```
ep-app/                        ← chart root
├── Chart.yaml                 ← chart metadata
├── values.yaml                ← default values
└── templates/
    ├── _helpers.tpl           ← reusable template functions
    ├── deployment.yaml        ← Deployment template
    ├── service.yaml           ← Service template
    ├── ingress.yaml           ← Ingress template
    ├── serviceaccount.yaml    ← ServiceAccount + IRSA annotation
    ├── hpa.yaml               ← HPA template
    └── externalsecret.yaml    ← ExternalSecret template
```

```yaml
# Chart.yaml
apiVersion: v2
name: ep-app
description: Generic Helm chart for TML EP microservices
type: application
version: 1.0.0
appVersion: "1.0.0"
```

### Helm Template Syntax

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "ep-app.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "ep-app.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "ep-app.selectorLabels" . | nindent 6 }}
  template:
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          {{- if .Values.env }}
          env:
            {{- range .Values.env }}
            - name: {{ .name }}
              value: {{ .value | quote }}
            {{- end }}
          {{- end }}
```

### Per-Service values.yaml

```yaml
# helm/ep-production-broadcast/values-prod.yaml
replicaCount: 3

image:
  repository: 123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast
  tag: abc1234   # replaced by CI pipeline with actual commit SHA

resources:
  requests:
    cpu: "250m"
    memory: "512Mi"
  limits:
    cpu: "500m"
    memory: "768Mi"

env:
  - name: SPRING_PROFILES_ACTIVE
    value: prod
  - name: KAFKA_BOOTSTRAP_SERVERS
    value: ipms4-kafka-bootstrap.kafka.svc.cluster.local:9092

ingress:
  enabled: true
  host: ep-production-broadcast.ipms4.tml.com
  tlsSecretName: tml-tls-cert
```

### Helm Commands

```bash
# Install or upgrade (idempotent)
helm upgrade --install ep-production-broadcast ./helm/ep-app \
  -f ./helm/ep-production-broadcast/values-dev.yaml \
  -n ipms4-dev \
  --create-namespace \
  --atomic           # roll back automatically if upgrade fails

# Render templates locally without deploying (for debugging)
helm template ep-production-broadcast ./helm/ep-app \
  -f ./helm/ep-production-broadcast/values-dev.yaml

# View deployment history
helm history ep-production-broadcast -n ipms4-dev

# Roll back to previous release
helm rollback ep-production-broadcast 1 -n ipms4-dev

# Uninstall
helm uninstall ep-production-broadcast -n ipms4-dev
```

---

## In the TML Codebase

### KOPS Clusters

| Cluster | K8s Version | Purpose |
|---|---|---|
| ipms4 | 1.27 | IPMS4 product (all environments) |
| mes4 | 1.24 | MES4 product |
| mes4-ev | 1.28 | MES4 EV variant |

All clusters run on AWS EC2 in `ap-south-1`, managed with KOPS. State stored in S3 (`tml-kops-state` bucket).

### Namespace Convention

```
{product}-{environment}

ipms4-dev
ipms4-pre-prod
ipms4-prod
mes4-dev
mes4-prod
kafka          ← shared infrastructure
monitoring     ← Prometheus, Grafana
argocd         ← GitOps
```

### ep-app Generic Helm Chart

All 20+ TML services use a single `ep-app` Helm chart with per-service `values.yaml` files. The chart lives in `ep-assembly-root/helm/ep-app/`. Per-service values live in `ep-assembly-root/helm/{service-name}/values-{env}.yaml`.

### GitOps Directory Structure

```
ep-assembly-root/
└── argocd/
    └── deploy/
        ├── dev/
        │   ├── ep-production-broadcast/
        │   │   └── values.yaml          ← dev overrides
        │   └── ep-sap-connector/
        │       └── values.yaml
        ├── pre-prod/
        └── prod/
```

Ansible templates `values.yaml` files with environment-specific values before `helm upgrade --install`. ArgoCD detects changes and triggers syncs.

### External Secrets Operator

ESO is deployed in the `external-secrets` namespace on all clusters. The `ClusterSecretStore` points to AWS Secrets Manager in `ap-south-1`. Every service has an `ExternalSecret` that creates the K8s Secret used by its Deployment.

---

## Quick Reference

### kubectl Command Reference

```bash
# Pods
kubectl get pods -n NAMESPACE
kubectl describe pod POD -n NAMESPACE
kubectl logs -f POD -n NAMESPACE
kubectl exec -it POD -n NAMESPACE -- sh
kubectl delete pod POD -n NAMESPACE   # K8s will restart it via Deployment

# Deployments
kubectl get deployments -n NAMESPACE
kubectl rollout status deployment/NAME -n NAMESPACE
kubectl rollout undo deployment/NAME -n NAMESPACE
kubectl scale deployment/NAME --replicas=5 -n NAMESPACE

# Resources
kubectl top pods -n NAMESPACE
kubectl top nodes
kubectl get events -n NAMESPACE --sort-by='.lastTimestamp'

# Secrets
kubectl get secret NAME -n NAMESPACE -o jsonpath='{.data.KEY}' | base64 -d
```

### Helm Command Reference

```bash
helm upgrade --install RELEASE ./chart -f values.yaml -n NAMESPACE
helm history RELEASE -n NAMESPACE
helm rollback RELEASE REVISION -n NAMESPACE
helm template RELEASE ./chart -f values.yaml     # dry run
helm list -n NAMESPACE
helm uninstall RELEASE -n NAMESPACE
```

### Deployment YAML Template

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-service
  namespace: my-namespace
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-service
  template:
    metadata:
      labels:
        app: my-service
    spec:
      containers:
        - name: my-service
          image: my-image:tag
          ports:
            - containerPort: 8080
          resources:
            requests: { cpu: "250m", memory: "512Mi" }
            limits:   { cpu: "500m", memory: "768Mi" }
          livenessProbe:
            httpGet: { path: /actuator/health/liveness, port: 8080 }
            initialDelaySeconds: 60
          readinessProbe:
            httpGet: { path: /actuator/health/readiness, port: 8080 }
            initialDelaySeconds: 30
```
