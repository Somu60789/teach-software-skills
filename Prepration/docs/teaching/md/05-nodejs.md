# Node.js

## Prerequisites

- JavaScript ES6+: arrow functions, destructuring, spread/rest, template literals, modules
- `async`/`await` and Promises: you can write async code without callback hell
- Basic understanding of HTTP: verbs, status codes, headers, JSON bodies
- Terminal comfort: running commands, setting environment variables

---

## What & Why

Node.js executes JavaScript on the server using V8, Google's JavaScript engine. Its defining feature is non-blocking I/O: instead of waiting for a database query or network call to complete, Node registers a callback and keeps processing other work. A single Node process can handle thousands of concurrent connections on minimal hardware.

**Why TML uses Node.js for certain services:**

1. **Real-time data push.** WebSockets fit Node's event-driven model perfectly. When a PLC updates a manufacturing floor sensor, Node can broadcast that update to all connected browser clients in milliseconds with very low overhead.

2. **Lightweight REST APIs.** Express is minimal and composes well. For services that primarily translate between a database and JSON, Node + Express + pg produces fast, readable code.

3. **npm ecosystem.** Libraries like `exceljs` (Excel generation), `ws` (WebSocket server), `jsonwebtoken` (JWT validation), and `multer` (file uploads) are mature and require minimal glue code.

4. **ep-eloto architecture.** The `ep-eloto` service is the real-time manufacturing floor data hub. It receives machine events, persists them, and pushes updates to browser dashboards via WebSocket — exactly the use case Node was designed for.

---

## Core Concepts

### The Event Loop

Node.js is single-threaded but concurrent. Understanding the event loop is the key to writing correct async code.

```
Call Stack         → currently executing synchronous code
Microtask Queue    → resolved Promises (.then(), await), queueMicrotask()
Task Queue         → setTimeout, setInterval, I/O callbacks
```

Execution order: call stack drains → all microtasks drain → one task from task queue → repeat.

```javascript
console.log('1: sync');

setTimeout(() => console.log('4: setTimeout'), 0);

Promise.resolve().then(() => console.log('2: microtask'));

console.log('3: sync');

// Output: 1, 3, 2, 4
```

**Implication:** Never block the call stack with heavy CPU work (use `worker_threads` for that). All I/O (database, HTTP, filesystem) must be async.

### CommonJS vs ES Modules

```javascript
// CommonJS (default in Node, .js files)
const express = require('express');
module.exports = { router };

// ES Modules (.mjs files, or "type": "module" in package.json)
import express from 'express';
export { router };
```

TML Node services use CommonJS. Set `"type": "commonjs"` (or omit `"type"`) in `package.json`.

### `package.json` scripts

```json
{
  "scripts": {
    "start":   "node src/index.js",
    "dev":     "nodemon src/index.js",
    "test":    "jest --runInBand",
    "lint":    "eslint src/"
  }
}
```

---

## Installation & Setup

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Install and use Node 20 LTS
nvm install 20 && nvm use 20

# Create project
mkdir ep-myservice && cd ep-myservice && npm init -y

# Core dependencies
npm install express dotenv cors
npm install --save-dev nodemon
```

**Minimal Express server (`src/index.js`):**

```javascript
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
```

**.env file:**
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myservice
DB_USER=tml
DB_PASSWORD=secret
JWT_SECRET=your-secret-key
```

---

## Beginner

### Express router with full CRUD

```javascript
// src/routes/materials.js
const express    = require('express');
const router     = express.Router();
const db         = require('../db');

// GET /api/materials?plant=PUNE
router.get('/', async (req, res, next) => {
    try {
        const { plant, limit = 50, offset = 0 } = req.query;
        const { rows } = await db.query(
            'SELECT * FROM materials WHERE ($1::text IS NULL OR plant_code = $1) LIMIT $2 OFFSET $3',
            [plant || null, limit, offset]
        );
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/materials/:id
router.get('/:id', async (req, res, next) => {
    try {
        const { rows } = await db.query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Material not found' });
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// POST /api/materials
router.post('/', async (req, res, next) => {
    try {
        const { material_code, description, plant_code, stock = 0 } = req.body;
        const { rows } = await db.query(
            'INSERT INTO materials (material_code, description, plant_code, stock) VALUES ($1,$2,$3,$4) RETURNING *',
            [material_code, description, plant_code, stock]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// PUT /api/materials/:id
router.put('/:id', async (req, res, next) => {
    try {
        const { stock } = req.body;
        const { rows } = await db.query(
            'UPDATE materials SET stock = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [stock, req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/materials/:id
router.delete('/:id', async (req, res, next) => {
    try {
        await db.query('DELETE FROM materials WHERE id = $1', [req.params.id]);
        res.status(204).end();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
```

### Error-handling middleware (4-argument)

```javascript
// src/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${err.message}`);
    console.error(err.stack);

    if (err.code === '23505') {  // PostgreSQL unique violation
        return res.status(409).json({ error: 'Duplicate entry', detail: err.detail });
    }
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
}

module.exports = errorHandler;

// In index.js — MUST be registered after all routes
app.use(require('./routes/materials'));
app.use(errorHandler);  // 4-argument — Express knows this is error middleware
```

### CORS and dotenv

```javascript
const cors = require('cors');

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

---

## Intermediate

### WebSocket server with `ws`

```bash
npm install ws
```

```javascript
// src/websocket.js
const WebSocket       = require('ws');
const { verifyToken } = require('./middleware/auth');

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        // Validate JWT on connection
        const token = new URL(req.url, 'ws://x').searchParams.get('token');
        try {
            ws.user = verifyToken(token);
        } catch {
            ws.close(4001, 'Unauthorized');
            return;
        }

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        ws.on('message', (data) => handleMessage(wss, ws, data));
        ws.on('close', () => console.log(`Client disconnected: ${ws.user?.sub}`));
        ws.send(JSON.stringify({ type: 'connected', userId: ws.user.sub }));
    });

    // Broadcast to all connected clients
    wss.broadcast = function(data) {
        const message = JSON.stringify(data);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    };

    // Heartbeat — close dead connections every 30s
    setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30_000);

    return wss;
}

module.exports = { setupWebSocket };
```

### PostgreSQL with `pg` Pool

```bash
npm install pg
```

```javascript
// src/db.js
const { Pool } = require('pg');

const pool = new Pool({
    host:               process.env.DB_HOST,
    port:               parseInt(process.env.DB_PORT || '5432'),
    database:           process.env.DB_NAME,
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    max:                10,           // max connections in pool
    idleTimeoutMillis:  30_000,       // close idle connections after 30s
    connectionTimeoutMillis: 2_000,   // fail fast if no connection available
});

pool.on('error', (err) => {
    console.error('Unexpected pool error:', err.message);
});

// Parameterised queries prevent SQL injection
async function query(sql, params = []) {
    const client = await pool.connect();
    try {
        return await client.query(sql, params);
    } finally {
        client.release();
    }
}

// Transaction helper
async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { query, withTransaction, pool };
```

### JWT middleware

```bash
npm install jsonwebtoken
```

```javascript
// src/middleware/auth.js
const jwt = require('jsonwebtoken');

function verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }
    try {
        req.user = verifyToken(authHeader.slice(7));
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function authorise(...roles) {
    return (req, res, next) => {
        const userRoles = req.user?.roles || [];
        if (!roles.some(r => userRoles.includes(r))) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

module.exports = { authenticate, authorise, verifyToken };
```

### `multer` file upload

```bash
npm install multer
```

```javascript
const multer = require('multer');
const path   = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, process.env.UPLOAD_DIR || '/tmp/uploads'),
    filename:    (req, file, cb) => {
        const ext  = path.extname(file.originalname);
        const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, name);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },  // 10 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.xlsx', '.xls', '.csv'];
        if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel and CSV files are allowed'));
        }
    }
});

router.post('/upload', authenticate, upload.single('file'), async (req, res, next) => {
    try {
        const result = await processUploadedFile(req.file.path);
        res.json({ imported: result.count, errors: result.errors });
    } catch (err) {
        next(err);
    }
});
```

---

## Advanced

### `exceljs`: generate and stream Excel

```bash
npm install exceljs
```

```javascript
const ExcelJS = require('exceljs');

async function generateStockReport(plant) {
    const wb = new ExcelJS.Workbook();
    wb.creator  = 'TML System';
    wb.created  = new Date();

    const ws = wb.addWorksheet('Stock Report', {
        views: [{ state: 'frozen', ySplit: 1 }]  // freeze header row
    });

    ws.columns = [
        { header: 'Material Code', key: 'material_code', width: 20 },
        { header: 'Description',   key: 'description',   width: 40 },
        { header: 'Plant',         key: 'plant_code',    width: 10 },
        { header: 'Stock',         key: 'stock',         width: 12 },
    ];

    // Style header row
    ws.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    });

    const { rows } = await db.query('SELECT * FROM materials WHERE plant_code = $1', [plant]);
    rows.forEach((row) => ws.addRow(row));

    // Stream to HTTP response
    return wb;
}

router.get('/export', authenticate, async (req, res, next) => {
    try {
        const wb = await generateStockReport(req.query.plant);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="stock-report.xlsx"');
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
});
```

### Rate limiting with `express-rate-limit`

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max:      100,
    standardHeaders: true,
    legacyHeaders:   false,
    handler: (req, res) => res.status(429).json({ error: 'Too many requests, slow down' }),
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
```

### Graceful shutdown

```javascript
const server = app.listen(PORT, () => console.log(`Listening on ${PORT}`));

function gracefulShutdown(signal) {
    console.log(`Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
        console.log('HTTP server closed. Closing DB pool...');
        await pool.end();
        console.log('DB pool closed. Exiting.');
        process.exit(0);
    });

    // Force shutdown after 10s if connections don't drain
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
```

### `bcryptjs` for password hashing

```bash
npm install bcryptjs
```

```javascript
const bcrypt = require('bcryptjs');

// Hash on registration (SALT_ROUNDS = 12 is recommended)
const SALT_ROUNDS = 12;
const hash = await bcrypt.hash(plainTextPassword, SALT_ROUNDS);
await db.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, hash]);

// Compare on login
const { rows } = await db.query('SELECT password_hash FROM users WHERE username = $1', [username]);
const valid = await bcrypt.compare(plainTextPassword, rows[0].password_hash);
if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
```

---

## Expert

### Node.js cluster mode

Node is single-threaded. `cluster` forks one worker per CPU core, letting you use all cores.

```javascript
// src/cluster.js
const cluster = require('cluster');
const os      = require('os');

if (cluster.isPrimary) {
    const cpus = os.cpus().length;
    console.log(`Primary ${process.pid} forking ${cpus} workers`);

    for (let i = 0; i < cpus; i++) cluster.fork();

    cluster.on('exit', (worker, code, signal) => {
        console.warn(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
        cluster.fork();
    });
} else {
    require('./index');  // each worker runs the Express app
    console.log(`Worker ${process.pid} started`);
}
```

In production, PM2's cluster mode (`pm2 start index.js -i max`) is preferred over manual `cluster` code.

### Memory leak debugging

```bash
# Start with inspector
node --inspect src/index.js

# Or for production-safe remote attach
node --inspect=0.0.0.0:9229 src/index.js
```

1. Open `chrome://inspect` in Chrome
2. Click "Open dedicated DevTools for Node"
3. Go to Memory tab → "Take snapshot"
4. Run your load test
5. Take another snapshot → "Compare" — look for objects with growing "# New" counts

Common Node memory leaks:
- Event listeners not removed (use `emitter.removeListener()` or `once()`)
- Closures holding large arrays in callbacks
- Cache maps with no eviction policy — use `lru-cache`

### Event emitter for internal pub/sub

```javascript
const EventEmitter = require('events');

class StockEventBus extends EventEmitter {}
const bus = new StockEventBus();

// Publisher (e.g., after database write)
bus.emit('stock:updated', { materialCode: 'MAT-001', newStock: 150 });

// Subscriber (e.g., WebSocket broadcaster)
bus.on('stock:updated', (event) => {
    wss.broadcast({ type: 'STOCK_UPDATE', ...event });
});
```

### Stream API for large file processing

```javascript
const fs      = require('fs');
const csv     = require('csv-parse');
const { Transform } = require('stream');

function importCsvToDb(filePath) {
    return new Promise((resolve, reject) => {
        let count = 0;

        const parser = fs.createReadStream(filePath)
            .pipe(csv.parse({ columns: true, skip_empty_lines: true }));

        const inserter = new Transform({
            objectMode: true,
            async transform(record, _, callback) {
                try {
                    await db.query(
                        'INSERT INTO materials (material_code, plant_code) VALUES ($1,$2) ON CONFLICT DO NOTHING',
                        [record.material_code, record.plant_code]
                    );
                    count++;
                    callback(null, record);
                } catch (err) {
                    callback(err);
                }
            }
        });

        parser.pipe(inserter)
              .on('finish', () => resolve(count))
              .on('error', reject);
    });
}
```

---

## In the TML Codebase

**`ep-eloto` architecture**
`ep-eloto` is the real-time manufacturing floor data service. It runs an Express HTTP API for querying historical events and a `ws` WebSocket server for live push to browser dashboards. Machine events arrive via a Kafka consumer (also running in the same process), get persisted to PostgreSQL, and are immediately broadcast to all WebSocket clients.

**pg pool configuration**
```javascript
// ep-eloto uses these exact settings
const pool = new Pool({
    max:                10,
    idleTimeoutMillis:  30_000,
    connectionTimeoutMillis: 2_000,
});
```

**JWT middleware pattern**
All `/api/*` routes in `ep-eloto` run the `authenticate` middleware. The Keycloak-issued JWT is verified against the Keycloak public key (fetched at startup via JWKS endpoint). The `req.user` payload carries the user's plant assignment and roles.

**multer + exceljs for report generation**
The `/api/reports/export` endpoint uses `exceljs` to build a workbook from live database queries and streams it directly to the response — no temp file on disk. Administrators can download shop-floor event summaries without a separate BI tool.

**`moment` for date formatting**
Date formatting in `ep-eloto` responses uses `moment.js` for human-readable timestamps. New code should prefer `date-fns` or `Intl.DateTimeFormat` (built-in), as `moment` is in maintenance mode.

---

## Quick Reference

### Express route template

```javascript
router.METHOD('/path/:param', authenticate, async (req, res, next) => {
    try {
        const result = await someAsyncOperation(req.params.param);
        res.json(result);
    } catch (err) {
        next(err);  // passes to error-handling middleware
    }
});
```

### WebSocket server skeleton

```javascript
const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
    ws.on('message', (data) => { /* handle */ });
    ws.on('close', () => { /* cleanup */ });
    ws.send(JSON.stringify({ type: 'welcome' }));
});
wss.broadcast = (data) => wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(data));
});
```

### pg query patterns

```javascript
// Simple query
const { rows } = await pool.query('SELECT * FROM t WHERE id = $1', [id]);

// Transaction
const client = await pool.connect();
try {
    await client.query('BEGIN');
    await client.query('UPDATE ...', [...]);
    await client.query('INSERT ...', [...]);
    await client.query('COMMIT');
} catch (e) {
    await client.query('ROLLBACK');
    throw e;
} finally {
    client.release();
}
```

### Common status codes

| Code | Meaning                          |
|------|----------------------------------|
| 200  | OK                               |
| 201  | Created                          |
| 204  | No Content (successful DELETE)   |
| 400  | Bad Request (validation error)   |
| 401  | Unauthorized (missing/bad token) |
| 403  | Forbidden (valid token, no role) |
| 404  | Not Found                        |
| 409  | Conflict (duplicate)             |
| 429  | Too Many Requests                |
| 500  | Internal Server Error            |
