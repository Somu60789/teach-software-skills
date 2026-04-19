# Observability & Monitoring

## Prerequisites

- **Kubernetes & Helm (doc 13):** The production observability stack runs inside Kubernetes. You must understand DaemonSets, ConfigMaps, Services, and how Helm installs complex applications. Fluent Bit runs as a DaemonSet; Prometheus and Grafana are deployed via Helm.
- **Spring Boot (doc 02):** TML services are Spring Boot applications. You must understand Spring Boot Actuator, `application.properties`, and the application lifecycle to configure metrics endpoints, health probes, and structured logging.
- **Basic Docker:** You need to run a local observability stack with docker-compose for development.

---

## What & Why

**Observability** is the ability to understand the internal state of a system from its external outputs. A system is "observable" if you can answer "what is wrong and why" without deploying new code or SSHing into a server.

**The three pillars:**

| Pillar | Question it answers | Tool |
|---|---|---|
| **Metrics** | What happened? (counts, rates, distributions) | Prometheus + Grafana |
| **Logs** | Why did it happen? (event details, error messages) | EFK (Elasticsearch + Fluent Bit + Kibana) |
| **Traces** | Where did it happen? (request path across services) | OpenTelemetry + Jaeger/Tempo |

**Why observability over ad-hoc debugging:**

Without observability, a production incident follows this pattern: user reports error → engineer SSHs into server → reads log files → guesses the problem → deploys a fix → repeats. This is slow, doesn't scale, and leaves no record.

With observability: alert fires on SLO breach → engineer opens Grafana dashboard → sees spike in error rate at 14:32 → jumps to Kibana → filters logs for `level: ERROR` between 14:30-14:35 → finds `NullPointerException` in `OrderService.processEvent()` → fixes in minutes.

**SRE concepts:**
- **SLI (Service Level Indicator):** A measurable metric for service quality. Example: "HTTP success rate" = (2xx responses / total responses).
- **SLO (Service Level Objective):** The target for an SLI. Example: "HTTP success rate ≥ 99.9% over 30 days."
- **SLA (Service Level Agreement):** A contract with users/customers about the SLO. Breaching the SLA has business consequences.
- **Error budget:** The allowed downtime/errors within an SLO period. 99.9% over 30 days = 43.2 minutes of allowed downtime.

**TML uses:** Prometheus + Grafana for metrics, EFK stack (Elasticsearch + Fluent Bit + Kibana) for logs, OpenTelemetry auto-instrumentation on select services, and Alertmanager for routing alerts to PagerDuty/Slack.

---

## Core Concepts

### Metric Types

**Counter:** A monotonically increasing value. Never decreases (except on reset). Use for total counts of events.
- `http_server_requests_total` — total HTTP requests since startup
- `kafka_consumer_records_consumed_total` — total Kafka messages processed
- To get a rate, use `rate()` in PromQL: `rate(http_server_requests_total[5m])` gives requests/second over 5 minutes.

**Gauge:** A value that can go up or down. Use for current state.
- `jvm_memory_used_bytes` — current JVM heap usage
- `kafka_consumer_group_lag` — current consumer lag
- `queue.size` — number of items currently in a queue

**Histogram:** Observes values and buckets them into ranges. Used for latency/duration measurement.
- `http_server_requests_seconds_bucket` — request duration in configurable buckets
- `sap_call_duration_seconds_bucket` — SAP API call latency
- Histograms enable percentile calculations: `histogram_quantile(0.99, rate(...[5m]))` gives p99 latency.

### Log Structure

**Unstructured log (bad):**
```
2024-01-15 14:32:11 ERROR Something went wrong processing order 12345 for vehicle VH-001
```

A human can read this. `grep` can find it. But you cannot filter by `orderId=12345` in Kibana because the fields aren't structured.

**Structured JSON log (good):**
```json
{
  "timestamp": "2024-01-15T14:32:11.432Z",
  "level": "ERROR",
  "logger": "com.tml.ipms4.service.OrderService",
  "message": "Failed to process order",
  "orderId": "12345",
  "vehicleId": "VH-001",
  "correlationId": "req-abc-123-xyz",
  "exception": "java.lang.NullPointerException",
  "stacktrace": "at com.tml..."
}
```

Kibana can filter by any field. You can search `orderId: 12345 AND level: ERROR`. You can aggregate how many errors occurred per `vehicleId`. Structure transforms logs from text files into a queryable database.

### Distributed Traces

A **trace** is a directed acyclic graph of **spans** representing a single request as it flows through multiple services.

```
[Trace: req-abc-123-xyz]
├── [Span: HTTP POST /api/orders] (OrderService: 234ms)
│   ├── [Span: Kafka publish order.created] (2ms)
│   ├── [Span: DB INSERT orders] (12ms)
│   └── [Span: HTTP POST /api/sap/create-order] (210ms)
│       └── [Span: SAP RFC call BAPI_CREATE_ORDER] (195ms)
```

Without traces, you know a user's request took 234ms but not which service or call caused it. With traces, you see immediately that the SAP RFC call consumed 83% of the time.

**Context propagation:** The trace ID travels with the request. In HTTP, via the `traceparent` header (W3C standard). In Kafka, via message headers. Each service reads the incoming context and adds its own spans as children.

---

## Installation & Setup

### Local Observability Stack with Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=15d'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      GF_AUTH_ANONYMOUS_ENABLED: "true"
      GF_AUTH_ANONYMOUS_ORG_ROLE: Admin
    volumes:
      - grafana-data:/var/lib/grafana

  elasticsearch:
    image: elasticsearch:8.12.0
    environment:
      discovery.type: single-node
      xpack.security.enabled: "false"
      ES_JAVA_OPTS: "-Xms512m -Xmx512m"
    ports:
      - "9200:9200"

  kibana:
    image: kibana:8.12.0
    ports:
      - "5601:5601"
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    depends_on:
      - elasticsearch

volumes:
  grafana-data:
```

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'spring-boot-services'
    static_configs:
      - targets:
          - 'host.docker.internal:9096'   # your local Spring Boot service
    metrics_path: /actuator/prometheus
```

```bash
docker-compose up -d
# Access:
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3000
# Kibana:     http://localhost:5601
```

**Check your Spring Boot service exposes metrics:**
```bash
curl http://localhost:9096/actuator/prometheus | head -30
```

Expected output begins with `# HELP` and `# TYPE` comment lines followed by metric lines.

---

## Beginner

### Reading Prometheus Metric Format

The `/actuator/prometheus` endpoint emits text in the Prometheus exposition format:

```
# HELP http_server_requests_seconds Duration of HTTP server request handling
# TYPE http_server_requests_seconds summary
http_server_requests_seconds_count{exception="None",method="GET",outcome="SUCCESS",status="200",uri="/api/orders"} 1547.0
http_server_requests_seconds_sum{exception="None",method="GET",outcome="SUCCESS",status="200",uri="/api/orders"} 23.847
http_server_requests_seconds_max{exception="None",method="GET",outcome="SUCCESS",status="200",uri="/api/orders"} 0.234

# HELP jvm_memory_used_bytes The amount of used memory
# TYPE jvm_memory_used_bytes gauge
jvm_memory_used_bytes{area="heap",id="G1 Eden Space"} 1.26877696E8
jvm_memory_used_bytes{area="heap",id="G1 Old Gen"} 2.34567E7
jvm_memory_used_bytes{area="nonheap",id="Metaspace"} 9.5432704E7
```

Each metric has:
- A `# HELP` line with a human-readable description
- A `# TYPE` line declaring counter, gauge, histogram, or summary
- Data lines with the metric name, label set in `{}`, and value

Labels are key-value pairs that slice the metric. `uri="/api/orders"` and `uri="/api/vehicles"` are separate time series for the same metric.

### Basic PromQL Queries

```promql
# Total HTTP request count for a service (raw counter)
http_server_requests_seconds_count{job="ep-production-broadcast"}

# Request rate over the last 5 minutes (requests/second)
rate(http_server_requests_seconds_count[5m])

# Error rate: only 5xx responses
rate(http_server_requests_seconds_count{status=~"5.."}[5m])

# Error percentage
100 * rate(http_server_requests_seconds_count{status=~"5.."}[5m])
    / rate(http_server_requests_seconds_count[5m])

# Sum by URI: see which endpoints are busiest
sum by(uri) (rate(http_server_requests_seconds_count[5m]))

# 99th percentile latency for successful requests
histogram_quantile(0.99,
  sum by(le, uri) (
    rate(http_server_requests_seconds_bucket{outcome="SUCCESS"}[5m])
  )
)

# Current JVM heap usage
jvm_memory_used_bytes{area="heap"}

# Heap usage percentage
100 * jvm_memory_used_bytes{area="heap"}
    / jvm_memory_max_bytes{area="heap"}
```

### Grafana: First Panel

1. Open `http://localhost:3000`
2. **Connections → Data Sources → Add data source → Prometheus**
3. URL: `http://prometheus:9090` (or `http://localhost:9090` if not in Docker)
4. Click **Save & Test**
5. **Dashboards → New → New Panel**
6. In the query editor, enter: `rate(http_server_requests_seconds_count[5m])`
7. Set **Legend** to `{{uri}} {{status}}`
8. Set panel title to "HTTP Request Rate"
9. Set refresh interval to 10s

### Kibana: First Search

1. Open `http://localhost:5601`
2. **Management → Stack Management → Index Patterns → Create index pattern**
3. Pattern: `logs-*` (or whatever Fluent Bit writes to)
4. Time field: `@timestamp`
5. Go to **Discover**
6. Run a KQL query:

```kql
level: "ERROR"

level: "ERROR" and logger: "com.tml.ipms4"

level: "ERROR" and correlationId: "req-abc-123"

message: "NullPointerException" and orderId: *
```

KQL (Kibana Query Language) is field-based. `level: "ERROR"` finds all documents where the `level` field equals `ERROR`. `message: *Exception*` is a wildcard search.

---

## Intermediate

### Custom Micrometer Metrics in Spring Boot

Spring Boot auto-configures a `MeterRegistry` bean. Inject it and register custom metrics.

```java
// OrderProcessingService.java
@Service
public class OrderProcessingService {

    private final Counter ordersProcessed;
    private final Counter ordersFailed;
    private final Timer sapCallTimer;
    private final AtomicInteger pendingOrderGauge;

    public OrderProcessingService(MeterRegistry registry) {
        this.ordersProcessed = Counter.builder("orders.processed")
            .description("Total orders successfully processed")
            .tag("bu", "cvbu")             // tag for filtering in dashboards
            .register(registry);

        this.ordersFailed = Counter.builder("orders.failed")
            .description("Total orders that failed processing")
            .tag("bu", "cvbu")
            .register(registry);

        this.sapCallTimer = Timer.builder("sap.call.duration")
            .description("Duration of SAP BAPI calls")
            .tag("bapi", "BAPI_CREATE_ORDER")
            .publishPercentiles(0.5, 0.95, 0.99)   // expose p50, p95, p99
            .register(registry);

        // Gauge: tracks a value that exists externally (not incremented here)
        this.pendingOrderGauge = new AtomicInteger(0);
        Gauge.builder("orders.pending", pendingOrderGauge, AtomicInteger::get)
            .description("Number of orders awaiting processing")
            .register(registry);
    }

    public void processOrder(Order order) {
        pendingOrderGauge.decrementAndGet();
        try {
            sapCallTimer.record(() -> sapClient.createOrder(order));
            ordersProcessed.increment();
        } catch (Exception e) {
            ordersFailed.increment();
            throw e;
        }
    }

    public void enqueueOrder(Order order) {
        pendingOrderGauge.incrementAndGet();
    }
}
```

These metrics appear at `/actuator/prometheus` as:
```
orders_processed_total{bu="cvbu"} 4521.0
orders_failed_total{bu="cvbu"} 12.0
sap_call_duration_seconds{bapi="BAPI_CREATE_ORDER",quantile="0.99"} 0.845
orders_pending{} 7.0
```

### Spring Boot Actuator Kubernetes Health Probes

```properties
# application.properties
# Expose Kubernetes-specific liveness and readiness probes
management.endpoint.health.probes.enabled=true
management.health.livenessState.enabled=true
management.health.readinessState.enabled=true

# Expose specific endpoints
management.endpoints.web.exposure.include=health,prometheus,info,metrics

# Bind management (actuator) to a separate port from the app
management.server.port=9096

# Show full health details
management.endpoint.health.show-details=always
```

```yaml
# Kubernetes Deployment livenessProbe and readinessProbe
livenessProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 9096
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /actuator/health/readiness
    port: 9096
  initialDelaySeconds: 20
  periodSeconds: 5
  failureThreshold: 3
```

`/actuator/health/liveness` returns 200 if the application's liveness state is `CORRECT` (the JVM is alive and not deadlocked). Kubernetes restarts the pod if liveness fails.

`/actuator/health/readiness` returns 200 if the application is ready to serve traffic (database connections are available, etc.). Kubernetes stops sending traffic to the pod if readiness fails — the pod is removed from the Service endpoints.

### Fluent Bit DaemonSet Configuration

Fluent Bit runs on every Kubernetes node and collects logs from all containers, parses them, and forwards to Elasticsearch.

```yaml
# fluent-bit-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: logging
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush        1
        Log_Level    info
        Parsers_File parsers.conf

    [INPUT]
        Name              tail
        Path              /var/log/containers/*.log
        multiline.parser  docker, cri
        Tag               kube.*
        Refresh_Interval  5
        Mem_Buf_Limit     50MB
        Skip_Long_Lines   On

    [FILTER]
        Name                kubernetes
        Match               kube.*
        Kube_URL            https://kubernetes.default.svc:443
        Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
        Merge_Log           On       # merge JSON log content into the record
        Keep_Log            Off
        K8S-Logging.Parser  On       # use pod annotation for custom parser

    [FILTER]
        Name   grep
        Match  kube.*
        Regex  $kubernetes['namespace_name'] ^ipms4

    [OUTPUT]
        Name            es
        Match           kube.*
        Host            elasticsearch.logging.svc.cluster.local
        Port            9200
        Logstash_Format On
        Logstash_Prefix logs
        Retry_Limit     5
        tls             Off
```

The `Merge_Log On` filter is critical for structured logging. When a Spring Boot service logs JSON (e.g., `{"level":"ERROR","message":"..."}`), Fluent Bit merges those JSON fields directly into the Elasticsearch document as first-class fields — `level`, `message`, `correlationId` are all queryable in Kibana.

### MDC Structured Logging

MDC (Mapped Diagnostic Context) attaches key-value pairs to the current thread's logging context. All log statements on that thread automatically include the MDC values in the JSON output.

```java
// KafkaListener in ep-production-broadcast
@KafkaListener(topics = "vehicle.order.created", groupId = "ep-production-broadcast")
public void handleOrderCreated(ConsumerRecord<String, String> record) {
    String correlationId = Optional.ofNullable(record.headers().lastHeader("correlationId"))
        .map(h -> new String(h.value()))
        .orElse(UUID.randomUUID().toString());

    MDC.put("correlationId", correlationId);
    MDC.put("vehicleId", record.key());
    MDC.put("kafkaTopic", record.topic());
    MDC.put("kafkaPartition", String.valueOf(record.partition()));
    MDC.put("kafkaOffset", String.valueOf(record.offset()));

    try {
        log.info("Processing order creation event");    // correlationId auto-included
        orderService.processOrder(parseOrder(record.value()));
        log.info("Order processed successfully");       // correlationId auto-included
    } catch (Exception e) {
        log.error("Failed to process order event", e);  // correlationId auto-included
    } finally {
        MDC.clear();    // ALWAYS clear MDC after processing — thread may be reused
    }
}
```

**`logback-spring.xml` for JSON output:**
```xml
<configuration>
  <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
    <encoder class="net.logstash.logback.encoder.LogstashEncoder">
      <includeCallerData>false</includeCallerData>
      <includeMdc>true</includeMdc>
      <!-- Add custom fields -->
      <customFields>{"service":"ep-production-broadcast","env":"${SPRING_PROFILES_ACTIVE}"}</customFields>
    </encoder>
  </appender>

  <root level="INFO">
    <appender-ref ref="JSON"/>
  </root>
</configuration>
```

Every log line now includes `correlationId`, `vehicleId`, `service`, `env`, and all other MDC/custom fields. You can search Kibana for `correlationId: "req-abc-123"` and see every log line across every service that processed that request.

---

## Advanced

### Alertmanager Rules: Kafka Consumer Lag

```yaml
# prometheus-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: ipms4-kafka-alerts
  namespace: monitoring
spec:
  groups:
    - name: kafka-consumer-lag
      interval: 30s
      rules:
        - alert: KafkaConsumerLagHigh
          expr: kafka_consumer_group_lag{group="ep-production-broadcast"} > 1000
          for: 5m
          labels:
            severity: warning
            team: ipms4
          annotations:
            summary: "Kafka consumer lag is high"
            description: >
              Consumer group {{ $labels.group }} has lag {{ $value }}
              on topic {{ $labels.topic }} partition {{ $labels.partition }}.
              This means messages are accumulating faster than they are being processed.
            runbook_url: "https://wiki.internal/runbooks/kafka-lag"

        - alert: KafkaConsumerLagCritical
          expr: kafka_consumer_group_lag{group="ep-production-broadcast"} > 10000
          for: 2m
          labels:
            severity: critical
            team: ipms4
          annotations:
            summary: "Kafka consumer lag is critically high — possible consumer stall"
            description: "Lag is {{ $value }}. Immediate investigation required."

        - alert: KafkaConsumerGroupDead
          expr: kafka_consumer_group_members{group="ep-production-broadcast"} == 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "No consumers in group ep-production-broadcast"
```

### JVM Metrics PromQL

```promql
# Current heap usage (in MB)
jvm_memory_used_bytes{area="heap"} / 1024 / 1024

# Heap usage percentage
100 * jvm_memory_used_bytes{area="heap"} / jvm_memory_max_bytes{area="heap"}

# GC pause time rate (ms/s — if this is high, GC is a problem)
rate(jvm_gc_pause_seconds_sum[5m]) * 1000

# GC pause count rate
rate(jvm_gc_pause_seconds_count[5m])

# Live thread count
jvm_threads_live_threads

# Daemon thread count
jvm_threads_daemon_threads

# CPU usage (0-1 scale)
process_cpu_usage

# Number of open file descriptors
process_files_open_files
```

Alert on JVM heap > 85% for more than 10 minutes — by that point, GC overhead is significant and OOM is likely imminent.

### Alertmanager Routing

```yaml
# alertmanager.yml
global:
  slack_api_url: 'https://hooks.slack.com/services/...'
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

route:
  receiver: default
  group_by: [alertname, team]
  group_wait: 30s        # wait 30s before sending first notification (group more alerts)
  group_interval: 5m     # send new grouped alerts every 5m
  repeat_interval: 4h    # resend if still firing after 4h

  routes:
    - match:
        severity: critical
      receiver: pagerduty-critical
      continue: true     # also send to default receiver

    - match:
        severity: warning
        team: ipms4
      receiver: slack-ipms4

    - match:
        severity: warning
        team: platform
      receiver: slack-platform

receivers:
  - name: default
    slack_configs:
      - channel: '#alerts-all'
        title: '{{ template "slack.title" . }}'
        text: '{{ template "slack.text" . }}'

  - name: pagerduty-critical
    pagerduty_configs:
      - routing_key: '<PD_ROUTING_KEY>'
        description: '{{ template "pagerduty.description" . }}'

  - name: slack-ipms4
    slack_configs:
      - channel: '#alerts-ipms4'
        send_resolved: true

inhibit_rules:
  # Suppress warning if critical is already firing for same alert+team
  - source_match:
      severity: critical
    target_match:
      severity: warning
    equal: [alertname, team]
```

### EFK Stack Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                         │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Node 1                  Node 2                       │  │
│  │  ┌──────────────┐        ┌──────────────┐             │  │
│  │  │ App Pod      │        │ App Pod      │             │  │
│  │  │ (JSON logs   │        │ (JSON logs   │             │  │
│  │  │  to stdout)  │        │  to stdout)  │             │  │
│  │  └──────┬───────┘        └──────┬───────┘             │  │
│  │         │ /var/log/containers/  │                     │  │
│  │  ┌──────▼───────────────────────▼───────┐             │  │
│  │  │         Fluent Bit DaemonSet         │             │  │
│  │  │  (tail → kubernetes filter → ES out) │             │  │
│  │  └──────────────────┬───────────────────┘             │  │
│  └─────────────────────┼─────────────────────────────────┘  │
│                        │                                    │
│  ┌─────────────────────▼──────────────┐                     │
│  │  Elasticsearch Cluster             │                     │
│  │  (3-node, rolling indices)         │                     │
│  └─────────────────────┬──────────────┘                     │
│                        │                                    │
│  ┌─────────────────────▼──────────────┐                     │
│  │  Kibana                            │                     │
│  │  (dashboards, discover, alerts)    │                     │
│  └────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

All application pods write JSON logs to stdout. Kubernetes captures stdout to `/var/log/containers/` on the node. Fluent Bit's DaemonSet pod on each node tails these files, adds Kubernetes metadata (pod name, namespace, labels), and forwards to Elasticsearch. Kibana reads from Elasticsearch.

---

## Expert

### OpenTelemetry Auto-Instrumentation

OpenTelemetry's Java agent instruments your application at JVM startup without any code changes. It intercepts HTTP clients, JDBC calls, Kafka producers/consumers, and Spring MVC and generates spans automatically.

```yaml
# Kubernetes Deployment spec
spec:
  template:
    spec:
      initContainers:
        - name: otel-agent
          image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-java:latest
          command: ["cp", "/javaagent.jar", "/otel/javaagent.jar"]
          volumeMounts:
            - name: otel-agent
              mountPath: /otel

      containers:
        - name: ep-gmes-integration
          image: 123456789012.dkr.ecr.ap-south-1.amazonaws.com/ep-gmes-integration:abc123
          env:
            - name: JAVA_TOOL_OPTIONS
              value: "-javaagent:/otel/javaagent.jar"
            - name: OTEL_SERVICE_NAME
              value: ep-gmes-integration
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: http://otel-collector.monitoring.svc.cluster.local:4317
            - name: OTEL_TRACES_EXPORTER
              value: otlp
            - name: OTEL_METRICS_EXPORTER
              value: none           # using Micrometer for metrics
            - name: OTEL_LOGS_EXPORTER
              value: none           # using Fluent Bit for logs
            - name: OTEL_PROPAGATORS
              value: tracecontext,baggage
          volumeMounts:
            - name: otel-agent
              mountPath: /otel

      volumes:
        - name: otel-agent
          emptyDir: {}
```

The `initContainer` downloads the agent JAR into a shared volume. The application container picks it up via `JAVA_TOOL_OPTIONS`. The agent intercepts all HTTP calls, Kafka produces/consumes, and database queries, generating OTLP spans and exporting to the collector.

### W3C TraceContext Propagation Across Kafka

HTTP propagation is automatic with the OTel agent. Kafka requires explicit header injection/extraction if you're not using the auto-instrumentation agent for Kafka.

**Producer side (inject trace context into Kafka headers):**
```java
// Manual context propagation for Kafka
@Autowired
private KafkaTemplate<String, String> kafkaTemplate;

public void publishOrderEvent(Order order) {
    ProducerRecord<String, String> record = new ProducerRecord<>(
        "vehicle.order.created",
        order.getVehicleId(),
        orderToJson(order)
    );

    // Inject W3C traceparent and tracestate headers
    TextMapSetter<ProducerRecord<?, ?>> setter = (carrier, key, value) ->
        carrier.headers().add(key, value.getBytes(StandardCharsets.UTF_8));

    GlobalOpenTelemetry.getPropagators()
        .getTextMapPropagator()
        .inject(Context.current(), record, setter);

    kafkaTemplate.send(record);
}
```

**Consumer side (extract trace context from Kafka headers):**
```java
@KafkaListener(topics = "vehicle.order.created")
public void consume(ConsumerRecord<String, String> record) {
    TextMapGetter<ConsumerRecord<?, ?>> getter = new TextMapGetter<>() {
        @Override public String get(ConsumerRecord<?, ?> carrier, String key) {
            Header header = carrier.headers().lastHeader(key);
            return header != null ? new String(header.value()) : null;
        }
        @Override public Iterable<String> keys(ConsumerRecord<?, ?> carrier) {
            return StreamSupport.stream(carrier.headers().spliterator(), false)
                .map(Header::key).collect(Collectors.toList());
        }
    };

    Context extractedContext = GlobalOpenTelemetry.getPropagators()
        .getTextMapPropagator()
        .extract(Context.current(), record, getter);

    try (Scope scope = extractedContext.makeCurrent()) {
        Span span = GlobalOpenTelemetry.getTracer("ep-production-broadcast")
            .spanBuilder("kafka.consume.vehicle.order.created")
            .setSpanKind(SpanKind.CONSUMER)
            .startSpan();
        try (Scope spanScope = span.makeCurrent()) {
            processOrder(record.value());
        } finally {
            span.end();
        }
    }
}
```

The consumer's span becomes a child of the producer's span. In Jaeger/Tempo, the full trace shows the complete path: REST API → Kafka publish → Kafka consume → SAP call — all as one trace with the same trace ID.

### Grafana SLO Dashboard

```promql
# SLI: HTTP success rate (non-5xx responses / total responses)
# Numerator: successful requests
sum(rate(http_server_requests_seconds_count{status!~"5..",job="ep-production-broadcast"}[5m]))

# Denominator: all requests
sum(rate(http_server_requests_seconds_count{job="ep-production-broadcast"}[5m]))

# SLI as a percentage (target: 99.9%)
100 * sum(rate(http_server_requests_seconds_count{status!~"5.."}[5m]))
    / sum(rate(http_server_requests_seconds_count[5m]))

# Burn rate alert: 1-hour burn rate > 14.4x normal (exhausts 30-day budget in 2 hours)
(
  1 - sum(rate(http_server_requests_seconds_count{status!~"5.."}[1h]))
    / sum(rate(http_server_requests_seconds_count[1h]))
) / (1 - 0.999)
```

A burn rate alert is more sophisticated than a simple error rate alert. A 1% error rate for 5 minutes is noise. A 1% error rate for 2 hours burns through your entire monthly error budget. Burn rate alerts capture this urgency.

### On-Call Runbook Structure

Every Alertmanager alert should have an associated runbook. Good runbooks follow this structure:

```markdown
# Runbook: KafkaConsumerLagHigh

## Symptom
Alert: `KafkaConsumerLagHigh` fired for consumer group `ep-production-broadcast`
Consumer lag on topic `vehicle.order.created` is > 1000 messages.

## Probable Causes
1. Consumer pod crashed or restarted (check pod events)
2. SAP integration is slow/unavailable (increases processing time per message)
3. Traffic spike: producers sending more messages than usual
4. Consumer pod out of memory (JVM heap full → GC pauses → slow processing)

## Investigation Steps
1. Check consumer pod status:
   kubectl get pods -n ipms4-production -l app=ep-production-broadcast
2. Check recent pod restarts:
   kubectl describe pod <POD_NAME> -n ipms4-production | grep -A10 "Events:"
3. Check JVM heap in Grafana: dashboard "IPMS4 JVM" → panel "Heap Usage %"
4. Check SAP call duration in Grafana: panel "SAP Call p99 Latency"
5. Check Kibana for ERROR logs in the last 30 minutes:
   level: ERROR AND service: ep-production-broadcast

## Resolution
- If pod crashed: kubectl rollout restart deployment/ep-production-broadcast -n ipms4-production
- If SAP is down: open incident with SAP team, consumer will retry automatically
- If heap > 90%: scale up memory limits in Helm values, or trigger GC analysis
- If traffic spike: consider scaling consumer replicas (update replicaCount in values.yaml)

## Escalation
If lag > 10,000 (KafkaConsumerLagCritical alert fires): page on-call lead immediately.
```

---

## In the TML Codebase

**Spring Boot metrics endpoint:** Every IPMS4 microservice exposes Micrometer metrics at `http://POD_IP:9096/actuator/prometheus`. Prometheus scrapes this endpoint every 15 seconds. The management port (9096) is separate from the application port (8080) so Prometheus traffic doesn't affect application routing.

**Kubernetes health probes:** All IPMS4 services have:
```yaml
livenessProbe:
  httpGet: { path: /actuator/health/liveness, port: 9096 }
readinessProbe:
  httpGet: { path: /actuator/health/readiness, port: 9096 }
```

The `readinessProbe` checks that Kafka consumer groups are connected and the database connection pool is healthy. During rolling deployments, old pods serve traffic until the new pods are fully ready.

**EFK in KOPS clusters:** Each KOPS cluster has a Fluent Bit DaemonSet running in the `logging` namespace. The DaemonSet config is managed via the `ep-infrastructure` Helm chart. Log indices in Elasticsearch are rotated daily (`logs-YYYY.MM.DD`), and indices older than 30 days are deleted via an ILM (Index Lifecycle Management) policy.

**OpenTelemetry on ep-gmes-integration:** The GMES integration service uses OTel Java auto-instrumentation to trace all outbound HTTP calls to the GMES API and all Kafka interactions. Traces are exported to an OTLP collector running in the `monitoring` namespace, which forwards to a Tempo/Jaeger instance.

**Grafana dashboards in production:**
- **IPMS4 Overview:** HTTP request rates, error rates, p99 latency per service
- **Kafka Consumer Lag:** Consumer group lag per topic and partition
- **JVM Health:** Heap usage, GC pause rate, thread count per pod
- **Infrastructure:** Node CPU, memory, and disk usage across the KOPS cluster

**MDC pattern in Kafka listeners:** The standard pattern across all IPMS4 Kafka listeners:
1. Extract `correlationId` from Kafka message headers (or generate if absent)
2. `MDC.put("correlationId", correlationId)` before any processing
3. Process the message (all logs automatically include `correlationId`)
4. `MDC.clear()` in a `finally` block

This enables full request tracing through Kibana: given a `correlationId` from a customer complaint, find every log line across every service that touched that request.

---

## Quick Reference

### PromQL Cheat Sheet

| Query | Description |
|---|---|
| `rate(metric[5m])` | Per-second rate of increase over 5 min |
| `increase(metric[1h])` | Total increase over 1 hour |
| `sum by(label) (metric)` | Sum grouped by label |
| `histogram_quantile(0.99, rate(hist_bucket[5m]))` | p99 from histogram |
| `metric{label=~"a\|b"}` | Label regex match (a or b) |
| `metric{label!~"5.."}` | Label does not match regex |
| `metric offset 1h` | Value from 1 hour ago |
| `absent(metric)` | Returns 1 if metric has no data |

### MDC Logging Setup

```xml
<!-- pom.xml dependency -->
<dependency>
  <groupId>net.logstash.logback</groupId>
  <artifactId>logstash-logback-encoder</artifactId>
  <version>7.4</version>
</dependency>
```

```java
// Pattern: always clear MDC in finally block
MDC.put("correlationId", id);
try {
    // ... processing
} finally {
    MDC.clear();
}
```

### Alertmanager Rule Template

```yaml
- alert: AlertName
  expr: PROMQL_EXPRESSION > THRESHOLD
  for: DURATION              # must be firing for this long before alerting
  labels:
    severity: warning|critical
    team: team-name
  annotations:
    summary: "Short human-readable summary"
    description: "Detailed description with {{ $value }} and {{ $labels.name }}"
    runbook_url: "https://wiki/runbooks/alert-name"
```

### Micrometer API Summary

| API | Usage |
|---|---|
| `Counter.builder("name").tag("k","v").register(reg).increment()` | Increment a counter |
| `Timer.builder("name").register(reg).record(Duration)` | Record a duration |
| `Timer.builder("name").register(reg).record(() -> call())` | Time a lambda |
| `Gauge.builder("name", obj, fn).register(reg)` | Track an external value |
| `DistributionSummary.builder("name").register(reg).record(value)` | Record a measurement |
| `reg.counter("name", "k", "v").increment()` | Shorthand counter |
| `reg.timer("name").record(duration, unit)` | Shorthand timer |
