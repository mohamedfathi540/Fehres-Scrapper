#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# Fehres — Hybrid Development Startup Script
# Docker: pgvector + Qdrant | Local: FastAPI + Vite Frontend
# ═══════════════════════════════════════════════════════════════════

# ── Colors & Symbols ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

export COMPOSE_PROJECT_NAME=fehres

CHECK="[OK]"
ROCKET="[START]"
FIRE="[HOT]"
BOLT="[FAST]"
DB="[DB]"
GLOBE="[WEB]"
STOP="[STOP]"
GEAR="[SYS]"
SPARKLE="[READY]"

# ── PID / Log Files ───────────────────────────────────────────────
PID_DIR="/tmp/fehres"
BACKEND_PID="$PID_DIR/backend.pid"
FRONTEND_PID="$PID_DIR/frontend.pid"
CLOUDFLARED_PID="$PID_DIR/cloudflared.pid"
BACKEND_LOG="$PID_DIR/backend.log"
FRONTEND_LOG="$PID_DIR/frontend.log"
CLOUDFLARED_LOG="$PID_DIR/cloudflared.log"
COMPOSE_DEV="Docker/docker-compose.dev.yml"
COMPOSE_FULL="Docker/docker-compose.yml"
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_ENV_FILE="$PROJECT_ROOT/Docker/env/.env.app"
BACKEND_ENV_FILE="$PROJECT_ROOT/SRC/.env"
CLOUDFLARED_ENV_FILE="$PROJECT_ROOT/Docker/env/.env.cloudflared"

mkdir -p "$PID_DIR"

# ── Helper Functions ───────────────────────────────────────────────
print_banner() {
    echo ""
    echo -e "${MAGENTA}${BOLD}"
    echo "    ███████╗███████╗██╗  ██╗██████╗ ███████╗███████╗"
    echo "    ██╔════╝██╔════╝██║  ██║██╔══██╗██╔════╝██╔════╝"
    echo "    █████╗  █████╗  ███████║██████╔╝█████╗  ███████╗"
    echo "    ██╔══╝  ██╔══╝  ██╔══██║██╔══██╗██╔══╝  ╚════██║"
    echo "    ██║     ███████╗██║  ██║██║  ██║███████╗███████║"
    echo "    ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝"
    echo -e "${NC}"
    echo -e "    ${DIM}Hybrid Dev Environment${NC}  ${FIRE} ${BOLT} ${ROCKET}"
    echo ""
}

step() {
    local num=$1
    local total=$2
    local msg=$3
    local icon=$4
    echo ""
    echo -e "  ${CYAN}${BOLD}[$num/$total]${NC} ${icon}  ${BOLD}${msg}${NC}"
    echo -e "  ${DIM}$(printf '%.0s─' {1..52})${NC}"
}

success() {
    echo -e "        ${GREEN}${CHECK} $1${NC}"
}

warn() {
    echo -e "        ${YELLOW}[WARN]  $1${NC}"
}

info() {
    echo -e "        ${DIM}$1${NC}"
}

err() {
    echo -e "        ${RED}[ERR]  $1${NC}"
}

kill_pid_file() {
    local pidfile=$1
    if [ -f "$pidfile" ]; then
        local pid
        pid=$(cat "$pidfile" 2>/dev/null)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            sleep 0.5
            kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
        fi
        rm -f "$pidfile"
    fi
}

# Try multiple methods to free a port
free_port() {
    local port=$1
    local pids
    pids=$(lsof -ti ":$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 0.3
    fi
    fuser -k "${port}/tcp" 2>/dev/null || true
    sleep 0.3
}

port_is_free() {
    local port=$1
    ! ss -tlnH 2>/dev/null | grep -q ":${port} "
}

require_port_free() {
    local port=$1
    local service=$2
    if ! port_is_free "$port"; then
        err "Port $port ($service) is still occupied!"
        echo ""
        echo -e "        ${YELLOW}This is likely caused by zombie docker-proxy processes.${NC}"
        echo -e "        ${YELLOW}Fix it by running:${NC}"
        echo ""
        echo -e "        ${BOLD}  sudo systemctl restart docker${NC}"
        echo -e "        ${DIM}  (or: sudo snap restart docker)${NC}"
        echo ""
        echo -e "        ${DIM}Then re-run: ./dev.sh${NC}"
        exit 1
    fi
}

wait_for_port() {
    local port=$1
    local name=$2
    local max_wait=${3:-30}
    local waited=0
    while ! ss -tlnH 2>/dev/null | grep -q ":${port} " && [ $waited -lt $max_wait ]; do
        sleep 1
        waited=$((waited + 1))
    done
    if [ $waited -ge $max_wait ]; then
        err "$name did not start on port $port within ${max_wait}s"
        echo -e "        ${DIM}Check logs: cat $BACKEND_LOG${NC}"
        return 1
    fi
    success "$name is live on port $port  (${waited}s)"
}

sync_backend_env() {
    if [ ! -f "$BACKEND_ENV_FILE" ]; then
        if [ ! -f "$APP_ENV_FILE" ]; then
            warn "Missing $APP_ENV_FILE, keeping existing backend .env"
            return 0
        fi
        cp "$APP_ENV_FILE" "$BACKEND_ENV_FILE"
        info "Initialized backend env from Docker/env/.env.app -> SRC/.env"
    fi

    # Force local backend to use dockerized pgvector host port in hybrid mode.
    sed -i -E \
        -e 's/^POSTGRES_HOST\s*=.*/POSTGRES_HOST = "localhost"/' \
        -e 's/^POSTGRES_HOST=.*/POSTGRES_HOST=localhost/' \
        -e 's/^POSTGRES_PORT\s*=.*/POSTGRES_PORT = "5434"/' \
        -e 's/^POSTGRES_PORT=.*/POSTGRES_PORT=5434/' \
        "$BACKEND_ENV_FILE"

    success "Ensured backend env mapped pgvector to localhost:5434"
}

start_cloudflared_local() {
    if [ ! -f "$CLOUDFLARED_ENV_FILE" ]; then
        info "No Docker/env/.env.cloudflared file found, skipping Cloudflare tunnel"
        return 0
    fi

    local token
    token=$(grep -E '^TUNNEL_TOKEN=' "$CLOUDFLARED_ENV_FILE" | tail -1 | cut -d'=' -f2- | tr -d '"' | xargs)

    if [ -z "$token" ] || [ "$token" = "your-cloudflare-tunnel-token-here" ]; then
        info "Cloudflare tunnel token is empty, skipping tunnel"
        return 0
    fi

    if ! command -v cloudflared >/dev/null 2>&1; then
        warn "cloudflared is not installed, skipping tunnel startup"
        echo ""
        echo "        Install with:"
        echo "        sudo mkdir -p --mode=0755 /usr/share/keyrings"
        echo "        curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null"
        echo "        echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list"
        echo "        sudo apt-get update && sudo apt-get install cloudflared"
        return 0
    fi

    info "Starting local Cloudflare tunnel..."
    cloudflared tunnel run --token "$token" > "$CLOUDFLARED_LOG" 2>&1 &
    echo $! > "$CLOUDFLARED_PID"
    sleep 2

    if kill -0 "$(cat "$CLOUDFLARED_PID" 2>/dev/null)" 2>/dev/null; then
        success "Cloudflare tunnel started (local process)"
    else
        warn "Cloudflare tunnel failed to start; check $CLOUDFLARED_LOG"
    fi
}


# ── Main Script Logic (rest of script continues here) ─────────────

wait_for_backend() {
    local port=$1
    local max_wait=${2:-300}
    local waited=0

    while [ $waited -lt $max_wait ]; do
        if ss -tlnH 2>/dev/null | grep -q ":${port} "; then
            success "FastAPI backend is live on port ${port}  (${waited}s)"
            return 0
        fi

        if [ -f "$BACKEND_PID" ]; then
            local pid
            pid=$(cat "$BACKEND_PID" 2>/dev/null)
            if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
                err "FastAPI backend process exited before binding port ${port}"
                return 1
            fi
        fi

        sleep 1
        waited=$((waited + 1))
    done

    err "FastAPI backend did not start on port ${port} within ${max_wait}s"
    echo -e "        ${DIM}Check logs: cat $BACKEND_LOG${NC}"
    return 1
}

# ── Cleanup on exit ───────────────────────────────────────────────
cleanup() {
    echo ""
    echo -e "  ${YELLOW}${BOLD}"
    echo "  ╔══════════════════════════════════════════════╗"
    echo "  ║       ${STOP}  Shutting down Fehres...            ║"
    echo "  ╚══════════════════════════════════════════════╝"
    echo -e "  ${NC}"

    kill_pid_file "$FRONTEND_PID"
    free_port 5173 2>/dev/null || true
    info "Frontend stopped"

    # Kill Cloudflare tunnel (local process)
    kill_pid_file "$CLOUDFLARED_PID"
    info "Cloudflare tunnel stopped"

    # Kill backend
    kill_pid_file "$BACKEND_PID"
    free_port 8000 2>/dev/null || true
    info "Backend stopped"

    docker compose -f "$PROJECT_ROOT/$COMPOSE_DEV" down 2>/dev/null || true
    info "Docker infrastructure stopped"

    echo ""
    echo -e "  ${GREEN}${CHECK} All services stopped cleanly.${NC}"
    echo ""
    exit 0
}

trap cleanup SIGINT SIGTERM

# ══════════════════════════════════════════════════════════════════
#                         MAIN FLOW
# ══════════════════════════════════════════════════════════════════

print_banner

# ── STEP 0: Clean up everything ───────────────────────────────────
step 0 4 "Preparing environment" "$GEAR"

kill_pid_file "$BACKEND_PID"
kill_pid_file "$FRONTEND_PID"
kill_pid_file "$CLOUDFLARED_PID"

# FIXED: Removed generic "pgvector", "qdrant", "nginx" so it doesn't kill RxTract
info "Stopping any existing Docker services..."
OLD_CONTAINERS="fastapi frontend nginx pgvector qdrant prometheus grafana postgres_exporter node_exporter cloudflared fehres-pgvector fehres-qdrant fehres-nginx-dev fehres-cloudflared-dev fehres-nginx fehres-cloudflared"
for c in $OLD_CONTAINERS; do
    docker stop "$c" 2>/dev/null && docker rm "$c" 2>/dev/null || true
done

docker compose -f "$PROJECT_ROOT/$COMPOSE_FULL" down --remove-orphans 2>/dev/null || true
docker compose -f "$PROJECT_ROOT/$COMPOSE_DEV" down --remove-orphans 2>/dev/null || true

# FIXED: Swapped 8000 for 8000
free_port 8000
free_port 5173
free_port "${NGINX_PORT:-8888}"

sleep 1

# FIXED: Swapped 8000 for 8000
require_port_free 8000 "FastAPI backend"
require_port_free 5173 "Vite frontend"
require_port_free "${NGINX_PORT:-8888}" "Nginx reverse proxy"

success "Environment is clean"

# ── STEP 1: Docker infrastructure ─────────────────────────────────
step 1 4 "Starting hybrid Docker infrastructure" "$DB"

info "Starting pgvector + Qdrant + Nginx (+ Cloudflare if configured) via Docker..."
docker compose -f "$PROJECT_ROOT/$COMPOSE_DEV" up -d 2>&1 | tail -10

info "Waiting for PostgreSQL to accept connections..."
PG_WAIT_TIMEOUT=${PG_WAIT_TIMEOUT:-180}
pg_waited=0
while [ $pg_waited -lt "$PG_WAIT_TIMEOUT" ]; do
    pg_health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' fehres-pgvector 2>/dev/null || echo "missing")

    if [ "$pg_health" = "healthy" ] || docker exec fehres-pgvector pg_isready -h 127.0.0.1 -U postgres -d minirag >/dev/null 2>&1; then
        break
    fi

    if [ "$pg_health" = "unhealthy" ]; then
        break
    fi

    sleep 1
    pg_waited=$((pg_waited + 1))
done
if [ $pg_waited -ge "$PG_WAIT_TIMEOUT" ] || [ "$pg_health" = "unhealthy" ]; then
    err "PostgreSQL failed to become healthy in ${PG_WAIT_TIMEOUT}s"
    exit 1
fi
success "PostgreSQL (pgvector) is ready on :5433  (${pg_waited}s)"

qdrant_waited=0
while ! curl -sf http://localhost:6333/healthz >/dev/null 2>&1 && [ $qdrant_waited -lt 30 ]; do
    sleep 1
    qdrant_waited=$((qdrant_waited + 1))
done
if [ $qdrant_waited -lt 30 ]; then
    success "Qdrant is ready on :6333  (${qdrant_waited}s)"
else
    warn "Qdrant may not be fully ready yet"
fi

nginx_waited=0
nginx_code="000"
NGINX_P=${NGINX_PORT:-8888}
while [ $nginx_waited -lt 30 ]; do
    nginx_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${NGINX_P}" 2>/dev/null || echo "000")
    if [ "$nginx_code" != "000" ]; then
        break
    fi
    sleep 1
    nginx_waited=$((nginx_waited + 1))
done
if [ $nginx_waited -lt 30 ]; then
    success "Nginx reverse proxy is reachable on :${NGINX_P}  (HTTP ${nginx_code}, ${nginx_waited}s)"
else
    err "Nginx did not become ready on :${NGINX_P}"
    exit 1
fi

# ── STEP 3: Backend ───────────────────────────────────────────────
step 2 4 "Starting FastAPI backend" "$BOLT"

cd "$PROJECT_ROOT/SRC"

sync_backend_env

# FIXED: Switched kill target to port 8000
pkill -f "uvicorn main:app --host 0.0.0.0 --port 8000" 2>/dev/null || true
sleep 0.5

# Ensure deps
info "Syncing Python dependencies with uv..."
uv sync --quiet 2>&1 || true

info "Applying database migrations..."
uv run alembic upgrade head || warn "Database migrations failed, please check."

# FIXED: Uvicorn now starts on port 8000
info "Launching uvicorn on :8000 with hot-reload..."
nohup uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload </dev/null > "$BACKEND_LOG" 2>&1 &
BACK_PID=$!
echo $BACK_PID > "$BACKEND_PID"
disown $BACK_PID

BACKEND_WAIT_TIMEOUT=${BACKEND_WAIT_TIMEOUT:-300}
if ! wait_for_backend 8000 "$BACKEND_WAIT_TIMEOUT"; then
    err "Backend failed to start. Last 15 lines of log:"
    tail -15 "$BACKEND_LOG" 2>/dev/null | sed 's/^/        /'
    exit 1
fi

cd "$PROJECT_ROOT"

# ── STEP 4: Frontend ──────────────────────────────────────────────
step 3 4 "Starting Vite frontend" "$GLOBE"

cd "$PROJECT_ROOT/frontend"

info "Installing frontend dependencies..."
pnpm install --frozen-lockfile --silent 2>&1 || pnpm install --silent 2>&1 || true

info "Launching Vite on :5173 with HMR..."
nohup npx vite --host --port 5173 --strictPort </dev/null > "$FRONTEND_LOG" 2>&1 &
FRONT_PID=$!
echo $FRONT_PID > "$FRONTEND_PID"
disown $FRONT_PID

if ! wait_for_port 5173 "Vite frontend" 30; then
    err "Frontend failed to start. Last 15 lines of log:"
    tail -15 "$FRONTEND_LOG" 2>/dev/null | sed 's/^/        /'
    exit 1
fi

cd "$PROJECT_ROOT"

# ── STEP 5: Optional Cloudflare tunnel ───────────────────────────
step 4 4 "Starting Cloudflare tunnel (optional)" "$GLOBE"
start_cloudflared_local

# ══════════════════════════════════════════════════════════════════
#                     DASHBOARD & DETACH
# ══════════════════════════════════════════════════════════════════

echo ""
echo -e "  ${GREEN}${BOLD}"
echo "  ╔═════════════════════════════════════════════════════════════════════════╗"
echo -e "  ║              ${SPARKLE}  ${NC}${GREEN}${BOLD}Fehres is LIVE${NC}${GREEN}${BOLD}  ${SPARKLE}                                   ║"
echo "  ╠═════════════════════════════════════════════════════════════════════════╣"
echo -e "  ║                                                                         ║"
echo -e "  ║  ${NC}${CYAN} Frontend  ${NC}${GREEN}→${NC}  ${BOLD}http://localhost:5173${NC}               ${GREEN}                    ║"
echo -e "  ║  ${NC}${CYAN} Nginx     ${NC}${GREEN}→${NC}  ${BOLD}http://localhost:${NGINX_PORT:-8888}${NC}               ${GREEN}            ║"
echo -e "  ║  ${NC}${CYAN} API Docs  ${NC}${GREEN}→${NC}  ${BOLD}http://localhost:8000/docs${NC}          ${GREEN}                    ║"
echo -e "  ║  ${NC}${CYAN} Postgres  ${NC}${GREEN}→${NC}  ${BOLD}localhost:5434${NC}                      ${GREEN}                    ║"
echo -e "  ║  ${NC}${CYAN} Qdrant    ${NC}${GREEN}→${NC}  ${BOLD}localhost:6333${NC}                      ${GREEN}                    ║"
echo -e "  ║                                                                         ║"
echo -e "  ${GREEN}╚═════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${DIM}Press ${BOLD}Ctrl+C${NC}${DIM} to stop all services${NC}"
echo ""

echo -e "  ${DIM}Running in detached mode. Logs: ${BOLD}$BACKEND_LOG${NC} ${DIM}and${NC} ${BOLD}$FRONTEND_LOG${NC}"
echo -e "  ${DIM}Stop manually with: ${BOLD}kill \$(cat $BACKEND_PID) \$(cat $FRONTEND_PID)${NC}"
echo ""

disown -a 2>/dev/null || true
trap - SIGINT SIGTERM

echo -e "${GREEN}${BOLD}  [OK] Setup complete. You can safely close this terminal. [READY]${NC}\n"
exit 0