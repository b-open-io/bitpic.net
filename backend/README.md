# BitPic Backend

Go backend service for bitpic.net - a paymail avatar service on Bitcoin SV.

## Features

- Real-time BitPic protocol transaction monitoring via JungleBus
- Redis caching for avatars and images
- ORDFS integration for image serving
- ARC transaction broadcasting
- Production-ready with Docker support

## Architecture

```
┌─────────────┐
│  JungleBus  │ ← Real-time BSV tx monitoring
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   Parser    │ ──→ │    Redis    │
└─────────────┘     └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Fiber API  │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    ORDFS    │
                    └─────────────┘
```

## API Endpoints

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

### GET /u/:paymail
Get avatar image for a paymail.

**Example:** `/u/alice@example.com`

**Response:** Image binary data

### GET /api/feed?offset=0&limit=20
Get paginated feed of recent avatar updates.

**Query Parameters:**
- `offset` - Offset for pagination (default: 0)
- `limit` - Number of items (default: 20, max: 100)

**Response:**
```json
[
  {
    "paymail": "alice@example.com",
    "outpoint": "txid_0",
    "timestamp": 1234567890
  }
]
```

### GET /api/avatar/:paymail
Get avatar metadata for a paymail.

**Example:** `/api/avatar/alice@example.com`

**Response:**
```json
{
  "paymail": "alice@example.com",
  "outpoint": "txid_0",
  "url": "https://ordfs.network/content/txid_0",
  "exists": true
}
```

### GET /api/exists/:paymail
Check if avatar exists for a paymail.

**Example:** `/api/exists/alice@example.com`

**Response:** `"1"` (exists) or `"0"` (does not exist)

### POST /api/broadcast
Broadcast a BitPic transaction.

**Request:**
```json
{
  "rawtx": "hex-encoded-transaction"
}
```

**Response:**
```json
{
  "success": true,
  "txid": "transaction-id"
}
```

## BitPic Protocol

BitPic transactions contain two OP_RETURN outputs:

1. **BitPic Protocol Output:**
```
OP_RETURN
  18pAqbYqhzErT6Zk3a5dwxHtB9icv8jH2p  // BitPic prefix
  <paymail>                            // User's paymail
  <pubkey>                             // Public key
  <signature>                          // Signature
```

2. **B Protocol Output (Image):**
```
OP_RETURN
  19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut  // B protocol prefix
  <image-data>                         // Image bytes
  <content-type>                       // MIME type
  <encoding>                           // Optional
  <filename>                           // Optional
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server
PORT=8080

# Redis
REDIS_URL=redis://localhost:6379

# JungleBus
JUNGLEBUS_URL=https://junglebus.gorillapool.io
JUNGLEBUS_SUBSCRIPTION_ID=d40d60de8e6fdaa627eefb14ea685052f5955e278d54f19e6564d6c5e5015eb3

# ORDFS
ORDFS_URL=https://ordfs.network

# ARC
ARC_URL=https://arc.taal.com

# Cache
IMAGE_CACHE_TTL=3600
```

## Development

### Prerequisites

- Go 1.22+
- Redis
- Make (optional)

### Run Locally

```bash
# Install dependencies
go mod download

# Run the server
go run main.go
```

### Build

```bash
go build -o bitpic
./bitpic
```

### Docker

```bash
# Build image
docker build -t bitpic-backend .

# Run container
docker run -p 8080:8080 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  bitpic-backend
```

## Deployment

### Railway

1. Create new project
2. Add Redis plugin
3. Connect GitHub repository
4. Set environment variables
5. Deploy from `/backend` directory

### Docker Compose

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  backend:
    build: .
    ports:
      - "8080:8080"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

volumes:
  redis-data:
```

## Testing

```bash
# Run tests
go test ./...

# Test health endpoint
curl http://localhost:8080/health

# Test avatar endpoint
curl http://localhost:8080/u/alice@example.com

# Test feed
curl http://localhost:8080/api/feed?limit=10
```

## Dependencies

- **gofiber/fiber** - Fast HTTP framework
- **redis/go-redis** - Redis client
- **bsv-blockchain/go-sdk** - BSV transaction parsing
- **joho/godotenv** - Environment variable loading

## License

MIT
