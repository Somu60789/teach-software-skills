# Jenkins

## Prerequisites

- **Docker (doc 12):** Jenkins runs in Docker for local development. Production Jenkins runs Docker agents for builds. You must understand container concepts, volume mounts, and port mappings.
- **Groovy basics:** Jenkins pipelines are written in Groovy. You need to understand closures (`{ -> ... }`), maps (`[key: value]`), lists (`['a', 'b']`), string interpolation (`"${variable}"`), and method calls. Groovy is Java-compatible — if you know Java, you know 80% of Groovy.
- **Git fundamentals:** Jenkins clones repositories, checks out branches, and reads the `Jenkinsfile` from the root. Understand branches and the concept of SCM polling.

---

## What & Why

Jenkins is the most widely deployed open-source CI/CD server in the world. Despite newer alternatives, it remains dominant in enterprises for several reasons:

1. **Flexibility:** Jenkins can do anything a server with Java and shell access can do. It is not opinionated about your tech stack, deployment target, or workflow.
2. **Shared library pattern:** DRY pipelines across hundreds of services. A single Groovy library centralises build logic. Updating the library updates all pipelines simultaneously.
3. **Job DSL for dynamic generation:** Instead of manually creating 50 pipeline jobs through a UI, a "seed job" reads a YAML config file and generates all jobs programmatically. Adding a new service is a one-line YAML change.
4. **Plugin ecosystem:** 1800+ plugins for every tool imaginable — Kubernetes agents, Slack notifications, SonarQube, Artifactory, AWS, everything.

**The tradeoff:** Jenkins requires a server to maintain. OS patches, Java upgrades, plugin compatibility hell — the operational burden is real. TML runs Jenkins for legacy products (MES4, MES4-EV) where the migration cost outweighs the operational cost. IPMS4 has migrated to GitHub Actions and ArgoCD.

**When you will encounter Jenkins at TML:** Any MES4 or MES4-EV pipeline. The `ep-pipelines` shared library. The Job DSL seed job pattern. Ansible deploy triggers from build pipelines.

---

## Core Concepts

| Concept | Description |
|---|---|
| **Pipeline** | A series of automated steps to build, test, and deploy code. Defined in a `Jenkinsfile`. |
| **Declarative Pipeline** | A structured, opinionated syntax with `pipeline { }` block. Recommended for most use cases. |
| **Scripted Pipeline** | Free-form Groovy inside `node { }`. More flexible, less readable. Legacy code uses this heavily. |
| **Stage** | A visual grouping of steps that appears as a column in Blue Ocean. Groups related work (`Build`, `Test`, `Deploy`). |
| **Step** | A single command within a stage: `sh "mvn test"`, `echo "done"`, `checkout scm`. |
| **Agent** | Where the pipeline runs. `agent any` uses any available executor. `agent { docker { image 'maven:3.9' } }` runs in a Docker container. |
| **Jenkinsfile** | A text file checked into the root of the repository containing the pipeline definition. |
| **Shared Library** | A Git repository of reusable Groovy code (steps, utility classes) loaded at the top of a Jenkinsfile with `@Library`. |
| **Credentials Binding** | A plugin that injects secrets from Jenkins Credentials Store into the pipeline as environment variables. Never hardcode credentials. |
| **Blue Ocean** | A modern Jenkins UI plugin that renders pipeline stages visually with per-stage log viewing. |

---

## Installation & Setup

### Run Jenkins Locally with Docker

```bash
docker run -d \
  -p 8080:8080 \
  -p 50000:50000 \
  --name jenkins \
  -v jenkins_home:/var/jenkins_home \
  jenkins/jenkins:lts

# Get the initial admin password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open `http://localhost:8080`, paste the initial password, and choose "Install suggested plugins." This installs Git, Gradle, Maven, Pipeline, and several others.

### Install Additional Required Plugins

Go to **Manage Jenkins → Plugins → Available plugins** and install:
- **Blue Ocean** — modern pipeline visualisation UI
- **Job DSL** — generate pipeline jobs from Groovy DSL code
- **Docker Pipeline** — `agent { docker { ... } }` support
- **Credentials Binding** — `withCredentials([...]) { }` syntax
- **Kubernetes** — dynamic Kubernetes pod agents

### Create Your First Pipeline Job

1. **New Item → Pipeline** → name it `my-app-build`
2. Under **Pipeline**, select **Pipeline script from SCM**
3. **SCM**: Git, enter your repository URL
4. **Branch**: `*/main`
5. **Script Path**: `Jenkinsfile`
6. Save. Click **Build Now**.

Jenkins clones the repository, reads the `Jenkinsfile`, and executes it. The Blue Ocean view shows each stage as a visual card.

### Add Credentials

**Manage Jenkins → Credentials → System → Global credentials → Add Credentials:**
- For AWS: Kind = "Secret text", ID = `AWS_ACCOUNT_ID`, Secret = `123456789012`
- For Docker registry: Kind = "Username with password", ID = `docker-registry-creds`
- For Slack: Kind = "Secret text", ID = `SLACK_TOKEN`

---

## Beginner

### Declarative Jenkinsfile Structure

```groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = "123456789012.dkr.ecr.ap-south-1.amazonaws.com"
        IMAGE_NAME      = "ep-mes4-service"
        AWS_REGION      = "ap-south-1"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo "Building commit: ${env.GIT_COMMIT}"
                echo "Branch: ${env.GIT_BRANCH}"
            }
        }

        stage('Build') {
            steps {
                sh 'mvn --no-transfer-progress clean package -DskipTests'
            }
        }

        stage('Test') {
            steps {
                sh 'mvn --no-transfer-progress test'
            }
            post {
                always {
                    junit 'target/surefire-reports/*.xml'
                }
            }
        }

        stage('Docker Build') {
            steps {
                sh """
                    docker build \\
                        -t ${DOCKER_REGISTRY}/${IMAGE_NAME}:${env.GIT_COMMIT} \\
                        -t ${DOCKER_REGISTRY}/${IMAGE_NAME}:latest \\
                        .
                """
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded: ${currentBuild.fullDisplayName}"
        }
        failure {
            echo "Pipeline failed: ${currentBuild.fullDisplayName}"
            // Notification step goes here
        }
        always {
            cleanWs()   // clean workspace after every run
        }
    }
}
```

`env.GIT_COMMIT` and `env.GIT_BRANCH` are injected automatically when using `checkout scm`. The `post` block runs after all stages, regardless of success or failure.

### Credentials Binding

Never put passwords, tokens, or keys in the `Jenkinsfile`. Use the Credentials Binding plugin.

```groovy
stage('Push to ECR') {
    steps {
        withCredentials([
            string(credentialsId: 'AWS_ACCOUNT_ID', variable: 'ACCOUNT_ID'),
            usernamePassword(
                credentialsId: 'docker-registry-creds',
                usernameVariable: 'DOCKER_USER',
                passwordVariable: 'DOCKER_PASS'
            )
        ]) {
            sh """
                echo "$DOCKER_PASS" | docker login \\
                    --username "$DOCKER_USER" \\
                    --password-stdin \\
                    ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
                docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}:${env.GIT_COMMIT}
            """
        }
    }
}
```

Inside the `withCredentials` block, `ACCOUNT_ID`, `DOCKER_USER`, and `DOCKER_PASS` are available as environment variables. Jenkins automatically masks these values in all log output — they appear as `****`.

### Environment Block and Built-in Variables

```groovy
pipeline {
    environment {
        // Static values
        SERVICE_NAME = "ep-mes4-api"
        // Dynamic values using Groovy expressions
        BUILD_TAG    = "${env.GIT_COMMIT?.take(8)}"
        IMAGE_TAG    = "${SERVICE_NAME}:${env.BUILD_NUMBER}-${BUILD_TAG}"
    }
    // ...
}
```

Useful built-in variables: `env.BUILD_NUMBER`, `env.BUILD_URL`, `env.JOB_NAME`, `env.WORKSPACE`, `env.GIT_COMMIT`, `env.GIT_BRANCH`, `env.BRANCH_NAME`.

---

## Intermediate

### Shared Library Pattern

The shared library pattern eliminates copy-paste pipeline code across 50+ services. Every service's `Jenkinsfile` calls a library step; the logic lives in one place.

**Library repository structure:**
```
ep-pipelines/
├── vars/
│   ├── buildAndPush.groovy      # global step: buildAndPush(...)
│   ├── deployWithAnsible.groovy # global step: deployWithAnsible(...)
│   └── notifySlack.groovy       # global step: notifySlack(...)
├── src/
│   └── com/
│       └── tml/
│           ├── Utils.groovy     # utility class: new com.tml.Utils(this)
│           └── DockerHelper.groovy
└── resources/
    └── templates/
        └── ansible-inventory.j2
```

**Register the library in Jenkins:** Manage Jenkins → Configure System → Global Pipeline Libraries:
- Name: `ep-pipeline`
- Default version: `main`
- Retrieval method: Modern SCM → Git → URL of `ep-pipelines` repository

**`vars/buildAndPush.groovy`:**

```groovy
// vars/buildAndPush.groovy
// Called as: buildAndPush(imageName: 'my-service', registry: '123.ecr.amazonaws.com')
def call(Map config = [:]) {
    def imageName = config.imageName ?: error("imageName is required")
    def registry  = config.registry  ?: error("registry is required")
    def tag       = config.tag       ?: env.GIT_COMMIT

    sh "docker build -t ${registry}/${imageName}:${tag} ."
    sh "docker push ${registry}/${imageName}:${tag}"

    return "${registry}/${imageName}:${tag}"
}
```

**`src/com/tml/Utils.groovy`:**

```groovy
// src/com/tml/Utils.groovy
package com.tml

class Utils implements Serializable {
    def steps

    Utils(steps) {
        this.steps = steps
    }

    String shortCommit() {
        return steps.env.GIT_COMMIT?.take(8) ?: 'unknown'
    }

    boolean isMainBranch() {
        return steps.env.BRANCH_NAME == 'master' || steps.env.BRANCH_NAME == 'main'
    }
}
```

**Service `Jenkinsfile` using the library:**

```groovy
@Library('ep-pipeline') _

pipeline {
    agent any

    stages {
        stage('Build & Push') {
            steps {
                script {
                    def utils = new com.tml.Utils(this)
                    def imageTag = buildAndPush(
                        imageName: 'ep-mes4-api',
                        registry:  '123456789012.dkr.ecr.ap-south-1.amazonaws.com',
                        tag:       utils.shortCommit()
                    )
                    env.DEPLOYED_IMAGE = imageTag
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'master'
            }
            steps {
                deployWithAnsible(
                    env: 'prod',
                    image: env.DEPLOYED_IMAGE
                )
            }
        }
    }

    post {
        always {
            notifySlack(
                channel: '#builds-mes4',
                status:  currentBuild.currentResult
            )
        }
    }
}
```

### Parallel Stages

Run lint and test simultaneously to cut total pipeline time.

```groovy
stage('Validate') {
    parallel {
        stage('Unit Tests') {
            steps {
                sh 'mvn --no-transfer-progress test'
            }
            post {
                always {
                    junit 'target/surefire-reports/*.xml'
                }
            }
        }
        stage('Code Lint') {
            steps {
                sh 'mvn --no-transfer-progress checkstyle:check'
            }
        }
        stage('Dependency Scan') {
            steps {
                sh 'mvn --no-transfer-progress dependency-check:check'
            }
        }
    }
}
```

Each branch of `parallel {}` runs on a separate executor concurrently. If any branch fails, the entire parallel stage fails, but the others are allowed to complete unless you add `failFast: true`.

### Stash and Unstash

Stash saves files from one stage and unstash retrieves them in a later stage running on a potentially different agent.

```groovy
stage('Build') {
    steps {
        sh 'mvn --no-transfer-progress clean package -DskipTests'
        stash name: 'jar-files', includes: 'target/*.jar'
    }
}

stage('Deploy') {
    agent { label 'deploy-agent' }   // different agent
    steps {
        unstash 'jar-files'
        sh 'ls target/'
        sh './deploy.sh target/app.jar'
    }
}
```

Stash stores files in Jenkins master storage, not the workspace. Keep stash sizes small (< 100 MB) — large stashes slow down Jenkins master. For large artifacts, upload to S3 and download from there.

---

## Advanced

### Job DSL Seed Job

Instead of manually creating 50+ pipeline jobs through the Jenkins UI, a **seed job** reads a YAML config file and generates all pipeline jobs programmatically. Adding a new service means adding one entry to the YAML.

**Service registry config** (`services.yaml`):
```yaml
services:
  - name: ep-mes4-api
    repo: git@github.com:tata-motors/ep-mes4-api.git
    branch: master
    deploy_env: prod

  - name: ep-mes4-ev-service
    repo: git@github.com:tata-motors/ep-mes4-ev-service.git
    branch: master
    deploy_env: prod

  - name: ep-mes4-reporting
    repo: git@github.com:tata-motors/ep-mes4-reporting.git
    branch: development
    deploy_env: dev
```

**Seed job Groovy DSL** (`seedJob.groovy`):

```groovy
// Read and parse YAML config
def servicesYaml = readFileFromWorkspace('services.yaml')
def config = new org.yaml.snakeyaml.Yaml().load(servicesYaml)

config.services.each { svc ->
    pipelineJob("${svc.name}-build") {
        description("Auto-generated build pipeline for ${svc.name}")

        triggers {
            scm('H/5 * * * *')    // poll SCM every 5 minutes
        }

        definition {
            cpsScm {
                scm {
                    git {
                        remote {
                            url(svc.repo)
                            credentials('github-ssh-key')
                        }
                        branches(svc.branch)
                    }
                }
                scriptPath('Jenkinsfile')
            }
        }
    }
}
```

Run the seed job whenever `services.yaml` changes to refresh all generated jobs. Jenkins Job DSL idempotently creates or updates jobs — running it twice is safe.

### Kubernetes Dynamic Agents

Instead of maintaining a pool of static agent VMs, use Kubernetes to spin up pod-based agents on demand and destroy them when the build completes.

```groovy
pipeline {
    agent {
        kubernetes {
            yaml '''
                apiVersion: v1
                kind: Pod
                spec:
                  containers:
                  - name: maven
                    image: maven:3.9-eclipse-temurin-21
                    command: [sleep]
                    args: [infinity]
                    resources:
                      requests:
                        cpu: "1"
                        memory: "2Gi"
                  - name: docker
                    image: docker:24-dind
                    securityContext:
                      privileged: true
                    volumeMounts:
                    - name: docker-storage
                      mountPath: /var/lib/docker
                  volumes:
                  - name: docker-storage
                    emptyDir: {}
            '''
            defaultContainer 'maven'
        }
    }

    stages {
        stage('Build') {
            steps {
                sh 'mvn --no-transfer-progress clean package'
            }
        }

        stage('Docker Build') {
            steps {
                container('docker') {
                    sh 'docker build -t myapp:latest .'
                }
            }
        }
    }
}
```

The pod has two containers: `maven` for the build and `docker` (Docker-in-Docker) for image operations. `defaultContainer 'maven'` means `sh` steps run in the Maven container unless you specify `container('docker') { }`.

### Pipeline as Code with Dynamic Stage Generation

Read config at pipeline runtime to dynamically generate stages:

```groovy
pipeline {
    agent any

    stages {
        stage('Load Config') {
            steps {
                script {
                    def yaml = readYaml file: 'deploy-config.yaml'
                    env.ENVIRONMENTS = yaml.environments.join(',')
                    // Store as JSON for later use
                    env.ENV_CONFIG = groovy.json.JsonOutput.toJson(yaml.environments)
                }
            }
        }

        stage('Deploy') {
            steps {
                script {
                    def envs = readJSON text: env.ENV_CONFIG
                    def deployStages = [:]

                    envs.each { environment ->
                        def envName = environment  // capture for closure
                        deployStages["Deploy to ${envName}"] = {
                            sh "ansible-playbook -i inventory/${envName} deploy.yml"
                        }
                    }

                    parallel deployStages
                }
            }
        }
    }
}
```

---

## Expert

### JenkinsPipelineUnit: Unit Testing Shared Library Code

Shared library Groovy code is business logic. Test it like any other code.

```groovy
// test/groovy/BuildAndPushSpec.groovy
import com.lesfurets.jenkins.unit.BasePipelineTest
import org.junit.Before
import org.junit.Test

class BuildAndPushSpec extends BasePipelineTest {

    @Before
    void setUp() {
        super.setUp()
        // Register mock steps that shared library code calls
        helper.registerAllowedMethod('sh', [String.class], { String cmd ->
            println "MOCK sh: ${cmd}"
        })
    }

    @Test
    void 'buildAndPush should call docker build and push'() {
        def script = loadScript('vars/buildAndPush.groovy')

        script.call(
            imageName: 'test-service',
            registry:  '123.ecr.amazonaws.com',
            tag:       'abc123'
        )

        assertJobStatusSuccess()
    }
}
```

Run with `./gradlew test` where the `build.gradle` includes `testImplementation 'com.lesfurets:jenkins-pipeline-unit:1.21'`. This catches Groovy syntax errors and logic bugs before they break production pipelines.

### Groovy Sandbox and @NonCPS

Jenkins runs Groovy in a restricted sandbox to prevent malicious scripts from accessing the Jenkins JVM. Many standard Java/Groovy operations are blocked by default.

```groovy
// This will fail in sandbox: GString.tokenize() not in whitelist
def parts = "a:b:c".tokenize(':')

// Fix 1: Request the method in the Groovy script approval UI
// Fix 2: Use @NonCPS annotation for non-serializable operations
@NonCPS
def parseConfig(String configText) {
    // @NonCPS methods run outside CPS transformation
    // They cannot call pipeline steps (sh, echo, etc.)
    // but can use any Java/Groovy standard library
    return configText.split('\n').findAll { it.contains('=') }.collectEntries {
        def (k, v) = it.split('=')
        [(k.trim()): v.trim()]
    }
}
```

`@NonCPS` bypasses the Groovy CPS (continuation-passing style) transformation used for pipeline resumability. `@NonCPS` methods are not resumable — if Jenkins restarts mid-execution of a `@NonCPS` method, the entire pipeline restarts from the last `@NonCPS`-safe checkpoint. Use it only for pure data-transformation logic.

### Pipeline Replay

When a pipeline fails and you want to test a fix without committing, use **Pipeline Replay**:

1. Open the failed build in Jenkins
2. Click **Replay** in the left sidebar
3. Jenkins shows the Jenkinsfile from that build in an editable text box
4. Modify the Groovy code directly and click **Run**

The modified Jenkinsfile is not saved to Git — it runs ephemerally. When you find the fix, commit it to the repository. This is the fastest debugging cycle for Jenkinsfile issues.

### Migrating from Jenkins to GitHub Actions: Concept Mapping

| Jenkins | GitHub Actions |
|---|---|
| `Jenkinsfile` | `.github/workflows/*.yml` |
| `pipeline { }` | `jobs:` |
| `stage('Name') { }` | Separate jobs with `needs:`, or steps within a job |
| `steps { sh '...' }` | `- run: ...` |
| `agent { docker { image '...' } }` | `container:` on a job |
| `withCredentials([string(...)])` | `env:` + `${{ secrets.NAME }}` |
| `stash` / `unstash` | `actions/upload-artifact` / `actions/download-artifact` |
| Shared library (`@Library`) | Reusable workflow (`workflow_call`) or composite action |
| Job DSL | GitHub's repository dispatch + dynamic matrix |
| Blue Ocean | GitHub Actions UI (native, no plugin needed) |
| `parallel { stage... }` | Multiple jobs with same `needs:` (truly parallel) |

---

## In the TML Codebase

**`ep-pipelines` shared library:** The central repository for all reusable pipeline logic. The `vars/` directory contains global step scripts (`buildAndPush.groovy`, `deployWithAnsible.groovy`, `notifySlack.groovy`). The `src/com/tml/` directory contains utility classes used internally by those steps. The `resources/` directory contains Jinja2 and Ansible template files loaded with `libraryResource()`.

**Job DSL seed pattern:** A single seed job in Jenkins reads a YAML file listing all services. Running the seed job generates or updates all ~50+ pipeline jobs. Engineers add new services by adding a YAML entry and re-running the seed — no Jenkins UI configuration required.

**Ansible deploy trigger:** After building and pushing to ECR, Jenkins pipelines call:
```groovy
sh """
    ansible-playbook \\
        -i inventory/${params.ENVIRONMENT} \\
        deploy.yml \\
        --vault-password-file vault_pass \\
        -e "image_tag=${env.GIT_COMMIT}"
"""
```

The Vault password is retrieved from Jenkins Credentials Store using `withCredentials`.

**Slack notifications:** All pipelines call `notifySlack()` in the `post { always { } }` block. The notification includes the job name, build number, result (SUCCESS/FAILURE), commit SHA, and a direct link to the build in Blue Ocean.

**MES4/MES4-EV still on Jenkins:** These products have long-running Jenkins pipelines with Kubernetes dynamic agents, the `ep-pipelines` shared library, and Ansible deploys. IPMS4 has been fully migrated to GitHub Actions + ArgoCD. New services should be built on GitHub Actions.

---

## Quick Reference

### Declarative Jenkinsfile Skeleton

```groovy
@Library('ep-pipeline') _

pipeline {
    agent any

    environment {
        IMAGE_NAME = "my-service"
        REGISTRY   = "123.dkr.ecr.ap-south-1.amazonaws.com"
    }

    stages {
        stage('Build')  { steps { sh 'mvn clean package -DskipTests' } }
        stage('Test')   { steps { sh 'mvn test' } }
        stage('Push')   { steps { buildAndPush(imageName: IMAGE_NAME, registry: REGISTRY) } }
        stage('Deploy') { when { branch 'master' }
                          steps { deployWithAnsible(env: 'prod') } }
    }

    post {
        always   { cleanWs() }
        success  { echo "SUCCESS" }
        failure  { notifySlack(channel: '#builds', status: 'FAILURE') }
    }
}
```

### Shared Library Step Template

```groovy
// vars/myStep.groovy
def call(Map config = [:]) {
    def required = config.myParam ?: error("myParam is required")
    // ... logic using `sh`, `echo`, `env`, `currentBuild`
}
```

### Credentials Binding Reference

```groovy
withCredentials([
    string(credentialsId: 'MY_TOKEN', variable: 'TOKEN'),
    usernamePassword(credentialsId: 'MY_CREDS', usernameVariable: 'USER', passwordVariable: 'PASS'),
    sshUserPrivateKey(credentialsId: 'MY_SSH_KEY', keyFileVariable: 'KEY_FILE'),
    file(credentialsId: 'MY_FILE_CRED', variable: 'CONFIG_FILE')
]) {
    sh 'echo $TOKEN'
}
```

### Useful Job DSL API Reference

```groovy
pipelineJob('job-name') {
    description('Description')
    parameters { stringParam('ENV', 'dev', 'Deployment environment') }
    triggers { scm('H/5 * * * *') }
    definition {
        cpsScm {
            scm {
                git {
                    remote { url('https://github.com/org/repo.git') ; credentials('github-creds') }
                    branches('*/main')
                }
            }
            scriptPath('Jenkinsfile')
        }
    }
}
```
