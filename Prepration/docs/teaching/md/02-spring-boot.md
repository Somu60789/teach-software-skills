# Spring Boot (Java)

## Prerequisites

Before working with Spring Boot at an expert level, you need a solid foundation in core Java. Here is what each prerequisite is used for:

- **OOP (classes, interfaces, inheritance):** Spring is built entirely on object-oriented design. Dependency injection relies on interfaces — you inject an `OrderService` interface, not a concrete class. Understanding inheritance is essential when extending `JpaRepository` or overriding security filter chains.
- **Generics:** `JpaRepository<Order, Long>`, `ResponseEntity<OrderDto>`, `List<String>` — generics appear everywhere in Spring APIs. Without them, you cannot read method signatures or write type-safe code.
- **Lambdas and streams:** Spring Data Specifications, `Optional.map()`, event listeners, and async callbacks all use functional interfaces. You will write `orders.stream().filter(...).map(...).collect(...)` constantly.
- **Optional:** Spring Data finder methods return `Optional<T>`. You must know `orElseThrow()`, `map()`, and `ifPresent()` to handle nullable results correctly without null pointer exceptions.

---

## What & Why

### What Spring Boot is

Spring Boot is an opinionated layer on top of the Spring Framework. The Spring Framework itself is a vast dependency injection container with modules for web, data, security, messaging, and more. Spring Boot adds:

- **Auto-configuration:** Based on what is on the classpath, Spring Boot automatically configures beans you would otherwise wire by hand. Add `spring-boot-starter-data-jpa` and Hibernate, a DataSource, and JPA repositories are configured without a single XML file.
- **Embedded server:** Your application ships as a fat JAR containing Tomcat (or Jetty). You run `java -jar app.jar`. No application server, no WAR deployment, no container-managed lifecycle.
- **Convention over configuration:** Sensible defaults everywhere. `spring.datasource.url` auto-configures a `DataSource`. `@SpringBootApplication` triggers component scanning of the package it lives in.
- **Production-ready features:** Actuator provides `/health`, `/metrics`, and `/prometheus` out of the box.

### Why TML uses Spring Boot over Quarkus or Micronaut

| Criterion | Spring Boot | Quarkus | Micronaut |
|---|---|---|---|
| Ecosystem maturity | 15+ years, vast library support | Newer, growing | Newer, growing |
| Team familiarity | High — most Java engineers know it | Requires relearning | Requires relearning |
| Library compatibility | Near-universal (Kafka, AWS SDK, etc.) | Subset with extensions | Subset |
| Community / Stack Overflow | Dominant | Smaller | Smaller |
| GraalVM native | Supported (with caveats) | First-class | First-class |

TML's services use Kafka, Spring Security, Flyway, and custom Spring Data extensions. The Spring ecosystem has battle-tested integrations for all of these. Switching frameworks would rewrite 80% of the codebase for marginal startup-time gains.

---

## Core Concepts

### The IoC Container

Inversion of Control means the framework creates and wires your objects — you do not call `new OrderService()`. You declare what you need; Spring provides it. This is the foundation everything else builds on.

### Stereotype Annotations

Spring scans your packages for classes annotated with these and registers them as beans:

- `@Component` — generic bean, used when none of the others fits
- `@Service` — business logic layer (no technical difference from `@Component`, but communicates intent)
- `@Repository` — data access layer; also enables persistence exception translation
- `@Controller` / `@RestController` — HTTP layer; `@RestController` = `@Controller` + `@ResponseBody`

### Dependency Injection: @Autowired vs Constructor Injection

**Field injection (avoid in production code):**
```java
@Service
public class OrderService {
    @Autowired  // hidden dependency, not testable without Spring context
    private OrderRepository orderRepository;
}
```

**Constructor injection (preferred):**
```java
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final InventoryClient inventoryClient;

    public OrderService(OrderRepository orderRepository, InventoryClient inventoryClient) {
        this.orderRepository = orderRepository;
        this.inventoryClient = inventoryClient;
    }
}
```

Constructor injection is preferred because:
1. Dependencies are explicit and visible in the constructor signature.
2. The fields can be `final`, preventing accidental reassignment.
3. The class is unit-testable with plain `new OrderService(mockRepo, mockClient)` — no Spring context needed.
4. Missing dependencies cause a compile error, not a runtime NPE.

When using Lombok, `@RequiredArgsConstructor` on a class with `final` fields generates the constructor automatically.

### @Bean and @Configuration

Use `@Configuration` classes to define beans that need programmatic setup — third-party classes you cannot annotate, beans with conditional logic, or beans wired from multiple components:

```java
@Configuration
public class KafkaConfig {

    @Bean
    public ProducerFactory<String, OrderEvent> producerFactory(KafkaProperties props) {
        Map<String, Object> config = new HashMap<>(props.buildProducerProperties());
        config.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        return new DefaultKafkaProducerFactory<>(config);
    }

    @Bean
    public KafkaTemplate<String, OrderEvent> kafkaTemplate(
            ProducerFactory<String, OrderEvent> factory) {
        return new KafkaTemplate<>(factory);
    }
}
```

### Auto-configuration Mechanism

When you add a starter to `build.gradle.kts`, Spring Boot scans `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (Spring Boot 3.x) for auto-configuration classes. Each is annotated with `@Conditional*` annotations:

```java
@AutoConfiguration
@ConditionalOnClass(DataSource.class)          // only if driver is on classpath
@ConditionalOnMissingBean(DataSource.class)    // only if you haven't defined your own
@EnableConfigurationProperties(DataSourceProperties.class)
public class DataSourceAutoConfiguration {
    // wires your DataSource from spring.datasource.* properties
}
```

This is why adding `spring-boot-starter-data-jpa` to your build is sufficient to get a fully configured JPA stack.

---

## Installation & Setup

### Spring Initializr

Go to [start.spring.io](https://start.spring.io) and select:
- Project: **Gradle - Kotlin DSL**
- Language: **Java**
- Spring Boot: **3.3.x**
- Packaging: **Jar**
- Java: **21**
- Dependencies: Spring Web, Spring Data JPA, PostgreSQL Driver, Flyway Migration, Spring Boot Actuator, Validation

### build.gradle.kts Structure

```kotlin
plugins {
    id("org.springframework.boot") version "3.3.4"
    id("io.spring.dependency-management") version "1.1.6"
    id("com.diffplug.spotless") version "6.25.0"
    java
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web") {
        exclude(group = "org.springframework.boot", module = "spring-boot-starter-tomcat")
    }
    implementation("org.springframework.boot:spring-boot-starter-jetty")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.flywaydb:flyway-core")
    runtimeOnly("org.postgresql:postgresql")
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly("com.h2database:h2")
}

spotless {
    java {
        googleJavaFormat()
    }
}
```

### Running the Application

```bash
./gradlew bootRun                          # run with default profile
./gradlew bootRun --args='--spring.profiles.active=local'
./gradlew build                            # compile, test, package fat JAR
./gradlew test                             # run all tests
./gradlew test --tests "*.OrderServiceTest" # run a single test class
./gradlew spotlessApply                    # reformat code
```

### Package Structure

```
src/main/java/com/example/app/
├── Application.java          (@SpringBootApplication entry point)
├── config/                   (@Configuration, @Bean, security config)
├── controller/               (@RestController, request/response handling)
├── service/                  (@Service, business logic)
├── repository/               (@Repository, JpaRepository extensions)
├── entity/                   (@Entity JPA models)
├── dto/                      (record DTOs for request/response)
└── exception/                (custom exceptions, @ControllerAdvice)

src/main/resources/
├── application.yaml
└── db/migration/             (Flyway scripts)

src/test/
├── java/com/example/app/
└── resources/application.yaml  (test overrides: H2, no Flyway)
```

---

## Beginner

### REST Controller

```java
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public ResponseEntity<List<OrderDto>> listOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(orderService.findAll(page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderDto> getOrder(@PathVariable Long id) {
        return orderService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<OrderDto> createOrder(@RequestBody @Valid CreateOrderRequest request) {
        OrderDto created = orderService.create(request);
        URI location = URI.create("/api/v1/orders/" + created.id());
        return ResponseEntity.created(location).body(created);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOrder(@PathVariable Long id) {
        orderService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

### DTO as a Java Record

```java
public record OrderDto(
        Long id,
        String customerCode,
        String status,
        BigDecimal totalAmount,
        LocalDateTime createdAt) {}

public record CreateOrderRequest(
        @NotBlank String customerCode,
        @NotEmpty List<OrderLineRequest> lines) {}
```

### Service Layer

```java
@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderMapper orderMapper;

    public OrderService(OrderRepository orderRepository, OrderMapper orderMapper) {
        this.orderRepository = orderRepository;
        this.orderMapper = orderMapper;
    }

    public List<OrderDto> findAll(int page, int size) {
        return orderRepository.findAll(PageRequest.of(page, size))
                .stream()
                .map(orderMapper::toDto)
                .collect(Collectors.toList());
    }

    public Optional<OrderDto> findById(Long id) {
        return orderRepository.findById(id).map(orderMapper::toDto);
    }

    public OrderDto create(CreateOrderRequest request) {
        Order order = orderMapper.toEntity(request);
        order.setStatus(OrderStatus.PENDING);
        return orderMapper.toDto(orderRepository.save(order));
    }

    public void delete(Long id) {
        orderRepository.findById(id).ifPresentOrElse(
                orderRepository::delete,
                () -> { throw new OrderNotFoundException(id); });
    }
}
```

### Entity

```java
@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_code", nullable = false, length = 20)
    private String customerCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status;

    @Column(name = "total_amount", precision = 19, scale = 4)
    private BigDecimal totalAmount;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // getters and setters (or use Lombok @Data / @Getter @Setter)
}
```

### Repository

```java
@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByStatus(OrderStatus status);
    List<Order> findByCustomerCodeAndStatusNot(String customerCode, OrderStatus status);
}
```

---

## Intermediate

### @Transactional

```java
@Service
@Transactional(readOnly = true)  // default for all methods
public class OrderService {

    @Transactional  // overrides to read-write for this method
    public OrderDto fulfill(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new OrderNotFoundException(id));
        order.setStatus(OrderStatus.FULFILLED);
        // no explicit save — dirty checking persists the change on commit
        return orderMapper.toDto(order);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void auditAction(Long orderId, String action) {
        // runs in its own transaction, commits even if caller rolls back
        auditRepository.save(new AuditEntry(orderId, action, Instant.now()));
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public void allocateStock(Long productId, int quantity) {
        // prevents phantom reads — use sparingly, high lock contention
    }
}
```

### @Async with @EnableAsync

```java
@Configuration
@EnableAsync
public class AsyncConfig {
    @Bean(name = "notificationExecutor")
    public Executor notificationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("notification-");
        executor.initialize();
        return executor;
    }
}

@Service
public class NotificationService {
    @Async("notificationExecutor")
    public CompletableFuture<Void> sendEmail(String recipient, String body) {
        // runs in a separate thread from the pool above
        emailClient.send(recipient, body);
        return CompletableFuture.completedFuture(null);
    }
}
```

### @Scheduled Cron Jobs

```java
@Component
@EnableScheduling
public class OrderCleanupJob {

    private final OrderRepository orderRepository;

    public OrderCleanupJob(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Scheduled(cron = "0 0 2 * * *")  // 02:00 every day
    public void archiveExpiredOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(90);
        orderRepository.findByStatusAndCreatedAtBefore(OrderStatus.CANCELLED, cutoff)
                .forEach(this::archiveAndDelete);
    }

    @Scheduled(fixedDelay = 30_000)  // 30s after last run completes
    public void pollPendingWebhooks() { /* ... */ }
}
```

### @ConfigurationProperties

```java
@ConfigurationProperties(prefix = "order-service")
@Validated
public class OrderServiceProperties {
    @NotNull private Duration fulfillmentTimeout;
    @Min(1) @Max(1000) private int maxBatchSize = 100;
    private String defaultCurrency = "USD";
    // getters and setters required (or use Lombok @Data)
}
```

```yaml
# application.yaml
order-service:
  fulfillment-timeout: 30m
  max-batch-size: 200
  default-currency: AUD
```

```java
@Configuration
@EnableConfigurationProperties(OrderServiceProperties.class)
public class AppConfig {}
```

### @Value Injection

```java
@Service
public class FeatureService {
    @Value("${feature-toggle.new-pricing-engine:false}")
    private boolean newPricingEngineEnabled;

    @Value("${app.external-api.base-url}")
    private String apiBaseUrl;
}
```

### Multi-Profile application.yaml

```yaml
# src/main/resources/application.yaml
spring:
  application:
    name: order-service
  profiles:
    active: local
  datasource:
    url: jdbc:postgresql://localhost:5432/orders
    username: orders_user
    password: ${DB_PASSWORD}
  jpa:
    open-in-view: false
    properties:
      hibernate:
        default_schema: public

server:
  port: 9090

management:
  server:
    port: 9096
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus

---
spring:
  config:
    activate:
      on-profile: local
  datasource:
    url: jdbc:postgresql://localhost:5432/orders_local
    password: local_password

---
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    url: ${DB_URL}
    password: ${DB_PASSWORD}
  jpa:
    show-sql: false
```

### Spring Data JPA Queries and Specifications

```java
@Repository
public interface OrderRepository extends JpaRepository<Order, Long>,
        JpaSpecificationExecutor<Order> {

    // JPQL — uses entity field names, not column names
    @Query("SELECT o FROM Order o WHERE o.customerCode = :code AND o.status != 'CANCELLED'")
    List<Order> findActiveByCustomer(@Param("code") String customerCode);

    // Native SQL — uses actual table/column names
    @Query(value = "SELECT * FROM orders WHERE total_amount > :threshold " +
                   "ORDER BY created_at DESC LIMIT :limit",
           nativeQuery = true)
    List<Order> findLargeOrders(@Param("threshold") BigDecimal threshold,
                                @Param("limit") int limit);
}

// Specification for dynamic filtering
public class OrderSpecifications {
    public static Specification<Order> hasStatus(OrderStatus status) {
        return (root, query, cb) ->
                status == null ? cb.conjunction() : cb.equal(root.get("status"), status);
    }

    public static Specification<Order> createdAfter(LocalDateTime date) {
        return (root, query, cb) ->
                date == null ? cb.conjunction() : cb.greaterThan(root.get("createdAt"), date);
    }
}

// Usage in service
Page<Order> results = orderRepository.findAll(
    Specification.where(hasStatus(filter.status()))
                 .and(createdAfter(filter.from())),
    PageRequest.of(page, size, Sort.by("createdAt").descending()));
```

### Flyway Migration

Naming convention: `V{timestamp}_{sequence}__{description}.sql`

```sql
-- src/main/resources/db/migration/V20240101_001__create_orders.sql
CREATE TABLE orders (
    id             BIGSERIAL PRIMARY KEY,
    customer_code  VARCHAR(20) NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_amount   NUMERIC(19, 4),
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_customer_code ON orders (customer_code);
CREATE INDEX idx_orders_status ON orders (status);
```

```sql
-- src/main/resources/db/migration/V20240115_002__add_orders_bu_column.sql
ALTER TABLE orders ADD COLUMN bu_code VARCHAR(10);
UPDATE orders SET bu_code = 'CVBU' WHERE bu_code IS NULL;
ALTER TABLE orders ALTER COLUMN bu_code SET NOT NULL;
```

### Global Error Handling

```java
@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(OrderNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("ORDER_NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("VALIDATION_FAILED", message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}

public record ErrorResponse(String code, String message) {}
```

---

## Advanced

### Spring Security — Stateless JWT

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s ->
                        s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }
        String token = header.substring(7);
        if (jwtService.isValid(token)) {
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(
                            jwtService.extractSubject(token),
                            null,
                            jwtService.extractAuthorities(token));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(request, response);
    }
}
```

### Method-Level Security

```java
@RestController
@RequestMapping("/api/v1/admin/orders")
public class AdminOrderController {

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}/force")
    public ResponseEntity<Void> forceDelete(@PathVariable Long id) {
        orderService.forceDelete(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR') and #buCode == authentication.principal.buCode")
    @GetMapping("/bu/{buCode}")
    public ResponseEntity<List<OrderDto>> getByBu(@PathVariable String buCode) {
        return ResponseEntity.ok(orderService.findByBu(buCode));
    }
}
```

### Actuator and Micrometer

```yaml
management:
  server:
    port: 9096
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus,loggers
  endpoint:
    health:
      show-details: always
  metrics:
    export:
      prometheus:
        enabled: true
```

```java
@Service
public class OrderService {

    private final Counter ordersCreatedCounter;
    private final Timer orderFulfillmentTimer;

    public OrderService(MeterRegistry registry) {
        this.ordersCreatedCounter = Counter.builder("orders.created")
                .description("Total orders created")
                .tag("service", "order-service")
                .register(registry);

        this.orderFulfillmentTimer = Timer.builder("orders.fulfillment.duration")
                .description("Time to fulfill an order")
                .register(registry);
    }

    public OrderDto create(CreateOrderRequest request) {
        OrderDto dto = /* create logic */;
        ordersCreatedCounter.increment();
        return dto;
    }

    public OrderDto fulfill(Long id) {
        return orderFulfillmentTimer.record(() -> {
            // fulfillment logic
            return orderMapper.toDto(orderRepository.save(order));
        });
    }
}
```

### SpringDoc OpenAPI

```java
@Tag(name = "Orders", description = "Order management operations")
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    @Operation(
        summary = "Create a new order",
        description = "Creates an order with PENDING status. Returns 201 with Location header."
    )
    @ApiResponse(responseCode = "201", description = "Order created",
            content = @Content(schema = @Schema(implementation = OrderDto.class)))
    @ApiResponse(responseCode = "400", description = "Validation failed")
    @PostMapping
    public ResponseEntity<OrderDto> createOrder(@RequestBody @Valid CreateOrderRequest request) {
        /* ... */
    }
}

public record OrderDto(
        @Schema(description = "Database-generated order ID", example = "12345")
        Long id,
        @Schema(description = "Customer SAP code", example = "CUST001")
        String customerCode,
        @Schema(description = "Current order status", allowableValues = {"PENDING", "FULFILLED", "CANCELLED"})
        String status) {}
```

### Application Events

```java
// Define the event
public class OrderFulfilledEvent {
    private final Long orderId;
    private final String customerCode;
    public OrderFulfilledEvent(Long orderId, String customerCode) {
        this.orderId = orderId;
        this.customerCode = customerCode;
    }
    public Long getOrderId() { return orderId; }
    public String getCustomerCode() { return customerCode; }
}

// Publish in service
@Service
public class OrderService {
    private final ApplicationEventPublisher eventPublisher;

    public OrderDto fulfill(Long id) {
        Order order = /* fulfill logic */;
        eventPublisher.publishEvent(new OrderFulfilledEvent(order.getId(), order.getCustomerCode()));
        return orderMapper.toDto(order);
    }
}

// Listen in another component
@Component
public class FulfillmentNotificationListener {
    @EventListener
    @Async
    public void onOrderFulfilled(OrderFulfilledEvent event) {
        notificationService.sendFulfillmentEmail(event.getCustomerCode(), event.getOrderId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderFulfilledAfterCommit(OrderFulfilledEvent event) {
        // fires only after the transaction that published the event commits
        kafkaProducer.send("order-fulfilled", event.getOrderId().toString());
    }
}
```

---

## Expert

### Auto-configuration Internals

Spring Boot 3.x reads `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` from every JAR on the classpath. Each listed class is a `@AutoConfiguration` that uses `@Conditional` annotations to decide whether to apply:

```java
@AutoConfiguration
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })
@ConditionalOnMissingBean(type = "io.r2dbc.spi.ConnectionFactory")
@EnableConfigurationProperties(DataSourceProperties.class)
@Import({ DataSourcePoolMetadataProvidersConfiguration.class,
          DataSourceInitializationConfiguration.class })
public class DataSourceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnSingleCandidate(DataSource.class)
    public DataSourceTransactionManager transactionManager(DataSource ds, ...) {
        return new DataSourceTransactionManager(ds);
    }
}
```

Key conditionals:
- `@ConditionalOnClass` — applies only if listed classes are on classpath
- `@ConditionalOnMissingBean` — backs off if you define your own bean of that type
- `@ConditionalOnProperty` — applies only if a property has a specific value
- `@ConditionalOnWebApplication` — applies only in a web context

Writing your own starter: create an auto-configuration class and list it in `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`. Publish as a JAR.

### Startup Time Optimisation

```yaml
# Enable lazy initialisation — beans created on first use, not at startup
spring:
  main:
    lazy-initialization: true
```

**spring-context-indexer:** Add to `build.gradle.kts` to pre-generate a component index, avoiding classpath scanning at runtime:

```kotlin
annotationProcessor("org.springframework:spring-context-indexer")
```

**Component scan exclusions:** If you have large packages that contribute no beans:

```java
@SpringBootApplication(
    excludeAutoConfiguration = {
        DataSourceAutoConfiguration.class,   // if you configure DataSource manually
        SecurityAutoConfiguration.class      // if you use a custom security setup
    },
    scanBasePackages = "com.example.app"    // explicit, not recursive from root
)
public class Application {}
```

### Debugging Slow Context Startup

```bash
./gradlew bootRun --args='--debug' 2>&1 | grep -E "AUTO-CONFIGURATION|Positive|Negative" | head -50
```

The `--debug` flag activates the auto-configuration report printed at startup. It shows which auto-configurations were applied and which were skipped and why. For fine-grained timing:

```bash
./gradlew bootRun --args='--spring.boot.startup.actuator=true'
```

Then `GET http://localhost:9096/actuator/startup` to see a breakdown of startup steps with timings.

### GraalVM Native Image Considerations

Native image compiles your Spring Boot app ahead of time with GraalVM. The result boots in under 100ms. The tradeoffs:

- **Reflection:** Any class loaded via reflection (JPA entity scanning, Jackson deserialization, dynamic proxies) must be declared in `reflect-config.json`. Spring AOT (run during build) generates most of this automatically via `./gradlew nativeCompile`.
- **Proxy config:** JDK proxies used by `@Transactional` and `@Cacheable` require `proxy-config.json` entries.
- **Resources:** Files read via `getResourceAsStream` at runtime must be declared in `resource-config.json`.
- **Build time:** `nativeCompile` takes 3–10 minutes and is memory-intensive (8GB+ RAM recommended).

Add the native build plugin:
```kotlin
plugins {
    id("org.graalvm.buildtools.native") version "0.10.2"
}
```

```bash
./gradlew nativeCompile          # build native binary
./build/native/nativeCompile/app # run it
```

For libraries that do not yet support native image, maintain a `src/main/resources/META-INF/native-image/` directory with hand-written config.

### H2 Test Configuration Pattern

```yaml
# src/test/resources/application.yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    database-platform: org.hibernate.dialect.H2Dialect
    hibernate:
      ddl-auto: create-drop
    show-sql: true
  flyway:
    enabled: false   # let JPA create schema from entities instead

server:
  port: 0   # random port — prevents conflicts when running tests in parallel

management:
  server:
    port: 0
```

For slice tests that only load the web layer:

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {
    @Autowired MockMvc mockMvc;
    @MockBean OrderService orderService;

    @Test
    void createOrder_validRequest_returns201() throws Exception {
        when(orderService.create(any())).thenReturn(new OrderDto(1L, "CUST001", "PENDING", null, null));

        mockMvc.perform(post("/api/v1/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"customerCode":"CUST001","lines":[{"sku":"SKU1","qty":1}]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
    }
}
```

---

## In the TML Codebase

### Jetty Instead of Tomcat

TML services run on Jetty, not the default Tomcat. The exclusion is in every service's `build.gradle.kts`:

```kotlin
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web") {
        exclude(group = "org.springframework.boot", module = "spring-boot-starter-tomcat")
    }
    implementation("org.springframework.boot:spring-boot-starter-jetty")
    // ... rest of dependencies
}
```

Jetty's NIO connector handles the same HTTP workloads with a smaller memory footprint. Operationally, the difference is invisible — Spring Boot's `WebServer` abstraction hides it.

### Git Hooks and Spotless

After cloning a TML repository, you run `./setup.sh`. This script installs the project's git hooks:

```bash
# .githooks/pre-commit (installed by setup.sh)
#!/bin/sh
./gradlew spotlessApply
git add -u   # re-stage files that spotless reformatted
```

Spotless configuration in `build.gradle.kts` enforces Google Java Format across all `.java` files:

```kotlin
spotless {
    java {
        googleJavaFormat()
        removeUnusedImports()
        trimTrailingWhitespace()
        endWithNewline()
    }
}
```

If you skip `./setup.sh`, your commits will not be reformatted and CI will fail the Spotless check.

### Local Dev Infrastructure

```bash
docker-compose -f docker-compose-tools.yml up -d
```

The `docker-compose-tools.yml` at the repo root starts PostgreSQL, Kafka, Zookeeper, and Schema Registry. Each service maps to a well-known local port. This gives you a full integration environment without any cloud account.

### BU Segmentation Pattern

TML's SAP connector serves multiple business units. Each BU has its own SAP system with its own URL and credentials. The configuration is BU-keyed in `application.yaml`:

```yaml
sap-connector:
  bu-specific-connection:
    cvbu:
      url: https://cvbu-sap.internal/api
      username: ${SAP_CVBU_USER}
      password: ${SAP_CVBU_PASSWORD}
    pvbu:
      url: https://pvbu-sap.internal/api
      username: ${SAP_PVBU_USER}
      password: ${SAP_PVBU_PASSWORD}
```

A `@ConfigurationProperties` class maps this into a `Map<String, SapConnectionConfig>` keyed by BU code. Services look up the correct config at runtime using the BU code on the inbound request.

### Feature Toggle Pattern

Features under development are guarded with a boolean property:

```java
@Service
public class DistributionService {

    @Value("${feature-toggle.dsob-distribution-enabled:false}")
    private boolean dsobEnabled;

    public void distribute(Order order) {
        if (dsobEnabled) {
            dsobClient.send(order);
        } else {
            legacyDistributor.send(order);
        }
    }
}
```

The `:false` default ensures the feature is off unless explicitly enabled in the environment's `application.yaml`. Production enables it only after full testing:

```yaml
feature-toggle:
  dsob-distribution-enabled: true
```

### Archive Repository Pattern

Fulfilled or cancelled records older than a retention window are moved to archive tables. The codebase follows a convention of a separate `*ArchiveRepository` per aggregate:

```java
@Repository
public interface OrderArchiveRepository extends JpaRepository<OrderArchive, Long> {
    void deleteByCreatedAtBefore(LocalDateTime cutoff);
}

@Service
@Transactional
public class OrderArchiveService {

    public void archiveOrder(Order order) {
        OrderArchive archive = mapper.toArchive(order);
        archiveRepository.save(archive);
        orderRepository.delete(order);
    }
}
```

The archive entity maps to a separate table (`orders_archive`) with the same columns plus an `archived_at` timestamp. This keeps the hot `orders` table small and query-fast without data loss.

### Test Config: Full Pattern

```yaml
# src/test/resources/application.yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL;NON_KEYWORDS=VALUE
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    database-platform: org.hibernate.dialect.H2Dialect
    hibernate:
      ddl-auto: create-drop
    open-in-view: false
  flyway:
    enabled: false

feature-toggle:
  dsob-distribution-enabled: false

sap-connector:
  bu-specific-connection:
    cvbu:
      url: http://localhost:9999/mock-sap
      username: test
      password: test
```

`@SpringBootTest` loads this file automatically when the `test` profile is not explicitly set, because it is in `src/test/resources` and takes precedence over `src/main/resources`.

---

## Quick Reference

### Common Annotations

| Annotation | Layer | Purpose |
|---|---|---|
| `@SpringBootApplication` | Root | Enables component scan, auto-config, `@Configuration` |
| `@RestController` | Web | `@Controller` + `@ResponseBody` |
| `@RequestMapping` | Web | Base URL for controller |
| `@GetMapping` / `@PostMapping` | Web | HTTP method mappings |
| `@PathVariable` | Web | Extract `{id}` from URL |
| `@RequestParam` | Web | Extract `?page=0` query param |
| `@RequestBody` | Web | Deserialise request body from JSON |
| `@Valid` | Web | Trigger Bean Validation on annotated parameter |
| `@Service` | Service | Business logic bean |
| `@Transactional` | Service | Demarcate transaction boundary |
| `@Async` | Service | Run method in thread pool |
| `@Scheduled` | Service | Cron / fixed-rate scheduling |
| `@Repository` | Data | Data access bean + exception translation |
| `@Entity` | Data | JPA-managed persistent class |
| `@Table` | Data | Override default table name |
| `@Id` / `@GeneratedValue` | Data | Primary key + generation strategy |
| `@Column` | Data | Column name/constraints override |
| `@Configuration` | Config | Source of `@Bean` definitions |
| `@Bean` | Config | Factory method producing a Spring bean |
| `@Value` | Any | Inject single property value |
| `@ConfigurationProperties` | Config | Bind property subtree to POJO |
| `@Profile` | Any | Activate bean only for named profile |
| `@ControllerAdvice` | Web | Global exception handler |
| `@ExceptionHandler` | Web | Handle specific exception type |
| `@PreAuthorize` | Security | SpEL expression access control |
| `@EventListener` | Any | Handle application event |

### Gradle Commands

```bash
./gradlew bootRun                                         # run application
./gradlew bootRun --args='--spring.profiles.active=local' # run with profile
./gradlew build                                           # compile + test + JAR
./gradlew test                                            # run all tests
./gradlew test --tests "com.example.app.OrderServiceTest" # single test class
./gradlew test --tests "*.OrderServiceTest.createOrder*"  # single test method
./gradlew spotlessApply                                   # reformat all Java files
./gradlew spotlessCheck                                   # check formatting (CI)
./gradlew dependencies --configuration runtimeClasspath   # inspect dependency tree
./gradlew nativeCompile                                   # build GraalVM native image
```

### application.yaml Structure Template

```yaml
spring:
  application:
    name: my-service
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: myuser
    password: ${DB_PASSWORD}
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate     # never use create/update in production
  flyway:
    enabled: true
    locations: classpath:db/migration

server:
  port: 9090

management:
  server:
    port: 9096
  endpoints:
    web:
      exposure:
        include: health,metrics,prometheus
  endpoint:
    health:
      show-details: always

logging:
  level:
    root: INFO
    com.example.app: DEBUG
```

### Port Conventions

| Service | Port |
|---|---|
| Application HTTP | 9090 |
| Actuator / management | 9096 |
| PostgreSQL (local) | 5432 |
| Kafka broker (local) | 9092 |
| Zookeeper (local) | 2181 |

### Flyway Naming Convention

```
V{YYYYMMDD}_{sequence}__{description}.sql
V20240101_001__create_orders.sql
V20240115_002__add_bu_column_to_orders.sql
V20240201_001__create_order_lines.sql
```

The double underscore before the description is mandatory. Flyway calculates a checksum of each applied migration — never edit a migration that has already been applied in any environment.
