# GitHub Actions

## Prerequisites

- **Docker (doc 12):** You must understand how to build and tag Docker images, push to a registry, and the concept of layers and build context. GitHub Actions will build and push your Docker images.
- **Git fundamentals:** You must be comfortable with `git commit`, `git push`, branching strategies, and opening Pull Requests on GitHub. Actions are triggered by Git events — if you don't understand the event model, the triggers will be confusing.
- **YAML syntax:** Workflows are pure YAML. Indentation errors are silent killers. Know the difference between a mapping, a sequence, and a scalar.
- **Basic shell scripting:** Every `run:` step is a bash script. Know how to set variables, chain commands with `&&`, and check exit codes.

---

## What & Why

GitHub Actions is GitHub's built-in CI/CD platform. A **workflow** is a YAML file checked into your repository under `.github/workflows/`. When a Git event occurs (push, PR opened, scheduled cron, manual trigger), GitHub spins up a fresh virtual machine, clones your repository, and executes your workflow.

**Why it matters over legacy CI servers:**

1. **No server to maintain.** Jenkins requires a server, plugins, OS patches, Java upgrades. GitHub Actions runs on GitHub-managed infrastructure. You pay per minute; you don't manage machines.
2. **Code-first.** The workflow lives in the same repository as the code. Reviewing a PR shows you exactly what CI will do. There is no separate Jenkins server config to check.
3. **OIDC for cloud authentication.** Traditional CI stores `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as long-lived secrets. If those leak, an attacker has persistent access. OIDC issues a short-lived token per workflow run — no stored credentials, no blast radius.
4. **Marketplace.** Thousands of community and vendor-published actions (`uses: actions/checkout@v4`, `uses: aws-actions/configure-aws-credentials@v4`) let you compose pipelines from tested building blocks rather than writing shell scripts for everything.

**TML uses GitHub Actions for:** IPMS4 microservice CI (build → test → Docker push → ArgoCD update), Terraform plan/apply automation, and reusable cross-team workflows via the `ep-github-workflows` repository.

---

## Core Concepts

| Concept | Description |
|---|---|
| **Workflow** | A YAML file at `.github/workflows/*.yml`. Defines when to run and what to do. |
| **Trigger (`on:`)** | The Git event that starts the workflow: `push`, `pull_request`, `workflow_dispatch`, `schedule`, `workflow_call`. |
| **Job** | A group of steps that run on the same runner. Jobs run in parallel by default unless you declare `needs:`. |
| **Step** | A single unit inside a job: either `run:` (shell command) or `uses:` (an action). |
| **Action** | A reusable unit of work published to the GitHub Marketplace or a local path. Referenced with `uses:`. |
| **Runner** | The VM that executes a job. `ubuntu-latest` is the most common. Can also be `windows-latest`, `macos-latest`, or a self-hosted runner. |
| **Secrets** | Encrypted values stored in GitHub Settings. Referenced as `${{ secrets.MY_SECRET }}`. Never printed in logs. |
| **Context** | Read-only objects available at runtime: `github` (repo, sha, ref, actor), `env`, `job`, `steps`, `runner`. |
| **Expression** | `${{ }}` syntax for interpolating contexts, calling functions (`hashFiles()`, `contains()`), and evaluating conditions. |
| **Output** | A value a step emits with `echo "name=value" >> $GITHUB_OUTPUT`. Subsequent steps read it as `${{ steps.step-id.outputs.name }}`. |

---

## Installation & Setup

GitHub Actions requires no installation — it is built into every GitHub repository. You only need to create the workflow file.

**Create your first workflow:**

```bash
mkdir -p .github/workflows
touch .github/workflows/build.yml
git add .github/workflows/build.yml
git commit -m "ci: add initial build workflow"
git push origin main
```

Open your repository on GitHub, click the **Actions** tab, and you will see the workflow run appear within seconds of the push.

**Local testing with `act`:**

Running a full push to test a one-line change is slow. `act` executes workflows locally using Docker containers that simulate the GitHub runner environment.

```bash
# Install on macOS/Linux
brew install act
# Or via curl
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run the default push event locally
act push

# Run a specific job
act push -j build

# Pass secrets from a local .secrets file
act push --secret-file .secrets

# List all available events in the workflow
act --list
```

`act` uses a Docker image that mirrors `ubuntu-latest`. The first run downloads ~1 GB. After that, runs take seconds. Create a `.actrc` file to set default flags:

```
-P ubuntu-latest=catthehacker/ubuntu:act-latest
--secret-file .secrets
```

---

## Beginner

### Your First Workflow: Build on Push to Main

```yaml
# .github/workflows/build.yml
name: Build and Test

on:
  push:
    branches: [main, development]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Java 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      - name: Build with Maven
        run: mvn --no-transfer-progress clean package -DskipTests

      - name: Run tests
        run: mvn --no-transfer-progress test
```

The `on.push.branches` filter means this workflow only fires when pushing to `main` or `development` — not feature branches. Without this filter, every branch push triggers the workflow and wastes runner minutes.

### Environment Variables and GitHub Contexts

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      REGISTRY: 123456789.dkr.ecr.ap-south-1.amazonaws.com
      IMAGE_NAME: ep-production-broadcast

    steps:
      - uses: actions/checkout@v4

      - name: Print build metadata
        run: |
          echo "Repository:  ${{ github.repository }}"
          echo "Branch:      ${{ github.ref_name }}"
          echo "Commit SHA:  ${{ github.sha }}"
          echo "Short SHA:   ${GITHUB_SHA::8}"
          echo "Actor:       ${{ github.actor }}"
          echo "Event:       ${{ github.event_name }}"
          echo "Full image:  $REGISTRY/$IMAGE_NAME:${{ github.sha }}"
```

`github.sha` is the full 40-character commit hash. Using it as a Docker image tag gives you an immutable, auditable tag — you can always look up exactly which commit a running container came from.

### Caching Dependencies

Without caching, Maven downloads the internet on every run. `actions/cache` stores and restores the local Maven repository between runs.

```yaml
      - name: Cache Maven packages
        uses: actions/cache@v4
        with:
          path: ~/.m2/repository
          key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
          restore-keys: |
            ${{ runner.os }}-maven-

      - name: Build
        run: mvn --no-transfer-progress clean package
```

The cache `key` is a hash of all `pom.xml` files. If `pom.xml` changes, the hash changes, the cache misses, and a fresh download occurs. The `restore-keys` is a prefix fallback — if the exact key misses, use the most recent cache that starts with `ubuntu-latest-maven-`. This avoids a full cold download every time a dependency changes.

For Node.js projects:
```yaml
      - name: Cache node_modules
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-
```

### Upload and Download Artifacts

Artifacts pass files between jobs in the same workflow run, or archive them for later download from the GitHub UI.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: mvn --no-transfer-progress clean package
      - name: Upload JAR artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-jar
          path: target/*.jar
          retention-days: 7

  deploy:
    runs-on: ubuntu-latest
    needs: build                   # waits for build job to complete
    steps:
      - name: Download JAR artifact
        uses: actions/download-artifact@v4
        with:
          name: app-jar
          path: ./artifacts

      - run: ls -lh ./artifacts/
```

Artifacts are stored in GitHub's blob storage, not the runner filesystem. The `needs: build` dependency ensures `deploy` only starts after `build` succeeds.

---

## Intermediate

### OIDC AWS Authentication — No Stored Keys

OIDC (OpenID Connect) lets GitHub issue a short-lived JWT per workflow run. AWS IAM is configured to trust JWTs from GitHub's OIDC provider and exchange them for temporary AWS credentials. No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` ever touches GitHub Secrets.

```yaml
name: Build and Push to ECR

on:
  push:
    branches: [main]

permissions:
  id-token: write       # Required: allows GitHub to request an OIDC token
  contents: read

env:
  AWS_REGION: ap-south-1
  ECR_REPO: 123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-ecr-push
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push Docker image
        run: |
          docker build -t $ECR_REPO:${{ github.sha }} .
          docker push $ECR_REPO:${{ github.sha }}

      - name: Tag as latest for main branch
        if: github.ref == 'refs/heads/main'
        run: |
          docker tag $ECR_REPO:${{ github.sha }} $ECR_REPO:latest
          docker push $ECR_REPO:latest
```

The `permissions` block at the workflow level enables the `id-token: write` permission. Without it, GitHub will not generate the OIDC token and the AWS step will fail with a cryptic error.

### Repository Secrets vs Environment Secrets

```yaml
# Repository secrets: available to all workflows in the repo
# Set in: Settings → Secrets and variables → Actions → Repository secrets
env:
  SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}   # repo-level secret

# Environment secrets: only available when job targets that environment
# Set in: Settings → Environments → production → Environment secrets
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment: production          # targets the "production" environment
    steps:
      - name: Deploy
        run: ./deploy.sh
        env:
          PROD_DB_PASSWORD: ${{ secrets.PROD_DB_PASSWORD }}  # env-level secret
```

Environments also support **required reviewers** — a deployment to `production` can require manual approval from a team lead before the job runs. Configure this in Settings → Environments.

### Matrix Strategy: Test Across Multiple Versions

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        java-version: [17, 21]
        spring-profile: [default, h2]
      fail-fast: false               # don't cancel other matrix jobs if one fails

    steps:
      - uses: actions/checkout@v4

      - name: Set up Java ${{ matrix.java-version }}
        uses: actions/setup-java@v4
        with:
          java-version: ${{ matrix.java-version }}
          distribution: temurin

      - name: Run tests with profile ${{ matrix.spring-profile }}
        run: mvn test -Dspring.profiles.active=${{ matrix.spring-profile }}
```

This generates 4 parallel jobs: Java 17 + default, Java 17 + h2, Java 21 + default, Java 21 + h2. All run concurrently. `fail-fast: false` is important — without it, a single failure cancels all running matrix jobs and you lose partial results.

### Conditional Steps

```yaml
steps:
  - name: Run integration tests
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    run: mvn verify -P integration-tests

  - name: Notify on failure
    if: failure()                    # built-in status function
    run: |
      curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
        -H 'Content-type: application/json' \
        --data '{"text":"Build failed: ${{ github.repository }} @ ${{ github.sha }}"}'

  - name: Only on PRs
    if: github.event_name == 'pull_request'
    run: echo "This is a PR from ${{ github.head_ref }} into ${{ github.base_ref }}"
```

Status functions: `success()`, `failure()`, `cancelled()`, `always()`. Without an `if:`, steps only run when all previous steps succeeded — equivalent to wrapping in `if: success()`.

---

## Advanced

### Reusable Workflows (workflow_call)

A reusable workflow is a workflow file that exposes a `workflow_call` trigger. Other repositories (or other workflows in the same repository) call it like a function.

**Defining the reusable workflow** (in `ep-github-workflows` repository):

```yaml
# .github/workflows/docker-build-push.yml
name: Docker Build and Push (Reusable)

on:
  workflow_call:
    inputs:
      image-name:
        required: true
        type: string
      ecr-registry:
        required: true
        type: string
      aws-region:
        default: ap-south-1
        type: string
    secrets:
      AWS_ROLE_ARN:
        required: true
    outputs:
      image-tag:
        description: "The Docker image tag (commit SHA)"
        value: ${{ jobs.build.outputs.image-tag }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    outputs:
      image-tag: ${{ steps.set-tag.outputs.tag }}
    steps:
      - uses: actions/checkout@v4

      - name: Set image tag
        id: set-tag
        run: echo "tag=${{ github.sha }}" >> $GITHUB_OUTPUT

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ inputs.aws-region }}

      - uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push
        run: |
          IMAGE="${{ inputs.ecr-registry }}/${{ inputs.image-name }}:${{ github.sha }}"
          docker build -t "$IMAGE" .
          docker push "$IMAGE"
```

**Calling the reusable workflow** (in any service repository):

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, development]

jobs:
  build-and-push:
    uses: tata-motors/ep-github-workflows/.github/workflows/docker-build-push.yml@main
    with:
      image-name: ep-production-broadcast
      ecr-registry: 123456789012.dkr.ecr.ap-south-1.amazonaws.com
    secrets:
      AWS_ROLE_ARN: ${{ secrets.AWS_ROLE_ARN }}

  notify:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - run: echo "Pushed image tag: ${{ needs.build-and-push.outputs.image-tag }}"
```

The `uses:` path format is `{owner}/{repo}/.github/workflows/{file}@{ref}`. The `@main` ref pins to the `main` branch of the shared workflow repository.

### Composite Actions

A composite action bundles multiple steps into a single reusable action with its own `action.yml`. Unlike reusable workflows, composite actions run within the calling job — they can access the calling job's environment and filesystem.

```yaml
# .github/actions/maven-cache-build/action.yml
name: Maven Cache and Build
description: Cache Maven dependencies and build the project

inputs:
  java-version:
    description: Java version to use
    default: '21'
  maven-args:
    description: Additional Maven arguments
    default: ''

outputs:
  jar-path:
    description: Path to the built JAR
    value: ${{ steps.find-jar.outputs.path }}

runs:
  using: composite
  steps:
    - uses: actions/setup-java@v4
      with:
        java-version: ${{ inputs.java-version }}
        distribution: temurin

    - uses: actions/cache@v4
      with:
        path: ~/.m2/repository
        key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
        restore-keys: ${{ runner.os }}-maven-

    - name: Build
      shell: bash
      run: mvn --no-transfer-progress clean package ${{ inputs.maven-args }}

    - name: Find JAR
      id: find-jar
      shell: bash
      run: echo "path=$(ls target/*.jar | head -1)" >> $GITHUB_OUTPUT
```

Usage in a workflow:
```yaml
steps:
  - uses: actions/checkout@v4
  - uses: ./.github/actions/maven-cache-build
    with:
      java-version: '21'
      maven-args: '-DskipTests'
```

### Concurrency Groups: Cancel Stale Runs

When you push to a branch twice in quick succession, you want the first run to cancel so it doesn't waste runner minutes.

```yaml
name: CI

on:
  push:
    branches: [main, development, pre-prod]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

The `group` expression combines the workflow name and the Git ref (branch or PR number). If a new run starts for the same group while one is already running, the in-progress run is cancelled. On `main`, you may want `cancel-in-progress: false` so completed runs always post their status to branch protection checks.

### Branch Protection with Required Status Checks

In GitHub → Settings → Branches → Branch protection rules for `main`:
- Enable "Require status checks to pass before merging"
- Add the specific job names: `build`, `test`, `lint`
- Enable "Require branches to be up to date"

This ensures no PR can merge unless the workflow's named jobs pass. Status checks are matched by the exact job name, not the workflow name.

---

## Expert

### Self-Hosted Runners in Kubernetes with actions-runner-controller

GitHub-hosted runners are constrained: no persistent caching across runs, limited CPU, no access to private network resources. The `actions-runner-controller` (ARC) deploys ephemeral self-hosted runners as Kubernetes pods.

```yaml
# RunnerDeployment CRD — deploys runners that register to GitHub
apiVersion: actions.summerwind.dev/v1alpha1
kind: RunnerDeployment
metadata:
  name: ep-runners
  namespace: actions-runner-system
spec:
  replicas: 3
  template:
    spec:
      repository: tata-motors/ep-production-broadcast
      labels:
        - self-hosted
        - linux
        - x64
      resources:
        requests:
          cpu: "2"
          memory: "4Gi"
        limits:
          cpu: "4"
          memory: "8Gi"
      env:
        - name: DOCKER_HOST
          value: tcp://localhost:2375
```

Reference in your workflow:
```yaml
jobs:
  build:
    runs-on: [self-hosted, linux, x64]
```

For Kubernetes-native scaling use `HorizontalRunnerAutoscaler` to scale runner pods based on pending jobs. The ARC controller watches the GitHub API for queued jobs and provisions runners before they time out.

### OIDC Trust Policy in AWS IAM

The IAM role's trust policy controls which GitHub repositories and branches can assume the role. This is your security boundary.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:tata-motors/ep-production-broadcast:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

The `sub` claim format is `repo:{owner}/{repo}:ref:refs/heads/{branch}`. Using `StringLike` with a wildcard (`repo:tata-motors/*:*`) grants all repositories in the org access to the role — use `StringEquals` for production roles to prevent lateral movement if one repository is compromised.

### Workflow Debugging with tmate

When a workflow fails with a cryptic error, you can SSH into the runner mid-run using `tmate`:

```yaml
      - name: Setup tmate session (debug only)
        uses: mxschmitt/action-tmate@v3
        if: ${{ github.event_name == 'workflow_dispatch' && inputs.debug_enabled }}
        with:
          limit-access-to-actor: true   # only the workflow triggerer can SSH in
```

Add a boolean `workflow_dispatch` input named `debug_enabled`. When triggered manually with debug on, the workflow pauses and prints an SSH connection string. You get a live shell on the runner. Remove or disable this before merging — it adds a security-sensitive step.

### Cost Optimisation

| Strategy | Impact |
|---|---|
| Cache dependencies aggressively | Saves 2-5 min per run for Maven/npm projects |
| `fail-fast: false` on matrix selectively | Trade cost for better debugging visibility |
| Use `paths:` filter on push triggers | Skip builds when only docs/README change |
| Larger runners for CPU-heavy builds | 4-core runner finishes 2x faster, costs 2x — often net win |
| Cancel stale runs with `concurrency:` | Eliminates wasteful parallel builds on same branch |
| Move integration tests to nightly `schedule:` | Free up PR feedback loop, run expensive tests less often |

```yaml
# Only run CI when source code changes, not when docs change
on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'pom.xml'
      - '.github/workflows/**'
    paths-ignore:
      - 'docs/**'
      - '*.md'
```

---

## In the TML Codebase

**Branch triggers:** TML workflows trigger on `development`, `pre-prod`, and `master` (not `main`). The branch name maps to the deployment environment: `development` → dev cluster, `pre-prod` → staging, `master` → production.

**OIDC authentication:** All ECR push workflows use `aws-actions/configure-aws-credentials@v4` with `role-to-assume`. There is no `AWS_ACCESS_KEY_ID` in any repository's secrets for ECR operations. The IAM roles are provisioned by the `ep-infrastructure` Terraform project.

**Image tagging strategy:** Every Docker image is tagged with `${{ github.sha }}` (the full 40-char commit SHA). This tag is then used by `argocd-image-updater` to detect new images in ECR and update the Helm values in Git. The SHA-based tag is immutable and auditable.

**`ep-github-workflows` repository:** Shared reusable workflows live here. Each service's CI file calls them with `uses: tata-motors/ep-github-workflows/.github/workflows/...@main`. This means fixing a CI bug in one place fixes it for all services simultaneously.

**Terraform workflows:** The `ep-infrastructure` repository has two patterns:
- On PR: `terraform plan` runs and posts the plan as a PR comment
- On merge to `main`: `terraform apply` runs with OIDC credentials. Manual approval via GitHub environment protection gates the apply step.

**Self-hosted runners:** Configured via the `ep-infrastructure` Terraform using the `actions-runner-controller` Helm chart. Runner pods run in the `actions-runner-system` namespace. They have IAM roles attached at the pod level via IRSA (IAM Roles for Service Accounts) for accessing ECR and S3 during builds.

---

## Quick Reference

### Workflow YAML Skeleton

```yaml
name: Service Name CI

on:
  push:
    branches: [main, development]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4
      # ... steps here
```

### OIDC AWS Authentication Block

```yaml
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME
          aws-region: ap-south-1
      - uses: aws-actions/amazon-ecr-login@v2
```

### Docker ECR Build/Push Block

```yaml
      - name: Build and push image
        env:
          ECR_REPO: 123456789012.dkr.ecr.ap-south-1.amazonaws.com/my-service
        run: |
          docker build -t $ECR_REPO:${{ github.sha }} .
          docker push $ECR_REPO:${{ github.sha }}
```

### Useful Contexts Table

| Expression | Value |
|---|---|
| `${{ github.sha }}` | Full 40-char commit SHA |
| `${{ github.ref_name }}` | Branch or tag name (e.g., `main`) |
| `${{ github.ref }}` | Full ref (e.g., `refs/heads/main`) |
| `${{ github.repository }}` | `owner/repo` |
| `${{ github.actor }}` | Username who triggered the run |
| `${{ github.event_name }}` | `push`, `pull_request`, etc. |
| `${{ github.run_number }}` | Sequential run counter |
| `${{ runner.os }}` | `Linux`, `Windows`, `macOS` |
| `${{ steps.ID.outputs.KEY }}` | Output from step with given ID |
| `${{ secrets.NAME }}` | Encrypted secret value |
