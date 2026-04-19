# Apache Kafka

## Prerequisites

- **PostgreSQL (08-postgresql.md)** — understanding of durable storage, transactions, and data consistency
- Basic messaging concepts: what a message broker is, producer/consumer terminology
- Java / Spring Boot familiarity (02-spring-boot.md) for the code sections
- Docker Compose for local setup

---

## What & Why

Apache Kafka is a **durable distributed event log**, not a traditional message queue. The distinction matters:

| Traditional Queue (RabbitMQ) | Kafka Event Log |
|---|---|
| Message deleted after consumption | Message persists on disk for configurable retention |
| One consumer per message | Many consumer groups read the same message independently |
| Push-based delivery | Pull-based: consumers control their own pace |
| Limited replay | Full replay from any historical offset |
| Thousands of msg/sec | Millions of msg/sec per broker |

**Why Kafka over RabbitMQ for TML?**

1. **Replay capability** — when a new downstream service is deployed it can replay historical events (e.g., all `material-master-updated-v1` events from the last 7 days) to bootstrap its own state.
2. **Decoupling microservices** — `ep-sap-connector` publishes SAP events; `ep-production-broadcast`, `ep-machine-integration`, and others consume independently without knowing about each other.
3. **Ordering guarantees** — all events for a given entity (e.g., work order `WO-001`) land in the same partition in creation order.
4. **Kafka Streams** — stateful stream processing (joins, aggregations) without a separate processing framework.

---

## Core Concepts

### Topics, Partitions, and Replicas

```
Topic: material-master-updated-v1
┌─────────────────────────────────────────────────────┐
│  Partition 0  [msg0] [msg1] [msg4] [msg7] ...        │
│  Partition 1  [msg2] [msg5] [msg8] ...               │
│  Partition 2  [msg3] [msg6] [msg9] ...               │
└─────────────────────────────────────────────────────┘
  Each partition is an ordered, immutable append-only log.
  Replication factor = 3 means each partition has 3 copies
  across different brokers (one leader, two followers).
```

- **Topic** — logical channel with a name (e.g., `orders-placed-v1`).
- **Partition** — ordered sub-log inside a topic; unit of parallelism. More partitions → more consumers reading in parallel.
- **Replica** — copy of a partition on another broker. If the leader broker dies, a follower is elected leader. Set `replication.factor=3` in production.

### Producer → Broker → Consumer

```
Producer                 Kafka Cluster               Consumer Group A
─────────               ─────────────────           ─────────────────
OrderService  ──msg──►  Broker 1 (leader P0)  ──►  Consumer instance 1 (reads P0)
                        Broker 2 (leader P1)  ──►  Consumer instance 2 (reads P1)
                        Broker 3 (leader P2)  ──►  Consumer instance 3 (reads P2)

                                                    Consumer Group B
                                                    ─────────────────
                                             ──►   Consumer instance 4 (reads P0,P1,P2)
                                                   (single instance reads all partitions)
```

**Key rule**: within a consumer group, each partition is assigned to exactly one consumer instance at a time.

### Consumer Groups

Consumer groups provide independent consumption. Group `order-service` might be at offset 1000 on partition 0 while group `analytics-service` is at offset 500 on the same partition. They do not interfere.

```
Topic: orders-placed-v1  (3 partitions)

Consumer Group: order-fulfillment
  ├── Instance A  →  Partition 0  (offset 1042)
  ├── Instance B  →  Partition 1  (offset 987)
  └── Instance C  →  Partition 2  (offset 1105)

Consumer Group: order-analytics   (independent offsets)
  └── Instance D  →  Partition 0, 1, 2  (offset 703, 698, 710)
```

### Offsets and Commit Strategies

Each message in a partition has a monotonically increasing **offset** (0, 1, 2, …). The consumer tracks which offset it has processed.

- **Auto-commit** (`enable.auto.commit=true`): Kafka commits the offset periodically. Risk: message processed but not committed → reprocessed on restart (at-least-once). Message committed but processing failed → lost (at-most-once).
- **Manual commit** (`enable.auto.commit=false`): Your code calls `Acknowledgment.acknowledge()` only after successful processing. This is the pattern used in TML services.
- **Seek**: A consumer can seek to any offset, including `earliest` (beginning of partition) or `latest` (only new messages).

### Retention

Kafka keeps messages based on **time** or **size** (whichever limit is hit first):

```
# broker/topic config
retention.ms=604800000   # 7 days (default)
retention.bytes=-1       # unlimited size retention
segment.bytes=1073741824 # 1GB per log segment file
```

Messages older than the retention window are deleted from disk by the log cleaner. With **log compaction** (`cleanup.policy=compact`), Kafka retains only the latest message per key — useful for materialising state (e.g., latest product price).

### Brokers and ZooKeeper / KRaft

- **Broker** — a Kafka server. Each broker hosts partitions. A cluster of 3+ brokers provides fault tolerance.
- **ZooKeeper** (legacy, pre-Kafka 3.x) — external service that stored cluster metadata (controller election, broker list, topic configs). Still used in older deployments.
- **KRaft** (Kafka 3.3+) — Kafka's own Raft-based metadata quorum. Eliminates ZooKeeper. Simpler ops, faster startup. Used in newer AMQ Streams deployments.

---

## Installation & Setup

```yaml
# docker-compose.yml — local Kafka + ZooKeeper
version: "3.8"
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"
```

Start the stack:

```bash
docker compose up -d

# Create a topic
docker exec kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --create --topic orders-placed-v1 \
  --partitions 3 --replication-factor 1

# List topics
docker exec kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

# Produce messages interactively
docker exec -it kafka kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic orders-placed-v1

# Consume from beginning
docker exec kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic orders-placed-v1 \
  --from-beginning \
  --group test-group
```

---

## Beginner

### Add Spring Kafka Dependency

```xml
<!-- pom.xml -->
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka</artifactId>
</dependency>
```

### application.yaml — Consumer and Producer Config

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
    consumer:
      group-id: order-service
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      properties:
        spring.json.trusted.packages: "com.tml.orders.dto"
      auto-offset-reset: latest
```

### Enable Kafka in Your Application

```java
@SpringBootApplication
@EnableKafka
public class OrderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
```

### Send a Message with KafkaTemplate

```java
@Service
@RequiredArgsConstructor
public class OrderProducerService {

    private final KafkaTemplate<String, OrderPlacedEvent> kafkaTemplate;

    public void publishOrderPlaced(Order order) {
        OrderPlacedEvent event = OrderPlacedEvent.builder()
                .orderId(order.getId())
                .plantCode(order.getPlantCode())
                .timestamp(Instant.now())
                .build();

        kafkaTemplate.send("orders-placed-v1", order.getId(), event);
        log.info("Published OrderPlacedEvent for orderId={}", order.getId());
    }
}
```

### Consume Messages with @KafkaListener

```java
@Component
@Slf4j
public class OrderConsumer {

    @KafkaListener(topics = "orders-placed-v1", groupId = "order-service")
    public void onOrderPlaced(@Payload OrderPlacedEvent event,
                              @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
                              @Header(KafkaHeaders.OFFSET) long offset) {
        log.info("Received order {} from partition {} offset {}",
                event.getOrderId(), partition, offset);
        // process event
    }
}
```

### JSON Deserialization Config Bean (Alternative to yaml)

```java
@Configuration
public class KafkaConsumerConfig {

    @Bean
    public ConsumerFactory<String, OrderPlacedEvent> consumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "order-service");
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "latest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);

        JsonDeserializer<OrderPlacedEvent> deserializer =
                new JsonDeserializer<>(OrderPlacedEvent.class);
        deserializer.addTrustedPackages("com.tml.orders.dto");

        return new DefaultKafkaConsumerFactory<>(
                props,
                new StringDeserializer(),
                deserializer);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, OrderPlacedEvent>
            kafkaListenerContainerFactory() {
        var factory = new ConcurrentKafkaListenerContainerFactory<String, OrderPlacedEvent>();
        factory.setConsumerFactory(consumerFactory());
        return factory;
    }
}
```

---

## Intermediate

### Manual Commit with Acknowledgment

Disable auto-commit and acknowledge only after successful processing:

```yaml
spring:
  kafka:
    listener:
      ack-mode: manual_immediate
      concurrency: 1
    consumer:
      enable-auto-commit: false
      max-poll-records: 10
      auto-offset-reset: latest
```

```java
@KafkaListener(topics = "orders-placed-v1", groupId = "order-service")
public void onOrderPlaced(@Payload OrderPlacedEvent event,
                          Acknowledgment acknowledgment) {
    try {
        orderProcessingService.process(event);
        acknowledgment.acknowledge();   // commit offset only on success
    } catch (RecoverableException ex) {
        log.warn("Transient error, will retry: {}", ex.getMessage());
        // do NOT acknowledge — message will be redelivered
    }
}
```

### Retry and Dead Letter Topics

```java
@Component
@Slf4j
public class OrderConsumer {

    @RetryableTopic(
        attempts = "3",
        backoff = @Backoff(delay = 1000, multiplier = 2.0),
        dltStrategy = DltStrategy.FAIL_ON_ERROR,
        topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE
    )
    @KafkaListener(topics = "orders-placed-v1", groupId = "order-service")
    public void onOrderPlaced(OrderPlacedEvent event) {
        orderProcessingService.process(event);
    }

    @DltHandler
    public void handleDlt(OrderPlacedEvent event,
                          @Header(KafkaHeaders.RECEIVED_TOPIC) String topic) {
        log.error("Message landed in DLT from topic {}: {}", topic, event);
        alertingService.sendDltAlert(topic, event);
    }
}
```

This creates topics: `orders-placed-v1-retry-0`, `orders-placed-v1-retry-1`, `orders-placed-v1-dlt`.

### KafkaTemplate with ProducerRecord and Custom Headers

```java
public void sendWithCorrelationId(OrderPlacedEvent event, String correlationId) {
    ProducerRecord<String, OrderPlacedEvent> record = new ProducerRecord<>(
            "orders-placed-v1",
            null,               // partition (null = let partitioner decide)
            event.getOrderId(), // key — determines partition
            event               // value
    );
    record.headers().add("X-Correlation-ID", correlationId.getBytes(StandardCharsets.UTF_8));
    record.headers().add("X-Source-Service", "order-service".getBytes(StandardCharsets.UTF_8));

    kafkaTemplate.send(record).whenComplete((result, ex) -> {
        if (ex != null) {
            log.error("Failed to send event for orderId={}", event.getOrderId(), ex);
        } else {
            log.debug("Sent to partition={} offset={}",
                    result.getRecordMetadata().partition(),
                    result.getRecordMetadata().offset());
        }
    });
}
```

### Embedded Kafka Test

```java
@SpringBootTest
@EmbeddedKafka(
    partitions = 1,
    topics = {"orders-placed-v1"},
    brokerProperties = {"listeners=PLAINTEXT://localhost:9099", "port=9099"}
)
@TestPropertySource(properties = {
    "spring.kafka.bootstrap-servers=${spring.embedded.kafka.brokers}"
})
class OrderConsumerIntegrationTest {

    @Autowired
    private KafkaTemplate<String, OrderPlacedEvent> kafkaTemplate;

    @Autowired
    private OrderRepository orderRepository;

    @Test
    void shouldProcessOrderPlacedEvent() throws Exception {
        var event = new OrderPlacedEvent("WO-001", "PLANT-1", Instant.now());

        kafkaTemplate.send("orders-placed-v1", "WO-001", event).get(5, TimeUnit.SECONDS);

        await().atMost(Duration.ofSeconds(10))
               .untilAsserted(() ->
                   assertThat(orderRepository.findById("WO-001")).isPresent());
    }
}
```

---

## Advanced

### Kafka Streams Topology

```java
@Configuration
@EnableKafkaStreams
public class MaterialStreamConfig {

    @Bean
    public KStream<String, MaterialEvent> materialStream(StreamsBuilder builder) {
        KStream<String, MaterialEvent> stream = builder
                .stream("material-master-updated-v1",
                        Consumed.with(Serdes.String(), materialSerde()));

        // Filter, transform, and forward to another topic
        stream.filter((key, event) -> event.getPlantCode().equals("PLANT-01"))
              .mapValues(event -> MaterialSummary.from(event))
              .to("material-summary-v1",
                  Produced.with(Serdes.String(), materialSummarySerde()));

        return stream;
    }
}
```

### KTable and Stream-Table Join

```java
@Bean
public KStream<String, EnrichedOrder> enrichedOrderStream(StreamsBuilder builder) {
    // Stream of orders
    KStream<String, OrderPlacedEvent> orders = builder.stream("orders-placed-v1");

    // Table of materials (compacted topic — latest value per key)
    KTable<String, Material> materials = builder.table(
            "material-master-updated-v1",
            Materialized.as("materials-store"));

    // Join: enrich each order with current material data
    return orders.join(
            materials,
            (order, material) -> EnrichedOrder.builder()
                    .orderId(order.getOrderId())
                    .materialDescription(material.getDescription())
                    .build(),
            Joined.with(Serdes.String(), orderSerde(), materialSerde()));
}
```

### State Store Query

```java
@RestController
@RequiredArgsConstructor
public class MaterialQueryController {

    private final KafkaStreams kafkaStreams;

    @GetMapping("/materials/{materialCode}")
    public Material getMaterial(@PathVariable String materialCode) {
        ReadOnlyKeyValueStore<String, Material> store =
                kafkaStreams.store(
                        StoreQueryParameters.fromNameAndType(
                                "materials-store",
                                QueryableStoreTypes.keyValueStore()));
        Material material = store.get(materialCode);
        if (material == null) throw new ResponseStatusException(NOT_FOUND);
        return material;
    }
}
```

### Consumer Lag Monitoring

```java
@Scheduled(fixedDelay = 30_000)
public void reportConsumerLag() {
    try (AdminClient admin = AdminClient.create(Map.of(
            AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers))) {

        Map<TopicPartition, OffsetAndMetadata> offsets =
                admin.listConsumerGroupOffsets("order-service")
                     .partitionsToOffsetAndMetadata()
                     .get(10, TimeUnit.SECONDS);

        offsets.forEach((tp, oam) -> {
            long endOffset = getEndOffset(admin, tp);
            long lag = endOffset - oam.offset();
            meterRegistry.gauge("kafka.consumer.lag",
                    Tags.of("topic", tp.topic(), "partition", String.valueOf(tp.partition())),
                    lag);
        });
    }
}
```

### Exactly-Once Semantics

```yaml
spring:
  kafka:
    producer:
      properties:
        enable.idempotence: true
        transactional.id: order-service-producer-1
        acks: all
        retries: 2147483647
        max.in.flight.requests.per.connection: 5
```

```java
@Transactional("kafkaTransactionManager")
public void processAndPublish(IncomingCommand command) {
    // DB write + Kafka publish in the same transaction
    orderRepository.save(Order.from(command));
    kafkaTemplate.send("orders-placed-v1", command.getOrderId(), OrderPlacedEvent.from(command));
}
```

---

## Expert

### AMQ Streams (Red Hat Kafka Operator on Kubernetes)

In the IPMS4 cluster, Kafka is managed by the AMQ Streams Operator using Custom Resource Definitions:

```yaml
# Kafka CRD — cluster definition
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: ipms4-kafka
  namespace: kafka
spec:
  kafka:
    replicas: 3
    version: 3.5.0
    storage:
      type: persistent-claim
      size: 100Gi
      class: gp3
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      default.replication.factor: 3
      log.retention.hours: 168
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 10Gi
```

```yaml
# KafkaTopic CRD — topic definition managed as code
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: material-master-updated-v1
  namespace: kafka
  labels:
    strimzi.io/cluster: ipms4-kafka
spec:
  partitions: 6
  replicas: 3
  config:
    retention.ms: "604800000"   # 7 days
    cleanup.policy: delete
```

### Partition Rebalancing

When a consumer joins or leaves a group, Kafka triggers a **rebalance** — all partitions are temporarily unassigned and redistributed.

- **Eager rebalance** (default, older): all consumers stop consuming, partitions revoked, then reassigned. Causes a consumption pause ("stop the world").
- **Cooperative/incremental rebalance** (`partition.assignment.strategy=CooperativeStickyAssignor`): only the partitions that need to move are revoked. Other consumers continue processing. Preferred for high-throughput services.

```yaml
spring:
  kafka:
    consumer:
      properties:
        partition.assignment.strategy: >
          org.apache.kafka.clients.consumer.CooperativeStickyAssignor
```

### Consumer Lag Alerting with Prometheus

The JMX Exporter sidecar exposes Kafka consumer metrics. The key metric is `kafka_consumer_group_lag`:

```yaml
# prometheus-rules.yaml
groups:
  - name: kafka-consumer-lag
    rules:
      - alert: KafkaConsumerHighLag
        expr: kafka_consumer_group_lag{topic=~".*-v[0-9]+"} > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Consumer group {{ $labels.consumergroup }} lag > 1000 on {{ $labels.topic }}"
```

### Dead Letter Topic Pattern with Error Envelope

```java
@Data
@Builder
public class DeadLetterEnvelope<T> {
    private T originalPayload;
    private String originalTopic;
    private int originalPartition;
    private long originalOffset;
    private String errorMessage;
    private String errorClass;
    private Instant failedAt;
    private String serviceId;
}

@Bean
public DeadLetterPublishingRecoverer deadLetterRecoverer(KafkaTemplate<String, Object> template) {
    return new DeadLetterPublishingRecoverer(template,
            (record, ex) -> new TopicPartition(record.topic() + ".dlt", -1)) {
        @Override
        protected void publish(ProducerRecord<Object, Object> outRecord, KafkaOperations<Object, Object> kafkaTemplate) {
            // wrap in error envelope before publishing to DLT
            DeadLetterEnvelope<?> envelope = DeadLetterEnvelope.builder()
                    .originalPayload(outRecord.value())
                    .originalTopic(outRecord.topic().replace(".dlt", ""))
                    .errorMessage(/* from context */)
                    .failedAt(Instant.now())
                    .serviceId("order-service")
                    .build();
            super.publish(new ProducerRecord<>(outRecord.topic(), outRecord.key(), envelope), kafkaTemplate);
        }
    };
}
```

### Message Ordering: Partition Key Strategy

Ordering is guaranteed **within a partition**, not across partitions. To ensure all events for a given work order arrive in order:

```java
// BAD: round-robin partitioning loses ordering
kafkaTemplate.send("work-orders-v1", event);

// GOOD: use the entity ID as partition key
kafkaTemplate.send("work-orders-v1", workOrder.getId(), event);
// All events for workOrder.getId() = "WO-001" always land on the same partition
```

**Partition key strategies in TML:**
- Work orders: `workOrderId`
- Material master: `materialCode + "_" + plantCode`
- Machine events: `machineId`

This means: "for a given entity, events are always processed in the order they were produced."

---

## In the TML Codebase

### Topic Naming Convention

```
{domain}-{entity}-{action}-v{version}

Examples:
  material-master-updated-v1
  work-order-created-v1
  work-order-status-changed-v2
  machine-telemetry-received-v1
  sap-rfc-response-received-v1
```

The `v{version}` suffix allows schema evolution — a breaking change creates a new topic version while the old version continues until all consumers migrate.

### Cross-Service Topic Map

```
ep-sap-connector
  PRODUCES:
    material-master-updated-v1    →  ep-production-broadcast (CONSUMES)
    work-order-created-v1         →  ep-production-broadcast (CONSUMES)
    sap-rfc-response-received-v1  →  ep-sap-connector itself (Kafka Streams bridge)

ep-production-broadcast
  PRODUCES:
    adherence-report-sent-v1      →  ep-analytics (CONSUMES)

ep-machine-integration
  PRODUCES:
    machine-telemetry-received-v1 →  ep-production-broadcast (CONSUMES)
```

### Single-Threaded Consumers (concurrency=1)

All TML consumers run with `concurrency=1`:

```yaml
spring:
  kafka:
    listener:
      concurrency: 1
```

**Rationale:** a single topic partition is assigned to this pod. Running multiple threads on the same partition would create race conditions on offset commits. Horizontal scaling is achieved by increasing pod replicas (each pod = one consumer group member = one partition). This keeps reasoning about ordering simple.

### MDC Correlation ID Propagation

```java
@KafkaListener(topics = "work-orders-v1", groupId = "production-broadcast")
public void onWorkOrder(@Payload WorkOrderEvent event,
                        @Headers MessageHeaders headers) {
    // Extract correlation ID from Kafka header, set in MDC before any logging
    String correlationId = extractHeader(headers, "X-Correlation-ID")
            .orElseGet(() -> UUID.randomUUID().toString());
    MDC.put("correlationId", correlationId);
    try {
        workOrderHandler.handle(event);
    } finally {
        MDC.clear();
    }
}
```

### ep-sap-connector Kafka Streams Bridge

`ep-sap-connector` uses Kafka Streams to bridge SAP RFC calls asynchronously:

1. Kafka Streams consumes `sap-rfc-request-v1`
2. For each message, performs a synchronous SAP RFC call (JCo)
3. Publishes the response to `sap-rfc-response-v1`
4. Callers consume `sap-rfc-response-v1` to correlate responses

This pattern keeps the SAP JCo connection pool within a single service while allowing any service to trigger SAP RFC calls via Kafka.

### Infrastructure

- **IPMS4 cluster**: AMQ Streams Operator (Red Hat), Kafka 3.5, 3 brokers, persistent EBS volumes
- **MES4 cluster**: Community Kafka (Strimzi), Kafka 3.3, 3 brokers
- **Local dev**: `docker-compose-tools.yml` — single-broker Kafka + ZooKeeper on port 9092

---

## Quick Reference

### Spring Kafka Annotations

| Annotation | Purpose |
|---|---|
| `@EnableKafka` | Enable Kafka listener infrastructure (class-level) |
| `@KafkaListener(topics=, groupId=)` | Declare a consumer method |
| `@Payload` | Bind method param to deserialized message value |
| `@Header(KafkaHeaders.OFFSET)` | Bind message offset |
| `@Header(KafkaHeaders.RECEIVED_PARTITION)` | Bind partition number |
| `@RetryableTopic(attempts=)` | Automatic retry with backoff + DLT routing |
| `@DltHandler` | Handle messages that exhausted retries |

### KafkaTemplate Send Patterns

```java
// Fire-and-forget (returns CompletableFuture)
kafkaTemplate.send(topic, key, value);

// Wait for broker acknowledgement (blocks)
kafkaTemplate.send(topic, key, value).get(5, SECONDS);

// With callback
kafkaTemplate.send(topic, key, value).whenComplete((result, ex) -> { ... });

// With headers (ProducerRecord)
ProducerRecord<String, V> record = new ProducerRecord<>(topic, null, key, value);
record.headers().add("header-name", value.getBytes());
kafkaTemplate.send(record);
```

### Topic Naming Template

```
{domain}-{entity}-{action}-v{version}
```

### Consumer Config Properties Reference

| Property | Recommended Value | Why |
|---|---|---|
| `enable.auto.commit` | `false` | Manual control over offset commits |
| `auto.offset.reset` | `latest` | Don't replay history on new consumer group |
| `max.poll.records` | `10` | Limit batch size for predictable processing time |
| `concurrency` | `1` | Ordering guarantee; scale via pod replicas |
| `ack-mode` | `manual_immediate` | Commit after each message |
| `replication.factor` | `3` | Survive 1 broker failure in production |
