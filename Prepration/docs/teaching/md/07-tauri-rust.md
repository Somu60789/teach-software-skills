# Tauri & Rust

## Prerequisites

- Completed `01-react.md`: you can build a React app with components, state, and hooks
- Basic programming concepts: functions, structs, types, error handling
- Terminal comfort: you run npm commands and understand what a build output is
- No prior Rust experience required — this document introduces what you need for Tauri

---

## What & Why

**Tauri** is a framework for building desktop applications. You write the user interface with any web frontend framework (React, Vue, Svelte) and Tauri packages it into a native desktop app using the operating system's built-in WebView. A small Rust process runs alongside the WebView and handles anything the browser sandbox cannot: file system access, native OS APIs, hardware communication, and network calls that bypass CORS.

**Why Tauri over Electron:**

Electron bundles a full Chromium browser and Node.js runtime inside every app. A minimal Electron app is 150–200 MB. Tauri uses the system WebView (WebKit on macOS/Linux, WebView2 on Windows), so the app binary is 3–10 MB. Memory usage is proportionally lower too — roughly 10x less than an equivalent Electron app at runtime.

For TML shop-floor PCs, this matters because:
- Installer size affects deployment speed across hundreds of machines
- Lower memory footprint leaves more headroom for other plant software
- Windows NSIS installers built by Tauri are standard corporate deployment packages

**Why Rust for the backend:**

Rust is a systems programming language with memory safety guarantees enforced at compile time. No garbage collector, no null pointer dereferences, no data races — the compiler rejects unsafe code before it ever runs. For IPP (Internet Printing Protocol) label printing, where incorrect byte-level protocol handling would silently corrupt print jobs, Rust's correctness guarantees are worth the steeper learning curve.

---

## Core Concepts

**Tauri architecture:**

```
┌─────────────────────────────────────┐
│  WebView (React + Vite)             │  Frontend — your UI
│  invoke('command_name', { args })   │  JavaScript → Rust call
└─────────────────┬───────────────────┘
                  │ IPC (inter-process communication)
┌─────────────────▼───────────────────┐
│  Rust process                       │  Backend
│  #[tauri::command] fn handler()     │  Runs natively on OS
│  tokio async runtime                │
└─────────────────────────────────────┘
```

**IPC model:** The frontend calls `invoke('rust_function_name', { param: value })`. Tauri serialises the arguments to JSON, passes them to the Rust function, serialises the return value, and resolves the JavaScript Promise. There is no shared memory — all communication is message-passing over JSON.

**`tauri.conf.json`:** Controls the app bundle: app name, version, window size, capabilities (what filesystem paths can be accessed, what shell commands can run), and build configuration.

**Capabilities model (Tauri 2):** Instead of a flat allowlist, Tauri 2 uses a capabilities JSON to grant specific permissions to specific windows. This prevents a compromised frontend from accessing sensitive OS resources you didn't explicitly permit.

---

## Installation & Setup

```bash
# 1. Install Rust (includes cargo, the Rust package manager)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup toolchain install stable
rustup target add x86_64-pc-windows-msvc   # for Windows cross-build (optional)

# 2. Install system dependencies (Ubuntu/Debian)
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev

# 3. Create a new Tauri + React + Vite project
npm create tauri-app@latest
# Choose: React, TypeScript, Vite

cd my-tauri-app
npm install

# 4. Run in development (hot-reloads both React and Rust)
npm run tauri dev

# 5. Build production installer
npm run tauri build
```

**`src-tauri/Cargo.toml`:**

```toml
[package]
name    = "my-tauri-app"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri        = { version = "2", features = ["protocol-asset"] }
tauri-build  = { version = "2", features = [] }
serde        = { version = "1", features = ["derive"] }
serde_json   = "1"
tokio        = { version = "1", features = ["full"] }
reqwest      = { version = "0.12", features = ["json"] }
thiserror    = "1"

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

---

## Beginner

### Your first Tauri command

```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

// Every #[tauri::command] function is exposed to the frontend
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust.", name)
}

#[tauri::command]
fn add_numbers(a: i32, b: i32) -> i32 {
    a + b
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, add_numbers])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Calling from React

```tsx
// src/App.tsx
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';

function App() {
    const [greeting, setGreeting] = useState('');
    const [name, setName]         = useState('');

    async function handleGreet() {
        try {
            const message = await invoke<string>('greet', { name });
            setGreeting(message);
        } catch (err) {
            console.error('Invoke failed:', err);
        }
    }

    return (
        <div>
            <input value={name} onChange={e => setName(e.target.value)} />
            <button onClick={handleGreet}>Greet</button>
            <p>{greeting}</p>
        </div>
    );
}
```

### `tauri.conf.json` essentials

```json
{
  "productName": "TML Shop Floor",
  "version": "1.0.0",
  "identifier": "com.tml.shopfloor",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173"
  },
  "app": {
    "windows": [{
      "title": "TML Shop Floor",
      "width":  1280,
      "height": 800,
      "resizable": true,
      "fullscreen": false
    }]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/icon.ico"]
  }
}
```

---

## Intermediate

### Rust structs with Serde (JSON serialisation)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PrintJob {
    pub material_code: String,
    pub description:   String,
    pub quantity:      u32,
    pub plant_code:    String,
}

#[derive(Debug, Serialize)]
pub struct PrintResult {
    pub success:     bool,
    pub job_id:      Option<String>,
    pub error:       Option<String>,
}

// The command receives a PrintJob from JS and returns a PrintResult
#[tauri::command]
async fn print_label(job: PrintJob) -> Result<PrintResult, String> {
    match send_ipp_print_job(&job).await {
        Ok(job_id) => Ok(PrintResult { success: true, job_id: Some(job_id), error: None }),
        Err(e)     => Err(e.to_string()),
    }
}
```

### `Result<T, String>` for error handling

```rust
#[tauri::command]
async fn fetch_stock(material_code: String, plant_code: String) -> Result<StockLevel, String> {
    let url = format!(
        "{}/api/materials/{}/stock?plant={}",
        std::env::var("API_BASE_URL").unwrap_or_default(),
        material_code,
        plant_code
    );

    reqwest::get(&url)
        .await
        .map_err(|e| format!("Network error: {}", e))?
        .json::<StockLevel>()
        .await
        .map_err(|e| format!("Parse error: {}", e))
}
```

The `?` operator is Rust's error propagation shorthand. If the `Result` is `Err`, it returns early from the function with that error.

### Async Tauri command

Any function that does I/O should be `async`. Tauri 2 uses `tokio` under the hood.

```rust
#[tauri::command]
async fn download_config(url: String) -> Result<String, String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    response.text().await.map_err(|e| e.to_string())
}
```

### Emitting events from Rust to frontend

```rust
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct PrintProgressEvent {
    job_id:   String,
    percent:  u8,
    status:   String,
}

async fn long_print_job(app: AppHandle, job: PrintJob) {
    for step in 0..=100u8 {
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        app.emit("print_progress", PrintProgressEvent {
            job_id:  job.material_code.clone(),
            percent: step,
            status:  if step == 100 { "done".into() } else { "printing".into() },
        }).ok();
    }
}

// React side
import { listen } from '@tauri-apps/api/event';
useEffect(() => {
    const unlisten = listen<PrintProgressEvent>('print_progress', (event) => {
        setProgress(event.payload.percent);
    });
    return () => { unlisten.then(f => f()); };
}, []);
```

---

## Advanced

### IPP (Internet Printing Protocol) label printing

IPP is an HTTP-based protocol. Printers expose an endpoint at `http://printer-ip:631/ipp/print`. A print job is an HTTP POST with a binary IPP payload.

```rust
use std::io::Write;

async fn send_ipp_print_job(job: &PrintJob, printer_url: &str) -> Result<String, IppError> {
    // Build the IPP request manually (or use the `ipp` crate)
    let mut ipp_payload: Vec<u8> = Vec::new();

    // IPP version 2.0 + operation Print-Job (0x0002)
    ipp_payload.write_all(&[0x02, 0x00, 0x00, 0x02]).unwrap();  // version + op-id
    ipp_payload.write_all(&[0x00, 0x00, 0x00, 0x01]).unwrap();  // request-id = 1

    // operation-attributes-tag (0x01)
    ipp_payload.push(0x01);
    write_ipp_attribute(&mut ipp_payload, "attributes-charset", "utf-8");
    write_ipp_attribute(&mut ipp_payload, "attributes-natural-language", "en");
    write_ipp_attribute(&mut ipp_payload, "printer-uri", printer_url);

    // job-attributes-tag (0x02)
    ipp_payload.push(0x02);
    write_ipp_attribute(&mut ipp_payload, "job-name", &job.material_code);
    write_ipp_attribute(&mut ipp_payload, "document-format", "application/octet-stream");

    // end-of-attributes (0x03)
    ipp_payload.push(0x03);

    // Append ZPL label data
    let zpl = format!("^XA^FO50,50^ADN,36,20^FD{}^FS^XZ", job.material_code);
    ipp_payload.extend_from_slice(zpl.as_bytes());

    let client = reqwest::Client::new();
    let response = client
        .post(printer_url)
        .header("Content-Type", "application/ipp")
        .body(ipp_payload)
        .send()
        .await?;

    // Parse job-id from IPP response
    let body = response.bytes().await?;
    extract_job_id(&body)
}
```

### File system API (Tauri fs plugin)

```bash
# Add the plugin
cargo add tauri-plugin-fs
npm install @tauri-apps/plugin-fs
```

```rust
// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![...])
        .run(tauri::generate_context!())
        .expect("error");
}
```

```ts
// React
import { readTextFile, writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

const content = await readTextFile('config.json', { baseDir: BaseDirectory.AppConfig });
await writeTextFile('log.txt', logData, { baseDir: BaseDirectory.AppLog });
```

### Window management

```rust
use tauri::{Manager, WebviewWindowBuilder};

#[tauri::command]
async fn open_print_preview(app: AppHandle, job_id: String) {
    let label = format!("print_preview_{}", job_id);
    if let Some(existing) = app.get_webview_window(&label) {
        existing.set_focus().ok();
        return;
    }
    WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App("/print-preview".into()))
        .title("Print Preview")
        .inner_size(800.0, 600.0)
        .build()
        .expect("failed to open print preview");
}
```

---

## Expert

### Cross-platform build

```bash
# On Linux, build for Linux
npm run tauri build
# → src-tauri/target/release/bundle/appimage/my-app.AppImage
# → src-tauri/target/release/bundle/deb/my-app.deb

# On Windows, build for Windows
npm run tauri build
# → src-tauri/target/release/bundle/nsis/my-app-setup.exe
# → src-tauri/target/release/bundle/msi/my-app.msi
```

For cross-compilation (build Windows installer from Linux), use GitHub Actions with `tauri-apps/tauri-action`:

```yaml
# .github/workflows/build.yml
- uses: tauri-apps/tauri-action@v0
  with:
    tagName: v${{ github.ref_name }}
    releaseName: 'App v${{ github.ref_name }}'
    args: --target x86_64-pc-windows-msvc
```

### Rust error handling with `thiserror`

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum IppError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Printer returned HTTP {status}: {body}")]
    PrinterError { status: u16, body: String },

    #[error("Could not parse IPP response: {0}")]
    ParseError(String),

    #[error("Printer not found at {url}")]
    PrinterNotFound { url: String },
}

// Tauri commands can return custom errors if they implement ToString
// The simplest way: implement Display (thiserror does this via #[error(...)])
#[tauri::command]
async fn print_with_custom_error(job: PrintJob) -> Result<PrintResult, String> {
    send_ipp_print_job(&job)
        .await
        .map_err(|e| e.to_string())  // converts IppError to String for Tauri IPC
}
```

### Debugging Rust backend

```bash
# Show full panic stack traces
RUST_BACKTRACE=1 npm run tauri dev

# Full backtrace with symbol names
RUST_BACKTRACE=full npm run tauri dev

# println! goes to the terminal where you ran `npm run tauri dev`
# Use eprintln! for stderr (also visible in terminal)
```

For production bugs, enable Tauri's logging plugin:

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new()
            .level(log::LevelFilter::Info)
            .build())
        .run(tauri::generate_context!())
        .expect("error");
}

// Rust code
log::info!("Print job started: {}", job.material_code);
log::error!("IPP error: {:?}", err);
```

Logs are written to `%APPDATA%\com.tml.shopfloor\logs\` on Windows.

---

## In the TML Codebase

**`ep-prolife-service-ui`**
This is the shop-floor desktop app distributed to plant PCs. It runs on Windows and allows supervisors to manage production confirmations, trigger label printing, and view real-time machine status. The React 19 + Vite frontend communicates with the Rust backend via Tauri `invoke()` calls.

**IPP label printing in `src-tauri/src/`**
The Rust backend connects to Zebra label printers on the plant network via IPP over HTTP. The print command accepts a `PrintJob` struct, builds a ZPL (Zebra Programming Language) document, wraps it in an IPP request, and POSTs it to the printer's IPP endpoint. This is impossible from a browser (no raw TCP/HTTP to arbitrary hosts), but trivial from Rust.

**`src-tauri/Cargo.toml` dependencies**
```toml
tauri     = "2"
tokio     = { version = "1", features = ["full"] }
serde     = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest   = { version = "0.12", features = ["json"] }
thiserror = "1"
```

**`tauri.conf.json` capabilities**
The app declares capabilities for filesystem access (read/write to `AppData` directory) and shell access (for running diagnostics). No network allow-list is needed because `reqwest` in Rust bypasses the WebView's security policies.

**Windows installer distribution**
The CI pipeline builds the NSIS installer (`my-app-setup.exe`) and publishes it to an internal artifact server. IT deploys it via Group Policy to shop-floor PCs. Tauri's updater plugin checks for new versions on startup and downloads the delta update.

---

## Quick Reference

### Tauri command template

```rust
// Rust
#[tauri::command]
async fn my_command(
    param_one: String,
    param_two: u32,
    app: tauri::AppHandle,   // optional: access to Tauri app APIs
) -> Result<MyReturnType, String> {
    // do work
    Ok(result)
}

// Register in main()
.invoke_handler(tauri::generate_handler![my_command])
```

### `invoke()` call patterns

```ts
// Basic call
const result = await invoke<ReturnType>('command_name', { paramOne: 'value', paramTwo: 42 });

// With error handling
try {
    const data = await invoke<StockLevel>('fetch_stock', { materialCode, plantCode });
    setStock(data);
} catch (err: unknown) {
    setError(typeof err === 'string' ? err : 'Unknown error');
}

// Fire-and-forget (don't await)
invoke('log_event', { event: 'scan', data: barcodeValue });
```

### Tauri build target table

| OS      | Target                          | Output                          |
|---------|---------------------------------|---------------------------------|
| Windows | `x86_64-pc-windows-msvc`        | `bundle/nsis/*.exe`, `bundle/msi/*.msi` |
| Linux   | `x86_64-unknown-linux-gnu`      | `bundle/appimage/*.AppImage`, `bundle/deb/*.deb` |
| macOS   | `x86_64-apple-darwin` (Intel)   | `bundle/macos/*.app`, `bundle/dmg/*.dmg` |
| macOS   | `aarch64-apple-darwin` (M-chip) | Same as above                   |

### Rust ownership quick reference

```rust
let s = String::from("hello");
let s2 = s;          // s is MOVED — s is no longer valid
// println!("{}", s);  // compile error: s was moved

let s3 = s2.clone(); // explicit deep copy — both s2 and s3 are valid

fn borrow(text: &str) { println!("{}", text); }
borrow(&s2);         // borrow — s2 remains valid after the call
borrow(&s3);         // &str is a reference, does not take ownership
```
