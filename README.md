# Internal Wallet Service

A high-traffic, ACID-compliant wallet service for virtual credits (e.g. "Gold Coins") in a gaming/loyalty platform. Implements double-entry ledger architecture for full auditability and data integrity.

## Features

- **Double-entry ledger**: All balances derived from immutable transaction log (no denormalized balance column drift risk)
- **Three core flows**:
  - Top-up (real-money purchase simulation)
  - Bonus / incentive (free credits from system)
  - Spend (in-app purchases)
- **Idempotency**: Safe retries using unique keys
- **Concurrency safety**: Pessimistic row locking (`SELECT FOR UPDATE`) + fixed lock order to avoid deadlocks
- **Negative balance prevention**: Atomic checks inside transactions
- **Audit trail**: Full transaction history endpoint
- **Containerized**: Docker + docker-compose for one-command setup

## Tech Stack & Why

| Component       | Choice              | Reason                                                                 |
|-----------------|---------------------|------------------------------------------------------------------------|
| Language        | Node.js 20+         | Fast async I/O, strong ecosystem, good concurrency via event loop     |
| Framework       | Express             | Simple, mature, sufficient for REST API                                |
| Database        | PostgreSQL          | Full ACID, row-level locking, serializable isolation, great for ledgers |
| Query Builder   | Knex.js             | Safe migrations, seeds, transactions, raw SQL when needed              |
| Idempotency     | PostgreSQL table    | Durable, atomic checks — survives restarts                              |
| Containerization| Docker + Compose    | Reproducible environment, easy evaluation                              |

## How to Run (Local)

### With Docker (recommended)

```bash
# Build & start (runs migrations + seed automatically)
docker compose up --build

# Or in background
docker compose up -d

# Stop & remove
docker compose down
