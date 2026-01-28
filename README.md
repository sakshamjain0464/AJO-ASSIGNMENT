# Live Bidding (Auction) Platform

A **production-ready**, real-time auction platform built with Node.js, Express, Socket.io, TypeScript, and Redis. This system ensures atomic bid handling, prevents race conditions, and uses server time as the single source of truth.

---

## 🏗️ System Architecture

### High-Level Overview

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP (REST)
       │ WebSocket (Socket.io)
       │
┌──────▼────────────────────┐
│    Express + Socket.io     │
│    (Application Layer)     │
└──────┬────────────────────┘
       │
       │ Business Logic
       │
┌──────▼────────────────────┐
│   Service Layer            │
│   (auction.service.ts)     │
└──────┬────────────────────┘
       │
       │ Redis Operations
       │
┌──────▼────────────────────┐
│   Store Layer              │
│   (auction.store.ts)       │
└──────┬────────────────────┘
       │
       │ Lua Script Execution
       │
┌──────▼────────────────────┐
│        Redis               │
│   (State Management)       │
└───────────────────────────┘
```

### Layer Responsibilities

- **HTTP Layer**: REST API for initial data load (`GET /items`)
- **WebSocket Layer**: Real-time bidding events (Socket.io)
- **Service Layer**: Business logic orchestration
- **Store Layer**: Redis read/write operations only
- **Redis + Lua**: Atomic state mutations

---

## 🔒 Race Condition Prevention

### The Problem

When two users bid the same amount simultaneously:

```
Time T:
  User A bids $100
  User B bids $100
```

Without atomicity, both could read `currentBid = $95`, validate their bids as acceptable, and both think they won.

### The Solution: Redis Lua Scripting

Redis executes **Lua scripts atomically** with these guarantees:

1. **Single-threaded execution**: Redis processes one command at a time
2. **No interleaving**: No other commands can execute during script execution
3. **Atomic read-check-write**: All operations happen in one indivisible block

#### Lua Script Logic (`src/lua/placeBid.lua`)

```lua
-- Atomic execution ensures no race conditions
1. Read: currentBid, endsAt, ended, version
2. Validate:
   - auction exists
   - not ended (time check + flag)
   - bidAmount > currentBid (strict inequality)
3. If valid, atomically update:
   - currentBid = bidAmount
   - highestBidder = bidderName
   - version = version + 1
4. Return status code
```

#### Race Condition Resolution Example

**Scenario**: User A and User B both bid $100 at exactly the same millisecond, current bid is $95.

**Redis Processing** (serialized):

1. **User A's bid arrives first**:
   - Lua script reads: `currentBid = $95`
   - Validates: `$100 > $95` ✅
   - Updates: `currentBid = $100`, `highestBidder = "User A"`
   - Returns: `1` (BID_ACCEPTED)

2. **User B's bid arrives 0.001ms later**:
   - Lua script reads: `currentBid = $100` (updated by User A)
   - Validates: `$100 > $100` ❌
   - **No update performed**
   - Returns: `0` (BID_TOO_LOW)

**Result**: User A wins, User B immediately receives `OUTBID` event.

### Return Codes

- `1`: BID_ACCEPTED
- `0`: BID_TOO_LOW (bid ≤ currentBid)
- `-1`: AUCTION_ENDED (time expired or manually ended)

---

## ⏰ Server Time Synchronization

### Design Philosophy

**Client clocks cannot be trusted.** Users can manipulate system time, experience timezone issues, or have clock skew.

### Strategy

1. **Server Time is Authority**:
   - All auction expirations use `Date.now()` on the server
   - Lua script receives `serverTime` as parameter
   - Client timers are **display-only**

2. **REST API Response**:
   ```json
   {
     "serverTime": 1706437890123,
     "items": [...]
   }
   ```
   Clients can compute offset and display accurate countdowns.

3. **Expiry Checks**:
   - Lua script: `serverTime > endsAt`
   - Service layer: Periodic check every 1 second
   - Broadcasts `AUCTION_ENDED` to all clients

---

## 🔌 Socket Event Flow

### Client → Server

#### `BID_PLACED`
```typescript
{
  itemId: string,
  amount: number,
  bidderName: string
}
```

### Server → Client

#### `UPDATE_BID` (broadcast to all)
```typescript
{
  id: string,
  title: string,
  currentBid: number,
  highestBidder: string,
  endsAt: number,
  ended: boolean,
  version: number
}
```

#### `BID_ACCEPTED` (sent to bidder)
```typescript
// Same structure as UPDATE_BID
```

#### `OUTBID` (sent to affected users)
```typescript
{
  itemId: string,
  currentBid: number,
  message: string
}
```

#### `AUCTION_ENDED` (broadcast)
```typescript
{
  id: string,
  title: string,
  ended: true,
  // ... other fields
}
```

---

## 📦 Data Model

### Redis Storage

Each auction is stored as a **Redis Hash** with key format:
```
auction:item:{id}
```

**Fields**:
```
id              → "1"
title           → "Vintage Rolex Submariner"
startingPrice   → "5000"
currentBid      → "5250"
highestBidder   → "User123"
endsAt          → "1706437890000" (epoch millis)
ended           → "false" | "true"
version         → "5" (incremented on each bid)
```

### TypeScript Interface

```typescript
interface AuctionItem {
  id: string;
  title: string;
  startingPrice: number;
  currentBid: number;
  highestBidder: string;
  endsAt: number; // epoch milliseconds
  ended: boolean;
  version: number;
}
```

---

## 🚀 Running the Application

### Prerequisites

- Docker
- Docker Compose

### Start with Docker

```bash
docker-compose up --build
```

This command:
1. Builds the Node.js backend image
2. Starts Redis container
3. Waits for Redis health check
4. Starts backend and seeds auction data
5. Exposes backend on `http://localhost:3000`

### Verify

```bash
# Health check
curl http://localhost:3000/health

# Get auction items
curl http://localhost:3000/items
```

### Stopping

```bash
docker-compose down
```

---

## 🧪 Testing the System

### Using WebSocket Client (e.g., wscat)

```bash
npm install -g wscat

# Connect
wscat -c ws://localhost:3000

# Send bid
{"itemId": "1", "amount": 5100, "bidderName": "Alice"}
```

### Using Browser Console

```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('BID_PLACED', {
    itemId: '1',
    amount: 5100,
    bidderName: 'Bob'
  });
});

socket.on('BID_ACCEPTED', (data) => {
  console.log('Bid accepted:', data);
});

socket.on('OUTBID', (data) => {
  console.log('Outbid:', data);
});

socket.on('UPDATE_BID', (data) => {
  console.log('Bid update:', data);
});

socket.on('AUCTION_ENDED', (data) => {
  console.log('Auction ended:', data);
});
```

### Race Condition Test

Open two browser tabs and execute bids simultaneously:

**Tab 1**:
```javascript
socket.emit('BID_PLACED', { itemId: '1', amount: 5500, bidderName: 'User1' });
```

**Tab 2** (execute immediately after):
```javascript
socket.emit('BID_PLACED', { itemId: '1', amount: 5500, bidderName: 'User2' });
```

**Expected**: One receives `BID_ACCEPTED`, the other receives `OUTBID`.

---

## 📂 Project Structure

```
src/
 ├─ app.ts                     # Express + Socket.io setup
 ├─ server.ts                  # Bootstrap & graceful shutdown
 ├─ config/
 │   ├─ env.ts                 # Environment variable loader
 │   └─ redis.ts               # Redis client singleton
 ├─ routes/
 │   └─ items.route.ts         # GET /items endpoint
 ├─ sockets/
 │   └─ bidding.socket.ts      # Socket.io event handlers
 ├─ services/
 │   └─ auction.service.ts     # Business logic layer
 ├─ models/
 │   └─ auctionItem.ts         # TypeScript interfaces
 ├─ store/
 │   └─ auction.store.ts       # Redis CRUD operations
 ├─ lua/
 │   └─ placeBid.lua           # Atomic bid script
 ├─ utils/
 │   └─ time.ts                # Server time utilities
 ├─ seed/
 │   └─ seed.ts                # Initial data seeder
 └─ types/
     └─ socket.ts              # Socket.io type definitions
```

---

## 🔐 Concurrency Guarantees

### 1. Atomic Bid Placement
- **Mechanism**: Redis Lua script
- **Guarantee**: Read-check-write is indivisible
- **Protection**: No lost updates, no double acceptance

### 2. Version Field
- Incremented on every successful bid
- Enables optimistic locking if needed
- Helps detect stale reads

### 3. Server Time Authority
- All expiry checks use server clock
- Prevents client-side time manipulation
- Consistent across all operations

### 4. Periodic Expiry Check
- Runs every 1 second
- Ensures auctions end even if no bids arrive
- Broadcasts `AUCTION_ENDED` reliably

---

## 🛠️ Development

### Local Setup (without Docker)

```bash
# Install dependencies
npm install

# Start Redis locally
redis-server

# Set environment variables
export REDIS_HOST=localhost
export REDIS_PORT=6379
export PORT=3000

# Run in development mode
npm run dev
```

### Build

```bash
npm run build
```

### Production

```bash
npm start
```

---

## 🧩 Extension Points

### Adding New Features

1. **Admin Controls**: Add endpoints to create/delete auctions
2. **Authentication**: Integrate JWT for user management
3. **Bid History**: Store bid logs in Redis sorted sets
4. **Notifications**: Email/SMS when outbid
5. **Multi-Server**: Use Redis Pub/Sub for horizontal scaling

### Scaling

To scale across multiple servers:

```typescript
// Use Redis adapter
import { createAdapter } from '@socket.io/redis-adapter';

const pubClient = createClient({ host: 'redis', port: 6379 });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

This ensures events broadcast across all server instances.

---

## 📜 License

MIT

---

## 🙏 Acknowledgments

Built with Socket.io for real-time communication and Redis for rock-solid state management.

<citations>
<document>
<document_type>WEB_PAGE</document_type>
<document_id>https://Socket.io</document_id>
</document>
<document>
<document_type>WEB_PAGE</document_type>
<document_id>https://socket.io</document_id>
</document>
</citations>

