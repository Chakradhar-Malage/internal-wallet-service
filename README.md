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
| Language        | Node.js 22         | Fast async I/O, strong ecosystem, good concurrency via event loop     |
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

```
## Without Docker (Fallback – using your local PostgreSQL)

Step 1: Create database wallet_service in pgAdmin or psql
Step 2: Copy .env.example → .env and fill your local DB credentials
Step 3: Install dependencies:
  ```bash 
npm install 
  ```
Step4: Run migrations & seed:
  ```bash
npm run migrate:latest
  ```
Step 5: 
  ```bash
npm run seed:run
  ```
Step 6 : Start development server:
  ```bash
npm run dev
  ```

## API Endpoints
All POST endpoints require a valid idempotencyKey (UUID v4) in the request body.
POST /topup
JSON
```bash
{
  "ownerId": "Chakradhar",
  "amount": 1000,
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
  "description": "First purchase"
} 
```
POST /bonus
JSON
```bash
{
  "ownerId": "Chakradhar",
  "amount": 500,
  "idempotencyKey": "new-uuid-here",
  "description": "Referral bonus"
}
```
POST /spend
JSON
```bash 
{
  "ownerId": "Chakradhar",
  "amount": 200,
  "idempotencyKey": "spend-uuid-123",
  "description": "Buy item"
}
```
→ Returns 400 "Insufficient balance" if funds are insufficient
GET /balance/:ownerId
texthttp://localhost:3000/balance/Chakradhar
→ { "owner": "Chakradhar", "balance": 800 }
GET /transactions/:ownerId?limit=10&offset=0
Paginated list of ledger entries affecting the user, including:

transaction_id
type (topup / bonus / spend)
amount
direction (debit / credit)
description
executed_at timestamp

GET /health
Simple status check.

## Concurrency & Data Integrity Strategy

Pessimistic locking: SELECT ... FOR UPDATE on both user and treasury account rows inside transaction
Deadlock prevention: Always acquire locks in fixed order → user account first, then treasury
Race condition protection: Balance sufficiency checked after locks are acquired
Idempotency: Duplicate requests return success with "already_processed" status (no double-crediting)
Immutability & auditability: All changes recorded as immutable ledger entries → balances computed via SUM queries

This combination ensures correctness even under high concurrent load.