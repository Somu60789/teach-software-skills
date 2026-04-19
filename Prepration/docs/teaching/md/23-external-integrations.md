# 23 — External Integrations (SAP, IoT, Freight Tiger)

## 1. Prerequisites

Before working through this document you should be comfortable with:

- **Spring Boot (02)** — dependency injection, `@Service`, `@Configuration`, `@Value`, exception handling
- **Kafka (09)** — producers, consumers, `@KafkaListener`, topic design, message headers

Understanding the basics of TCP/IP networking (ports, protocols, timeouts) will also help in the advanced sections.

---

## 2. What & Why

TML's manufacturing platform is valuable not because it stores data, but because it connects systems that could not previously talk to each other. Three categories of external system dominate:

**SAP ERP** — the system of record for all material masters, stock levels, production orders, and vendor data. SAP uses RFC (Remote Function Call), a proprietary RPC protocol that predates REST by a decade. Every stock level displayed in TML's portals ultimately comes from a SAP RFC call. The JCo (Java Connector) library is the official bridge between JVM services and SAP.

**IoT shop-floor machines** — CNC machines, welding robots, and assembly line sensors publish temperature, cycle time, and error codes over MQTT. MQTT is the standard messaging protocol for constrained IoT devices: it is lightweight, runs over TCP, and supports publish/subscribe with configurable quality-of-service guarantees. TML uses AWS IoT Core as the MQTT broker for all machine telemetry.

**Freight Tiger** — the third-party logistics platform that tracks truck movements for inbound material delivery and outbound dispatch. Integration is a standard REST API: TML creates a trip when a truck departs and closes the trip when the truck arrives. OkHttp3 is the HTTP client used for these calls.

These integrations are not peripheral features — they are the core value of the platform. Understanding how they work is essential for any engineer touching production, replenishment, or logistics services.

---

## 3. Core Concepts

**RFC (Remote Function Call)** is SAP's proprietary RPC mechanism. An RFC call is a named function exposed by SAP (e.g. `ZPPRFC_MES_MARDSTOCK`) that accepts typed import parameters and returns typed export parameters and tables. The JCo library handles serialisation, authentication, and connection pooling. JCo requires JDK 11 because the `sapjco3` native library was compiled against JDK 11 APIs and is not compatible with JDK 17+.

**MQTT** is a publish/subscribe protocol designed for constrained devices. A broker (Mosquitto or AWS IoT Core) routes messages between publishers and subscribers. Topics are hierarchical strings: `machines/1001/weld-01/temperature`. Subscribers use wildcard `+` (single level) and `#` (multi-level) to receive messages from multiple topics.

**REST integration patterns** for external APIs:
- **Retry** — automatically retry failed requests with exponential backoff (network hiccups)
- **Circuit breaker** — stop calling a service that is consistently failing (prevent cascade failures)
- **Timeout** — never wait forever; set connect timeout and read timeout on every client

**Rate limiting for legacy systems** — SAP is a shared production system. Hammering it with concurrent RFC calls degrades performance for the SAP GUI users. TML enforces a minimum 120-minute interval between RFC calls for the same plant+BU combination, and limits batch size to 500 materials per call.

---

## 4. Installation & Setup

### SAP JCo

SAP JCo is not available on Maven Central (licensing restrictions). The `sapjco3.jar` and the native library (`libsapjco3.so` on Linux) are deployed as local file dependencies:

```kotlin
// build.gradle.kts
dependencies {
    implementation(files("libs/sapjco3.jar"))
}
```

**Critical**: JDK 11 must be used for any service that loads `sapjco3`. The native library will crash with `UnsatisfiedLinkError` on JDK 17+. Every SAP-connected service explicitly sets `java.toolchain.languageVersion = JavaLanguageVersion.of(11)`.

### MQTT local testing with Mosquitto

```bash
# Start a local MQTT broker on default port 1883
docker run -d -p 1883:1883 -p 9001:9001 \
  -v $(pwd)/mosquitto.conf:/mosquitto/config/mosquitto.conf \
  eclipse-mosquitto

# Subscribe to a topic (in one terminal)
mosquitto_sub -h localhost -p 1883 -t "machines/+/temperature"

# Publish a test message (in another terminal)
mosquitto_pub -h localhost -p 1883 -t "machines/1001/weld-01/temperature" \
  -m '{"value": 72.5, "unit": "celsius", "timestamp": "2026-04-19T10:00:00Z"}'
```

### OkHttp3

```kotlin
// build.gradle.kts
dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
}
```

---

## 5. Beginner

### OkHttp3 REST client

```java
@Component
public class FreightTigerClient {

    private static final MediaType JSON = MediaType.get("application/json");
    private final OkHttpClient client;
    private final String apiKey;
    private final String baseUrl;

    public FreightTigerClient(
            @Value("${freight-tiger.api-key}") String apiKey,
            @Value("${freight-tiger.base-url}") String baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;

        this.client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .addInterceptor(new HttpLoggingInterceptor()
                .setLevel(HttpLoggingInterceptor.Level.BASIC))
            .build();
    }

    public TripResponse createTrip(TripRequest request) {
        String json = objectMapper.writeValueAsString(request);

        Request httpRequest = new Request.Builder()
            .url(baseUrl + "/api/trips")
            .addHeader("Authorization", "Bearer " + apiKey)
            .addHeader("Accept", "application/json")
            .post(RequestBody.create(json, JSON))
            .build();

        try (Response response = client.newCall(httpRequest).execute()) {
            if (!response.isSuccessful()) {
                throw new FreightTigerException(
                    "Trip creation failed: " + response.code());
            }
            String body = response.body().string();
            return objectMapper.readValue(body, TripResponse.class);
        } catch (IOException e) {
            throw new FreightTigerException("HTTP call failed", e);
        }
    }

    public void closeTrip(String tripId) {
        Request request = new Request.Builder()
            .url(baseUrl + "/api/trips/" + tripId + "/close")
            .addHeader("Authorization", "Bearer " + apiKey)
            .post(RequestBody.create("{}", JSON))
            .build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new FreightTigerException(
                    "Trip close failed for " + tripId + ": " + response.code());
            }
        } catch (IOException e) {
            throw new FreightTigerException("HTTP call failed", e);
        }
    }
}
```

### Ktor Client (Kotlin)

```kotlin
val client = HttpClient(CIO) {
    install(ContentNegotiation) {
        json(Json { ignoreUnknownKeys = true })
    }
    install(HttpTimeout) {
        connectTimeoutMillis = 10_000
        requestTimeoutMillis = 30_000
    }
}

suspend fun createTrip(request: TripRequest): TripResponse {
    return client.post("${baseUrl}/api/trips") {
        bearerAuth(apiKey)
        contentType(ContentType.Application.Json)
        setBody(request)
    }.body()
}
```

### MQTT subscribe — basic machine sensor listener

```java
@Component
public class MachineSensorListener implements MqttCallback {

    private final MqttClient mqttClient;

    @PostConstruct
    void connect() throws MqttException {
        MqttConnectOptions options = new MqttConnectOptions();
        options.setCleanSession(true);
        options.setAutomaticReconnect(true);
        options.setKeepAliveInterval(60); // seconds

        mqttClient.connect(options);
        // Subscribe to all sensors for all machines — '+' is single-level wildcard
        mqttClient.subscribe("machines/+/+/temperature", 1);
        mqttClient.setCallback(this);
    }

    @Override
    public void messageArrived(String topic, MqttMessage message) {
        String payload = new String(message.getPayload(), StandardCharsets.UTF_8);
        log.info("Message on {}: {}", topic, payload);
        // Parse topic: machines/{plant}/{machineId}/temperature
        String[] parts = topic.split("/");
        String plantCode = parts[1];
        String machineId = parts[2];
        processSensorReading(plantCode, machineId, payload);
    }

    @Override
    public void connectionLost(Throwable cause) {
        log.error("MQTT connection lost", cause);
        // automaticReconnect=true handles reconnection
    }

    @Override
    public void deliveryComplete(IMqttDeliveryToken token) {
        // Called when a QoS 1 or 2 publish is acknowledged
    }
}
```

---

## 6. Intermediate

### SAP JCo RFC call

```java
@Component
public class SapStockClient {

    private static final String DESTINATION = "SAP_CVBU";
    private static final String RFC_NAME = "ZPPRFC_MES_MARDSTOCK";

    public List<StockLevel> getStockLevels(String plantCode, List<String> materialCodes)
            throws JCoException {

        JCoDestination destination = JCoDestinationManager.getDestination(DESTINATION);
        JCoFunction function = destination.getRepository().getFunction(RFC_NAME);

        if (function == null) {
            throw new SapException("RFC function " + RFC_NAME + " not found in SAP");
        }

        // Set import parameters
        function.getImportParameterList().setValue("WERKS", plantCode);
        function.getImportParameterList().setValue("BUDAT", LocalDate.now().toString());

        // Populate the input table with material codes
        JCoTable matnrTable = function.getTableParameterList().getTable("IT_MATNR");
        for (String matnr : materialCodes) {
            matnrTable.appendRow();
            matnrTable.setValue("MATNR", matnr);
        }

        // Execute the RFC call
        function.execute(destination);

        // Read the output table
        JCoTable stockTable = function.getTableParameterList().getTable("ET_STOCK");
        List<StockLevel> result = new ArrayList<>();

        for (int i = 0; i < stockTable.getNumRows(); i++) {
            stockTable.setRow(i);
            result.add(new StockLevel(
                stockTable.getString("MATNR"),
                stockTable.getString("WERKS"),
                stockTable.getBigDecimal("LABST"),  // unrestricted stock
                stockTable.getBigDecimal("INSME")   // quality inspection stock
            ));
        }

        return result;
    }
}
```

### JCo destination properties file

```properties
# sapjco/SAP_CVBU.jcoDestination
# File name must match the destination name passed to JCoDestinationManager.getDestination()

jco.client.ashost=sap-01.tml.com
jco.client.sysnr=00
jco.client.client=100
jco.client.user=MES_RFC_USER
jco.client.passwd=<loaded from Secrets Manager at runtime>
jco.client.lang=EN
jco.destination.pool_capacity=5
jco.destination.peak_limit=20
jco.destination.expiration_time=60000
```

The password is never stored in the properties file. The `SapDestinationDataProvider` implementation reads credentials from AWS Secrets Manager and injects them at runtime.

### AWS IoT Device SDK MQTT with TLS certificates

```java
@Configuration
public class AwsIotMqttConfig {

    @Value("${aws.iot.endpoint}")
    private String endpoint;

    @Value("${aws.iot.client-id}")
    private String clientId;

    @Bean
    public AWSIotMqttClient mqttClient() throws Exception {
        // Certificates are stored in classpath or loaded from Secrets Manager
        String certPath = "/etc/iot/device-cert.pem";
        String keyPath  = "/etc/iot/device-key.pem";

        AWSIotMqttClient client = new AWSIotMqttClient(endpoint, clientId, keyPath, certPath);
        client.setCleanSession(false);
        client.setMaxConnectionRetries(5);

        client.connect();
        return client;
    }
}

@Component
public class MachineDataSubscriber extends AWSIotTopic {

    public MachineDataSubscriber() {
        // Subscribe to all machine data for all plants
        super("machines/#", AWSIotQos.QOS1);
    }

    @Override
    public void onMessage(AWSIotMessage message) {
        String topic = message.getTopic();
        String payload = message.getStringPayload();

        // Route to appropriate handler based on topic structure
        // machines/{plant}/{machineId}/{sensorType}
        MachineMessage msg = MachineMessage.parse(topic, payload);
        machineDataService.ingest(msg);
    }
}
```

### Freight Tiger trip lifecycle

```java
@Service
@Slf4j
public class FreightTigerService {

    private final FreightTigerClient client;
    private final TripRepository tripRepository;

    @Transactional
    public void startTrip(DispatchEvent event) {
        TripRequest request = TripRequest.builder()
            .source(event.getSourcePlant())
            .destination(event.getDestinationPlant())
            .vehicleNumber(event.getTruckNumber())
            .materialCode(event.getMaterialCode())
            .quantity(event.getQuantity())
            .build();

        TripResponse response = client.createTrip(request);

        // Persist the trip ID for later closure
        Trip trip = Trip.builder()
            .freightTigerTripId(response.getTripId())
            .dispatchId(event.getDispatchId())
            .status(TripStatus.IN_TRANSIT)
            .startedAt(Instant.now())
            .build();

        tripRepository.save(trip);
        log.info("Freight Tiger trip {} created for dispatch {}",
            response.getTripId(), event.getDispatchId());
    }

    @Transactional
    public void completeTrip(String dispatchId) {
        Trip trip = tripRepository.findByDispatchId(dispatchId)
            .orElseThrow(() -> new NotFoundException("Trip not found: " + dispatchId));

        client.closeTrip(trip.getFreightTigerTripId());
        trip.setStatus(TripStatus.COMPLETED);
        trip.setCompletedAt(Instant.now());
        tripRepository.save(trip);
    }
}
```

---

## 7. Advanced

### SAP rate limiting with scheduled enforcement

```java
@Component
@Slf4j
public class SapRateLimiter {

    // Key: "plantCode:buCode", Value: timestamp of last call
    private final ConcurrentHashMap<String, AtomicLong> lastCallTime = new ConcurrentHashMap<>();
    private static final long MIN_INTERVAL_MS = 120 * 60 * 1000L; // 120 minutes
    public  static final int  MAX_BATCH_SIZE  = 500;

    public boolean isCallAllowed(String plantCode, String buCode) {
        String key = plantCode + ":" + buCode;
        long now = System.currentTimeMillis();
        AtomicLong last = lastCallTime.computeIfAbsent(key, k -> new AtomicLong(0));

        if (now - last.get() < MIN_INTERVAL_MS) {
            long minutesUntilNext = (MIN_INTERVAL_MS - (now - last.get())) / 60000;
            log.warn("SAP rate limit active for {}. Next call in {} minutes", key, minutesUntilNext);
            return false;
        }

        last.set(now);
        return true;
    }

    public <T> List<List<T>> partition(List<T> items) {
        List<List<T>> batches = new ArrayList<>();
        for (int i = 0; i < items.size(); i += MAX_BATCH_SIZE) {
            batches.add(items.subList(i, Math.min(i + MAX_BATCH_SIZE, items.size())));
        }
        return batches;
    }
}
```

### Kafka-to-SAP bridge pattern (ep-sap-connector)

```java
@Component
@Slf4j
public class SapConnectorListener {

    private final SapStockClient sapClient;
    private final SapRateLimiter rateLimiter;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "sap-stock-requests", groupId = "sap-connector")
    public void handleStockRequest(
            @Payload String message,
            @Header(KafkaHeaders.RECEIVED_KEY) String key) {

        try {
            StockRequest request = objectMapper.readValue(message, StockRequest.class);

            if (!rateLimiter.isCallAllowed(request.getPlantCode(), request.getBuCode())) {
                // Publish rejection so the caller knows to retry later
                publishError(key, request.getCorrelationId(), "RATE_LIMITED");
                return;
            }

            // Partition materials into batches of max 500
            List<List<String>> batches = rateLimiter.partition(request.getMaterialCodes());
            List<StockLevel> allLevels = new ArrayList<>();

            for (List<String> batch : batches) {
                allLevels.addAll(sapClient.getStockLevels(request.getPlantCode(), batch));
            }

            // Publish response to reply topic
            StockResponse response = StockResponse.builder()
                .correlationId(request.getCorrelationId())
                .plantCode(request.getPlantCode())
                .stockLevels(allLevels)
                .fetchedAt(Instant.now())
                .build();

            kafkaTemplate.send("sap-stock-responses", key,
                objectMapper.writeValueAsString(response));

        } catch (JCoException e) {
            log.error("SAP RFC call failed for key {}", key, e);
            publishError(key, extractCorrelationId(message), "RFC_ERROR: " + e.getKey());
        }
    }

    private void publishError(String key, String correlationId, String reason) {
        ErrorResponse error = new ErrorResponse(correlationId, reason, Instant.now());
        kafkaTemplate.send("sap-stock-responses", key,
            objectMapper.writeValueAsString(error));
    }
}
```

### BU-specific SAP connection configuration

```java
@ConfigurationProperties(prefix = "sap")
@Configuration
@Validated
public class SapConnectionConfig {

    private Map<String, SapConnectionProperties> connections = new HashMap<>();

    public SapConnectionProperties getConnectionFor(String buCode) {
        SapConnectionProperties props = connections.get(buCode);
        if (props == null) {
            throw new ConfigurationException("No SAP connection configured for BU: " + buCode);
        }
        return props;
    }

    @Data
    public static class SapConnectionProperties {
        @NotBlank private String host;
        @NotNull  private Integer systemNumber;
        @NotBlank private String client;
        @NotBlank private String destinationName;
    }
}
```

```yaml
# application.yaml
sap:
  connections:
    "5101":   # CVBU
      host: sap-01.tml.com
      system-number: 0
      client: "100"
      destination-name: SAP_CVBU
    "5201":   # PVBU
      host: sap-02.tml.com
      system-number: 0
      client: "200"
      destination-name: SAP_PVBU
    "5301":   # EVBU
      host: sap-03.tml.com
      system-number: 0
      client: "300"
      destination-name: SAP_EVBU
```

### JCo exception handling

```java
try {
    function.execute(destination);
} catch (JCoException e) {
    switch (e.getGroup()) {
        case JCoException.JCO_ERROR_COMMUNICATION:
            // Network failure — safe to retry after delay
            throw new SapCommunicationException("SAP unreachable", e);

        case JCoException.JCO_ERROR_SYSTEM_FAILURE:
            // SAP system error — may or may not be transient
            log.error("SAP system failure, key={}, message={}", e.getKey(), e.getMessage());
            throw new SapSystemException("SAP returned system error: " + e.getKey(), e);

        case JCoException.JCO_ERROR_APPLICATION_EXCEPTION:
            // Business logic error from ABAP function — not retriable
            String abapMessage = function.getExceptionList().getString(0);
            throw new SapBusinessException("ABAP exception: " + abapMessage);

        default:
            throw new SapException("Unexpected JCo error group: " + e.getGroup(), e);
    }
}
```

---

## 8. Expert

### SAP JCo connection pool tuning

```properties
# For a service that makes infrequent batch calls:
jco.destination.pool_capacity=3        # idle connections kept open
jco.destination.peak_limit=10          # maximum concurrent connections
jco.destination.max_get_client_time=60000  # wait up to 60s for a connection from the pool

# For a service with high throughput:
jco.destination.pool_capacity=10
jco.destination.peak_limit=30
jco.destination.expiration_time=300000  # idle connections expire after 5 min
```

### MQTT QoS levels

| QoS | Guarantee | Use case |
|---|---|---|
| 0 — At most once | Fire and forget. Message may be lost if broker or client crashes. | High-frequency sensor readings where a missed point does not matter (temperature every second) |
| 1 — At least once | Message delivered at least once. Duplicates possible. Receiver must be idempotent. | Machine alarms, cycle count events — must not be lost, tolerate duplicates |
| 2 — Exactly once | Four-way handshake ensures exactly one delivery. Slowest. | Financial transactions, production count records — must not be duplicated or lost |

TML uses QoS 1 for machine sensor data (idempotent upsert at ingest) and QoS 2 for production count events where double-counting would corrupt KPI metrics.

### Certificate management for AWS IoT Core

```bash
# Rotate a device certificate (run in ep-machine-integration/scripts/)
aws iot create-keys-and-certificate \
  --set-as-active \
  --certificate-pem-outfile new-cert.pem \
  --public-key-outfile new-public.key \
  --private-key-outfile new-private.key

# Attach the existing policy to the new certificate
aws iot attach-policy \
  --policy-name TML-MachineIntegration-Policy \
  --target <new-certificate-arn>

# Deactivate the old certificate after confirming the new one works
aws iot update-certificate \
  --certificate-id <old-cert-id> \
  --new-status INACTIVE
```

### Resilience4j circuit breaker for SAP calls

```java
@Service
public class ResilientSapClient {

    private final SapStockClient sapClient;

    @CircuitBreaker(name = "sap", fallbackMethod = "getStockLevelsFallback")
    @Retry(name = "sap")
    @TimeLimiter(name = "sap")
    public CompletableFuture<List<StockLevel>> getStockLevelsAsync(
            String plantCode, List<String> materials) {
        return CompletableFuture.supplyAsync(() ->
            sapClient.getStockLevels(plantCode, materials));
    }

    // Fallback — return cached levels or empty list when SAP is unavailable
    public CompletableFuture<List<StockLevel>> getStockLevelsFallback(
            String plantCode, List<String> materials, Exception ex) {
        log.warn("SAP unavailable for plant {}, using cached data", plantCode, ex);
        return CompletableFuture.completedFuture(
            stockCacheService.getCachedLevels(plantCode, materials));
    }
}
```

```yaml
# application.yaml
resilience4j:
  circuitbreaker:
    instances:
      sap:
        slidingWindowSize: 10
        failureRateThreshold: 50        # open after 5/10 failures
        waitDurationInOpenState: 120s   # matches SAP rate limit interval
        permittedNumberOfCallsInHalfOpenState: 3
  retry:
    instances:
      sap:
        maxAttempts: 2
        waitDuration: 5s
  timelimiter:
    instances:
      sap:
        timeoutDuration: 45s
```

---

## 9. In the TML Codebase

### ep-sap-connector — architecture summary

The SAP connector is a standalone Spring Boot service (not a library). Other services that need SAP data publish a request to the `sap-stock-requests` Kafka topic and listen on `sap-stock-responses` for the reply. The connector owns the JCo dependency and is the only service that communicates directly with SAP.

**JDK 11 is mandatory** — the connector's `build.gradle.kts` explicitly declares `java.toolchain.languageVersion = JavaLanguageVersion.of(11)`. Do not upgrade this service to JDK 17 without first verifying that a JDK-17-compatible version of the `sapjco3` native library is available.

**RFC function**: `ZPPRFC_MES_MARDSTOCK` — custom-developed RFC in SAP that returns unrestricted stock, quality inspection stock, and blocked stock for a list of material codes at a given plant and business unit.

**Rate limiting**: a minimum 120-minute interval between calls for the same plant+BU combination. Maximum 500 materials per RFC call. If the request contains more than 500 materials, the connector automatically splits it into multiple sequential RFC calls.

### ep-machine-integration — architecture summary

This service subscribes to AWS IoT Core MQTT topics using the AWS IoT Device SDK. Topic pattern: `machines/{plant}/{machine-id}/{sensor-type}`.

Raw sensor payloads are written to S3 immediately (no transformation) for audit and replay. Cleaned and validated sensor data is then published to a Kafka topic for downstream services (KPI calculation, alert detection).

### Freight Tiger in ep-production-broadcast

OkHttp3 is used for all Freight Tiger API calls. Credentials come from `application.yaml` (`freight-tiger.api-key`). The key is injected from AWS Secrets Manager via Kubernetes External Secrets Operator at runtime — it is never hardcoded.

Trip creation happens synchronously during the dispatch event processing flow. If Freight Tiger is unavailable, the dispatch is still recorded internally and Freight Tiger trip creation is retried up to 3 times with 5-second backoff.

### BU to SAP host mapping

| BU Code | BU Name | SAP Host | SAP Client |
|---|---|---|---|
| 5101 | CVBU (Commercial Vehicles) | sap-01.tml.com:3300 | 100 |
| 5201 | PVBU (Passenger Vehicles) | sap-02.tml.com:3300 | 200 |
| 5301 | EVBU (Electric Vehicles) | sap-03.tml.com:3300 | 300 |

---

## 10. Quick Reference

### SAP JCo destination properties reference

| Property | Description | Example value |
|---|---|---|
| `jco.client.ashost` | SAP application server hostname | `sap-01.tml.com` |
| `jco.client.sysnr` | SAP system number (two digits) | `00` |
| `jco.client.client` | SAP client (three digits) | `100` |
| `jco.client.user` | RFC user name | `MES_RFC_USER` |
| `jco.client.passwd` | RFC user password (load at runtime) | — |
| `jco.client.lang` | Logon language | `EN` |
| `jco.destination.pool_capacity` | Idle connections kept open | `5` |
| `jco.destination.peak_limit` | Maximum concurrent connections | `20` |
| `jco.destination.max_get_client_time` | Wait time for pooled connection (ms) | `60000` |

### MQTT QoS comparison

| QoS | Delivery guarantee | Latency | Use when |
|---|---|---|---|
| 0 | At most once | Lowest | High-frequency, loss-tolerant readings |
| 1 | At least once | Medium | Critical events; receiver must be idempotent |
| 2 | Exactly once | Highest | Financial or count data that must not duplicate |

### OkHttp3 client template

```java
OkHttpClient client = new OkHttpClient.Builder()
    .connectTimeout(10, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .writeTimeout(15, TimeUnit.SECONDS)
    .build();

Request request = new Request.Builder()
    .url(baseUrl + "/path")
    .addHeader("Authorization", "Bearer " + token)
    .post(RequestBody.create(json, MediaType.get("application/json")))
    .build();

try (Response response = client.newCall(request).execute()) {
    if (!response.isSuccessful()) throw new RuntimeException("HTTP " + response.code());
    return objectMapper.readValue(response.body().string(), ResponseType.class);
}
```

### JCo function call template

```java
JCoDestination dest = JCoDestinationManager.getDestination("SAP_DEST");
JCoFunction fn = dest.getRepository().getFunction("RFC_FUNCTION_NAME");
fn.getImportParameterList().setValue("PARAM_NAME", value);

JCoTable inputTable = fn.getTableParameterList().getTable("IT_TABLE");
inputTable.appendRow();
inputTable.setValue("FIELD", value);

fn.execute(dest);

JCoTable outputTable = fn.getTableParameterList().getTable("ET_TABLE");
for (int i = 0; i < outputTable.getNumRows(); i++) {
    outputTable.setRow(i);
    String value = outputTable.getString("FIELD_NAME");
}
```
