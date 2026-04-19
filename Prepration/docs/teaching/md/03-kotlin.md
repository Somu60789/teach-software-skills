# Kotlin

## Prerequisites

- Comfortable with Java: classes, interfaces, generics, collections, lambdas, `Optional<T>`, streams
- Completed `02-spring-boot.md` — you understand Spring beans, repositories, and the request lifecycle
- Familiarity with Gradle build files (XML or Groovy DSL) is helpful but not required

---

## What & Why

Kotlin is a statically-typed JVM language developed by JetBrains. It compiles to the same JVM bytecode as Java and is 100% interoperable with every Java library. JetBrains designed it to eliminate the ceremony that Java developers tolerate every day: verbose getters/setters, null pointer exceptions, `instanceof` chains, and builder boilerplate.

**Why TML uses Kotlin for repositories and service layers:**

1. **Null safety at compile time.** Java's `Optional<T>` is bolted on and easy to ignore. Kotlin bakes nullability into the type system: `String` can never be null, `String?` might be null, and the compiler refuses to compile code that forgets to handle the null case. When querying a database for a record that might not exist, Kotlin forces the developer to decide what to do before the code ships.

2. **Data classes replace boilerplate.** A Java POJO with five fields needs 40–60 lines of getters, setters, `equals()`, `hashCode()`, and `toString()`. A Kotlin data class does it in one line and adds a `copy()` method for free.

3. **Less noise, more signal.** Extension functions let you add methods to existing types without inheritance. Scope functions (`let`, `run`, `apply`, `also`, `with`) replace nested null checks and builder patterns. The collections API is richer and more expressive than Java streams.

4. **Spring first-class citizen.** Spring 5+ ships Kotlin extensions. Spring Data repositories work identically. The `kotlin("plugin.spring")` compiler plugin opens classes that Spring needs to proxy, removing the `open` modifier boilerplate.

---

## Core Concepts

### `val` vs `var`

`val` is an immutable reference (like Java's `final`). `var` is mutable. Prefer `val` everywhere; use `var` only when mutation is genuinely needed.

```kotlin
val name = "Tata Motors"   // type inferred as String, cannot be reassigned
var count = 0              // mutable
count = count + 1          // fine
// name = "Other"          // compile error
```

### Null Safety: `?`, `!!`, `?.`, `?:`

```kotlin
val a: String = "hello"   // non-nullable — cannot hold null
val b: String? = null     // nullable

// Safe call: returns null instead of throwing NPE
val length: Int? = b?.length

// Elvis operator: provide a default when null
val len: Int = b?.length ?: 0

// Not-null assertion: throws KotlinNullPointerException if null
// Use only when you are CERTAIN the value is non-null
val forced: Int = b!!.length

// Chaining safe calls
data class User(val address: Address?)
data class Address(val city: String?)
val city: String = user.address?.city ?: "Unknown"
```

### Data Classes

```kotlin
data class Material(
    val materialCode: String,
    val description: String,
    val plantCode: String,
    val stock: Int = 0
)

// copy() for immutable updates
val updated = material.copy(stock = material.stock + 10)

// Destructuring
val (code, desc, plant, stock) = material
```

### String Templates

```kotlin
val plant = "PUNE"
val qty = 150
println("Plant $plant has $qty units")
println("Plant ${plant.lowercase()} stock: ${qty * 1.1}")
```

### When Expressions

`when` is an exhaustive switch that returns a value. When used as an expression (assigned or returned), the compiler enforces that all cases are covered.

```kotlin
val status = "DISPATCHED"

val label = when (status) {
    "PENDING"    -> "Awaiting processing"
    "DISPATCHED" -> "In transit"
    "DELIVERED"  -> "Complete"
    else         -> "Unknown: $status"
}

// when on sealed class is exhaustive without else
sealed class OrderResult
data class Success(val orderId: String) : OrderResult()
data class Failure(val reason: String) : OrderResult()

fun describe(result: OrderResult): String = when (result) {
    is Success -> "Order ${result.orderId} succeeded"
    is Failure -> "Failed: ${result.reason}"
    // no else needed — compiler knows all subtypes
}
```

### Extension Functions

Add methods to types you don't own, without subclassing.

```kotlin
fun String.toSlug(): String =
    this.lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')

fun <T> List<T>.secondOrNull(): T? = if (size >= 2) this[1] else null

// Usage
"Tata Motors Limited".toSlug()  // "tata-motors-limited"
listOf("a", "b", "c").secondOrNull()  // "b"
```

---

## Installation & Setup

### IntelliJ IDEA

Download IntelliJ IDEA Community (free) from [jetbrains.com/idea](https://www.jetbrains.com/idea/). Kotlin support is bundled. For Android, use Android Studio (based on IntelliJ).

### Adding Kotlin to an existing Spring Boot project

`build.gradle.kts`:

```kotlin
plugins {
    kotlin("jvm") version "1.9.23"
    kotlin("plugin.spring") version "1.9.23"   // opens classes for Spring proxying
    kotlin("plugin.jpa") version "1.9.23"      // generates no-arg constructors for JPA entities
    id("org.springframework.boot") version "3.2.4"
    id("io.spring.dependency-management") version "1.1.4"
}

group = "com.tml"
version = "0.0.1-SNAPSHOT"
java.sourceCompatibility = JavaVersion.VERSION_17

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    runtimeOnly("org.postgresql:postgresql")
    testImplementation("io.kotest:kotest-runner-junit5:5.8.1")
    testImplementation("io.mockk:mockk:1.13.10")
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs = listOf("-Xjsr305=strict")
        jvmTarget = "17"
    }
}
```

### Mixed Java/Kotlin project structure

```
src/
  main/
    java/com/tml/legacy/    ← existing Java code
    kotlin/com/tml/         ← new Kotlin code
  test/
    kotlin/com/tml/
```

Both directories compile together. Kotlin can call Java and vice versa without any bridge code.

---

## Beginner

### Data class as DTO with `copy()`

```kotlin
data class MaterialDto(
    val materialCode: String,
    val description: String,
    val plantCode: String,
    val availableStock: Int = 0,
    val reservedStock: Int = 0
) {
    val netStock: Int get() = availableStock - reservedStock
}

// Named parameters — self-documenting call sites
val dto = MaterialDto(
    materialCode = "MAT-001",
    description = "Bolt M8x20",
    plantCode = "PUNE",
    availableStock = 500
)

// Immutable update
val dispatched = dto.copy(availableStock = dto.availableStock - 50)
```

### `val`/`var`, named parameters, default parameters

```kotlin
fun formatStockAlert(
    materialCode: String,
    currentStock: Int,
    threshold: Int = 100,        // default value
    urgent: Boolean = false
): String {
    val prefix = if (urgent) "[URGENT] " else ""
    return "${prefix}Material $materialCode: stock $currentStock (threshold: $threshold)"
}

// Caller can skip args that have defaults
formatStockAlert("MAT-001", 20)
formatStockAlert("MAT-001", 20, urgent = true)
formatStockAlert(materialCode = "MAT-002", currentStock = 5, threshold = 50, urgent = true)
```

### `when` as exhaustive expression

```kotlin
enum class ReplenishmentStatus { PENDING, IN_PROGRESS, COMPLETED, CANCELLED }

fun statusColor(status: ReplenishmentStatus): String = when (status) {
    ReplenishmentStatus.PENDING     -> "grey"
    ReplenishmentStatus.IN_PROGRESS -> "blue"
    ReplenishmentStatus.COMPLETED   -> "green"
    ReplenishmentStatus.CANCELLED   -> "red"
    // exhaustive — no else required for enum
}
```

### `if` as expression

```kotlin
val discount = if (quantity > 1000) 0.15 else if (quantity > 500) 0.10 else 0.0
val label = if (stock > 0) "In Stock" else "Out of Stock"
```

### Kotlin Spring Data repository

```kotlin
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository

@Repository
interface MaterialRepository : JpaRepository<MaterialEntity, Long> {
    fun findByMaterialCodeAndPlantCode(materialCode: String, plantCode: String): MaterialEntity?
    fun findAllByPlantCodeAndStockLessThan(plantCode: String, threshold: Int): List<MaterialEntity>

    @Query("SELECT m FROM MaterialEntity m WHERE m.plantCode = :plant AND m.stock < :threshold")
    fun findLowStock(plant: String, threshold: Int): List<MaterialEntity>
}
```

---

## Intermediate

### Extension functions

```kotlin
// Add to String — no subclassing required
fun String.toSlug(): String =
    this.lowercase()
        .replace(Regex("[\\s_]+"), "-")
        .replace(Regex("[^a-z0-9-]"), "")
        .trim('-')

// Generic extension on List
fun <T> List<T>.secondOrNull(): T? = if (size >= 2) this[1] else null

// Extension on nullable receiver
fun String?.orUnknown(): String = this ?: "UNKNOWN"
```

### Higher-order functions

```kotlin
fun <T> List<T>.applyIfNotEmpty(action: (List<T>) -> Unit) {
    if (isNotEmpty()) action(this)
}

fun processAlerts(alerts: List<StockAlert>, notify: (StockAlert) -> Unit) {
    alerts.filter { it.isUrgent }.forEach(notify)
}

// Usage
processAlerts(alerts) { alert ->
    emailService.send(alert.materialCode, alert.message)
}
```

### Scope functions: when to use each

```kotlin
// let: transform a nullable value, or run a block and return a new value
val upper = name?.let { it.uppercase() }

// run: configure and return an object (receiver is 'this')
val request = HttpRequest.newBuilder()
    .run {
        uri(URI.create(url))
        header("Authorization", "Bearer $token")
        build()
    }

// also: side-effect without changing the chain (receiver is 'it')
val saved = repository.save(entity).also { log.info("Saved entity ${it.id}") }

// apply: configure an object (receiver is 'this', returns 'this')
val entity = MaterialEntity().apply {
    materialCode = "MAT-001"
    plantCode = "PUNE"
    stock = 100
}

// with: call multiple methods on an object when you already have a non-null ref
with(reportBuilder) {
    setTitle("Stock Report")
    setDate(LocalDate.now())
    addSection("Summary", summaryData)
}
```

### Collections API

```kotlin
val materials: List<MaterialEntity> = repository.findAll()

// filter + map
val lowStockCodes: List<String> = materials
    .filter { it.stock < 100 }
    .map { it.materialCode }

// groupBy
val byPlant: Map<String, List<MaterialEntity>> = materials.groupBy { it.plantCode }

// associate — build a lookup map
val codeToEntity: Map<String, MaterialEntity> = materials.associate { it.materialCode to it }

// flatMap — flatten nested lists
val allBomItems: List<BomItem> = bills.flatMap { it.items }

// partition — split into two lists
val (inStock, outOfStock) = materials.partition { it.stock > 0 }

// aggregate
val totalStock: Int = materials.sumOf { it.stock }
val avgStock: Double = materials.map { it.stock }.average()
```

### Kotlin JPA repository with `@Query`

```kotlin
@Repository
interface ReplenishmentRepository : JpaRepository<ReplenishmentOrder, Long> {

    @Query("""
        SELECT r FROM ReplenishmentOrder r
        WHERE r.plantCode = :plant
          AND r.status = :status
          AND r.createdAt BETWEEN :from AND :to
        ORDER BY r.createdAt DESC
    """)
    fun findByPlantAndStatusBetween(
        plant: String,
        status: String,
        from: LocalDateTime,
        to: LocalDateTime
    ): List<ReplenishmentOrder>

    @Modifying
    @Query("UPDATE ReplenishmentOrder r SET r.status = :status WHERE r.id IN :ids")
    fun bulkUpdateStatus(ids: List<Long>, status: String): Int
}
```

---

## Advanced

### Coroutines: `suspend`, `async`/`await`, `Flow`

Coroutines are Kotlin's concurrency primitive. A `suspend` function can pause without blocking a thread.

```kotlin
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

// suspend function — only callable from another suspend or coroutine scope
suspend fun fetchStockLevel(materialCode: String): Int {
    delay(100)  // non-blocking sleep
    return stockApiClient.getStock(materialCode)
}

// parallel execution with async/await
suspend fun fetchMultiple(codes: List<String>): List<Int> = coroutineScope {
    codes.map { code -> async { fetchStockLevel(code) } }
         .awaitAll()
}

// Flow for streaming / reactive sequences
fun stockUpdates(plantCode: String): Flow<StockEvent> = flow {
    while (true) {
        val events = fetchRecentEvents(plantCode)
        events.forEach { emit(it) }
        delay(5_000)
    }
}

// Collect in a coroutine
stockUpdates("PUNE")
    .filter { it.delta < 0 }
    .collect { event -> alertService.send(event) }
```

### Exposed ORM

JetBrains' Exposed is a lightweight SQL DSL that gives you type-safe SQL without the weight of Hibernate.

```kotlin
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

object Materials : Table("materials") {
    val id = integer("id").autoIncrement()
    val materialCode = varchar("material_code", 50)
    val plantCode = varchar("plant_code", 10)
    val stock = integer("stock").default(0)
    override val primaryKey = PrimaryKey(id)
}

// Read
fun findLowStock(threshold: Int): List<ResultRow> = transaction {
    Materials.selectAll()
             .where { Materials.stock less threshold }
             .orderBy(Materials.stock)
             .toList()
}

// Insert or ignore duplicate
fun upsertStock(code: String, plant: String, qty: Int) = transaction {
    Materials.insertIgnore {
        it[materialCode] = code
        it[plantCode] = plant
        it[stock] = qty
    }
}

// Update
fun adjustStock(code: String, delta: Int) = transaction {
    Materials.update({ Materials.materialCode eq code }) {
        with(SqlExpressionBuilder) {
            it.update(stock, stock + delta)
        }
    }
}
```

### Arrow-kt: `Either<L, R>`

Arrow brings functional error handling. `Either<Error, Value>` makes the error path part of the type signature — no more swallowed exceptions.

```kotlin
import arrow.core.*

sealed class StockError {
    data class NotFound(val code: String) : StockError()
    data class InsufficientStock(val available: Int, val requested: Int) : StockError()
    data class DatabaseError(val cause: Throwable) : StockError()
}

fun findMaterial(code: String): Either<StockError, MaterialEntity> =
    Either.catch { repository.findByMaterialCode(code) }
          .mapLeft { StockError.DatabaseError(it) }
          .flatMap { entity ->
              if (entity != null) entity.right()
              else StockError.NotFound(code).left()
          }

fun reserveStock(code: String, qty: Int): Either<StockError, MaterialEntity> =
    findMaterial(code).flatMap { material ->
        if (material.stock >= qty)
            repository.save(material.copy(stock = material.stock - qty)).right()
        else
            StockError.InsufficientStock(material.stock, qty).left()
    }

// Consuming Either with fold
val result = reserveStock("MAT-001", 50).fold(
    ifLeft  = { error -> ResponseEntity.badRequest().body(error.toString()) },
    ifRight = { entity -> ResponseEntity.ok(entity.toDto()) }
)

// Option<A> — explicit optional
val maybeMaterial: Option<MaterialEntity> = repository.findById(id).toOption()
val description: String = maybeMaterial.fold({ "N/A" }, { it.description })
```

---

## Expert

### Inline functions and reified type parameters

Normally, Kotlin generics are erased at runtime (same as Java). The `inline` + `reified` combination preserves the type.

```kotlin
// Without reified: T is erased, can't do T::class at runtime
// With reified: T is available at runtime
inline fun <reified T : Any> ObjectMapper.parseOrNull(json: String): T? =
    try { readValue(json, T::class.java) } catch (e: Exception) { null }

// Usage — no Class<T> argument needed
val dto: MaterialDto? = mapper.parseOrNull<MaterialDto>(jsonString)

// Inline higher-order functions avoid lambda overhead
inline fun <T> measureTime(block: () -> T): Pair<T, Long> {
    val start = System.currentTimeMillis()
    val result = block()
    return result to (System.currentTimeMillis() - start)
}
```

### Kotlin compiler plugins

The `allopen` and `noarg` plugins are required for Spring and JPA to work correctly. By default Kotlin classes are `final`; Spring AOP needs to subclass them.

```kotlin
// build.gradle.kts
allOpen {
    annotation("org.springframework.stereotype.Service")
    annotation("org.springframework.stereotype.Repository")
    annotation("org.springframework.stereotype.Component")
    annotation("org.springframework.web.bind.annotation.RestController")
}

noArg {
    annotation("javax.persistence.Entity")
    annotation("javax.persistence.MappedSuperclass")
    annotation("javax.persistence.Embeddable")
}
```

### Kotest FunSpec and DescribeSpec

```kotlin
import io.kotest.core.spec.style.FunSpec
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.assertions.throwables.shouldThrow

class StockServiceTest : FunSpec({

    val repository = mockk<MaterialRepository>()
    val service = StockService(repository)

    test("findLowStock returns materials below threshold") {
        every { repository.findAllByPlantCodeAndStockLessThan("PUNE", 100) } returns
            listOf(MaterialEntity(materialCode = "M1", stock = 50, plantCode = "PUNE"))

        val result = service.findLowStock("PUNE", 100)

        result shouldHaveSize 1
        result.first().materialCode shouldBe "M1"
    }

    test("reserveStock throws when insufficient") {
        every { repository.findByMaterialCodeAndPlantCode("M1", "PUNE") } returns
            MaterialEntity(materialCode = "M1", stock = 10, plantCode = "PUNE")

        shouldThrow<InsufficientStockException> {
            service.reserve("M1", "PUNE", 100)
        }
    }
})

class StockServiceDescribeTest : DescribeSpec({
    describe("StockService") {
        context("when stock is sufficient") {
            it("saves updated entity and returns dto") {
                // arrange / act / assert
            }
        }
        context("when stock is zero") {
            it("returns left with InsufficientStock error") {
                // arrange / act / assert
            }
        }
    }
})
```

### MockK

```kotlin
import io.mockk.*

// Basic stubbing
val repo = mockk<MaterialRepository>()
every { repo.findById(1L) } returns Optional.of(entity)

// Coroutine stubbing
coEvery { asyncClient.fetch("MAT-001") } returns StockLevel(100)

// Verification
verify(exactly = 1) { repo.save(any()) }
coVerify(atLeast = 1) { asyncClient.fetch(any()) }

// Capture arguments
val slot = slot<MaterialEntity>()
every { repo.save(capture(slot)) } answers { slot.captured }
service.updateStock("MAT-001", 50)
slot.captured.stock shouldBe 50

// Relaxed mock — all methods return default values
val relaxed = mockk<MaterialRepository>(relaxed = true)
```

---

## In the TML Codebase

**Repositories in Kotlin (`ep-production-broadcast`, `ep-prolife-service`)**
Spring Data JPA repositories are written in Kotlin. Method names like `findByMaterialCodeAndPlantCodeAndVendorCode` avoid raw SQL for simple lookups. The return types use Kotlin nullability (`MaterialEntity?`) instead of `Optional<MaterialEntity>`.

**Arrow-kt Either in service layer**
Service methods return `Either<DomainError, ResultType>` instead of throwing exceptions. Controllers call `.fold()` to map left (error) to an HTTP error response and right (success) to a 200 body. This forces every caller to handle both cases at compile time.

**Exposed ORM in `ep-reconciliation`**
This service uses Exposed instead of JPA because it needs fine-grained SQL control for reconciliation queries. `transaction {}` blocks wrap every database operation. `insertIgnore` handles the idempotency requirement for reprocessed Kafka messages.

**Kotest in `ep-replenishment`**
Tests are written in `FunSpec` style. The project uses `kotest-assertions-core` for `shouldBe`, `shouldContain`, and `shouldThrow`. `MockK` replaces Mockito — `every {}` for stubbing, `verify {}` for interaction checks.

**`build.gradle.kts` allopen config**
All Spring Boot services open `@Service`, `@Repository`, `@Component`, and `@RestController` via the allopen plugin. Without this, Spring's CGLIB proxying fails at startup with a "cannot subclass final class" error.

---

## Quick Reference

### Scope function comparison

| Function | Receiver inside block | Return value      | Primary use case                          |
|----------|-----------------------|-------------------|-------------------------------------------|
| `let`    | `it`                  | Lambda result     | Null-safe transform, scoped variable      |
| `run`    | `this`                | Lambda result     | Object config + compute result            |
| `also`   | `it`                  | The object itself | Side effects (logging, validation)        |
| `apply`  | `this`                | The object itself | Object initialisation / builder pattern   |
| `with`   | `this`                | Lambda result     | Multiple calls on non-null existing ref   |

### Arrow-kt Either chaining template

```kotlin
fun processOrder(request: OrderRequest): Either<OrderError, OrderDto> =
    validateRequest(request)           // Either<OrderError, ValidRequest>
        .flatMap { findMaterial(it) }  // Either<OrderError, Material>
        .flatMap { reserveStock(it) }  // Either<OrderError, Material>
        .map { it.toDto() }            // Either<OrderError, OrderDto>
```

### Kotest assertion styles

```kotlin
result shouldBe expected
result shouldNotBe null
list shouldHaveSize 3
list shouldContain "item"
string shouldStartWith "prefix"
number shouldBeGreaterThan 0
shouldThrow<IllegalArgumentException> { service.call() }
```

### Null safety cheat sheet

```kotlin
val x: String? = maybeNull()
x?.length           // Int?   — safe call
x?.length ?: 0      // Int    — elvis default
x!!.length          // Int    — assert non-null (throws if null)
x?.let { doWork(it) }  // run block only if non-null
```
