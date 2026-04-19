# Authentication & Keycloak

## Prerequisites

- **React (01-react.md)** — component model, hooks, routing
- **Spring Boot (02-spring-boot.md)** — beans, filters, annotations
- HTTP basics: request/response headers, `Authorization: Bearer <token>`, cookies vs tokens
- JSON basics — Keycloak tokens are JSON Web Tokens (JWT)

---

## What & Why

Authentication answers "who is this user?" Authorization answers "what can they do?". Doing both inside every microservice creates duplicated logic, inconsistent token formats, and no single logout.

**Keycloak** is a self-hosted, open-source Identity and Access Management (IAM) server. It implements OAuth 2.0 and OpenID Connect (OIDC) — the industry-standard protocols for delegated authentication.

| Without Keycloak | With Keycloak |
|---|---|
| Each service has its own user table + password hashing | One user store, one login page |
| Each service issues its own session token | Keycloak issues signed JWTs; any service can verify |
| No SSO — log in to each microservice separately | Single Sign-On: log in once, access all services |
| Self-managed password reset, MFA, LDAP sync | Keycloak handles all of this out of the box |
| Stored credentials in multiple databases | Credentials stored only in Keycloak |

**Why self-hosted Keycloak vs a cloud IdP (Auth0, Cognito)?**
- Data sovereignty — user data stays within TML infrastructure
- No per-MAU pricing at scale
- Deep customisation: custom protocol mappers, custom themes, custom authenticators
- Air-gapped environments (MES plant floor) can still authenticate

---

## Core Concepts

### OAuth2 Flows

```
Authorization Code Flow (web apps with server-side component)
─────────────────────────────────────────────────────────────
Browser → Keycloak login page → user logs in
Keycloak → redirect to app with ?code=AUTH_CODE
App server → POST /token with code + client_secret
Keycloak → returns access_token + refresh_token + id_token

PKCE Flow (public clients: React SPAs, mobile apps)
─────────────────────────────────────────────────────────────
Same as Auth Code BUT:
  - App generates code_verifier (random string)
  - App sends code_challenge = SHA256(code_verifier) with initial request
  - App sends code_verifier when exchanging code for tokens
  - No client_secret needed (safe for public clients)

Client Credentials Flow (service-to-service, no user)
─────────────────────────────────────────────────────────────
Service A → POST /token with client_id + client_secret + grant_type=client_credentials
Keycloak → returns access_token (machine identity, no user claims)
Service A uses access_token to call Service B
```

### JWT Structure

A JWT is three base64url-encoded JSON objects separated by dots:

```
eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyMSIsInJlYWxtX2FjY2Vzcyi...}.SIGNATURE

HEADER  (algorithm + token type)
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-id-for-rotation"
}

PAYLOAD (claims)
{
  "sub": "user-uuid-from-keycloak",
  "preferred_username": "john.doe",
  "email": "john.doe@tml.com",
  "realm_access": {
    "roles": ["ROLE_OPERATOR", "ROLE_SUPERVISOR"]
  },
  "plant_list": ["PLANT-01", "PLANT-03"],
  "iss": "https://keycloak.tml.com/realms/tml",
  "aud": "ep-production-broadcast",
  "exp": 1714000000,
  "iat": 1713996400
}

SIGNATURE (RS256 of header.payload, signed by Keycloak's private key)
Verified by services using Keycloak's public key from JWKS endpoint
```

**Never** store sensitive data in the JWT payload — it is base64url encoded, not encrypted. Anyone can decode it at jwt.io.

### OIDC: ID Token vs Access Token

- **ID Token** — for the client application. Tells the frontend "who logged in" (name, email, profile picture). Should not be sent to resource servers (APIs).
- **Access Token** — for resource servers (your Spring Boot APIs). Contains roles and scopes. Has a short TTL (typically 5–15 minutes).
- **Refresh Token** — long-lived (hours/days). Used to obtain new access tokens silently without re-login.

### Keycloak Concepts

```
Realm:  tml
├── Clients
│   ├── ep-frontend              (public, PKCE, React SPA)
│   ├── ep-production-broadcast  (confidential, Spring Boot API)
│   └── service-account-ci       (client credentials, GitHub Actions)
├── Users
│   ├── john.doe   (member of groups: plant-01-operators)
│   └── jane.smith (member of groups: plant-01-supervisors)
├── Roles
│   ├── ROLE_OPERATOR
│   ├── ROLE_SUPERVISOR
│   └── ROLE_ADMIN
├── Groups
│   ├── plant-01-operators   (assigned ROLE_OPERATOR)
│   └── plant-01-supervisors (assigned ROLE_SUPERVISOR)
└── Scopes
    └── openid, profile, email, roles
```

- **Realm** — isolated tenant. All TML services share one realm (`tml`).
- **Client** — an application registered in Keycloak. Confidential clients have a `client_secret`; public clients (SPAs, mobile) do not.
- **Realm role** — assigned to users/groups, appears in `realm_access.roles` claim.
- **Custom claim (mapper)** — `plant_list` is added via a custom protocol mapper.

---

## Installation & Setup

```bash
# Start Keycloak with Docker
docker run -p 8080:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:26.0.0 start-dev
```

Admin console: http://localhost:8080/admin

**Setup steps in the UI:**

1. Create realm: `tml` (top-left dropdown → Create realm)
2. Create client `ep-frontend`:
   - Client type: OpenID Connect
   - Client authentication: OFF (public client for SPA)
   - Valid redirect URIs: `http://localhost:3000/*`
   - Web origins: `http://localhost:3000`
3. Create client `ep-production-broadcast`:
   - Client authentication: ON (confidential — has client secret)
   - Service accounts enabled: OFF (user-facing, not service-to-service)
4. Create roles: `ROLE_OPERATOR`, `ROLE_SUPERVISOR`, `ROLE_ADMIN`
5. Create a test user, assign roles

**Export realm configuration for version control:**

```bash
docker exec keycloak /opt/keycloak/bin/kc.sh export \
  --dir /tmp/realm-export \
  --realm tml \
  --users realm_file

docker cp keycloak:/tmp/realm-export/tml-realm.json ./keycloak/realm-export.json
```

Commit `realm-export.json` — this is your infrastructure-as-code for Keycloak configuration.

---

## Beginner

### React: keycloak-js Integration

```bash
npm install keycloak-js
```

```typescript
// src/auth/keycloak.ts
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'https://keycloak.tml.com',
  realm: 'tml',
  clientId: 'ep-frontend',
});

export default keycloak;
```

```typescript
// src/main.tsx
import ReactDOM from 'react-dom/client';
import keycloak from './auth/keycloak';
import App from './App';

keycloak.init({
  onLoad: 'login-required',   // redirect to login if not authenticated
  checkLoginIframe: false,     // disable iframe polling (use token expiry instead)
  pkceMethod: 'S256',          // enforce PKCE
}).then((authenticated) => {
  if (authenticated) {
    ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
  }
});
```

```typescript
// src/auth/useAuth.ts
import keycloak from './keycloak';

export function useAuth() {
  return {
    token: keycloak.token,
    username: keycloak.tokenParsed?.preferred_username,
    roles: keycloak.tokenParsed?.realm_access?.roles ?? [],
    logout: () => keycloak.logout(),
    hasRole: (role: string) => keycloak.hasRealmRole(role),
  };
}
```

### PrivateRoute Component

```typescript
// src/auth/PrivateRoute.tsx
import { Navigate } from 'react-router-dom';
import keycloak from './keycloak';

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export function PrivateRoute({ children, requiredRole }: Props) {
  if (!keycloak.authenticated) {
    return <Navigate to="/login" replace />;
  }
  if (requiredRole && !keycloak.hasRealmRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}
```

### Adding Token to API Calls

```typescript
// src/api/apiClient.ts
import axios from 'axios';
import keycloak from '../auth/keycloak';

const apiClient = axios.create({ baseURL: '/api' });

apiClient.interceptors.request.use(async (config) => {
  // Refresh token if it expires within 30 seconds
  await keycloak.updateToken(30);
  config.headers.Authorization = `Bearer ${keycloak.token}`;
  return config;
});

export default apiClient;
```

### Spring Boot: @PreAuthorize on Controller

```java
@RestController
@RequestMapping("/api/work-orders")
public class WorkOrderController {

    @GetMapping
    @PreAuthorize("hasRole('ROLE_OPERATOR') or hasRole('ROLE_SUPERVISOR')")
    public List<WorkOrderDto> getWorkOrders() { ... }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    public void deleteWorkOrder(@PathVariable String id) { ... }
}
```

---

## Intermediate

### Spring Boot Resource Server Configuration

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers("/api/**").authenticated()
                .anyRequest().denyAll())
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .jwkSetUri("https://keycloak.tml.com/realms/tml/protocol/openid-connect/certs")));
        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        var converter = new JwtGrantedAuthoritiesConverter();
        converter.setAuthoritiesClaimName("realm_access.roles");
        converter.setAuthorityPrefix("ROLE_");
        var authConverter = new JwtAuthenticationConverter();
        authConverter.setJwtGrantedAuthoritiesConverter(converter);
        return authConverter;
    }
}
```

### JwtUtil: Decode Claims Without Verifying Signature

Useful for extracting claims in filters before the full security chain runs (e.g., for logging, routing):

```java
@Component
public class JwtUtil {

    public Map<String, Object> extractClaims(String bearerToken) {
        String token = bearerToken.replace("Bearer ", "");
        String[] parts = token.split("\\.");
        if (parts.length != 3) throw new IllegalArgumentException("Invalid JWT");
        byte[] payload = Base64.getUrlDecoder().decode(parts[1]);
        return new ObjectMapper().readValue(payload, new TypeReference<>() {});
    }

    public String extractUsername(String bearerToken) {
        return (String) extractClaims(bearerToken).get("preferred_username");
    }

    public List<String> extractRoles(String bearerToken) {
        Map<String, Object> claims = extractClaims(bearerToken);
        @SuppressWarnings("unchecked")
        Map<String, Object> realmAccess = (Map<String, Object>) claims.get("realm_access");
        return realmAccess != null ? (List<String>) realmAccess.get("roles") : List.of();
    }

    public boolean isExpired(String bearerToken) {
        Map<String, Object> claims = extractClaims(bearerToken);
        long exp = ((Number) claims.get("exp")).longValue();
        return Instant.ofEpochSecond(exp).isBefore(Instant.now());
    }
}
```

### SecurityContextFilter Pattern

```java
@Component
@Order(1)
@RequiredArgsConstructor
public class SecurityContextFilter implements Filter {

    private final JwtUtil jwtUtil;

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String username = jwtUtil.extractUsername(authHeader);
            MDC.put("userId", username);
        }
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.clear();
        }
    }
}
```

### Client Credentials Grant (Service-to-Service)

```java
@Service
public class ServiceTokenProvider {

    private final RestTemplate restTemplate;
    private final String tokenUrl;
    private final String clientId;
    private final String clientSecret;

    public String getServiceToken() {
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "client_credentials");
        body.add("client_id", clientId);
        body.add("client_secret", clientSecret);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        ResponseEntity<TokenResponse> response = restTemplate.postForEntity(
                tokenUrl,
                new HttpEntity<>(body, headers),
                TokenResponse.class);

        return Objects.requireNonNull(response.getBody()).getAccessToken();
    }

    record TokenResponse(
        @JsonProperty("access_token") String accessToken,
        @JsonProperty("expires_in") int expiresIn
    ) {}
}
```

### Python: Keycloak Token Introspection

```python
# requirements: python-keycloak
from keycloak import KeycloakOpenID

keycloak_openid = KeycloakOpenID(
    server_url="https://keycloak.tml.com/",
    realm_name="tml",
    client_id="ep-python-service",
    client_secret_key="your-client-secret",
)

def validate_token(token: str) -> dict:
    """Introspect token against Keycloak — confirms it is active and not forged."""
    token_info = keycloak_openid.introspect(token)
    if not token_info.get("active"):
        raise ValueError("Token is not active")
    return token_info

def get_userinfo(token: str) -> dict:
    """Fetch user profile from /userinfo endpoint using the access token."""
    return keycloak_openid.userinfo(token)
```

---

## Advanced

### Keycloak Admin Client: Create User and Assign Role

```java
@Service
public class KeycloakUserProvisioningService {

    private Keycloak adminClient;

    @PostConstruct
    public void init() {
        adminClient = KeycloakBuilder.builder()
                .serverUrl("https://keycloak.tml.com")
                .realm("master")
                .clientId("admin-cli")
                .username("admin")
                .password(adminPassword)
                .build();
    }

    public void provisionUser(String username, String email, String roleName) {
        RealmResource realmResource = adminClient.realm("tml");
        UsersResource usersResource = realmResource.users();

        UserRepresentation user = new UserRepresentation();
        user.setUsername(username);
        user.setEmail(email);
        user.setEnabled(true);

        Response response = usersResource.create(user);
        String userId = CreatedResponseUtil.getCreatedId(response);

        RoleRepresentation role = realmResource.roles().get(roleName).toRepresentation();
        usersResource.get(userId).roles().realmLevel().add(List.of(role));

        // Trigger password reset email
        usersResource.get(userId).executeActionsEmail(List.of("UPDATE_PASSWORD"));
    }
}
```

### AppAuth PKCE for Android

```kotlin
// build.gradle: implementation 'net.openid:appauth:0.11.1'

class LoginActivity : AppCompatActivity() {

    private lateinit var authService: AuthorizationService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        authService = AuthorizationService(this)

        val serviceConfig = AuthorizationServiceConfiguration(
            Uri.parse("https://keycloak.tml.com/realms/tml/protocol/openid-connect/auth"),
            Uri.parse("https://keycloak.tml.com/realms/tml/protocol/openid-connect/token")
        )

        val authRequest = AuthorizationRequest.Builder(
            serviceConfig,
            "ep-android-app",
            ResponseTypeValues.CODE,
            Uri.parse("com.tml.hht://callback")
        )
        .setScope("openid profile email")
        .setCodeVerifier(CodeVerifierUtil.generateRandomCodeVerifier())  // PKCE
        .build()

        val authIntent = authService.getAuthorizationRequestIntent(authRequest)
        startActivityForResult(authIntent, RC_AUTH)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == RC_AUTH) {
            val response = AuthorizationResponse.fromIntent(data!!)
            if (response != null) {
                authService.performTokenRequest(
                    response.createTokenExchangeRequest()
                ) { tokenResponse, _ ->
                    val accessToken = tokenResponse?.accessToken
                    // Store in EncryptedSharedPreferences — never plain SharedPreferences
                }
            }
        }
    }
}
```

### Custom Protocol Mapper (Add plant_list Claim to JWT)

In Keycloak Admin Console: Clients → ep-frontend → Client Scopes → Add Mapper → User Attribute

Or programmatically via Admin API:

```java
ProtocolMapperRepresentation mapper = new ProtocolMapperRepresentation();
mapper.setName("plant-list-mapper");
mapper.setProtocol("openid-connect");
mapper.setProtocolMapper("oidc-usermodel-attribute-mapper");
mapper.setConfig(Map.of(
    "user.attribute",       "plant_list",
    "claim.name",           "plant_list",
    "jsonType.label",       "JSON",       // parses as JSON array
    "id.token.claim",       "true",
    "access.token.claim",   "true",
    "multivalued",          "true"
));
clientResource.getProtocolMappers().createMapper(mapper);
```

Users must have `plant_list` attribute set (e.g., `["PLANT-01","PLANT-03"]`) in Keycloak user attributes.

---

## Expert

### Keycloak Clustering

Keycloak uses Infinispan (JGroups) for distributed session cache. For HA in Kubernetes:

```yaml
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: keycloak
          env:
            - name: KC_CACHE
              value: ispn
            - name: KC_CACHE_STACK
              value: kubernetes
            - name: JAVA_OPTS_APPEND
              value: "-Djgroups.dns.query=keycloak-headless.keycloak.svc.cluster.local"
```

Use a sticky session ALB during the login redirect flow to avoid session state mismatch between nodes. Once the token is issued, any node can verify it (stateless JWT validation).

### Silent Token Refresh Strategy

```typescript
// Check every 30 seconds; refresh if token expires within 60 seconds
setInterval(() => {
  keycloak.updateToken(60)
    .then((refreshed) => {
      if (refreshed) {
        // Update Authorization header in API client with new keycloak.token
        console.debug('Token refreshed silently');
      }
    })
    .catch(() => {
      console.error('Token refresh failed — session expired');
      keycloak.logout();
    });
}, 30_000);
```

### Certificate Rotation and JWKS Endpoint

Spring Boot auto-fetches public keys from Keycloak's JWKS endpoint. When Keycloak rotates its signing keys, Spring Boot detects the new `kid` in incoming JWTs and re-fetches automatically — no restart required.

```
JWKS endpoint: https://keycloak.tml.com/realms/tml/protocol/openid-connect/certs

Response:
{
  "keys": [
    { "kid": "current-key-id", "kty": "RSA", "use": "sig", "n": "...", "e": "AQAB" }
  ]
}
```

### Debugging 401 Unauthorized

```bash
# Step 1: Extract the raw token from browser DevTools → Network → Authorization header

# Step 2: Decode the payload section (middle part)
echo "eyJzdWIi..." | base64 -d 2>/dev/null | python3 -m json.tool

# Step 3: Verify these claims:
# "iss" must match spring.security.oauth2.resourceserver.jwt.issuer-uri
# "aud" must match the Spring Boot service's client ID
# "exp" must be in the future (unix timestamp > now)
# "realm_access.roles" must contain the required role

# Step 4: Check the JWKS endpoint is reachable from the service
curl https://keycloak.tml.com/realms/tml/protocol/openid-connect/certs
```

Common mismatches:
- `iss` uses `http://` but Spring config has `https://` (or vice versa)
- `aud` claim missing — add the "audience" mapper in Keycloak client
- Clock skew > 30 seconds between the service pod and Keycloak
- Role not in `realm_access.roles` — check group assignment in Keycloak

---

## In the TML Codebase

### Keycloak Version Matrix

| Service | Keycloak Version | Notes |
|---|---|---|
| Older services (pre-2024) | 19 | Legacy theme, older token format |
| ep-prolife-service-ui | 26 | New theme, PKCE enforced |
| HHT Android app | 26 | AppAuth PKCE |
| Terraform-managed | 26 | keycloak Terraform provider 4.x |

Migration from Keycloak 19 → 26: the `KC_HOSTNAME_URL` env var is replaced by `KC_HOSTNAME`; realm export/import is required; the OIDC discovery path is unchanged.

### STATELESS Session Policy

All Spring Boot services use `SessionCreationPolicy.STATELESS`. No server-side session is created. Every request must carry a valid JWT in the `Authorization: Bearer` header.

### ep-authorization Service

A dedicated service centralises business-level access control:

```
Request flow:
  React UI → Bearer token → ep-production-broadcast
  ep-production-broadcast → POST /api/authorize
    Body: { userId: "john.doe", plantCode: "PLANT-01", operation: "CLOSE_WORK_ORDER" }
  ep-authorization → { allowed: true, allowedOperations: [...] }
  ep-production-broadcast → proceeds only if allowed: true
```

This separates authentication (valid JWT) from business authorization (can this user perform this operation at this plant).

### SecurityContextFilter + JwtUtil Pattern

Every Spring Boot service follows the same two-class pattern:
1. `JwtUtil` — decodes JWT payload for claim extraction (MDC, logging). Does not verify the signature.
2. `SecurityContextFilter` — sets `MDC.put("userId", username)` before the request enters controllers.
3. Spring Security `oauth2ResourceServer` — performs full RS256 signature verification via JWKS.

The `JwtUtil` is only for reading claims. **Never use it to make authorization decisions** — Spring Security does the authoritative check.

### Claims Used Across Services

| Claim | Purpose |
|---|---|
| `preferred_username` | Audit logs, MDC, display name |
| `realm_access.roles` | Spring Security `hasRole()` checks |
| `plant_list` | Custom claim — which plants this user can access |
| `sub` | Unique user UUID for database foreign keys |

### Token Storage: Memory, Not localStorage

```typescript
// WRONG — vulnerable to XSS attacks
localStorage.setItem('access_token', keycloak.token);

// CORRECT — keycloak-js stores token in a JavaScript variable (in-memory)
// Token is lost on page refresh, but keycloak-js re-establishes SSO silently
// This is the default behaviour — do not override it
```

---

## Quick Reference

### JWT Claims Reference

| Claim | Example Value | Description |
|---|---|---|
| `sub` | `"550e8400-e29b-41d4-a716-446655440000"` | Keycloak user UUID |
| `preferred_username` | `"john.doe"` | Login username |
| `email` | `"john.doe@tml.com"` | Email address |
| `realm_access.roles` | `["ROLE_OPERATOR"]` | Realm roles array |
| `iss` | `"https://keycloak.tml.com/realms/tml"` | Issuer URI |
| `aud` | `"ep-production-broadcast"` | Intended audience |
| `exp` | `1714000000` | Expiry (Unix timestamp) |
| `plant_list` | `["PLANT-01","PLANT-03"]` | Custom claim |

### Spring Security Config Skeleton

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
        .csrf(AbstractHttpConfigurer::disable)
        .authorizeHttpRequests(a -> a
            .requestMatchers("/actuator/health/**").permitAll()
            .anyRequest().authenticated())
        .oauth2ResourceServer(o -> o.jwt(j -> j
            .jwkSetUri("https://keycloak.tml.com/realms/tml/protocol/openid-connect/certs")))
        .build();
}
```

### keycloak-js Init Options

| Option | Values | Default | Effect |
|---|---|---|---|
| `onLoad` | `login-required`, `check-sso` | none | `login-required` redirects immediately |
| `pkceMethod` | `S256`, `plain` | none | `S256` enforces PKCE for public clients |
| `checkLoginIframe` | `true`, `false` | `true` | Set `false` to disable iframe polling |
| `silentCheckSsoRedirectUri` | URL string | unset | Enable silent SSO via hidden iframe |
