# PostgreSQL

## Prerequisites

- Basic understanding of data: rows, columns, tables, and what a database is for
- You know what SELECT, INSERT, UPDATE, and DELETE do conceptually
- Some exposure to joins is helpful but not required

---

## What & Why

PostgreSQL (often called Postgres) is a fully open-source relational database with over 35 years of active development. It implements the SQL standard faithfully and extends it with powerful features: JSONB for semi-structured data, window functions, CTEs, table partitioning, full-text search, and advisory locks.

**Why TML uses PostgreSQL:**

1. **ACID compliance.** Every write either completes fully or not at all. A network failure in the middle of a multi-row stock update cannot leave the database in a partially updated state. In manufacturing, where stock accuracy drives physical production decisions, this is non-negotiable.

2. **AWS RDS managed hosting.** RDS handles backups, point-in-time recovery, multi-AZ failover, and patching. The engineering team manages schema and queries; AWS manages the machine. There is no DBA team required for operations.

3. **JSONB.** Some data (machine event payloads, BOM configurations) doesn't fit neatly into fixed columns. JSONB stores arbitrary JSON and indexes into it using GIN indexes, giving you the flexibility of a document store with the transactional integrity of a relational database.

4. **JPA/Hibernate + Spring Data.** The entire TML Spring Boot service layer uses JPA over PostgreSQL. Flyway manages schema migrations. This combination is well-understood by the team and has strong tooling support.

---

## Core Concepts

**Tables and schema:** Data is stored in tables (rows of typed columns) inside a schema namespace (default `public`). Tables reference each other via foreign keys.

**Primary key:** Uniquely identifies each row. Usually a surrogate integer (`SERIAL` / `IDENTITY`) or a natural composite key.

**Foreign key:** A column whose value must match a primary key in another table. Enforces referential integrity — you can't insert a stock record for a plant that doesn't exist.

**Index:** A data structure that speeds up lookups. Without an index, every query scans every row (sequential scan). With an index on the searched column, PostgreSQL jumps directly to matching rows.

**Transaction:** A group of SQL statements that execute as a single atomic unit. Either all succeed (`COMMIT`) or all are rolled back (`ROLLBACK`).

**ACID:**
- **Atomicity:** All-or-nothing. A multi-statement transaction either completes or rolls back entirely.
- **Consistency:** Each transaction brings the database from one valid state to another, respecting all constraints.
- **Isolation:** Concurrent transactions don't see each other's uncommitted changes (configurable isolation level).
- **Durability:** After a COMMIT, the data survives a crash. The write-ahead log (WAL) ensures this.

**NULL:** NULL means "unknown" or "absent" — not zero, not empty string. `NULL = NULL` is NULL (not true). Use `IS NULL` and `IS NOT NULL`.

---

## Installation & Setup

```bash
# Run PostgreSQL 15 locally with Docker
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_USER=tml \
  -e POSTGRES_DB=inventory \
  -p 5432:5432 \
  postgres:15

# Connect with psql
psql -h localhost -U tml -d inventory
# Password: secret

# OR use psql inside the container
docker exec -it postgres psql -U tml -d inventory
```

**Useful `psql` meta-commands:**

```sql
\l                  -- list all databases
\c inventory        -- connect to database 'inventory'
\dt                 -- list all tables in current schema
\dt public.*        -- list tables in public schema explicitly
\d materials        -- describe table structure (columns, types, constraints)
\di                 -- list indexes
\df                 -- list functions
\timing on          -- show query execution time
\x                  -- toggle expanded (vertical) display
\q                  -- quit
```

---

## Beginner

### CREATE TABLE

```sql
CREATE TABLE vendors (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE materials (
    id              SERIAL PRIMARY KEY,
    material_code   VARCHAR(50)     NOT NULL,
    description     VARCHAR(200)    NOT NULL,
    plant_code      VARCHAR(10)     NOT NULL,
    vendor_id       INTEGER         NOT NULL REFERENCES vendors(id),
    stock           INTEGER         NOT NULL DEFAULT 0,
    unit_price      NUMERIC(12, 2)  NOT NULL,
    notes           TEXT,                              -- nullable by default
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    CONSTRAINT materials_code_plant_unique UNIQUE (material_code, plant_code)
);
```

### INSERT, SELECT, UPDATE, DELETE

```sql
-- Insert rows
INSERT INTO vendors (code, name) VALUES ('V001', 'Tata AutoComp Systems');
INSERT INTO vendors (code, name) VALUES ('V002', 'Motherson Sumi');

INSERT INTO materials (material_code, description, plant_code, vendor_id, stock, unit_price)
VALUES ('MAT-001', 'Bolt M8x20 Zinc', 'PUNE', 1, 5000, 0.45);

-- Select all columns
SELECT * FROM materials;

-- Select specific columns with WHERE
SELECT material_code, description, stock
FROM   materials
WHERE  plant_code = 'PUNE'
  AND  stock < 100
ORDER  BY stock ASC;

-- UPDATE with WHERE — ALWAYS include WHERE unless you intend to update all rows
UPDATE materials
SET    stock = stock + 500,
       updated_at = NOW()
WHERE  material_code = 'MAT-001'
  AND  plant_code = 'PUNE';

-- DELETE with WHERE
DELETE FROM materials
WHERE  material_code = 'MAT-TEMP'
  AND  plant_code = 'TEST';
```

### JOINs

```sql
-- INNER JOIN: only rows with matching records in both tables
SELECT m.material_code, m.description, m.stock, v.name AS vendor_name
FROM   materials m
INNER  JOIN vendors v ON m.vendor_id = v.id
WHERE  m.plant_code = 'PUNE';

-- LEFT JOIN: all materials, with vendor name where it exists (NULL if vendor deleted)
SELECT m.material_code, v.name AS vendor_name
FROM   materials m
LEFT   JOIN vendors v ON m.vendor_id = v.id;

-- RIGHT JOIN: all vendors, with their materials (NULL if vendor has no materials)
SELECT v.code, v.name, m.material_code
FROM   materials m
RIGHT  JOIN vendors v ON m.vendor_id = v.id;
```

### Basic index

```sql
-- Single-column index for frequent filter
CREATE INDEX idx_materials_plant_code ON materials(plant_code);

-- Composite index for queries that filter by both columns
CREATE INDEX idx_materials_plant_stock ON materials(plant_code, stock);

-- Unique index (also enforces uniqueness — same as UNIQUE constraint)
CREATE UNIQUE INDEX idx_materials_code_plant ON materials(material_code, plant_code);
```

---

## Intermediate

### Composite primary keys

```sql
-- Natural composite PK — no surrogate id needed when the combination is always unique
CREATE TABLE material_stock (
    material_code   VARCHAR(50)  NOT NULL,
    plant_code      VARCHAR(10)  NOT NULL,
    vendor_code     VARCHAR(20)  NOT NULL,
    stock_date      DATE         NOT NULL,
    opening_stock   INTEGER      NOT NULL DEFAULT 0,
    closing_stock   INTEGER      NOT NULL DEFAULT 0,
    PRIMARY KEY (material_code, plant_code, vendor_code, stock_date)
);
```

### EXPLAIN ANALYZE

`EXPLAIN ANALYZE` shows the query execution plan and actual timing. Use it whenever a query is slow.

```sql
EXPLAIN ANALYZE
SELECT m.material_code, m.stock, v.name
FROM   materials m
JOIN   vendors v ON m.vendor_id = v.id
WHERE  m.plant_code = 'PUNE'
  AND  m.stock < 100;
```

Example output:
```
Hash Join  (cost=8.27..24.91 rows=3 width=74) (actual time=0.123..0.145 rows=3 loops=1)
  Hash Cond: (m.vendor_id = v.id)
  ->  Index Scan using idx_materials_plant_code on materials m
        (cost=0.28..12.41 rows=4 width=48) (actual time=0.043..0.059 rows=4 loops=1)
        Index Cond: (plant_code = 'PUNE')
        Filter: (stock < 100)
  ->  Hash  (cost=4.50..4.50 rows=50 width=30) (actual time=0.062..0.063 rows=2 loops=1)
Planning Time: 0.312 ms
Execution Time: 0.198 ms
```

**Reading the output:**
- **Seq Scan:** reads every row — bad for large tables without a WHERE that uses an index
- **Index Scan:** uses an index — fast for selective queries
- **cost=X..Y:** estimated cost units (arbitrary). Lower is better. First number is startup cost, second is total cost
- **actual time=X..Y ms:** real measured time
- **rows=N:** estimated rows. If this differs hugely from actual rows, run `ANALYZE tablename` to refresh statistics

### Window functions

```sql
-- ROW_NUMBER: rank materials by stock within each plant
SELECT
    material_code,
    plant_code,
    stock,
    ROW_NUMBER() OVER (PARTITION BY plant_code ORDER BY stock ASC) AS rank_in_plant
FROM materials;

-- LAG: compare each day's stock to the previous day
SELECT
    stock_date,
    plant_code,
    closing_stock,
    LAG(closing_stock) OVER (PARTITION BY plant_code ORDER BY stock_date) AS prev_day_stock,
    closing_stock - LAG(closing_stock) OVER (PARTITION BY plant_code ORDER BY stock_date) AS delta
FROM material_stock
WHERE material_code = 'MAT-001';

-- RANK with ties
SELECT material_code, stock,
       RANK() OVER (ORDER BY stock DESC) AS stock_rank
FROM   materials
WHERE  plant_code = 'PUNE';
```

### CTEs (Common Table Expressions)

```sql
-- Readable multi-step query
WITH low_stock_materials AS (
    SELECT material_code, plant_code, stock
    FROM   materials
    WHERE  stock < 100
),
vendor_for_low_stock AS (
    SELECT lsm.material_code, lsm.stock, v.name AS vendor_name, v.code AS vendor_code
    FROM   low_stock_materials lsm
    JOIN   materials m ON lsm.material_code = m.material_code
    JOIN   vendors v   ON m.vendor_id = v.id
)
SELECT * FROM vendor_for_low_stock
ORDER  BY stock ASC;

-- Recursive CTE for hierarchical data (e.g., BOM tree)
WITH RECURSIVE bom_tree AS (
    SELECT id, parent_id, component_code, 1 AS depth
    FROM   bom_items
    WHERE  parent_id IS NULL

    UNION ALL

    SELECT b.id, b.parent_id, b.component_code, bt.depth + 1
    FROM   bom_items b
    JOIN   bom_tree bt ON b.parent_id = bt.id
)
SELECT * FROM bom_tree ORDER BY depth, component_code;
```

### UPSERT

```sql
-- Insert or update on conflict — idempotent write
INSERT INTO material_stock (material_code, plant_code, vendor_code, stock_date, closing_stock)
VALUES ('MAT-001', 'PUNE', 'V001', '2024-01-15', 450)
ON CONFLICT (material_code, plant_code, vendor_code, stock_date)
DO UPDATE SET
    closing_stock = EXCLUDED.closing_stock,
    updated_at    = NOW();

-- Insert or do nothing (idempotent insert, ignore duplicates)
INSERT INTO audit_events (event_id, event_type, created_at)
VALUES ('EVT-123', 'STOCK_UPDATE', NOW())
ON CONFLICT (event_id) DO NOTHING;
```

### `SERIAL` vs `IDENTITY`

```sql
-- SERIAL (older, still works)
id SERIAL PRIMARY KEY
-- equivalent to: id INTEGER DEFAULT nextval('table_id_seq')

-- IDENTITY (SQL standard, preferred in PostgreSQL 10+)
id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY
-- ALWAYS means you cannot bypass the sequence with an explicit INSERT value

-- If you need to override IDENTITY during data migration:
id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
-- DEFAULT allows explicit values but still auto-generates when omitted
```

---

## Advanced

### Table partitioning by range

Partitioning splits a large table into smaller physical pieces while presenting a single logical table to queries.

```sql
-- Create the parent (partitioned) table — no data stored here
CREATE TABLE stock_events (
    id           BIGSERIAL,
    material_code VARCHAR(50) NOT NULL,
    plant_code    VARCHAR(10) NOT NULL,
    event_type    VARCHAR(30) NOT NULL,
    delta         INTEGER     NOT NULL,
    created_at    TIMESTAMP   NOT NULL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE stock_events_2024_01
    PARTITION OF stock_events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE stock_events_2024_02
    PARTITION OF stock_events
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Queries automatically route to the correct partition
SELECT * FROM stock_events
WHERE  plant_code = 'PUNE'
  AND  created_at >= '2024-01-01'
  AND  created_at  < '2024-02-01';
-- → scans only stock_events_2024_01, not all partitions
```

### LISTEN / NOTIFY for async events

```sql
-- Session 1: listen for notifications
LISTEN stock_updates;

-- Session 2: notify (triggers all listeners)
NOTIFY stock_updates, '{"materialCode":"MAT-001","plant":"PUNE","stock":250}';

-- Session 1 receives: Asynchronous notification "stock_updates" received from server
```

In application code (Python `psycopg2`):
```python
conn = psycopg2.connect(dsn)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()
cur.execute("LISTEN stock_updates;")
while True:
    if select.select([conn], [], [], 5) == ([], [], []):
        continue  # timeout, loop
    conn.poll()
    while conn.notifies:
        notify = conn.notifies.pop(0)
        handle_notification(notify.payload)
```

### JSONB operators

```sql
-- Sample table with JSONB column
CREATE TABLE machine_events (
    id          BIGSERIAL PRIMARY KEY,
    event_data  JSONB NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO machine_events (event_data) VALUES
('{"machineId": "CNC-01", "status": "running", "metrics": {"rpm": 3200, "temp": 65}}');

-- -> returns JSONB, ->> returns text
SELECT event_data -> 'machineId'         AS machine_id_json,   -- "CNC-01"
       event_data ->> 'machineId'        AS machine_id_text,   -- CNC-01
       event_data -> 'metrics' ->> 'rpm' AS rpm                -- 3200
FROM   machine_events;

-- @> contains operator
SELECT * FROM machine_events
WHERE  event_data @> '{"status": "running"}';

-- #> path operator (array path)
SELECT event_data #> '{metrics, rpm}' FROM machine_events;

-- GIN index for fast @> containment queries
CREATE INDEX idx_machine_events_data ON machine_events USING GIN (event_data);

-- jsonb_array_elements for expanding JSON arrays
SELECT e.id, item
FROM   machine_events e,
       jsonb_array_elements(e.event_data -> 'alerts') AS item
WHERE  e.event_data ? 'alerts';
```

### Full-text search

```sql
-- Add a tsvector column (computed from description and notes)
ALTER TABLE materials
ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(description, '') || ' ' || coalesce(notes, ''))
    ) STORED;

-- GIN index for fast full-text search
CREATE INDEX idx_materials_search ON materials USING GIN (search_vector);

-- Search query
SELECT material_code, description
FROM   materials
WHERE  search_vector @@ to_tsquery('english', 'bolt & zinc')
ORDER  BY ts_rank(search_vector, to_tsquery('english', 'bolt & zinc')) DESC;
```

### HikariCP in Spring Boot `application.yaml`

```yaml
spring:
  datasource:
    url:      jdbc:postgresql://localhost:5432/inventory
    username: tml
    password: ${DB_PASSWORD}
    hikari:
      maximum-pool-size:     10    # max connections in pool
      minimum-idle:           5    # keep at least 5 connections warm
      idle-timeout:       30000    # ms — close idle connections after 30s
      connection-timeout:  2000    # ms — fail fast if no connection available
      max-lifetime:      1800000   # ms — replace connections every 30 min
      pool-name:         InventoryHikariPool
      connection-test-query: SELECT 1  # keep-alive query
```

---

## Expert

### VACUUM and AUTOVACUUM

PostgreSQL uses MVCC (Multi-Version Concurrency Control). When you UPDATE a row, the old row is not deleted — it's marked as dead. Dead rows accumulate as "bloat". `VACUUM` reclaims dead rows; `VACUUM ANALYZE` also updates planner statistics.

```sql
-- Check table bloat
SELECT relname, n_dead_tup, n_live_tup,
       round(n_dead_tup * 100.0 / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct
FROM   pg_stat_user_tables
ORDER  BY n_dead_tup DESC;

-- Manual vacuum on a specific table (won't lock the table)
VACUUM ANALYZE materials;

-- VACUUM FULL reclaims disk space but holds an exclusive lock — avoid on production during business hours
VACUUM FULL materials;
```

Autovacuum runs automatically in the background. If it can't keep up (high-write tables), tune in `postgresql.conf` or per-table:
```sql
ALTER TABLE stock_events SET (
    autovacuum_vacuum_scale_factor = 0.01,   -- vacuum when 1% of rows are dead (default 20%)
    autovacuum_analyze_scale_factor = 0.005  -- analyze when 0.5% rows change
);
```

### Monitoring active queries

```sql
-- Show all active queries
SELECT pid, usename, application_name, state, wait_event_type, wait_event,
       query_start, now() - query_start AS duration,
       left(query, 100) AS query_snippet
FROM   pg_stat_activity
WHERE  state = 'active'
  AND  pid != pg_backend_pid()
ORDER  BY duration DESC;

-- Kill a long-running query (graceful — waits for transaction boundary)
SELECT pg_cancel_backend(12345);

-- Kill a stuck query (immediate — use with caution)
SELECT pg_terminate_backend(12345);
```

### Lock contention

```sql
-- Find blocking and blocked queries
SELECT
    blocked.pid          AS blocked_pid,
    blocked.query        AS blocked_query,
    blocking.pid         AS blocking_pid,
    blocking.query       AS blocking_query,
    blocked.wait_event   AS wait_event
FROM  pg_stat_activity blocked
JOIN  pg_locks         blocked_locks   ON blocked_locks.pid = blocked.pid
JOIN  pg_locks         blocking_locks  ON blocking_locks.transactionid = blocked_locks.transactionid
                                      AND blocking_locks.pid != blocked_locks.pid
JOIN  pg_stat_activity blocking        ON blocking.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### Replication concepts

**WAL (Write-Ahead Log):** Every change is written to the WAL before it's applied to data files. This guarantees durability — if the server crashes, PostgreSQL replays the WAL on restart.

**Streaming replication:** The primary continuously streams WAL records to one or more standby servers. Standby applies WAL in real-time, staying within seconds of the primary. Used for high availability (failover) and read scaling (read replicas).

**Logical replication:** Instead of shipping raw WAL bytes, logical replication ships logical change events (INSERT/UPDATE/DELETE rows). This allows replicating to a different PostgreSQL major version or to a specific subset of tables. Used for zero-downtime major version upgrades.

**AWS RDS Multi-AZ:** AWS automatically maintains a synchronous standby in a different Availability Zone. On primary failure, AWS promotes the standby and updates the DNS endpoint. Failover takes ~60–120 seconds. Applications reconnect to the same endpoint — no DNS change needed.

### RDS parameter group tuning

| Parameter           | Default          | TML recommendation                                                                 |
|---------------------|------------------|------------------------------------------------------------------------------------|
| `work_mem`          | 4MB              | 16–64MB for complex analytical queries (careful: per sort operation per connection) |
| `shared_buffers`    | 128MB            | 25% of available RAM (set by RDS automatically from instance class)               |
| `max_connections`   | 100              | RDS sets based on instance class; use PgBouncer if you need more                   |
| `effective_cache_size` | 4GB           | 75% of RAM — tells the planner how much OS cache is available                      |
| `log_min_duration_statement` | -1 (off) | Set to 1000ms in pre-prod to log slow queries                                    |
| `auto_explain.log_min_duration` | -1   | Set to 500ms in pre-prod to log EXPLAIN ANALYZE for slow queries automatically     |

---

## In the TML Codebase

**Flyway migration naming convention**
```
V20240115093000__create_material_stock.sql
V20240116110000__add_vendor_index.sql
V20240120083000__alter_materials_add_notes.sql
```
Timestamp prefix (yyyyMMddHHmmss) ensures ordering. `spring.flyway.out-of-order=true` is set in all services so migrations created on branches apply without blocking other merged migrations.

**H2 test configuration**
```yaml
# src/test/resources/application-test.yaml
spring:
  datasource:
    url:      jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL;NON_KEYWORDS=VALUE
    driver-class-name: org.h2.Driver
  flyway:
    locations: classpath:db/migration
  jpa:
    database-platform: org.hibernate.dialect.H2Dialect
```

`MODE=PostgreSQL` makes H2 accept PostgreSQL-specific SQL syntax (e.g., `NOW()`, `ILIKE`).

**HikariCP defaults in TML services**
Most services run with `maximum-pool-size: 10`. On pre-prod RDS (`db.t3.medium`, 4GB RAM), 6 services × 10 connections = 60 active connections, well within the 100-connection default. The `connection-timeout: 2000` setting causes a fast startup failure rather than a silent hang if the database is unreachable.

**Archive table pattern**
High-volume event tables (e.g., `material_distribution`) get archived monthly:
```sql
INSERT INTO material_distribution_archive
SELECT * FROM material_distribution WHERE created_at < NOW() - INTERVAL '3 months';

DELETE FROM material_distribution WHERE created_at < NOW() - INTERVAL '3 months';
```
This keeps the live table fast while retaining history for compliance. The archive table has identical schema, allowing cross-table UNION queries for historical reports.

**Composite keys in `MaterialRepository`**
The `material_stock` table uses `(material_code, plant_code, vendor_code, stock_date)` as its primary key — no surrogate `id`. Spring Data JPA uses an `@EmbeddedId` with a `MaterialStockId` data class. Queries always include all four key components, making every lookup an index scan.

---

## Quick Reference

### SQL cheat sheet

```sql
-- DDL
CREATE TABLE t (id SERIAL PK, col VARCHAR(50) NOT NULL);
ALTER TABLE t ADD COLUMN new_col INTEGER DEFAULT 0;
ALTER TABLE t ALTER COLUMN col TYPE TEXT;
DROP TABLE t;

-- DML
INSERT INTO t (col) VALUES ('val') RETURNING id;
UPDATE t SET col = 'new' WHERE id = 1;
DELETE FROM t WHERE id = 1;

-- Query patterns
SELECT * FROM t WHERE col ILIKE '%search%';  -- case-insensitive LIKE
SELECT * FROM t WHERE col = ANY(ARRAY['a','b','c']);
SELECT * FROM t WHERE id IN (SELECT id FROM other WHERE cond);
SELECT COUNT(*), SUM(qty), AVG(price), MAX(stock), MIN(stock) FROM t;
SELECT col, COUNT(*) FROM t GROUP BY col HAVING COUNT(*) > 1;

-- Transactions
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;   -- or ROLLBACK;
```

### EXPLAIN ANALYZE reading guide

| Node type       | Meaning                                                              | When to worry                                   |
|-----------------|----------------------------------------------------------------------|-------------------------------------------------|
| Seq Scan        | Reads every row in the table                                         | Large tables without a usable index             |
| Index Scan      | Uses a B-tree index; reads heap for matching rows                    | Usually fine                                    |
| Index Only Scan | Uses a B-tree index; doesn't need to touch heap (covering index)     | Best case for read-heavy queries                |
| Bitmap Index Scan + Bitmap Heap Scan | Combines multiple index conditions | Fine for moderate selectivity            |
| Hash Join       | Builds a hash table from the smaller relation                        | Fine; prefer over Nested Loop for large sets    |
| Nested Loop     | For each outer row, scans inner — O(n×m)                             | Bad if inner is large; check for missing index  |
| Sort            | Explicit sort (no index for ORDER BY)                                | Add index if sort appears on hot query path     |

### HikariCP config properties

| Property                | Default | Description                                         |
|-------------------------|---------|-----------------------------------------------------|
| `maximumPoolSize`       | 10      | Max total connections                               |
| `minimumIdle`           | 10      | Min idle connections (set equal to max for fixed pool) |
| `connectionTimeout`     | 30000   | ms to wait for a connection from pool               |
| `idleTimeout`           | 600000  | ms before idle connection is closed (0 = never)    |
| `maxLifetime`           | 1800000 | ms before a connection is replaced (prevent stale) |
| `keepaliveTime`         | 0       | ms interval to send a keepalive query               |
| `connectionTestQuery`   | (auto)  | Query run to validate connection health             |
