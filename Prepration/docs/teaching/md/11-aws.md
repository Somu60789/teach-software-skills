# AWS Cloud Services

## Prerequisites

- Basic networking: DNS (domain → IP), HTTP (request/response), TCP ports, what a firewall does
- Linux command line basics (ls, cd, cat, chmod)
- Docker (12-docker.md) is helpful for the ECR section but not required

---

## What & Why

AWS (Amazon Web Services) is the cloud platform TML uses to run its production infrastructure. Rather than owning physical servers in a data centre, TML rents virtual machines, managed databases, object storage, and other services from AWS on-demand.

**Why cloud over on-premises?**

| On-Premises | AWS Cloud |
|---|---|
| Hardware procurement takes weeks | New server in 60 seconds |
| Manual OS patching, hardware failures | AWS manages underlying infrastructure |
| Unused capacity is wasted spend | Pay only for what you use |
| Disaster recovery requires duplicate hardware | Multi-AZ replication built in |
| Global reach requires global offices | 30+ regions worldwide |

**Why AWS over Azure/GCP for TML?**
- ap-south-1 (Mumbai) region — low latency for Indian plant operations, data residency compliance
- Established enterprise agreements and support contracts
- ECR, EKS, Secrets Manager, IoT Core — the specific services TML uses are mature on AWS

**Managed services TML uses:**
- **ECR** — container image registry (replaces self-hosted Docker registry)
- **Secrets Manager** — encrypted secret storage (replaces secrets in YAML files)
- **SES** — email sending (replaces SMTP server management)
- **S3** — object storage (machine data files, build artefacts)
- **IoT Core** — MQTT broker for shop-floor machine telemetry
- **RDS** — managed PostgreSQL (replaces self-hosted Postgres)

---

## Core Concepts

### Regions and Availability Zones

```
AWS Global Infrastructure
├── Region: ap-south-1 (Mumbai)   ← TML primary
│   ├── AZ: ap-south-1a
│   ├── AZ: ap-south-1b
│   └── AZ: ap-south-1c
├── Region: us-east-1 (N. Virginia)
│   ├── AZ: us-east-1a
│   └── ...
```

A **region** is an independent geographic area. An **Availability Zone (AZ)** is an isolated data centre within a region. Deploying across multiple AZs means a power outage in one data centre doesn't take your service down.

### IAM: Identity and Access Management

```
IAM concepts:
├── User       — a person (avoid long-lived user credentials in apps)
├── Role       — assumed by services, EC2, Lambda, K8s pods (preferred for apps)
├── Policy     — JSON document: Allow/Deny specific Actions on specific Resources
└── Group      — collection of users sharing a policy
```

Every AWS API call is an IAM action. Examples: `s3:PutObject`, `ses:SendEmail`, `secretsmanager:GetSecretValue`. Policies grant these actions on specific resources (ARNs).

### ARN Format

```
arn:aws:service:region:account-id:resource-type/resource-id

Examples:
  arn:aws:s3:::tml-machine-data                                    (S3 bucket, no region/account)
  arn:aws:secretsmanager:ap-south-1:123456789012:secret:db/prod-a  (Secrets Manager)
  arn:aws:iam::123456789012:role/ep-production-broadcast-role      (IAM role)
  arn:aws:ecr:ap-south-1:123456789012:repository/ep-sap-connector  (ECR repo)
```

### VPC: Virtual Private Cloud

```
VPC: 10.0.0.0/16
├── Public Subnet:  10.0.1.0/24  (has route to Internet Gateway)
│   └── ALB, NAT Gateway
├── Private Subnet: 10.0.2.0/24  (no direct internet route)
│   └── EC2 nodes (K8s workers), RDS, Kafka brokers
└── Route Table, NACLs, Security Groups
```

- **Security Group** — stateful firewall at the instance/ENI level. Rules: allow TCP 5432 from app SG.
- **NACL** — stateless firewall at the subnet level. Less commonly used than security groups.
- **NAT Gateway** — allows private subnet resources to initiate outbound internet connections (e.g., to pull Docker images) without being publicly accessible.

---

## Installation & Setup

```bash
# Install AWS CLI v2 on Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip
sudo ./aws/install
aws --version   # aws-cli/2.x.x

# Configure credentials (for local development)
aws configure
# AWS Access Key ID:     (from IAM console → Security Credentials)
# AWS Secret Access Key: (shown once at creation time)
# Default region name:   ap-south-1
# Default output format: json

# Or use a named profile for multiple accounts
aws configure --profile tml-dev

# Verify authentication
aws sts get-caller-identity
# {
#   "UserId": "AIDAIOSFODNN7EXAMPLE",
#   "Account": "123456789012",
#   "Arn": "arn:aws:iam::123456789012:user/john.doe"
# }
```

For GitHub Actions, use OIDC (no stored keys). See the TML Codebase section.

---

## Beginner

### S3: Object Storage

```bash
# Create a bucket (bucket names are globally unique)
aws s3 mb s3://tml-machine-data-dev --region ap-south-1

# Upload a file
aws s3 cp /tmp/machine-reading-001.csv s3://tml-machine-data-dev/raw/2024/01/

# List bucket contents
aws s3 ls s3://tml-machine-data-dev/raw/2024/01/

# Download a file
aws s3 cp s3://tml-machine-data-dev/raw/2024/01/machine-reading-001.csv /tmp/

# Generate a presigned URL (time-limited public access)
aws s3 presign s3://tml-machine-data-dev/raw/2024/01/machine-reading-001.csv \
  --expires-in 3600
```

### SES: Simple Email Service

```bash
# Verify an email address (for sandbox mode)
aws ses verify-email-identity \
  --email-address noreply@tml.com \
  --region ap-south-1

# Send a test email
aws ses send-email \
  --from noreply@tml.com \
  --destination '{"ToAddresses":["john.doe@tml.com"]}' \
  --message '{"Subject":{"Data":"Test"},"Body":{"Text":{"Data":"Hello from SES"}}}' \
  --region ap-south-1
```

### ECR: Container Registry

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-south-1.amazonaws.com

# Create a repository
aws ecr create-repository \
  --repository-name ep-production-broadcast \
  --region ap-south-1

# Tag and push an image
docker tag ep-production-broadcast:latest \
  123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast:abc1234

docker push 123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast:abc1234
```

### IAM Role and Policy

```bash
# Create a role that EC2 (or K8s) can assume
aws iam create-role \
  --role-name ep-production-broadcast-role \
  --assume-role-policy-document file://trust-policy.json

# trust-policy.json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ec2.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}

# Attach an inline policy
aws iam put-role-policy \
  --role-name ep-production-broadcast-role \
  --policy-name ses-send \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }]
  }'
```

---

## Intermediate

### Secrets Manager: Store and Retrieve Secrets

```bash
# Create a secret
aws secretsmanager create-secret \
  --name /ipms4/prod/db-password \
  --secret-string '{"username":"appuser","password":"verysecret123"}' \
  --region ap-south-1

# Retrieve a secret
aws secretsmanager get-secret-value \
  --secret-id /ipms4/prod/db-password \
  --region ap-south-1
```

```java
// Java SDK — retrieve secret at application startup
@Bean
public DataSource dataSource() {
    SecretsManagerClient client = SecretsManagerClient.builder()
            .region(Region.AP_SOUTH_1)
            .build();

    GetSecretValueResponse response = client.getSecretValue(
            GetSecretValueRequest.builder()
                    .secretId("/ipms4/prod/db-password")
                    .build());

    Map<String, String> secret = objectMapper.readValue(
            response.secretString(), new TypeReference<>() {});

    return DataSourceBuilder.create()
            .url("jdbc:postgresql://rds-host:5432/ipms4")
            .username(secret.get("username"))
            .password(secret.get("password"))
            .build();
}
```

### RDS PostgreSQL

```bash
# Create a managed PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier ipms4-prod-postgres \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username appuser \
  --master-user-password "$(aws secretsmanager get-secret-value ...)" \
  --allocated-storage 100 \
  --storage-type gp3 \
  --multi-az \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name ipms4-db-subnet-group \
  --region ap-south-1
```

Connection string format:
```
jdbc:postgresql://ipms4-prod-postgres.xxxx.ap-south-1.rds.amazonaws.com:5432/ipms4
```

### IRSA: IAM Roles for Service Accounts

IRSA gives a specific Kubernetes pod its own AWS IAM role — without putting credentials on the node or in environment variables.

```bash
# Step 1: Create OIDC provider for the K8s cluster (one-time)
eksctl utils associate-iam-oidc-provider --cluster ipms4 --approve

# Step 2: Create IAM role with trust policy referencing K8s service account
aws iam create-role \
  --role-name ipms4-ep-production-broadcast \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/oidc.eks.ap-south-1.amazonaws.com/id/XXXX"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.ap-south-1.amazonaws.com/id/XXXX:sub":
            "system:serviceaccount:ipms4-prod:ep-production-broadcast"
        }
      }
    }]
  }'

# Step 3: Annotate the K8s ServiceAccount
kubectl annotate serviceaccount ep-production-broadcast \
  -n ipms4-prod \
  eks.amazonaws.com/role-arn=arn:aws:iam::123456789012:role/ipms4-ep-production-broadcast
```

### ALB: Application Load Balancer

```bash
# Create target group
aws elbv2 create-target-group \
  --name ep-production-broadcast-tg \
  --protocol HTTP \
  --port 8080 \
  --target-type ip \
  --vpc-id vpc-xxxxxxxx \
  --health-check-path /actuator/health \
  --health-check-interval-seconds 30

# Create HTTPS listener with certificate
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

---

## Advanced

### AWS IoT Core: MQTT for Shop-Floor Machines

```java
// AWS IoT Device SDK Java v2
// Maven: software.amazon.awssdk.iotdevicesdk:aws-iot-device-sdk-java
MqttClientConnection connection = AwsIotMqttConnectionBuilder
        .newMtlsBuilderFromPath("/etc/iot/cert.pem", "/etc/iot/private.key")
        .withCertificateAuthorityFromPath(null, "/etc/iot/AmazonRootCA1.pem")
        .withEndpoint("xxxx.iot.ap-south-1.amazonaws.com")
        .withClientId("machine-001")
        .withCleanSession(false)
        .build();

connection.connect().get();

// Subscribe to machine telemetry
connection.subscribe("machines/MACHINE-001/telemetry",
        QualityOfService.AT_LEAST_ONCE,
        (message) -> {
            String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
            telemetryProcessor.process(payload);
        }).get();

// Publish a status update
String statusJson = """{"machineId":"MACHINE-001","status":"RUNNING","timestamp":"%s"}"""
        .formatted(Instant.now());
connection.publish(new MqttMessage(
        "machines/MACHINE-001/status",
        statusJson.getBytes(),
        QualityOfService.AT_LEAST_ONCE,
        false)).get();
```

### AWS SDK Java: S3 and SES

```java
// S3 — upload file
S3Client s3 = S3Client.builder().region(Region.AP_SOUTH_1).build();

s3.putObject(
    PutObjectRequest.builder()
        .bucket("tml-machine-data")
        .key("raw/2024/01/reading-001.csv")
        .contentType("text/csv")
        .build(),
    RequestBody.fromFile(Path.of("/tmp/reading-001.csv")));

// S3 — generate presigned URL (15 minutes)
S3Presigner presigner = S3Presigner.builder().region(Region.AP_SOUTH_1).build();
PresignedGetObjectRequest presigned = presigner.presignGetObject(r -> r
    .signatureDuration(Duration.ofMinutes(15))
    .getObjectRequest(g -> g.bucket("tml-machine-data").key("raw/2024/01/reading-001.csv")));
String url = presigned.url().toString();

// SES — send HTML email
SesClient ses = SesClient.builder().region(Region.AP_SOUTH_1).build();
ses.sendEmail(SendEmailRequest.builder()
    .destination(Destination.builder().toAddresses("john.doe@tml.com").build())
    .message(Message.builder()
        .subject(Content.builder().data("Adherence Report - PLANT-01").build())
        .body(Body.builder()
            .html(Content.builder().data("<h1>Adherence: 94%</h1>").charset("UTF-8").build())
            .build())
        .build())
    .source("noreply@tml.com")
    .build());
```

### boto3 Python

```python
import boto3

# S3 upload
s3 = boto3.client('s3', region_name='ap-south-1')
s3.upload_file('/tmp/report.csv', 'tml-machine-data', 'reports/2024/01/report.csv')

# SES send email
ses = boto3.client('ses', region_name='ap-south-1')
ses.send_email(
    Source='noreply@tml.com',
    Destination={'ToAddresses': ['john.doe@tml.com']},
    Message={
        'Subject': {'Data': 'Adherence Report'},
        'Body': {'Html': {'Data': '<h1>Report</h1>'}}
    }
)

# CloudWatch custom metric
cloudwatch = boto3.client('cloudwatch', region_name='ap-south-1')
cloudwatch.put_metric_data(
    Namespace='TML/ProductionBroadcast',
    MetricData=[{
        'MetricName': 'WorkOrdersProcessed',
        'Value': 42,
        'Unit': 'Count',
        'Dimensions': [{'Name': 'Plant', 'Value': 'PLANT-01'}]
    }]
)
```

---

## Expert

### Cost Optimisation

**Compute:**
- T3 (burstable) for dev/staging, M5/M6i (general purpose) for production workloads
- Reserved Instances (1-year commit) for steady-state workloads: ~40% savings
- Savings Plans for flexible compute commitment: ~35% savings
- Spot Instances for batch jobs and non-critical workers

**Storage:**
- S3 Lifecycle policies: transition to S3-IA after 30 days, Glacier after 90 days
- RDS storage: GP3 is cheaper and faster than GP2 for most sizes
- Delete untagged ECR images older than 30 days via lifecycle policy

```json
// ECR lifecycle policy — delete untagged images after 14 days
{
  "rules": [{
    "rulePriority": 1,
    "description": "Remove untagged images",
    "selection": {
      "tagStatus": "untagged",
      "countType": "sinceImagePushed",
      "countUnit": "days",
      "countNumber": 14
    },
    "action": { "type": "expire" }
  }]
}
```

### VPC Flow Logs and Athena Analysis

```bash
# Enable VPC flow logs to S3
aws ec2 create-flow-logs \
  --resource-type VPC \
  --resource-ids vpc-xxxxxxxx \
  --traffic-type ALL \
  --log-destination-type s3 \
  --log-destination arn:aws:s3:::tml-flow-logs

# Query with Athena (after creating Glue table)
SELECT sourceaddress, destinationaddress, action, COUNT(*) as count
FROM vpc_flow_logs
WHERE action = 'REJECT'
  AND date_partition = '2024/01/15'
GROUP BY sourceaddress, destinationaddress, action
ORDER BY count DESC
LIMIT 20;
```

### AWS Well-Architected Framework

| Pillar | Key Practice |
|---|---|
| Operational Excellence | IaC (Terraform), automated deployments, runbooks |
| Security | Least-privilege IAM, IRSA, Secrets Manager, GuardDuty |
| Reliability | Multi-AZ RDS, ALB health checks, K8s liveness probes |
| Performance Efficiency | Right-sized instances, caching (ElastiCache), CloudFront |
| Cost Optimisation | Reserved Instances, S3 lifecycle, right-sizing |
| Sustainability | Graviton instances, efficient autoscaling |

---

## In the TML Codebase

### ECR Push from GitHub Actions with OIDC

No stored AWS credentials — GitHub Actions assumes an IAM role via OIDC:

```yaml
# .github/workflows/deploy.yml
jobs:
  build-and-push:
    permissions:
      id-token: write   # required for OIDC token request
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-ecr-push
          aws-region: ap-south-1

      - name: Login to ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push
        run: |
          IMAGE=${{ steps.ecr-login.outputs.registry }}/ep-production-broadcast:${{ github.sha }}
          docker build -t $IMAGE .
          docker push $IMAGE
```

The IAM role's trust policy allows `sts:AssumeRoleWithWebIdentity` from `token.actions.githubusercontent.com` for the specific repository.

### External Secrets Operator

Instead of putting secrets into K8s Secrets manually, the External Secrets Operator syncs from AWS Secrets Manager automatically:

```yaml
# ExternalSecret CRD — syncs every 1 hour
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
    name: ep-production-broadcast-secrets   # creates this K8s Secret
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: /ipms4/prod/ep-production-broadcast
        property: db_password
    - secretKey: KEYCLOAK_CLIENT_SECRET
      remoteRef:
        key: /ipms4/prod/ep-production-broadcast
        property: keycloak_client_secret
```

### SES for Adherence Reports

`ep-production-broadcast` sends daily adherence reports via SES from the `ap-south-1` region. The sender domain `tml.com` is verified (DNS TXT + DKIM records). SES is out of sandbox mode (production access approved). Templates are stored as SES email templates for consistent formatting.

### S3 Machine Data Bucket

`ep-machine-integration` writes raw sensor files to `tml-machine-data` S3 bucket. The bucket has:
- Server-side encryption (SSE-S3)
- Versioning enabled
- Lifecycle policy: transition to S3-IA after 30 days
- Access restricted to IRSA role for the `ep-machine-integration` service account

### IoT Device SDK MQTT

Shop-floor machines connect to AWS IoT Core using X.509 certificates (mTLS). The certificates are provisioned per machine and stored on the device's local filesystem. `ep-machine-integration` subscribes to MQTT topics and bridges messages into Kafka for downstream processing.

---

## Quick Reference

### Essential AWS CLI Commands

```bash
# Identity
aws sts get-caller-identity

# S3
aws s3 ls s3://bucket-name/prefix/
aws s3 cp local-file.txt s3://bucket/key
aws s3 presign s3://bucket/key --expires-in 3600

# Secrets Manager
aws secretsmanager get-secret-value --secret-id /path/to/secret
aws secretsmanager create-secret --name /path/to/secret --secret-string '{"key":"value"}'

# ECR
aws ecr get-login-password | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.REGION.amazonaws.com
aws ecr list-images --repository-name my-service

# IAM
aws iam get-role --role-name my-role
aws iam list-attached-role-policies --role-name my-role
```

### S3 Java SDK Pattern

```java
S3Client s3 = S3Client.builder().region(Region.AP_SOUTH_1).build();
// Upload: s3.putObject(PutObjectRequest, RequestBody)
// Download: s3.getObject(GetObjectRequest, Path)
// Presign: S3Presigner.presignGetObject(...)
```

### IAM Policy Skeleton

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::tml-machine-data/*"
    }
  ]
}
```
