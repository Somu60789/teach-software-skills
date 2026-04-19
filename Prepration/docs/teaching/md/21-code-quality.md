# 21 — Code Quality & Linting

## 1. Prerequisites

Before working through this document you should be comfortable with:

- **React (01)** — project structure, package.json scripts, npm workflow
- **Spring Boot (02)** — Gradle build files, plugin system, project structure

You do not need prior experience with linting or formatting tools. This document explains them from first principles.

---

## 2. What & Why

Code quality enforcement is one of the highest-return investments a team can make. The return is not just clean code — it is the elimination of an entire category of review comments ("add a blank line here", "missing semicolon", "this method is too long") so code reviews focus on logic, design, and correctness.

**Consistent style reduces cognitive load.** When every file in a codebase looks the same, you spend zero mental energy parsing formatting and 100% of your attention on the logic. Onboarding a new developer is faster when there is nothing to "learn" about local style conventions.

**Review friction disappears.** Style debates in pull request comments ("I prefer single quotes", "trailing commas yes or no") are resolved once at the tooling level and never discussed again. Engineers stop defending personal preferences because the tool decides — not the reviewer and not the author.

**Automated enforcement ensures standards are actually applied.** A style guide that lives in a wiki is aspirational. A pre-commit hook that reformats code on every commit is a hard guarantee. The difference between "we try to follow this" and "this is enforced" is the difference between inconsistent code and consistent code.

---

## 3. Core Concepts

**Linting** is static analysis — running rules over source code without executing it. Linters find both style issues (variable naming, import order) and genuine bugs (unused variables that are likely a typo, unreachable code, use of `==` instead of `===` in JavaScript). ESLint for JavaScript, Checkstyle for Java, Detekt for Kotlin.

**Formatting** auto-fixes whitespace, line breaks, and punctuation. Unlike linting, formatting produces no warnings — it just rewrites the file. There is no human decision to make: you run the formatter and commit. Prettier for JavaScript/TypeScript, Spotless (wrapping google-java-format or ktfmt) for JVM languages.

**Static analysis** goes deeper than style: it detects code smells, calculates cyclomatic complexity, finds duplicated blocks, and flags security vulnerabilities. SonarQube and Qodana perform this analysis on the full codebase after every push.

**Git hooks** enforce quality at commit time — before the code ever reaches a remote repository. A pre-commit hook runs formatting and linting in seconds. Any failure aborts the commit and shows the developer exactly what to fix. Hooks are configured with Husky (JavaScript) or a custom `.githooks/` directory (Java/Kotlin).

---

## 4. Installation & Setup

### Java / Kotlin

Spotless is managed by Gradle. After cloning any Spring Boot service, run the one-time setup:

```bash
# Installs .githooks/pre-commit — must run once per clone
./setup.sh

# Check if code needs formatting (non-destructive, exits non-zero if changes needed)
./gradlew spotlessCheck

# Apply formatting in-place (rewrites files)
./gradlew spotlessApply
```

### JavaScript / TypeScript

Husky installs hooks automatically when you run `npm install` (via the `prepare` script). ESLint and Prettier are project dependencies.

```bash
npm install          # also installs Husky hooks via prepare script
npm run lint         # run ESLint, print all warnings and errors
npm run lint:fix     # run ESLint with --fix flag (auto-fixes what it can)
npm run format       # run Prettier over all files
npm run format:check # check formatting without rewriting (used in CI)
```

---

## 5. Beginner

### ESLint configuration

```javascript
// .eslintrc.cjs — CommonJS format required when package.json has "type":"module"
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react', 'react-hooks', '@typescript-eslint'],
  rules: {
    // Errors that indicate real bugs
    'no-unused-vars': 'error',
    'no-undef': 'error',
    'no-unreachable': 'error',

    // Warnings for style — set to 'error' to enforce strictly
    'no-console': 'warn',
    'prefer-const': 'warn',

    // React-specific
    'react/prop-types': 'off',         // TypeScript handles this
    'react/react-in-jsx-scope': 'off', // Not needed with React 17+ JSX transform
  },
  ignorePatterns: ['dist/', 'build/', 'node_modules/', '*.min.js'],
};
```

### .eslintignore

```
dist/
build/
coverage/
node_modules/
*.config.js
vite.config.ts
```

### Prettier configuration

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### VS Code workspace settings

```json
// .vscode/settings.json — commit this so all team members get the same experience
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## 6. Intermediate

### Spotless in build.gradle.kts

```kotlin
// build.gradle.kts
plugins {
    id("com.diffplug.spotless") version "6.23.3"
}

spotless {
    // Only reformat files changed since origin/main — fast for incremental work
    ratchetFrom("origin/main")

    java {
        importOrder()
        removeUnusedImports()
        googleJavaFormat("1.17.0")
        trimTrailingWhitespace()
        endWithNewline()
    }

    kotlin {
        ktfmt("0.46").googleStyle()
        trimTrailingWhitespace()
        endWithNewline()
    }

    kotlinGradle {
        ktfmt("0.46").googleStyle()
    }
}
```

The `ratchetFrom("origin/main")` directive means Spotless only checks files that differ from the main branch. This prevents the situation where adding Spotless to a large existing codebase forces you to reformat 10,000 lines of unrelated code before you can make a two-line fix.

### Husky + lint-staged

```json
// package.json
{
  "scripts": {
    "prepare": "husky install",
    "lint": "eslint src --ext .js,.jsx,.ts,.tsx --max-warnings 0",
    "lint:fix": "eslint src --ext .js,.jsx,.ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{js,jsx,ts,tsx,css,json}\"",
    "format:check": "prettier --check \"src/**/*.{js,jsx,ts,tsx,css,json}\""
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix --max-warnings 0",
      "prettier --write"
    ],
    "*.{css,json,md}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

`lint-staged` runs linting and formatting only on files staged for the current commit. This is critical for performance: you do not reformat the entire codebase on every commit, only the files you changed.

### TypeScript strict mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

`noUncheckedIndexedAccess` is the most impactful strict option most teams do not enable. It makes `array[0]` return `T | undefined` instead of `T`, forcing you to handle the case where the array is empty. This eliminates an entire class of runtime crashes.

---

## 7. Advanced

### Detekt for Kotlin

```yaml
# detekt.yml
complexity:
  LongMethod:
    active: true
    threshold: 60           # Flag methods longer than 60 lines
  CyclomaticComplexMethod:
    active: true
    threshold: 15
  LargeClass:
    active: true
    threshold: 300

style:
  MagicNumber:
    active: true
    ignoreNumbers: ['-1', '0', '1', '2']
    ignoreHashCodeFunction: true
    ignorePropertyDeclaration: true
  WildcardImport:
    active: true

naming:
  FunctionNaming:
    active: true
    functionPattern: '[a-z][a-zA-Z0-9]*'
    # Allow backtick test names: `should do something when condition`
    excludes: ['**/test/**', '**/Test.kt']
```

```kotlin
// build.gradle.kts
plugins {
    id("io.gitlab.arturbosch.detekt") version "1.23.4"
}

detekt {
    config.setFrom(files("detekt.yml"))
    buildUponDefaultConfig = true
    allRules = false
    // Run detekt with type resolution for more accurate analysis
    source.setFrom("src/main/kotlin")
}

tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach {
    reports {
        html.required.set(true)
        xml.required.set(true)  // for CI integration
    }
}
```

### Checkstyle for Java

```xml
<!-- checkstyle.xml -->
<?xml version="1.0"?>
<!DOCTYPE module PUBLIC "-//Checkstyle//DTD Checkstyle Configuration 1.3//EN"
    "https://checkstyle.org/dtds/configuration_1_3.dtd">
<module name="Checker">
    <property name="severity" value="error"/>

    <module name="TreeWalker">
        <module name="MethodLength">
            <property name="max" value="60"/>
        </module>
        <module name="ParameterNumber">
            <property name="max" value="7"/>
        </module>
        <module name="CyclomaticComplexity">
            <property name="max" value="15"/>
        </module>
        <module name="MagicNumber">
            <property name="ignoreNumbers" value="-1, 0, 1, 2"/>
        </module>
    </module>

    <!-- Suppress checkstyle in generated code -->
    <module name="SuppressionFilter">
        <property name="file" value="checkstyle-suppressions.xml"/>
    </module>
</module>
```

### SonarQube integration

```kotlin
// build.gradle.kts
plugins {
    id("org.sonarqube") version "4.4.1.3373"
}

sonar {
    properties {
        property("sonar.projectKey", "tml_ep-production-broadcast")
        property("sonar.projectName", "EP Production Broadcast")
        property("sonar.sources", "src/main")
        property("sonar.tests", "src/test")
        property("sonar.coverage.jacoco.xmlReportPaths",
            "build/reports/jacoco/test/jacocoTestReport.xml")
        property("sonar.kotlin.detekt.reportPaths",
            "build/reports/detekt/detekt.xml")
        property("sonar.qualitygate.wait", "true") // fail build if quality gate fails
    }
}
```

Quality gate configuration in SonarQube UI (or via API):
- Coverage on new code: > 80%
- Duplicated lines on new code: < 3%
- Maintainability rating: A
- Reliability rating: A
- Security rating: A

### Writing a custom ESLint rule

```javascript
// eslint-rules/no-direct-window-location.js
// Prevents direct window.location.href assignment — use React Router's navigate() instead
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow direct window.location.href assignments',
      recommended: false,
    },
    messages: {
      useNavigate: 'Use React Router navigate() instead of window.location.href',
    },
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        if (
          node.left.type === 'MemberExpression' &&
          node.left.object.name === 'location' &&
          node.left.property.name === 'href'
        ) {
          context.report({ node, messageId: 'useNavigate' });
        }
      },
    };
  },
};
```

---

## 8. Expert

### Enforcing zero warnings in CI

```yaml
# .github/workflows/ci.yml
- name: Lint (zero warnings allowed)
  run: npm run lint -- --max-warnings 0
```

`--max-warnings 0` means any ESLint warning becomes a build failure. This is the right setting for production codebases: if a rule is important enough to have, it should break the build, not just print a yellow message that gets ignored.

The implication: every rule in `.eslintrc.cjs` that is set to `'warn'` will fail CI. Either set rules to `'error'` (enforced) or `'off'` (not checked). Remove the middle ground.

### Code smell taxonomy

Understanding the canonical code smells helps you identify problems before the linter catches them:

- **Long method** — a method that does too many things. Rule of thumb: if you need a comment to explain a block within a method, extract that block into a named method.
- **Large class** — a class with too many responsibilities. God objects in manufacturing software often evolve as "one service that handles all material operations" — split by bounded context.
- **Feature envy** — a method that uses more data from another class than from its own. It belongs in that other class.
- **Data clumps** — three or more fields that always appear together (plant code, BU code, material code). Extract them into a value object.
- **Primitive obsession** — using `String` for a plant code, `int` for a BU code. Wrap in a named type so the compiler prevents mixing them.
- **Shotgun surgery** — a single change requires editing many classes. Indicates poorly cohesive design.

### Technical debt tracking with SonarQube

SonarQube's SQALE (Software Quality Assessment based on Lifecycle Expectations) model estimates remediation time for each issue. The debt ratio is:

```
Debt Ratio = (Total Remediation Cost) / (Cost to rewrite from scratch)
```

Ratings:
- **A** — debt ratio 0-5%
- **B** — 6-10%
- **C** — 11-20%
- **D** — 21-50%
- **E** — over 50% (the code costs more to maintain than it would to rewrite)

### Cognitive complexity vs cyclomatic complexity

**Cyclomatic complexity** counts the number of linearly independent paths through a method (each `if`, `for`, `while`, `case`, `&&`, `||` adds 1). A method with cyclomatic complexity > 15 is hard to test completely.

**Cognitive complexity** (SonarQube's metric) counts how hard code is to understand, not just how many paths exist. Nested conditions score higher than flat conditions with the same number of branches. A flat chain of `if-else if` with 10 branches has lower cognitive complexity than a nested 3-level `if` tree.

Prefer optimising for cognitive complexity in manufacturing code where business rules are inherently complex — readable flat code is better than clever nested code even when the path count is the same.

---

## 9. In the TML Codebase

### Spotless via pre-commit hook

Every Spring Boot service has a `.githooks/pre-commit` file. This hook is NOT automatically active — you must run `./setup.sh` once after cloning:

```bash
git clone git@github.com:tata-motors/ep-production-broadcast.git
cd ep-production-broadcast
./setup.sh   # <-- required step, hooks don't install themselves
```

If you forget and push unformatted code, the GitHub Actions CI job runs `./gradlew spotlessCheck` and fails. The fix is always `./gradlew spotlessApply && git add -p && git commit`.

### ESLint in GitHub Actions CI

All React projects run ESLint in CI with `--max-warnings 0`. Any lint warning that was acceptable during local development becomes a build failure. The CI job looks like:

```yaml
- name: Lint
  run: npm run lint -- --max-warnings 0
  working-directory: frontend/
```

This means you cannot merge a PR with an `any` type escape hatch, an unused import, or a `console.log` left in from debugging. The rule is absolute.

### Prettier config per project

Different product teams have slightly different Prettier configurations. The configs are not shared across repos — each team owns their formatting preferences. Before submitting a PR, always run `npm run format` in the specific project you are working in.

### qodana.yaml for deep static analysis

Some repos include a `qodana.yaml` at the root. Qodana is JetBrains' SonarQube-equivalent that runs in CI:

```yaml
# qodana.yaml
version: "1.0"
linter: jetbrains/qodana-jvm:latest
profile:
  name: qodana.starter
exclude:
  - name: All
    paths:
      - build/
      - src/generated/
failureConditions:
  severityThresholds:
    any: 50
    critical: 1
    high: 5
```

### build.gradle.kts Spotless config reference

```kotlin
spotless {
    ratchetFrom("origin/main")

    java {
        importOrder()
        removeUnusedImports()
        googleJavaFormat("1.17.0")
    }

    kotlin {
        ktfmt("0.46").googleStyle()
    }

    kotlinGradle {
        ktfmt("0.46").googleStyle()
    }
}
```

---

## 10. Quick Reference

### Common ESLint rules reference

| Rule | Effect |
|---|---|
| `no-unused-vars: error` | Error on declared but unused variables |
| `no-console: warn` | Warn on `console.*` calls (use logger instead) |
| `prefer-const: error` | Error when `let` could be `const` |
| `no-var: error` | Disallow `var` (use `let`/`const`) |
| `eqeqeq: error` | Require `===` instead of `==` |
| `no-implicit-coercion: error` | Disallow `!!`, `+`, `~` type coercions |
| `@typescript-eslint/no-explicit-any: error` | Disallow `any` type |
| `@typescript-eslint/no-non-null-assertion: error` | Disallow `!` non-null assertions |
| `react-hooks/rules-of-hooks: error` | Enforce hooks rules |
| `react-hooks/exhaustive-deps: warn` | Warn on missing hook dependencies |

### Spotless Gradle DSL

```kotlin
spotless {
    ratchetFrom("origin/main")   // only check changed files
    java { googleJavaFormat("1.17.0") }
    kotlin { ktfmt("0.46").googleStyle() }
    kotlinGradle { ktfmt("0.46").googleStyle() }
}
```

### Husky v9 setup commands

```bash
npm install --save-dev husky lint-staged
npx husky init
# Creates .husky/pre-commit — edit to run lint-staged
echo "npx lint-staged" > .husky/pre-commit
```

### Detekt YAML structure

```yaml
# detekt.yml
<rule-set>:
  <Rule>:
    active: true
    threshold: <number>
    excludes: ['**/test/**']
```

Common rule sets: `complexity`, `style`, `naming`, `performance`, `exceptions`, `coroutines`.

### Pre-commit vs CI enforcement model

```
Developer commits
       │
       ▼
.githooks/pre-commit
  spotlessApply (Java/Kotlin)
  lint-staged (JS/TS)
       │
  Pass? ──No──► Abort commit, show diff
       │
      Yes
       │
       ▼
GitHub Actions CI
  spotlessCheck --max-warnings 0
  ./gradlew test
  sonarqube scan
       │
  Pass? ──No──► Block PR merge
       │
      Yes
       ▼
  PR ready to merge
```
