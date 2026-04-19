# Docker

## Prerequisites

- Basic Linux command line: `ls`, `cd`, `cat`, `chmod`, redirecting output
- Understanding of what a process is (program running in memory)
- Helpful but not required: basic networking (ports, localhost)

---

## What & Why

Before Docker, deploying software meant: "install Java 17, install PostgreSQL 15, set these 12 environment variables, run this shell script." On a colleague's laptop with Java 11 and Postgres 14, it broke. On the staging server with a different Linux distro, it broke differently.

**Docker packages an application and all its dependencies into a single portable unit called a container.** The container runs identically on any machine that has Docker installed — developer laptop, CI pipeline, production server.

| Without Docker | With Docker |
|---|---|
| "Works on my machine" | Same image runs everywhere |
| Manual dependency installation | Dependencies declared in Dockerfile |
| Environment drift between dev/staging/prod | Identical image promoted across environments |
| Conflicting library versions between services | Each container has its own isolated filesystem |
| Complex onboarding ("install 7 tools") | `docker compose up` — done |

---

## Core Concepts

### Image vs Container

```
Dockerfile → docker build → Image (read-only template)
                                  │
                                  ▼
                           docker run → Container (running instance)
                                  │
                                  ├── Container 1 (running)
                                  ├── Container 2 (running)
                                  └── Container 3 (stopped)

Multiple containers can run from the same image simultaneously.
```

- **Image** — a read-only snapshot of a filesystem and metadata (environment variables, entrypoint command). Identified by `name:tag` (e.g., `nginx:1.25-alpine`).
- **Container** — a running (or stopped) instance of an image. Has its own writable layer on top of the image.
- **Layer** — images are built in layers. Each Dockerfile instruction (`RUN`, `COPY`, `ADD`) creates a new layer. Layers are cached and shared — if you change only your application code, Docker reuses the dependency layers.
- **Registry** — a server that stores and distributes images. Docker Hub is public; ECR is TML's private registry.
- **Tag** — a label on an image version. `latest` is just a convention; TML uses commit SHA tags (e.g., `abc1234`).

### Dockerfile Instructions

| Instruction | Purpose |
|---|---|
| `FROM` | Base image to build on top of |
| `WORKDIR` | Set the working directory inside the image |
| `COPY` | Copy files from host into image |
| `RUN` | Execute a command during build (installs dependencies) |
| `ENV` | Set environment variable baked into image |
| `EXPOSE` | Document which port the container listens on (informational) |
| `CMD` | Default command when container starts (can be overridden) |
| `ENTRYPOINT` | Fixed command; CMD appends arguments to it |
| `ARG` | Build-time variable (not available at runtime) |
| `USER` | Set the user the container runs as |
| `HEALTHCHECK` | Define how Docker checks if the container is healthy |

---

## Installation & Setup

```bash
# Install Docker Desktop (Linux / Mac / Windows)
# https://docs.docker.com/desktop/

# Verify installation
docker run hello-world

# Essential commands
docker ps                    # list running containers
docker ps -a                 # list all containers (including stopped)
docker images                # list local images
docker logs myapp            # tail container logs
docker logs -f myapp         # follow (stream) logs
docker exec -it myapp sh     # open shell inside running container
docker stop myapp            # gracefully stop container
docker rm myapp              # remove stopped container
docker rmi myapp:latest      # remove image

# System cleanup
docker system prune          # remove stopped containers, unused images
docker system prune -a       # also remove unused (not just dangling) images
```

---

## Beginner

### Simple Node.js Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests first (for layer caching)
COPY package*.json ./

# Install dependencies (cached unless package*.json changes)
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Document the port (does not actually publish it)
EXPOSE 3000

# Start the application
CMD ["node", "src/index.js"]
```

```bash
# Build the image
docker build -t myapp:latest .

# Run with port forwarding: host port 3000 → container port 3000
docker run -p 3000:3000 --name myapp myapp:latest

# Run in background (detached)
docker run -d -p 3000:3000 --name myapp myapp:latest

# Open an interactive shell inside the running container
docker exec -it myapp sh
```

### Environment Variables

```bash
# Pass environment variable at runtime
docker run -e DATABASE_URL=postgres://localhost/mydb myapp:latest

# Load from an env file
docker run --env-file .env.local myapp:latest

# .env.local
DATABASE_URL=postgres://localhost/mydb
LOG_LEVEL=debug
```

```dockerfile
# Bake default (non-secret) env var into the image
ENV LOG_LEVEL=info
ENV PORT=3000
```

---

## Intermediate

### Multi-Stage Build: Spring Boot Service

Using two stages reduces the final image size by 80%+ — the build toolchain (Gradle, JDK source files) is discarded.

```dockerfile
# Stage 1: Build
FROM gradle:7-jdk17 AS build
WORKDIR /app

# Copy Gradle wrapper and build files first (cache dependency downloads)
COPY gradle/ gradle/
COPY gradlew build.gradle settings.gradle ./

# Download dependencies (cached layer)
RUN ./gradlew dependencies --no-daemon

# Copy source and build
COPY src/ src/
RUN ./gradlew bootJar --no-daemon -x test

# Stage 2: Runtime
FROM amazoncorretto:17-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only the built JAR from stage 1
COPY --from=build /app/build/libs/*.jar app.jar

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -q --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
```

### .dockerignore

```
# .dockerignore — prevents these from being sent to Docker daemon (speeds up builds)
node_modules/
.git/
.env
.env.*
target/
build/
*.log
.DS_Store
README.md
```

### docker-compose.yml for Local Development

```yaml
# docker-compose-tools.yml
version: "3.8"

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ipms4_dev
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: devpassword
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U appuser -d ipms4_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      zookeeper:
        condition: service_started
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"

  keycloak:
    image: quay.io/keycloak/keycloak:26.0.0
    command: start-dev --import-realm
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    volumes:
      - ./keycloak/realm-export.json:/opt/keycloak/data/import/realm.json
    ports:
      - "8180:8080"
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health/ready || exit 1"]
      interval: 30s
      timeout: 10s
      start_period: 90s

volumes:
  postgres_data:
```

```bash
# Start all infrastructure services
docker compose -f docker-compose-tools.yml up -d

# Start only postgres and kafka
docker compose -f docker-compose-tools.yml up -d postgres kafka

# View logs of a specific service
docker compose -f docker-compose-tools.yml logs -f kafka

# Stop and clean up (preserves volumes)
docker compose -f docker-compose-tools.yml down

# Stop and destroy volumes (full reset)
docker compose -f docker-compose-tools.yml down -v
```

---

## Advanced

### Alpine vs Debian: Choosing the Right Base

```
Image size comparison (ep-production-broadcast JAR ~60MB):
  openjdk:17                          →  470MB  (Debian, full JDK)
  amazoncorretto:17                   →  420MB  (Debian, JRE)
  amazoncorretto:17-alpine            →  190MB  (Alpine, JRE)
  eclipse-temurin:17-jre-alpine       →  185MB  (Alpine, JRE)
```

**Alpine** uses musl libc instead of glibc. This matters for:
- **SAP JCo library** (`libsapjco3.so`) — compiled against glibc. **Cannot run on Alpine.** Use Debian/Corretto base for `ep-sap-connector`.
- Most Java applications work fine on Alpine.

```dockerfile
# ep-sap-connector: must use glibc-based image
FROM amazoncorretto:17    # Debian-based, has glibc

# ep-production-broadcast: Alpine is fine
FROM amazoncorretto:17-alpine
```

### Layer Caching Optimisation

The Docker build cache is invalidated from the first changed instruction downward. Order instructions from least-to-most-frequently-changed:

```dockerfile
# WRONG — source copy invalidates dependency cache on every code change
FROM node:20-alpine
WORKDIR /app
COPY . .                   # copies everything including source
RUN npm ci                 # re-runs on every source change (slow!)

# CORRECT — dependencies cached separately from source
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./      # only changes when deps change
RUN npm ci                 # cached unless package.json changes
COPY . .                   # source changes only invalidate from here
CMD ["node", "src/index.js"]
```

### Multi-Platform Build

```bash
# Build for both AMD64 (cloud) and ARM64 (Apple Silicon, Graviton)
docker buildx create --use --name multiplatform-builder
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t 123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast:$SHA \
  --push .
```

### Custom Base Images in ECR

Build a base image once (with shared CA certificates, JVM tuning, security hardening) and reference it in all services:

```dockerfile
# base-image/Dockerfile — built by CI, pushed to ECR
FROM amazoncorretto:17-alpine
RUN apk add --no-cache curl tzdata
COPY tml-root-ca.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates
ENV TZ=Asia/Kolkata
```

```dockerfile
# ep-production-broadcast/Dockerfile
FROM 123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-base-jre:17
COPY --from=build /app/build/libs/*.jar app.jar
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
```

### docker scout: Vulnerability Scanning

```bash
# Scan an image for CVEs
docker scout cves 123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast:abc1234

# Compare with previous version
docker scout compare \
  123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast:abc1234 \
  --to 123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast:prev123
```

---

## Expert

### Linux Namespaces and cgroups

Docker containers are not VMs — they are isolated Linux processes using two kernel features:

**Namespaces** (what the process can see):
- `PID` — the container has its own PID 1 (your app); cannot see host processes
- `NET` — the container has its own network stack (eth0 with a private IP)
- `MNT` — the container has its own filesystem mount view (the image layers)
- `UTS` — the container has its own hostname
- `IPC` — isolated inter-process communication

**cgroups** (what the process can use):
```bash
# Limit container to 512MB RAM and 1 CPU core
docker run -m 512m --cpus="1.0" myapp:latest
```

### Rootless Containers

Running as root inside a container is a security risk — if an attacker escapes the container, they get root on the host. Always use `USER`:

```dockerfile
FROM amazoncorretto:17-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# ... copy JAR ...
USER appuser          # container runs as non-root from here
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### JVM Memory Tuning in Containers

Without tuning, the JVM reads host memory (e.g., 32GB on an EC2 node) and sets heap to 25% of it (8GB). Your 512MB container crashes with OOMKilled.

```dockerfile
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
# MaxRAMPercentage=75 → in a 512m container, heap = ~384MB
# Leaves 128MB for off-heap (Metaspace, thread stacks, native buffers)
```

### docker stats: Reading Resource Usage

```bash
docker stats

CONTAINER         CPU %    MEM USAGE / LIMIT    MEM %    NET I/O          BLOCK I/O
ep-prod-bcast     12.3%    245MiB / 512MiB      47.9%    1.2GB / 450MB    0B / 8.2MB
ep-sap-connector  3.1%     198MiB / 512MiB      38.7%    890MB / 210MB    0B / 2.1MB
```

- **CPU %** — percentage of the allocated CPU shares (not host CPUs)
- **MEM USAGE / LIMIT** — current RSS vs `-m` limit; approaching 100% means OOMKill risk
- **NET I/O** — total bytes in/out since container start (useful for detecting unexpected traffic)

### Diagnosing OOMKilled Containers

```bash
# Container exits with exit code 137 = OOMKilled
docker inspect myapp --format='{{.State.ExitCode}}'
# 137

# Check if K8s pod was OOMKilled
kubectl describe pod ep-production-broadcast-xxx | grep -A 5 "Last State"
# Last State: Terminated
#   Reason: OOMKilled
#   Exit Code: 137

# Fix options:
# 1. Increase container memory limit
# 2. Tune JVM: -XX:MaxRAMPercentage=75.0 -XX:+UseG1GC
# 3. Find and fix memory leak (heap dump analysis with MAT)
```

---

## In the TML Codebase

### Frontend: Node Build → nginx Runtime

```dockerfile
# ep-production-broadcast-ui/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build   # creates /app/dist

FROM nginx:1.25-alpine AS runtime
# Custom nginx config for React Router (SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy built static files
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

```nginx
# nginx.conf — SPA routing: all unknown paths → index.html (React Router handles it)
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # API proxy to backend service
    location /api/ {
        proxy_pass http://ep-production-broadcast:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # React Router: serve index.html for any non-file path
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Backend: Gradle Build → JRE Runtime

```dockerfile
# ep-production-broadcast/Dockerfile
FROM gradle:7-jdk17 AS build
WORKDIR /app
COPY gradle/ gradle/
COPY gradlew build.gradle settings.gradle ./
RUN ./gradlew dependencies --no-daemon
COPY src/ src/
RUN ./gradlew bootJar --no-daemon -x test

FROM amazoncorretto:17-alpine AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/build/libs/*.jar app.jar
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD wget -q --spider http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
```

**Note:** `ep-sap-connector` uses `amazoncorretto:17` (Debian, not Alpine) because SAP JCo requires glibc.

### docker-compose-tools.yml

Every Spring Boot service has a `docker-compose-tools.yml` in its root with `postgres:5432`, `kafka:9092`, and `zookeeper:2181` pre-configured. Run `docker compose -f docker-compose-tools.yml up -d` before `./gradlew bootRun` for local development.

### ECR Image Naming

```
{account}.dkr.ecr.ap-south-1.amazonaws.com/{service-name}:{git-commit-sha}

Examples:
  123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-production-broadcast:a1b2c3d
  123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-sap-connector:f4e5d6c
```

Images are never tagged `latest` in production. The Helm chart values file is updated with the exact commit SHA by the CI pipeline.

---

## Quick Reference

### Dockerfile Instructions

| Instruction | Example | Notes |
|---|---|---|
| `FROM` | `FROM node:20-alpine` | Always pin a version, never use `latest` in prod |
| `WORKDIR` | `WORKDIR /app` | Creates dir if not exists |
| `COPY` | `COPY package*.json ./` | Copies from build context |
| `RUN` | `RUN npm ci` | Each RUN = one layer; chain with `&&` to reduce layers |
| `CMD` | `CMD ["node", "index.js"]` | Overridable at `docker run` |
| `ENTRYPOINT` | `ENTRYPOINT ["java", "-jar", "app.jar"]` | Not overridable without `--entrypoint` |
| `USER` | `USER appuser` | Always set before CMD/ENTRYPOINT |
| `HEALTHCHECK` | `HEALTHCHECK CMD curl -f http://localhost:8080/health` | Docker and compose use this |

### docker-compose Commands

```bash
docker compose up -d                    # start all services in background
docker compose up -d postgres kafka     # start specific services
docker compose down                     # stop containers (keep volumes)
docker compose down -v                  # stop and delete volumes
docker compose logs -f service-name     # follow logs
docker compose ps                       # list service status
docker compose exec service-name sh     # shell into service
docker compose pull                     # pull latest images
```

### nginx.conf SPA Template

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

This single line makes React Router work: if the file doesn't exist on disk (e.g., `/dashboard` route), serve `index.html` and let React Router render the correct page.
