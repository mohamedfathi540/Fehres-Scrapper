# Docker Configuration README

This directory contains the Docker configurations for deploying the project's microservices architecture. The setup uses Docker Compose to orchestrate multiple services including the main FastAPI application, databases, and monitoring tools.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed.
- [Docker Compose](https://docs.docker.com/compose/install/) installed.

## Services Overview

The `docker-compose.yml` defines the following services:

### Application & Proxy
- **`fastapi`**: The core application server running the FastAPI app.
  - **Build Context**: Project root (`..`).
  - **Dockerfile**: `docker/minirag/Dockerfile`.
  - **Port**: `8000`.
  - **Dependencies**: Waits for `pgvector` to be healthy.
- **`nginx`**: A reverse proxy serving as the entry point.
  - **Port**: `80` (mapped to host).
  - **Configuration**: `Nginx/Default.conf`.
  - **Routing**: Proxies requests to `fastapi`.

### Databases
- **`pgvector`**: PostgreSQL 17 extended with `pgvector` for vector similarity search.
  - **Image**: `pgvector/pgvector:0.8.0-pg17`.
  - **Port**: `5433` (Host) -> `5432` (Container).
  - **Data Persistence**: Named volume `pgvector`.
  - **Healthcheck**: Checks if Postgres is ready.
- **`qdrant`**: A high-performance vector database.
  - **Image**: `qdrant/qdrant:latest`.
  - **Ports**: `6333` (API), `6334` (Internal).
  - **Data Persistence**: Named volume `qdrant_data`.

### Monitoring & Observability
- **`prometheus`**: Collects and stores metrics.
  - **Port**: `9090`.
  - **Configuration**: `Prometheus/prometheus.yml`.
  - **Data Persistence**: Named volume `prometheus_data`.
- **`grafana`**: Visualization dashboard for Prometheus metrics.
  - **Port**: `3000`.
  - **Dependencies**: `prometheus`.
  - **Data Persistence**: Named volume `grafana_data`.
- **`node_exporter`**: Exports hardware and OS metrics exposed by *NIX kernels.
  - **Port**: `9100`.
  - **Mounts**: Read-only mounts of host `/proc`, `/sys`, and `/` to gather system metrics.
- **`postgres_exporter`**: Exports PostgreSQL metrics.
  - **Port**: `9187`.
  - **Dependencies**: `pgvector`.

## Configuration Details

### Environment Variables
Environment variables are loaded from the `env/` directory.
- `.env.app`: FastAPI application settings.
- `.env.postgres`: PostgreSQL credentials (user, password, db).
- `.env.grafana`: Grafana settings (admin credentials).
- `.env.postgres-exporter`: Exporter credentials (should match postgres).

> [!WARNING]
> **Configuration Discrepancy Note**: The `docker-compose.yml` refers to `./env/.env.postgres-exporter`, but the actual file in the directory might be named `2.postgres-exporter`. Please verify the filename matches the docker-compose reference.

### Nginx Configuration (`Nginx/Default.conf`)
Handles HTTP requests:
- Proxies `/` to `http://fastapi:8000`.
- Proxies `/kfgndfkk4464_fubfd555` to the FastAPI metrics endpoint.

### Prometheus Configuration (`Prometheus/Prometheus.yml`)
Defines scrape jobs:
- `postgres`: Scrapes `postgres_exporter:9187`.
- `prometheus`: Scrapes itself `localhost:9090`.
- `node_exporter`: Scrapes `node_exporter:9100`.
- `qdrant`: Scrapes `qdrant:6333/metrics`.
- `fastapi`: Scrapes `fastapi:8000/kfgndfkk4464_fubfd555`.

> [!IMPORTANT]
> **File Naming Note**: The file is physically named `Prometheus.yml` (capital P) on disk, but `docker-compose.yml` references `prometheus.yml`. On case-sensitive filesystems (like Linux), this volume mount will fail. You must rename the file to lowercase `prometheus.yml` or update `docker-compose.yml`.

## Usage

### Start Services
Run the following command in this directory:
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f [service_name]
```

## Access Points
- **App via Nginx**: http://localhost
- **FastAPI Direct**: http://localhost:8000
- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090

## Bash Commands & Entrypoints

### Container Entrypoints
The system uses several bash commands within containers to initialize and run services:

#### **FastAPI (`minirag/enterypoint.sh`)**
The application container runs this script on startup:
```bash
#!/bin/bash
set -e
echo "Runing database migrations..."
cd /app/Models/DB_Schemes/minirag
alembic upgrade head
cd /app
echo "Starting uvicorn server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
```
- **`alembic upgrade head`**: Applies pending database migrations.
- **`uvicorn main:app ...`**: Starts the ASGI application server.

#### **Prometheus (`docker-compose.yml`)**
Overrides default command to specify configuration paths and enable lifecycle API:
```bash
--config.file=/etc/prometheus/prometheus.yml
--storage.tsdb.path=/prometheus
--web.console.libraries=/etc/prometheus/console_libraries
--web.console.templates=/etc/prometheus/consoles
--web.enable-lifecycle
```

#### **Node Exporter (`docker-compose.yml`)**
Mounts host directories and runs:
```bash
--path.procfs=/host/proc
--path.sysfs=/host/sys
--path.rootfs=/rootfs
--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)
```

#### **Healthchecks**
- **PgVector**: `pg_isready -U postgres` (Checks if database is accepting connections).

### Common System Management Commands
Use these commands in your terminal to manage the system.

**Start/Stop:**
```bash
# Start all services in detached mode
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart fastapi
```

**Logs & Debugging:**
```bash
# Follow logs for all services
docker-compose logs -f

# Follow logs for a specific service
docker-compose logs -f fastapi

# Open a bash shell inside a running container
docker exec -it fastapi /bin/bash

# Open a shell in the database
docker exec -it pgvector psql -U postgres
```

**Database Migrations (Manual):**
If you need to run migrations manually from within the `fastapi` container:
```bash
docker exec -it fastapi /bin/bash
cd /app/Models/DB_Schemes/minirag

### Volume Maintenance & Backups

This project uses named volumes (`pgvector`, `qdrant_data`, etc.) for persistence. Here are commands to manage them.

**List Volumes:**
```bash
docker volume ls
```

**Inspect Volume Data:**
Check where a volume is stored on the host:
```bash
docker volume inspect docker_pgvector
```

**Backup Volume (Example: `pgvector`):**
Create a compressed backup of the `pgvector` volume to your current directory:
```bash
docker run --rm -v docker_pgvector:/volume -v $(pwd):/backup alpine tar cvf /backup/pgvector_backup.tar /volume
```

**Restore Volume:**
Restore a backup to the `pgvector` volume (WARNING: Overwrites existing data):
```bash
docker run --rm -v docker_pgvector:/volume -v $(pwd):/backup alpine sh -c "cd /volume && tar xvf /backup/pgvector_backup.tar --strip 1"
```

**Remove Volumes:**
Remove a specific volume (Data will be LOST):
```bash
docker volume rm docker_pgvector
```

**Cleanup Unused Volumes:**
Remove all volumes not currently used by at least one container:
```bash
docker volume prune
```

**Note on Volume Names:**
Docker Compose usually prefixes volumes with the directory name (e.g., if the method is `docker`, the volume might be `docker_pgvector`). Use `docker volume ls` to confirm the exact names.


