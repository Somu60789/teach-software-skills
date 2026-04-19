# 20 — Testing

## 1. Prerequisites

Before working through this document you should be comfortable with:

- **React (01)** — component lifecycle, hooks, props/state, JSX
- **Spring Boot (02)** — controllers, services, repositories, dependency injection, JPA entities

You do not need to have written a single test before. This document starts from zero and builds to production-grade test suites.

---

## 2. What & Why

A test suite is the engineering team's safety net. Without it, every change is a gamble: you fix one thing, you may break three others without knowing it until a user reports a defect in production. With a good suite, you get a three-second verdict after every save.

**Confidence in changes** — when 600 tests pass after you refactor an order-routing algorithm, you merge with confidence. When three tests turn red, the suite tells you exactly which behaviours broke before the defect reaches production.

**Catch regressions early** — a regression is when working behaviour stops working. The earlier you catch it, the cheaper it is to fix. Studies consistently show that a defect found by a unit test costs roughly 10x less to fix than one found by a QA tester and 100x less than one found in production.

**TDD discipline (write the test first)** — Test-Driven Development flips the workflow: write a failing test that describes the behaviour you want, then write the minimum code to make it pass, then refactor. The benefit is not just test coverage — TDD forces you to think about the public API before the implementation, which consistently produces simpler, more composable designs.

**The test pyramid** — not all tests are equal. The pyramid describes the ideal distribution:

```
        /\
       /e2e\          slow (minutes), few (dozens)
      /------\
     /integr. \       medium (seconds), moderate (hundreds)
    /------------\
   /  unit tests  \   fast (milliseconds), many (thousands)
  /-----------------\
```

Unit tests are fast because they test a single class or function in isolation, with all dependencies replaced by doubles. Integration tests wire up multiple components — database, message broker, HTTP — to verify they cooperate correctly. End-to-end tests drive the real application through a browser or API client to validate complete user flows.

The implication for daily work: write many unit tests, moderate integration tests, and only a handful of e2e tests. Inverting the pyramid (many slow e2e tests, few unit tests) creates a test suite that takes 40 minutes to run and nobody trusts.

---

## 3. Core Concepts

**Arrange-Act-Assert (AAA)** is the universal structure for a test:

```
// Arrange — set up the data and collaborators
// Act     — call the code under test
// Assert  — verify the outcome
```

Every test you write should have exactly these three phases, ideally separated by blank lines. When a test is hard to structure into AAA, that is a signal the code under test is doing too much.

**Test isolation** means each test starts from a clean slate and cannot affect — or be affected by — any other test. Shared mutable static state, shared database rows, and tests that depend on execution order are the three most common isolation violations. Isolation is what makes individual tests runnable in parallel and in any order.

**Mocking** replaces a real dependency with a controllable substitute. When you test an `OrderService`, you do not want a real database — you want a mock repository that returns exactly the data your test needs and nothing else. The test is now fast, deterministic, and requires no infrastructure.

**Test doubles taxonomy:**
- **Mock** — records interactions; you verify that specific calls were made
- **Stub** — returns canned answers; you do not verify interactions
- **Spy** — wraps a real object but records calls; useful when you want some real behaviour
- **Fake** — a simplified real implementation (e.g. in-memory map instead of database)

**Coverage metrics:**
- **Line coverage** — percentage of source lines executed by tests
- **Branch coverage** — percentage of conditional branches (if/else, ternary) exercised
- **Mutation coverage** — the gold standard: a tool modifies your source code in small ways (mutations) and checks whether your tests catch the change. Surviving mutants indicate tests that pass even when the code is wrong

---

## 4. Installation & Setup

### Java / Kotlin (Gradle)

JUnit 5, Mockito, and AssertJ are included automatically in Spring Boot's test starter. Nothing extra to add for basic testing.

```bash
# Run all tests
./gradlew test

# Run a single test class
./gradlew test --tests "com.tml.controller.OrderControllerTest"

# Run a single test method
./gradlew test --tests "com.tml.controller.OrderControllerTest.shouldReturn201WhenOrderCreated"

# Generate JaCoCo HTML coverage report
# Output: build/reports/jacoco/test/html/index.html
./gradlew jacocoTestReport
```

### React / JavaScript

Create React App and Vite both ship with Jest configured. React Testing Library is included in CRA; add it explicitly for Vite projects.

```bash
# Run all tests in watch mode (default)
npm test

# Run tests once with coverage report
npm test -- --coverage

# Run tests for a specific file
npm test -- --testPathPattern=OrderList

# Run a specific test by name
npm test -- --testNamePattern="should display orders"
```

---

## 5. Beginner

### JUnit 5 basics

```java
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;

class PriceCalculatorTest {

    private PriceCalculator calculator;

    @BeforeEach
    void setUp() {
        // Runs before EACH test method — fresh instance every time
        calculator = new PriceCalculator();
    }

    @AfterEach
    void tearDown() {
        // Runs after each test — release resources if needed
    }

    @Test
    void shouldAddTaxToBasePrice() {
        // Arrange
        double basePrice = 100.0;
        double taxRate = 0.18;

        // Act
        double result = calculator.withTax(basePrice, taxRate);

        // Assert
        assertEquals(118.0, result, 0.001);
    }

    @Test
    void shouldThrowWhenNegativePrice() {
        assertThrows(IllegalArgumentException.class,
            () -> calculator.withTax(-10.0, 0.18));
    }

    @Test
    void shouldReturnOrdersForPlant() {
        // Hamcrest matchers give readable failure messages
        List<String> materials = List.of("MAT-001", "MAT-002", "MAT-003");
        assertThat(materials, hasSize(3));
        assertThat(materials, hasItem("MAT-002"));
        assertThat(materials, not(hasItem("MAT-999")));
    }
}
```

### Jest basics

```javascript
// priceCalculator.test.js
import { withTax, applyDiscount } from '../utils/priceCalculator';

describe('PriceCalculator', () => {
  it('adds tax to base price', () => {
    // Arrange
    const basePrice = 100;
    const taxRate = 0.18;

    // Act
    const result = withTax(basePrice, taxRate);

    // Assert
    expect(result).toBe(118);
  });

  it('throws when price is negative', () => {
    expect(() => withTax(-10, 0.18)).toThrow('Price must be non-negative');
  });

  it('deep-equals a complex object', () => {
    const order = { id: 1, items: [{ sku: 'A1', qty: 2 }] };
    // toBe uses reference equality; toEqual compares structure
    expect(order).toEqual({ id: 1, items: [{ sku: 'A1', qty: 2 }] });
  });
});
```

### React Testing Library

```javascript
// OrderList.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderList } from '../components/OrderList';

describe('OrderList', () => {
  it('renders order rows from props', () => {
    const orders = [
      { id: 1, material: 'MAT-001', quantity: 50 },
      { id: 2, material: 'MAT-002', quantity: 30 },
    ];

    render(<OrderList orders={orders} />);

    // Prefer getByRole — tests accessibility semantics, not implementation detail
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 data rows
    expect(screen.getByText('MAT-001')).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = jest.fn();
    const orders = [{ id: 1, material: 'MAT-001', quantity: 50 }];

    render(<OrderList orders={orders} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('shows loading spinner while fetching', async () => {
    render(<OrderList orders={[]} loading={true} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // waitFor polls until assertion passes or times out
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});
```

### Simple service unit test (Spring)

```java
class MaterialServiceTest {

    // Manual fake — no framework needed for simple cases
    private final MaterialRepository fakeRepo = new FakeMaterialRepository();
    private final MaterialService service = new MaterialService(fakeRepo);

    @Test
    void shouldReturnMaterialByCode() {
        // Act
        Material result = service.findByCode("MAT-001");

        // Assert
        assertNotNull(result);
        assertEquals("MAT-001", result.getCode());
    }

    // Simple in-memory fake — faster and more readable than Mockito for basic cases
    static class FakeMaterialRepository implements MaterialRepository {
        private final Map<String, Material> store = new HashMap<>();

        FakeMaterialRepository() {
            store.put("MAT-001", new Material("MAT-001", "Steel Rod", 100));
        }

        @Override
        public Optional<Material> findByCode(String code) {
            return Optional.ofNullable(store.get(code));
        }
    }
}
```

---

## 6. Intermediate

### Mockito

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepo;

    @Mock
    private InventoryClient inventoryClient;

    @InjectMocks
    private OrderService orderService;

    @Test
    void shouldCreateOrderWhenStockAvailable() {
        // Arrange
        when(inventoryClient.getStock("MAT-001", "1001"))
            .thenReturn(new StockLevel("MAT-001", 200));
        when(orderRepo.save(any(Order.class)))
            .thenAnswer(inv -> {
                Order o = inv.getArgument(0);
                o.setId(42L);
                return o;
            });

        CreateOrderRequest req = new CreateOrderRequest("MAT-001", "1001", 50);

        // Act
        Order result = orderService.createOrder(req);

        // Assert
        assertEquals(42L, result.getId());
        assertEquals(OrderStatus.PENDING, result.getStatus());

        // Verify the repository was called with correct data
        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepo).save(captor.capture());
        assertEquals(50, captor.getValue().getQuantity());
    }

    @Test
    void shouldThrowWhenInsufficientStock() {
        when(inventoryClient.getStock("MAT-001", "1001"))
            .thenReturn(new StockLevel("MAT-001", 10));

        assertThrows(InsufficientStockException.class,
            () -> orderService.createOrder(new CreateOrderRequest("MAT-001", "1001", 50)));

        // Verify the order was never persisted
        verify(orderRepo, never()).save(any());
    }
}
```

### @WebMvcTest — controller layer only

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderService orderService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void shouldReturn201WhenOrderCreated() throws Exception {
        CreateOrderRequest req = new CreateOrderRequest("MAT-001", "1001", 50);
        Order created = new Order(1L, "MAT-001", 50, OrderStatus.PENDING);

        when(orderService.createOrder(any())).thenReturn(created);

        mockMvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.id").value(1L))
            .andExpect(jsonPath("$.status").value("SUCCESS"));
    }

    @Test
    void shouldReturn400WhenQuantityIsZero() throws Exception {
        CreateOrderRequest badReq = new CreateOrderRequest("MAT-001", "1001", 0);

        mockMvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(badReq)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.status").value("ERROR"));
    }
}
```

### @DataJpaTest with H2

```java
@DataJpaTest
class MaterialRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private MaterialRepository materialRepository;

    @Test
    void shouldFindMaterialsByPlantCode() {
        // Arrange — persist directly via EntityManager, bypassing repository layer
        Material m1 = new Material(null, "MAT-001", "Steel Rod", "1001");
        Material m2 = new Material(null, "MAT-002", "Brass Fitting", "1001");
        Material m3 = new Material(null, "MAT-003", "Rubber Seal", "1002");
        entityManager.persist(m1);
        entityManager.persist(m2);
        entityManager.persist(m3);
        entityManager.flush(); // force SQL INSERT before querying

        // Act
        List<Material> result = materialRepository.findByPlantCode("1001");

        // Assert
        assertThat(result, hasSize(2));
        assertThat(result.stream().map(Material::getCode).collect(toList()),
            containsInAnyOrder("MAT-001", "MAT-002"));
    }
}
```

### @SpringBootTest with full context

```java
@SpringBootTest
@AutoConfigureMockMvc
@Transactional // each test method rolls back after completion — no manual cleanup
class OrderIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrderRepository orderRepository;

    @Test
    void shouldPersistOrderToDatabaseOnCreate() throws Exception {
        String json = """
            {"materialCode": "MAT-001", "plantCode": "1001", "quantity": 50}
            """;

        mockMvc.perform(post("/api/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isCreated());

        List<Order> persisted = orderRepository.findAll();
        assertThat(persisted, hasSize(1));
        assertEquals("MAT-001", persisted.get(0).getMaterialCode());
    }
}
```

### WireMock for HTTP stubs

```java
@SpringBootTest
@WireMockTest(httpPort = 8090)
class FreightTigerClientTest {

    @Autowired
    private FreightTigerClient client;

    @Test
    void shouldParseCreatedTripId() {
        // Stub the external HTTP call — no real network traffic
        stubFor(post(urlEqualTo("/api/trips"))
            .willReturn(aResponse()
                .withStatus(201)
                .withHeader("Content-Type", "application/json")
                .withBody("""
                    {"tripId": "FT-99001", "status": "CREATED"}
                    """)));

        TripResponse response = client.createTrip(
            new TripRequest("Delhi", "Mumbai", "TML-001"));

        assertEquals("FT-99001", response.getTripId());
    }
}
```

### @EmbeddedKafka

```java
@SpringBootTest
@EmbeddedKafka(partitions = 1, topics = {"order-events", "order-responses"})
class OrderKafkaListenerTest {

    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    @Autowired
    private OrderResponseCollector responseCollector;

    @Test
    void shouldPublishResponseAfterProcessingOrder() throws Exception {
        String payload = """
            {"orderId": "ORD-001", "action": "CONFIRM"}
            """;

        kafkaTemplate.send("order-events", "ORD-001", payload);

        // Block until listener processes and publishes response (max 5 seconds)
        assertTrue(responseCollector.await(5, TimeUnit.SECONDS));
        assertEquals("CONFIRMED", responseCollector.getLastStatus());
    }
}
```

### MockK (Kotlin)

```kotlin
@ExtendWith(MockKExtension::class)
class InventoryServiceTest {

    @MockK
    lateinit var inventoryRepo: InventoryRepository

    @InjectMockKs
    lateinit var inventoryService: InventoryService

    @Test
    fun `should return zero stock when material not found`() {
        // every{} is MockK's equivalent of Mockito's when().thenReturn()
        every { inventoryRepo.findByMaterialCode("UNKNOWN") } returns Optional.empty()

        val result = inventoryService.getStockLevel("UNKNOWN")

        assertEquals(0, result.quantity)
    }
}

// For suspend (coroutine) functions, use coEvery and coVerify:
class AsyncInventoryServiceTest {

    private val repo = mockk<InventoryRepository>()
    private val service = AsyncInventoryService(repo)

    @Test
    fun `should fetch stock asynchronously`() = runTest {
        coEvery { repo.findByCodeAsync("MAT-001") } returns StockEntity("MAT-001", 150)

        val result = service.getStockAsync("MAT-001")

        assertEquals(150, result.quantity)
        coVerify { repo.findByCodeAsync("MAT-001") }
    }
}
```

---

## 7. Advanced

### Testcontainers — real PostgreSQL in tests

```java
@Testcontainers
@SpringBootTest
class MaterialRepositoryPostgresTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15")
        .withDatabaseName("tml_test")
        .withUsername("tml")
        .withPassword("secret");

    // Inject the container's random port into Spring context before it starts
    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private MaterialRepository materialRepository;

    @Test
    void shouldHandlePostgresSpecificJsonbQueries() {
        Material m = new Material(null, "MAT-001", Map.of("tensile_strength", "500MPa"));
        materialRepository.save(m);

        Optional<Material> found = materialRepository
            .findByAttributeValue("tensile_strength", "500MPa");

        assertTrue(found.isPresent());
    }
}
```

### Kotest FunSpec (Kotlin)

```kotlin
class OrderServiceTest : FunSpec({

    val orderRepo = mockk<OrderRepository>()
    val service = OrderService(orderRepo)

    beforeEach {
        clearMocks(orderRepo)
    }

    test("should create order with PENDING status") {
        val request = CreateOrderRequest("MAT-001", "1001", 50)
        every { orderRepo.save(any()) } answers { firstArg<Order>().copy(id = 1L) }

        val result = service.createOrder(request)

        result.status shouldBe OrderStatus.PENDING
        result.id shouldBe 1L
    }

    test("should throw InsufficientStockException when quantity exceeds available stock") {
        every { orderRepo.save(any()) } throws InsufficientStockException("Not enough stock")

        shouldThrow<InsufficientStockException> {
            service.createOrder(CreateOrderRequest("MAT-001", "1001", 9999))
        }
    }

    context("order validation") {
        test("should reject zero quantity") {
            shouldThrow<IllegalArgumentException> {
                service.createOrder(CreateOrderRequest("MAT-001", "1001", 0))
            }
        }

        test("should reject blank material code") {
            shouldThrow<IllegalArgumentException> {
                service.createOrder(CreateOrderRequest("", "1001", 50))
            }
        }
    }
})
```

### Gatling load test

```scala
class OrderLoadTest extends Simulation {

  val createOrderJson = """{"materialCode":"MAT-001","plantCode":"1001","quantity":50}"""

  val orderScenario = scenario("Create Orders")
    .exec(
      http("Create Order")
        .post("/api/orders")
        .header("Content-Type", "application/json")
        .body(StringBody(createOrderJson))
        .check(status.is(201))
        .check(jsonPath("$.data.id").saveAs("orderId"))
    )
    .pause(100.milliseconds)
    .exec(
      http("Get Order")
        .get("/api/orders/#{orderId}")
        .check(status.is(200))
    )

  setUp(
    orderScenario.inject(
      atOnceUsers(10),
      rampUsers(100).during(30.seconds),
      constantUsersPerSec(50).during(60.seconds)
    )
  ).protocols(
    http.baseUrl("http://localhost:8080")
  ).assertions(
    global.responseTime.p95.lt(500),      // 95th percentile < 500ms
    global.successfulRequests.percent.gt(99.0)
  )
}
```

### Jest module mocking and MSW

```javascript
// __tests__/OrderService.test.js
import { fetchOrders } from '../services/OrderService';

// Replace the entire module before any code imports it
jest.mock('../api/client', () => ({
  get: jest.fn(),
}));

import { get } from '../api/client';

describe('OrderService', () => {
  afterEach(() => jest.clearAllMocks());

  it('transforms snake_case API response to camelCase domain objects', async () => {
    get.mockResolvedValue({
      data: { data: [{ id: 1, material_code: 'MAT-001', qty: 50 }] }
    });

    const orders = await fetchOrders('1001');

    expect(orders[0].materialCode).toBe('MAT-001');
    expect(get).toHaveBeenCalledWith('/api/orders?plantCode=1001');
  });

  it('silences expected console.error in error boundary tests', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // ... code that calls console.error intentionally
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

// MSW (Mock Service Worker) — intercepts fetch/XHR at network level
// src/mocks/handlers.js
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/orders', (req, res, ctx) => {
    const plantCode = req.url.searchParams.get('plantCode');
    return res(
      ctx.status(200),
      ctx.json({
        status: 'SUCCESS',
        data: plantCode === '1001'
          ? [{ id: 1, materialCode: 'MAT-001', quantity: 50 }]
          : [],
      })
    );
  }),

  rest.post('/api/orders', async (req, res, ctx) => {
    const body = await req.json();
    return res(
      ctx.status(201),
      ctx.json({ status: 'SUCCESS', data: { id: 99, ...body } })
    );
  }),
];
```

---

## 8. Expert

### Test design principles

**Test behaviour, not implementation.** Tests should call public APIs and verify observable outcomes — they should not reach into private methods, check internal field values, or assert on the order of private calls. When you test implementation details, refactoring breaks tests even when the behaviour is unchanged. The result is a test suite that makes refactoring harder rather than safer.

**One assertion per test concept.** Each test should have one reason to fail. A test with 15 assertions tells you "something broke" but not which specific behaviour broke. Separate assertions into separate test methods, or use `assertAll()` in JUnit 5 to collect all failures so you see everything at once.

**Prefer real objects over mocks for pure functions.** If a function has no side effects and takes no I/O dependencies, test it with real input and real output. Mocking a `TaxCalculator` that is itself under test defeats the purpose. Reserve mocks for true boundaries: databases, HTTP calls, message queues, clocks, random number generators.

### JaCoCo coverage enforcement in build.gradle.kts

```kotlin
plugins {
    jacoco
}

jacoco {
    toolVersion = "0.8.10"
}

tasks.jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit {
                minimum = "0.80".toBigDecimal() // 80% overall line coverage required
            }
        }
        rule {
            element = "CLASS"
            excludes = listOf("com.tml.*.dto.*", "com.tml.*.entity.*")
            limit {
                counter = "BRANCH"
                minimum = "0.70".toBigDecimal()
            }
        }
    }
}

// Make the standard check task depend on coverage verification
tasks.check {
    dependsOn(tasks.jacocoTestCoverageVerification)
}
```

### Mutation testing with PIT

```kotlin
// build.gradle.kts
plugins {
    id("info.solidsoft.pitest") version "1.15.0"
}

pitest {
    targetClasses.set(listOf("com.tml.service.*"))
    targetTests.set(listOf("com.tml.service.*Test"))
    mutators.set(listOf("STRONGER"))
    outputFormats.set(listOf("HTML", "XML"))
    threads.set(4)
    // Fail build if mutation score drops below 70%
    mutationThreshold.set(70)
}
```

Run with `./gradlew pitest`. The HTML report at `build/reports/pitest/index.html` shows which lines were mutated and whether your tests caught each mutation. A surviving mutant (a code change that does not cause any test to fail) means your tests pass even when the logic is subtly wrong. Pay particular attention to surviving mutants on boundary conditions — off-by-one errors, null checks, and conditional operators.

### Cypress end-to-end

```javascript
// cypress/e2e/order-creation.cy.js
describe('Order Creation Flow', () => {
  beforeEach(() => {
    cy.login('test-user', 'password'); // custom command in cypress/support/commands.js
    cy.visit('/orders/create');
  });

  it('creates an order and shows confirmation', () => {
    // Intercept the API call to control timing and verify payload
    cy.intercept('POST', '/api/orders', {
      statusCode: 201,
      body: { status: 'SUCCESS', data: { id: 1, materialCode: 'MAT-001' } },
    }).as('createOrder');

    cy.get('[data-testid=material-code-input]').type('MAT-001');
    cy.get('[data-testid=quantity-input]').type('50');
    cy.get('[data-testid=plant-select]').select('Pune - Plant 1001');
    cy.get('[data-testid=submit-button]').click();

    cy.wait('@createOrder').its('request.body').should('deep.equal', {
      materialCode: 'MAT-001',
      plantCode: '1001',
      quantity: 50,
    });

    cy.get('[data-testid=success-banner]').should('be.visible');
    cy.url().should('include', '/orders/1');
  });
});
```

---

## 9. In the TML Codebase

### H2 test configuration pattern

All Spring Boot services use this `src/test/resources/application.yaml` pattern:

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb;MODE=PostgreSQL;DB_CLOSE_DELAY=-1
    driver-class-name: org.h2.Driver
    username: sa
    password:
  jpa:
    hibernate:
      ddl-auto: create-drop
    database-platform: org.hibernate.dialect.H2Dialect
  flyway:
    enabled: false  # Flyway migrations NOT run in tests; Hibernate creates schema from entities
```

The `MODE=PostgreSQL` flag makes H2 accept PostgreSQL syntax (array types, `::` cast operator, `ON CONFLICT` clauses). DDL-auto `create-drop` creates tables from entity annotations at startup and drops them at shutdown. This means adding a new entity field immediately works in tests without writing a migration.

### WireMock in ep-production-broadcast

The SAP Connector and Freight Tiger HTTP calls are stubbed with WireMock in integration tests. Stub files live in `src/test/resources/__files/` (response body JSON) and `src/test/resources/mappings/` (URL and method matching rules). This keeps test data out of Java code and makes it easy to update stub responses without recompiling.

### Running a single test class

```bash
./gradlew test --tests "com.tml.controller.ShareOfBusinessControllerTest"
./gradlew test --tests "com.tml.service.OrderServiceTest.shouldCreateOrderWhenStockAvailable"
```

### Kotest in ep-replenishment

The ep-replenishment service uses Kotest with two styles:
- `FunSpec` for straightforward service tests (flat structure, like Jest)
- `BehaviorSpec` for business-rule-heavy tests where given/when/then reads naturally

```kotlin
class ReplenishmentServiceTest : BehaviorSpec({
    given("a material with reorder point") {
        val material = Material("MAT-001", reorderPoint = 100, currentStock = 80)

        `when`("stock falls below reorder point") {
            val plan = ReplenishmentService().generatePlan(material)

            then("a replenishment order is raised") {
                plan.shouldNotBeNull()
                plan.materialCode shouldBe "MAT-001"
            }
        }
    }
})
```

### Jest + RTL in React projects

All React projects co-locate test files: `src/components/OrderList/__tests__/OrderList.test.jsx`. The `__tests__/` directory lives next to the component file, keeping tests near the code they verify without polluting the component directory directly.

### Pre-commit hook setup

Running `./setup.sh` after cloning any Spring Boot service installs a Git pre-commit hook at `.githooks/pre-commit`. The hook runs `./gradlew spotlessApply` to auto-format code before every commit. If formatting changes any files, the commit is aborted so you can review and re-stage. This prevents "fix formatting" commits and ensures the test suite always runs on properly formatted code.

---

## 10. Quick Reference

### JUnit 5 annotation reference

| Annotation | Purpose |
|---|---|
| `@Test` | Marks a method as a test |
| `@BeforeEach` | Runs before each test method |
| `@AfterEach` | Runs after each test method |
| `@BeforeAll` | Runs once before all tests in the class (must be `static`) |
| `@AfterAll` | Runs once after all tests in the class (must be `static`) |
| `@Disabled("reason")` | Skip this test with a documented reason |
| `@ParameterizedTest` | Run the same test with multiple inputs |
| `@ValueSource(ints={1,2,3})` | Provide primitive values for parameterized test |
| `@CsvSource({"1,2,3"})` | Provide CSV rows for parameterized test |
| `@Nested` | Group related tests in an inner class |
| `@ExtendWith(X.class)` | Register a JUnit extension (e.g. `MockitoExtension`) |

### Mockito cheat sheet

| Operation | Syntax |
|---|---|
| Stub return value | `when(mock.method(arg)).thenReturn(value)` |
| Stub exception | `when(mock.method(arg)).thenThrow(new Ex())` |
| Stub with lambda | `when(mock.method(arg)).thenAnswer(inv -> ...)` |
| Verify called once | `verify(mock).method(arg)` |
| Verify exact times | `verify(mock, times(3)).method(arg)` |
| Verify never called | `verify(mock, never()).method(any())` |
| Capture argument | `ArgumentCaptor<T> cap = ArgumentCaptor.forClass(T.class); verify(mock).method(cap.capture()); cap.getValue()` |
| Match any argument | `any()`, `anyString()`, `anyLong()` |
| Match exact value | `eq("exact-value")` |

### RTL query priority guide

Prefer queries in this order — highest to lowest accessibility signal:

1. `getByRole` — tests ARIA semantics; catches missing aria-label and wrong element types
2. `getByLabelText` — finds form inputs by their associated `<label>` text
3. `getByPlaceholderText` — finds inputs by placeholder attribute
4. `getByText` — finds visible text content in the DOM
5. `getByAltText` — finds images and other media by alt text
6. `getByTitle` — finds elements by title attribute
7. `getByDisplayValue` — finds form elements by their current displayed value
8. `getByTestId` — last resort; couples tests to `data-testid` implementation details

**Async query variants:**
- `findBy*` — returns a Promise; use with `await`; retries until element appears or timeout
- `queryBy*` — returns `null` instead of throwing when element not found; use for negative assertions
