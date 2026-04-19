# Terraform

## Prerequisites

- **AWS (11-aws.md)** — IAM, VPC, S3, ECR, Secrets Manager, RDS, IAM roles
- **Kubernetes & Helm (13-kubernetes-helm.md)** — understanding of K8s resources and KOPS
- Basic command line: running commands, reading error output
- YAML/JSON basics — Terraform uses HCL (similar structure)

---

## What & Why

Before Infrastructure as Code (IaC), infrastructure was provisioned by clicking through the AWS console. This created invisible state — nobody knew exactly what was running, why, or how it differed between environments.

**Terraform** turns infrastructure into version-controlled, reviewable, repeatable code:

```
terraform plan    →  shows what WILL change (like git diff for infra)
terraform apply   →  makes the changes
terraform destroy →  tears everything down
```

| Manual AWS Console | Terraform |
|---|---|
| "Who created this RDS instance? When?" | Git blame on `rds.tf` |
| Environments drift (prod has X, staging doesn't) | Same code, different tfvars = consistent environments |
| No disaster recovery story | `terraform apply` recreates everything |
| No review process for infra changes | PR + `terraform plan` output = reviewable change |
| CloudFormation (AWS-only) | Terraform: AWS + K8s + Keycloak + GitHub in one tool |

**Why Terraform over CloudFormation?**
- Multi-provider: AWS + Kubernetes + Helm + Keycloak managed in the same codebase
- HCL is cleaner and more readable than CloudFormation JSON/YAML
- Terraform plan is more informative than CloudFormation change sets
- Massive community: providers for 3000+ services
- `terraform import` to bring existing resources under management

---

## Core Concepts

```
Terraform lifecycle:
  Write HCL code → terraform init (download providers)
                 → terraform plan (preview changes)
                 → terraform apply (make changes)
                 → terraform destroy (tear down)

Key concepts:
  Provider    — plugin that knows how to talk to AWS/K8s/Keycloak API
  Resource    — a real thing to create (S3 bucket, EC2, IAM role)
  Data source — read existing infrastructure (not managed by this config)
  Variable    — input parameter
  Output      — export a value for other modules/humans to use
  Local       — computed value used within the module
  State       — Terraform's record of what it created (DON'T delete this)
  Module      — reusable group of resources
```

### State

Terraform state is a JSON file that maps your HCL resources to real cloud resources. Without state, Terraform doesn't know what it already created.

- **Local state** (`terraform.tfstate`) — fine for learning, dangerous for teams (merge conflicts, accidental deletion)
- **Remote state** (S3 + DynamoDB) — team-safe, locked during operations, encrypted at rest

---

## Installation & Setup

```bash
# tfenv — Terraform version manager (recommended)
git clone https://github.com/tfutils/tfenv.git ~/.tfenv
echo 'export PATH="$HOME/.tfenv/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Install Terraform 1.6.0
tfenv install 1.6.0
tfenv use 1.6.0
terraform version
# Terraform v1.6.0

# Basic workflow
cd terraform/kafka/ipms4/dev/
terraform init      # download providers declared in required_providers
terraform plan      # preview: what will be created/modified/destroyed?
terraform apply     # execute the plan (prompts for confirmation)
terraform destroy   # tear down all resources (use with caution!)

# Non-interactive apply (CI pipelines)
terraform apply -auto-approve
```

---

## Beginner

### S3 Bucket Resource

```hcl
# main.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"    # allow 5.x, reject 6.x
    }
  }
  required_version = ">= 1.6.0"
}

provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "machine_data" {
  bucket = "tml-machine-data-${var.environment}"

  tags = {
    Environment = var.environment
    Product     = "IPMS4"
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "machine_data" {
  bucket = aws_s3_bucket.machine_data.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "machine_data" {
  bucket = aws_s3_bucket.machine_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
```

### Variables

```hcl
# variables.tf

variable "aws_region" {
  type        = string
  description = "AWS region for all resources"
  default     = "ap-south-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment: dev, pre-prod, or prod"

  validation {
    condition     = contains(["dev", "pre-prod", "prod"], var.environment)
    error_message = "environment must be one of: dev, pre-prod, prod"
  }
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t3.medium"
}
```

### Outputs

```hcl
# outputs.tf

output "machine_data_bucket_arn" {
  description = "ARN of the machine data S3 bucket"
  value       = aws_s3_bucket.machine_data.arn
}

output "machine_data_bucket_name" {
  description = "Name of the machine data S3 bucket"
  value       = aws_s3_bucket.machine_data.id
}
```

### terraform.tfvars

```hcl
# terraform.tfvars — values for variable inputs (do not commit secrets!)
aws_region       = "ap-south-1"
environment      = "dev"
db_instance_class = "db.t3.small"
```

### S3 Remote State Backend

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "tml-terraform-state"
    key            = "kafka/ipms4/dev/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "tml-terraform-locks"   # state locking
  }
}
```

The DynamoDB table must have `LockID` as the partition key (String). Terraform creates and deletes lock entries atomically — prevents two `terraform apply` runs from conflicting.

---

## Intermediate

### Module Structure

```
terraform/
└── modules/
    └── rds/
        ├── main.tf        ← resource definitions
        ├── variables.tf   ← module input variables
        └── outputs.tf     ← module output values
```

```hcl
# modules/rds/main.tf
resource "aws_db_instance" "this" {
  identifier        = "${var.name}-postgres"
  engine            = "postgres"
  engine_version    = var.postgres_version
  instance_class    = var.instance_class
  db_name           = var.db_name
  username          = var.db_username
  password          = var.db_password
  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  multi_az          = var.multi_az

  vpc_security_group_ids = var.security_group_ids
  db_subnet_group_name   = var.subnet_group_name

  backup_retention_period = var.backup_retention_days
  skip_final_snapshot     = var.environment != "prod"

  tags = merge(var.tags, { Name = "${var.name}-postgres" })
}
```

```hcl
# Call the module from an environment config
module "ipms4_db" {
  source = "../../modules/rds"

  name              = "ipms4"
  environment       = var.environment
  postgres_version  = "15.4"
  instance_class    = var.db_instance_class
  db_name           = "ipms4"
  db_username       = "appuser"
  db_password       = data.aws_secretsmanager_secret_version.db_password.secret_string
  allocated_storage = 100
  multi_az          = var.environment == "prod"
  security_group_ids = [aws_security_group.rds.id]
  subnet_group_name  = aws_db_subnet_group.main.name
  backup_retention_days = var.environment == "prod" ? 7 : 1

  tags = local.common_tags
}
```

### Remote State Data Source

Read outputs from another Terraform workspace:

```hcl
# Read VPC state created by a separate networking Terraform config
data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "tml-terraform-state"
    key    = "networking/ipms4/prod/terraform.tfstate"
    region = "ap-south-1"
  }
}

# Use the VPC ID from the networking state
resource "aws_db_subnet_group" "main" {
  name       = "ipms4-prod-db-subnet-group"
  subnet_ids = data.terraform_remote_state.networking.outputs.private_subnet_ids
}
```

### for_each: Create Multiple Resources from a Set

```hcl
# Create one ECR repository per service
variable "services" {
  type    = set(string)
  default = [
    "ep-production-broadcast",
    "ep-sap-connector",
    "ep-machine-integration",
    "ep-authorization",
  ]
}

resource "aws_ecr_repository" "services" {
  for_each = var.services
  name     = each.value

  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Service = each.value
    ManagedBy = "terraform"
  }
}

# Reference a specific repository
output "ep_production_broadcast_ecr_url" {
  value = aws_ecr_repository.services["ep-production-broadcast"].repository_url
}
```

### count for Conditional Resource

```hcl
# Only create the read replica in production
resource "aws_db_instance" "read_replica" {
  count = var.environment == "prod" ? 1 : 0

  identifier          = "ipms4-${var.environment}-postgres-replica"
  replicate_source_db = aws_db_instance.primary.identifier
  instance_class      = var.db_instance_class
  publicly_accessible = false
  skip_final_snapshot = true
}
```

### Terraform Workspaces

```bash
# Create and use a workspace per environment
terraform workspace new dev
terraform workspace new prod
terraform workspace select dev

# Reference workspace name in code
resource "aws_s3_bucket" "machine_data" {
  bucket = "tml-machine-data-${terraform.workspace}"
}
```

TML uses directory-based environment isolation (separate `terraform.tfstate` per directory) rather than workspaces, but workspaces are common in other teams.

---

## Advanced

### Full VPC + Application Stack

```hcl
# vpc.tf
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "ipms4-${var.environment}"
  cidr = "10.${local.cidr_octet}.0.0/16"

  azs             = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
  private_subnets = ["10.${local.cidr_octet}.1.0/24", "10.${local.cidr_octet}.2.0/24", "10.${local.cidr_octet}.3.0/24"]
  public_subnets  = ["10.${local.cidr_octet}.101.0/24", "10.${local.cidr_octet}.102.0/24", "10.${local.cidr_octet}.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = var.environment != "prod"

  tags = local.common_tags
}
```

```hcl
# secrets.tf
resource "aws_secretsmanager_secret" "ep_production_broadcast" {
  name        = "/ipms4/${var.environment}/ep-production-broadcast"
  description = "Runtime secrets for ep-production-broadcast"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "ep_production_broadcast" {
  secret_id = aws_secretsmanager_secret.ep_production_broadcast.id
  secret_string = jsonencode({
    db_password           = random_password.db_password.result
    keycloak_client_secret = var.keycloak_client_secret
    kafka_bootstrap_servers = module.kafka.bootstrap_servers
  })
}
```

### Kubernetes Provider

```hcl
# providers.tf
provider "kubernetes" {
  host                   = data.aws_eks_cluster.ipms4.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.ipms4.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.ipms4.token
}

# Create namespace via Terraform
resource "kubernetes_namespace" "ipms4_prod" {
  metadata {
    name = "ipms4-prod"
    labels = {
      environment = "prod"
      product     = "ipms4"
    }
  }
}

# Service account with IRSA annotation
resource "kubernetes_service_account" "ep_production_broadcast" {
  metadata {
    name      = "ep-production-broadcast"
    namespace = kubernetes_namespace.ipms4_prod.metadata[0].name
    annotations = {
      "eks.amazonaws.com/role-arn" = aws_iam_role.ep_production_broadcast.arn
    }
  }
}
```

### Helm Provider

```hcl
provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.ipms4.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.ipms4.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.ipms4.token
  }
}

resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"
  version    = "0.9.9"
  namespace  = "external-secrets"
  create_namespace = true

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = aws_iam_role.external_secrets.arn
  }
}
```

### Keycloak Provider

```hcl
provider "keycloak" {
  client_id     = "admin-cli"
  username      = "admin"
  password      = var.keycloak_admin_password
  url           = "https://keycloak.tml.com"
}

resource "keycloak_realm" "tml" {
  realm   = "tml"
  enabled = true

  login_theme = "tml-theme"

  access_token_lifespan = "300s"   # 5 minutes

  smtp_server {
    host = "email-smtp.ap-south-1.amazonaws.com"
    port = 587
    from = "noreply@tml.com"
    auth {
      username = var.ses_smtp_username
      password = var.ses_smtp_password
    }
  }
}

resource "keycloak_openid_client" "ep_frontend" {
  realm_id              = keycloak_realm.tml.id
  client_id             = "ep-frontend"
  name                  = "EP Frontend"
  enabled               = true
  access_type           = "PUBLIC"   # no client secret
  standard_flow_enabled = true
  valid_redirect_uris   = ["https://ep.ipms4.tml.com/*"]
  web_origins           = ["https://ep.ipms4.tml.com"]
}

resource "keycloak_role" "operator" {
  realm_id = keycloak_realm.tml.id
  name     = "ROLE_OPERATOR"
}
```

---

## Expert

### terraform import: Bring Existing Resources Under Management

```bash
# Import an existing S3 bucket (the bucket was created manually)
terraform import aws_s3_bucket.machine_data tml-machine-data-prod

# Import an existing RDS instance
terraform import aws_db_instance.primary ipms4-prod-postgres

# Import a Kubernetes namespace
terraform import kubernetes_namespace.ipms4_prod ipms4-prod

# After import: run terraform plan to see drift between actual state and your .tf code
terraform plan
# If there are diffs, update your .tf code to match reality, then re-plan until clean
```

### State Surgery

```bash
# List all resources in state
terraform state list

# Move a resource to a new address (after renaming in .tf code)
terraform state mv aws_s3_bucket.data aws_s3_bucket.machine_data

# Remove a resource from state WITHOUT destroying it
# (use when you want Terraform to stop managing something)
terraform state rm aws_s3_bucket.legacy_bucket

# Pull remote state locally for inspection
terraform state pull > current-state.json
```

### Provider Version Pinning

```hcl
terraform {
  required_version = ">= 1.6.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.31"     # allow 5.31.x, block 6.x
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    keycloak = {
      source  = "mrparkers/keycloak"
      version = "~> 4.3"
    }
  }
}
```

Run `terraform providers lock -platform=linux_amd64` after updating versions to lock the `.terraform.lock.hcl` file. Commit this file.

### Atlantis: PR-Based Plan/Apply Workflow

Atlantis runs on a server (or K8s pod) and integrates with GitHub:

1. Open PR with Terraform changes
2. Atlantis automatically comments with `terraform plan` output
3. Team reviews the plan (what WILL change)
4. Comment `atlantis apply` on the PR — Atlantis applies and merges
5. No manual `terraform apply` on local machines for production

```yaml
# atlantis.yaml — repository config
version: 3
projects:
  - name: kafka-ipms4-prod
    dir: terraform/kafka/ipms4/prod
    workspace: default
    autoplan:
      when_modified: ["*.tf", "*.tfvars", "../../../modules/**/*.tf"]
      enabled: true
    apply_requirements: [approved, mergeable]
```

---

## In the TML Codebase

### Directory Structure

```
ep-assembly-root/
└── terraform/
    ├── modules/
    │   ├── kafka/           ← AMQ Streams / Kafka module
    │   ├── rds/             ← PostgreSQL RDS module
    │   ├── keycloak/        ← Keycloak realm + clients
    │   ├── kops-cluster/    ← KOPS K8s cluster
    │   └── kong/            ← Kong API Gateway
    ├── kafka/
    │   ├── ipms4/
    │   │   ├── dev/
    │   │   │   ├── main.tf
    │   │   │   ├── variables.tf
    │   │   │   ├── outputs.tf
    │   │   │   ├── backend.tf
    │   │   │   └── terraform.tfvars
    │   │   ├── pre-prod/
    │   │   └── prod/
    │   ├── mes4/
    │   └── mes4-ev/
    └── keycloak/
        └── ipms4/
            ├── dev/
            ├── pre-prod/
            └── prod/
```

### Remote State Backend

```hcl
# Every environment backend.tf
terraform {
  backend "s3" {
    bucket         = "tml-terraform-state"
    key            = "{module}/{context}/{environment}/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "tml-terraform-locks"
  }
}
```

Examples:
- `kafka/ipms4/prod/terraform.tfstate`
- `keycloak/ipms4/prod/terraform.tfstate`
- `kops-cluster/ipms4/terraform.tfstate`

### Makefile Wrapper

`ep-assembly-root/Makefile` wraps Terraform commands for each context/environment:

```makefile
# Usage:
#   make tf-plan context=ipms4 env=prod module=kafka
#   make tf-apply context=ipms4 env=prod module=kafka

TF_DIR := terraform/$(module)/$(context)/$(env)

tf-init:
    cd $(TF_DIR) && terraform init -backend-config=backend.tf

tf-plan:
    cd $(TF_DIR) && terraform plan -var-file=terraform.tfvars

tf-apply:
    cd $(TF_DIR) && terraform apply -var-file=terraform.tfvars -auto-approve

tf-destroy:
    @echo "DANGER: About to destroy $(module)/$(context)/$(env)"
    @read -p "Type the environment name to confirm: " confirm && [ "$$confirm" = "$(env)" ]
    cd $(TF_DIR) && terraform destroy -var-file=terraform.tfvars
```

### Modules Managed

| Module | What it provisions |
|---|---|
| `kops-cluster` | EC2 nodes, Route53 DNS, K8s cluster state in S3 |
| `kafka` | AMQ Streams operator, Kafka CRD, KafkaTopic CRDs |
| `keycloak` | Realm, clients, roles, protocol mappers |
| `jenkins` | Jenkins EC2 instance, IAM role, EBS volume |
| `github-actions-runners` | Self-hosted runner EC2 ASG, IAM role, ECR access |
| `kong` | Kong API Gateway deployment via Helm |
| `efk` | Elasticsearch, Fluentd, Kibana via Helm |
| `prometheus` | Prometheus + Grafana via kube-prometheus-stack |

---

## Quick Reference

### HCL Syntax Cheat Sheet

```hcl
# Resource
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket-name"
}

# Variable
variable "environment" {
  type    = string
  default = "dev"
}

# Output
output "bucket_arn" {
  value = aws_s3_bucket.my_bucket.arn
}

# Local
locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Data source (read existing resource)
data "aws_vpc" "main" {
  tags = { Name = "ipms4-${var.environment}" }
}

# Reference a resource attribute
resource "aws_db_subnet_group" "main" {
  subnet_ids = data.terraform_remote_state.vpc.outputs.private_subnet_ids
}

# for_each
resource "aws_ecr_repository" "services" {
  for_each = toset(["service-a", "service-b"])
  name     = each.value
}

# count (conditional)
resource "aws_db_instance" "replica" {
  count = var.environment == "prod" ? 1 : 0
  # ...
}
```

### Common AWS Resources

```hcl
# S3 bucket
resource "aws_s3_bucket" "b" { bucket = "name" }

# Secrets Manager
resource "aws_secretsmanager_secret" "s" { name = "/path/to/secret" }

# ECR repository
resource "aws_ecr_repository" "r" { name = "service-name" }

# IAM role + policy attachment
resource "aws_iam_role" "r" {
  name               = "my-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}
resource "aws_iam_role_policy_attachment" "a" {
  role       = aws_iam_role.r.name
  policy_arn = aws_iam_policy.p.arn
}
```

### backend.tf Template

```hcl
terraform {
  backend "s3" {
    bucket         = "tml-terraform-state"
    key            = "MODULE/CONTEXT/ENV/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "tml-terraform-locks"
  }
}
```
