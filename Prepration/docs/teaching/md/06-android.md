# Android (Jetpack Compose)

## Prerequisites

- Kotlin fundamentals: completed `03-kotlin.md` — you understand data classes, coroutines, Flow, and null safety
- OOP: classes, interfaces, inheritance, dependency injection concepts
- Basic Android concepts: what an Activity is, what an Intent does, the concept of a View
- Gradle: you can read a `build.gradle.kts` file and add a dependency

---

## What & Why

Android development at TML means writing apps that run on hand-held terminals (HHTs) — ruggedised Android devices used on the shop floor for barcode scanning, stock confirmation, and label printing. These devices run Android 12+ and are always connected to the plant's Wi-Fi network.

**Why Jetpack Compose instead of XML layouts:**

The traditional Android UI system uses XML layout files linked to Java/Kotlin `View` code. This creates a dual-language split that leads to fragile code: the XML and the Kotlin can get out of sync, null pointer exceptions from `findViewById` are common, and passing data back up the hierarchy is convoluted.

Jetpack Compose is Google's modern declarative UI toolkit. You describe _what_ the UI should look like for a given state, and Compose handles the rest. Benefits:

1. **State-driven.** When state changes, Compose recomposes only the parts of the tree that read that state. No manual `view.setText()` calls.
2. **Single language.** UI and logic are both Kotlin. No XML-to-Kotlin impedance mismatch.
3. **Testable.** Compose provides a test rule that lets you render a composable in isolation and assert on its content.
4. **Less boilerplate.** A screen that took 3 files (XML layout, Fragment, ViewModel) can be expressed as a single Composable function and a ViewModel.

---

## Core Concepts

**Composable functions** are the building blocks. A function annotated with `@Composable` describes a piece of UI. It can call other composables.

**Recomposition** is how Compose updates the UI. When a state value read inside a composable changes, Compose schedules a recomposition of that composable (and only that composable, and its children that also read the changed state).

**State hoisting** is the pattern of lifting state up to the lowest common ancestor that needs it, passing it down as a parameter. This makes composables stateless and more reusable.

**`remember`** keeps a value alive across recompositions. Without it, a value declared inside a composable would reset on every recomposition.

**`LaunchedEffect(key)`** launches a coroutine tied to the composable's lifecycle. When `key` changes, the previous coroutine is cancelled and a new one starts. When the composable leaves the composition, the coroutine is cancelled.

---

## Installation & Setup

1. Download **Android Studio Hedgehog** (or later) from [developer.android.com/studio](https://developer.android.com/studio)
2. Create new project: **Empty Activity** (this creates a Compose project by default)
3. Choose: Language = Kotlin, Minimum SDK = API 26 (Android 8.0)
4. Gradle sync downloads all dependencies automatically
5. Create an emulator: Device Manager → Create Device → Pixel 6 → API 33

**`app/build.gradle.kts` (generated Compose project):**

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.hilt.android)
    kotlin("kapt")
}

android {
    compileSdk = 34
    defaultConfig {
        minSdk = 26
        targetSdk = 34
    }
    buildFeatures { compose = true }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.material3)
    implementation(libs.hilt.android)
    kapt(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.ktor.client.android)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    testImplementation(libs.kotest.runner.junit5)
    testImplementation(libs.mockk)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
}
```

---

## Beginner

### `@Composable` function, layouts, and state

```kotlin
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun StockCounter(initialStock: Int = 0) {
    // remember keeps the value across recompositions
    var stock by remember { mutableStateOf(initialStock) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Stock: $stock",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { if (stock > 0) stock-- }) { Text("−") }
            Button(onClick = { stock++ })                  { Text("+") }
        }
    }
}

@Composable
fun BarcodeInput(onSubmit: (String) -> Unit) {
    var barcode by remember { mutableStateOf("") }

    OutlinedTextField(
        value         = barcode,
        onValueChange = { barcode = it },
        label         = { Text("Scan barcode") },
        singleLine    = true,
        modifier      = Modifier.fillMaxWidth()
    )
    Button(
        onClick  = { onSubmit(barcode); barcode = "" },
        enabled  = barcode.isNotBlank(),
        modifier = Modifier.padding(top = 8.dp)
    ) {
        Text("Confirm")
    }
}
```

### `LaunchedEffect` for one-time side effects

```kotlin
@Composable
fun ScanScreen(viewModel: ScanViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // Runs once when this composable enters the composition
    LaunchedEffect(Unit) {
        viewModel.loadMaterials()
    }

    // Runs every time `uiState.errorMessage` changes to a non-null value
    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let { message ->
            // show snackbar or dialog
        }
    }

    when {
        uiState.isLoading -> CircularProgressIndicator()
        uiState.materials.isEmpty() -> Text("No materials found")
        else -> MaterialList(materials = uiState.materials)
    }
}
```

### `@Preview`

```kotlin
@Preview(showBackground = true, widthDp = 360)
@Composable
fun StockCounterPreview() {
    MaterialTheme {
        StockCounter(initialStock = 150)
    }
}
```

---

## Intermediate

### Hilt dependency injection

```kotlin
// Application class
@HiltAndroidApp
class TmlApplication : Application()

// Activity entry point
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { TmlApp() }
    }
}

// ViewModel with injected dependencies
@HiltViewModel
class ScanViewModel @Inject constructor(
    private val materialRepository: MaterialRepository,
    private val stockApiClient: StockApiClient
) : ViewModel() {
    // ...
}

// Hilt module providing dependencies
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideHttpClient(): HttpClient = HttpClient(Android) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        install(Auth) {
            bearer {
                loadTokens { BearerTokens(TokenStore.accessToken, TokenStore.refreshToken) }
            }
        }
    }

    @Provides
    @Singleton
    fun provideStockApiClient(client: HttpClient): StockApiClient =
        StockApiClientImpl(client, BuildConfig.API_BASE_URL)
}
```

### ViewModel with `StateFlow`

```kotlin
data class ScanUiState(
    val isLoading:    Boolean = false,
    val materials:    List<MaterialDto> = emptyList(),
    val scannedCode:  String? = null,
    val errorMessage: String? = null
)

@HiltViewModel
class ScanViewModel @Inject constructor(
    private val repository: MaterialRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ScanUiState())
    val uiState: StateFlow<ScanUiState> = _uiState.asStateFlow()

    fun loadMaterials() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            try {
                val materials = repository.getLowStock()
                _uiState.update { it.copy(isLoading = false, materials = materials) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }

    fun onBarcodeScanned(code: String) {
        _uiState.update { it.copy(scannedCode = code) }
        viewModelScope.launch {
            repository.confirmScan(code)
        }
    }
}
```

### Navigation with NavHost

```kotlin
// Define routes as a sealed class
sealed class Screen(val route: String) {
    object ScanList  : Screen("scan_list")
    object ScanDetail : Screen("scan_detail/{materialCode}") {
        fun createRoute(code: String) = "scan_detail/$code"
    }
    object Settings  : Screen("settings")
}

@Composable
fun TmlApp() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Screen.ScanList.route) {
        composable(Screen.ScanList.route) {
            ScanListScreen(
                onMaterialClick = { code ->
                    navController.navigate(Screen.ScanDetail.createRoute(code))
                }
            )
        }
        composable(
            route = Screen.ScanDetail.route,
            arguments = listOf(navArgument("materialCode") { type = NavType.StringType })
        ) { backStackEntry ->
            val code = backStackEntry.arguments?.getString("materialCode") ?: return@composable
            ScanDetailScreen(materialCode = code, onBack = { navController.popBackStack() })
        }
        composable(Screen.Settings.route) { SettingsScreen() }
    }
}
```

### DataStore Preferences

```kotlin
// DataStore setup
val Context.dataStore by preferencesDataStore(name = "settings")

object PreferencesKeys {
    val AUTH_TOKEN    = stringPreferencesKey("auth_token")
    val PLANT_CODE    = stringPreferencesKey("plant_code")
    val LAST_SYNC     = longPreferencesKey("last_sync_ms")
}

// Write
suspend fun saveToken(context: Context, token: String) {
    context.dataStore.edit { prefs ->
        prefs[PreferencesKeys.AUTH_TOKEN] = token
    }
}

// Read as Flow
fun getPlantCode(context: Context): Flow<String> =
    context.dataStore.data.map { prefs ->
        prefs[PreferencesKeys.PLANT_CODE] ?: "UNKNOWN"
    }
```

---

## Advanced

### Ktor Client for HTTP

```kotlin
// Repository implementation using Ktor
class StockApiClientImpl(
    private val client: HttpClient,
    private val baseUrl: String
) : StockApiClient {

    override suspend fun getMaterials(plantCode: String): List<MaterialDto> =
        client.get("$baseUrl/api/materials") {
            parameter("plant", plantCode)
        }.body()

    override suspend fun confirmScan(
        materialCode: String,
        quantity: Int,
        token: String
    ): ScanResult =
        client.post("$baseUrl/api/scans") {
            contentType(ContentType.Application.Json)
            bearerAuth(token)
            setBody(ScanRequest(materialCode = materialCode, quantity = quantity))
        }.body()
}
```

### AppAuth PKCE flow for Keycloak OIDC

```kotlin
class KeycloakAuthService @Inject constructor(
    private val context: Context
) {
    private val authService = AuthorizationService(context)

    fun buildAuthRequest(): AuthorizationRequest {
        val config = AuthorizationServiceConfiguration(
            Uri.parse("${BuildConfig.KEYCLOAK_URL}/realms/${BuildConfig.REALM}/protocol/openid-connect/auth"),
            Uri.parse("${BuildConfig.KEYCLOAK_URL}/realms/${BuildConfig.REALM}/protocol/openid-connect/token")
        )
        return AuthorizationRequest.Builder(
            config,
            BuildConfig.CLIENT_ID,
            ResponseTypeValues.CODE,
            Uri.parse(BuildConfig.REDIRECT_URI)
        )
        .setScope("openid profile email")
        .setCodeVerifier(CodeVerifierUtil.generateRandomCodeVerifier())  // PKCE
        .build()
    }

    fun performTokenRequest(
        authResponse: AuthorizationResponse,
        callback: (String?, String?, Exception?) -> Unit
    ) {
        authService.performTokenRequest(
            authResponse.createTokenExchangeRequest()
        ) { tokenResponse, ex ->
            callback(tokenResponse?.accessToken, tokenResponse?.refreshToken, ex)
        }
    }
}
```

### Encrypted DataStore

```kotlin
// EncryptedSharedPreferences for sensitive token storage
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

val encryptedPrefs = EncryptedSharedPreferences.create(
    context,
    "secure_prefs",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

// Write token
encryptedPrefs.edit().putString("access_token", token).apply()

// Read token
val storedToken = encryptedPrefs.getString("access_token", null)
```

---

## Expert

### Certificate pinning

Prevents man-in-the-middle attacks on the shop-floor Wi-Fi network.

```kotlin
// In your Hilt module, add certificate pinning to the OkHttp client
// that backs your Ktor client on Android
val certificatePinner = CertificatePinner.Builder()
    .add("api.tml-internal.plant", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    .add("api.tml-internal.plant", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=")  // backup
    .build()

val okHttpClient = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .build()

// Use this OkHttpClient as the engine for Ktor
val httpClient = HttpClient(OkHttp) {
    engine { preconfigured = okHttpClient }
    install(ContentNegotiation) { json() }
}
```

Get the SHA-256 pin: `openssl s_client -connect api.tml-internal.plant:443 | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64`

### Compose performance: skippable composables

Compose skips recomposing a function if its inputs haven't changed. A composable is **skippable** only if all its parameters are stable types.

```kotlin
// Unstable: List<T> is NOT stable — Compose can't verify it hasn't changed
@Composable
fun MaterialList(materials: List<MaterialDto>) { /* recomposes every time parent does */ }

// Stable: wrap in an @Stable or @Immutable annotated class
@Immutable
data class MaterialListState(val items: List<MaterialDto>)

@Composable
fun MaterialList(state: MaterialListState) { /* skipped unless state reference changes */ }

// Or use ImmutableList from kotlinx.collections.immutable
@Composable
fun MaterialList(materials: ImmutableList<MaterialDto>) { /* stable — Compose can skip */ }
```

Use the Layout Inspector in Android Studio (Layout Inspector → Recomposition Counts) to identify composables recomposing too frequently.

### Compose UI test

```kotlin
@get:Rule
val composeTestRule = createComposeRule()

@Test
fun scanScreen_displaysScannedMaterial_afterBarcodeEntry() {
    val fakeViewModel = FakeScanViewModel()

    composeTestRule.setContent {
        ScanScreen(viewModel = fakeViewModel)
    }

    composeTestRule.onNodeWithText("Scan barcode").performTextInput("MAT-001")
    composeTestRule.onNodeWithText("Confirm").performClick()

    composeTestRule.onNodeWithText("MAT-001").assertIsDisplayed()
    composeTestRule.onNodeWithText("In Stock").assertIsDisplayed()
}
```

### JaCoCo in Android Gradle

```kotlin
// app/build.gradle.kts
android {
    buildTypes {
        debug {
            enableUnitTestCoverage = true
        }
    }
}

// Run tests and generate report
// ./gradlew testDebugUnitTest
// ./gradlew createDebugUnitTestCoverageReport
// Report at: app/build/reports/coverage/test/debug/index.html
```

---

## In the TML Codebase

**`ep-prolife-service-hht-ui`**
The HHT UI app is built with Kotlin + Jetpack Compose. Shop-floor workers use it to scan barcodes, confirm stock movements, and trigger label printing. The app communicates with `ep-prolife-service` (the Kotlin Spring Boot backend) via Ktor HTTP client.

**Keycloak OIDC via AppAuth PKCE**
The app authenticates workers against the TML Keycloak instance. AppAuth handles the browser-based PKCE flow: it opens a Chrome Custom Tab for the Keycloak login page, intercepts the redirect, and exchanges the authorization code for access and refresh tokens. Tokens are stored in `EncryptedSharedPreferences`.

**Certificate pinning**
The OkHttp client pins the TML plant network CA certificate. This prevents a compromised device on the shop floor Wi-Fi from performing a MITM attack against the API. The pin is stored in `BuildConfig` (injected at build time, not hardcoded in source).

**MockK + Kotest test suite**
Unit tests use `MockK` for mocking Hilt-injected dependencies and `Kotest` `FunSpec` for test structure. ViewModels are tested by directly calling their methods and asserting on the emitted `StateFlow` values, without needing an Android device.

**Hilt modules wired for Ktor client and Keycloak service**
`NetworkModule` provides a singleton `HttpClient` (Ktor + OkHttp engine + certificate pinner). `AuthModule` provides the `KeycloakAuthService`. Both are injected into ViewModels via constructor injection.

---

## Quick Reference

### Compose state patterns

```kotlin
// Local UI state (lives in composition)
var isExpanded by remember { mutableStateOf(false) }

// Derived state (recomputes only when dependency changes)
val isValid by remember(text) { derivedStateOf { text.length >= 3 } }

// ViewModel state (survives configuration change)
val uiState by viewModel.uiState.collectAsStateWithLifecycle()

// One-time events (LaunchedEffect)
LaunchedEffect(key) { /* coroutine runs when key changes */ }

// Side effect that doesn't block composition
SideEffect { analytics.setScreen(screenName) }
```

### Hilt annotation reference

| Annotation              | Where it goes              | What it does                                         |
|-------------------------|----------------------------|------------------------------------------------------|
| `@HiltAndroidApp`       | `Application` subclass     | Triggers Hilt code generation, sets up app component |
| `@AndroidEntryPoint`    | Activity / Fragment        | Enables field injection into Android framework type  |
| `@HiltViewModel`        | ViewModel class            | Enables Hilt to create the ViewModel                 |
| `@Inject constructor`   | Class constructor          | Marks constructor for Hilt to use                    |
| `@Module`               | Object/class               | Declares a set of bindings                           |
| `@InstallIn`            | Module class               | Specifies which component scope the module lives in  |
| `@Provides`             | Function in module         | Returns a binding                                    |
| `@Singleton`            | Provides function          | One instance for app lifetime                        |
| `@ViewModelScoped`      | Provides function          | One instance per ViewModel lifetime                  |

### Ktor request DSL

```kotlin
// GET with query params
client.get("$base/materials") {
    parameter("plant", plantCode)
    parameter("limit", 50)
}

// POST JSON body
client.post("$base/scans") {
    contentType(ContentType.Application.Json)
    bearerAuth(token)
    setBody(ScanRequest(materialCode, quantity))
}

// Response type is inferred from .body<T>()
val result: ScanResult = client.post(...).body()
```
