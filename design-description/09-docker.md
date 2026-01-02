# Docker Setup

This document provides detailed information about the Docker deployment setup for Giraffe Terminal.

## Overview

Giraffe Terminal is fully containerized and can be deployed using Docker and Docker Compose. The setup includes:

- **Multi-stage builds** for optimized production images
- **Development mode** with hot-reload support
- **Optional services** (AI Agent, Nginx) via Docker profiles
- **Persistent data** using Docker volumes

## Container Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Docker Network                               │
│                (giraffe-terminal-network)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   nginx      │    │    app       │    │   agent      │       │
│  │  (optional)  │───▶│  (main)      │◀───│  (optional)  │       │
│  │              │    │              │    │              │       │
│  │  Port: 80    │    │  Port: 3001  │    │  Port: 8000  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                              │                                   │
│                              ▼                                   │
│                    ┌──────────────────┐                          │
│                    │  Docker Volume   │                          │
│                    │  (giraffe-data)  │                          │
│                    │                  │                          │
│                    │  /app/data/      │                          │
│                    │  └─ giraffe.db   │                          │
│                    └──────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Docker Files

### Dockerfile (Production)

Located at: `./Dockerfile`

A multi-stage build that:
1. **Stage 1 (frontend-builder)**: Builds the React frontend with Vite
2. **Stage 2 (production)**: Creates the final production image with Node.js, built frontend, and backend

Features:
- Uses Alpine Linux for minimal image size (~200MB)
- Installs only production dependencies
- Includes health check endpoint
- Runs as a single unified server

### Dockerfile.dev (Development)

Located at: `./Dockerfile.dev`

A development build that:
- Installs all dependencies (including devDependencies)
- Runs both frontend (Vite) and backend (Node) concurrently
- Supports hot-reload via volume mounts

### agent/Dockerfile (AI Agent)

Located at: `./agent/Dockerfile`

A Python container that:
- Uses Python 3.11 slim image
- Installs FastAPI, LangGraph, and LangChain dependencies
- Runs Uvicorn as the ASGI server
- Includes health check endpoint

## Docker Compose Configuration

### docker-compose.yml (Production)

**Services:**

| Service | Container Name | Port | Profile | Description |
|---------|---------------|------|---------|-------------|
| `app` | giraffe-terminal | 3001 | default | Main application (frontend + backend) |
| `agent` | giraffe-agent | 8000 | with-agent | Python AI analysis agent |
| `nginx` | giraffe-nginx | 80 | with-nginx | Reverse proxy |

**Volumes:**
- `giraffe-terminal-data`: Persists the SQLite database at `/app/data`

**Networks:**
- `giraffe-terminal-network`: Internal Docker network for container communication

### docker-compose.dev.yml (Development)

Same structure as production but with:
- Source code mounted as volumes for hot-reload
- Development dependencies included
- Uvicorn runs with `--reload` flag

## Usage

### Quick Start (Production)

```bash
# Start main application only
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Running All Services

```bash
# Start app + AI agent + Nginx
docker-compose --profile with-agent --profile with-nginx up -d

# Access points:
# - http://localhost      (via Nginx)
# - http://localhost:3001 (direct to app)
# - http://localhost:8000 (direct to agent)
```

### Development Mode

```bash
# Start with hot-reload
docker-compose -f docker-compose.dev.yml up

# With AI agent
docker-compose -f docker-compose.dev.yml --profile with-agent up

# Access points:
# - http://localhost:5173 (Vite frontend)
# - http://localhost:3001 (backend API)
# - http://localhost:8000 (AI agent)
```

### Build Commands

```bash
# Build all images
docker-compose build

# Build without cache (fresh build)
docker-compose build --no-cache

# Build specific service
docker-compose build app
```

## Environment Variables

### Root `.env` File

Used by docker-compose for environment substitution:

```env
# AI Agent Configuration
GOOGLE_API_KEY=your-google-api-key-here
LLM_MODEL=gemini-2.0-flash
SEC_USER_AGENT=GiraffeTerminal admin@giraffeterminal.local
```

### Container Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | production | Node environment |
| `PORT` | 3001 | Backend server port |
| `GOOGLE_API_KEY` | (required) | Google AI API key for agent |
| `GIRAFFE_API_URL` | http://app:3001/api | Internal API URL for agent |
| `LLM_MODEL` | gemini-2.0-flash | LLM model to use |
| `SEC_USER_AGENT` | (required) | User agent for SEC EDGAR API |

## Data Persistence

### Docker Volumes

The SQLite database is stored in a Docker volume for persistence:

```yaml
volumes:
  giraffe-data:
    name: giraffe-terminal-data
```

**Important:** Running `docker-compose down -v` will delete the volume and all data!

### Migrating Existing Data

To copy an existing database into the container:

```bash
# Copy database to container
docker cp ./data/giraffe.db giraffe-terminal:/app/data/giraffe.db

# Restart to apply
docker restart giraffe-terminal
```

### Backing Up Data

```bash
# Copy database from container to host
docker cp giraffe-terminal:/app/data/giraffe.db ./backup/giraffe.db
```

## Nginx Configuration

The optional Nginx service provides:

- **Reverse proxy** to the app container
- **Gzip compression** for text-based content
- **Path routing**:
  - `/` → Main application
  - `/api/*` → Backend API
  - `/agent/*` → AI Agent API (if enabled)

Configuration file: `./nginx.conf`

## Health Checks

Both main services include Docker health checks:

**App Container:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1
```

**Agent Container:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl --fail http://localhost:8000/health || exit 1
```

## Troubleshooting

### Container Won't Start

```bash
# View container logs
docker-compose logs app

# Check container status
docker ps -a

# Inspect container
docker inspect giraffe-terminal
```

### Database Issues

```bash
# Access container shell
docker exec -it giraffe-terminal sh

# Check database file
ls -la /app/data/

# Verify database
sqlite3 /app/data/giraffe.db ".tables"
```

### Network Issues

```bash
# List networks
docker network ls

# Inspect network
docker network inspect giraffe-terminal-network

# Test connectivity between containers
docker exec giraffe-agent ping app
```

### Rebuilding After Changes

```bash
# Stop, rebuild, and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Docker Desktop Integration

When running, you can manage containers via Docker Desktop:

1. **Containers tab**: View running containers, logs, and terminal access
2. **Images tab**: See built images and their sizes
3. **Volumes tab**: Manage persistent data volumes
4. **Networks tab**: View container networks

## Security Considerations

1. **Environment Variables**: Never commit `.env` files with real API keys
2. **Database Access**: The database volume should not be mounted to untrusted containers
3. **Network Isolation**: Containers communicate on an internal Docker network
4. **Production Hardening**: Consider adding rate limiting to Nginx for production
