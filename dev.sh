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

CHECK="✅"
ROCKET="🚀"
FIRE="🔥"
BOLT="⚡"
DB="🗄️"
GLOBE="🌐"
STOP="🛑"
GEAR="⚙️"
SPARKLE="✨"

# ── PID / Log Files ───────────────────────────────────────────────
PID_DIR="/tmp/fehres"
BACKEND_PID="$PID_DIR/backend.pid"
FRONTEND_PID="$PID_DIR/frontend.pid"
BACKEND_LOG="$PID_DIR/backend.log"
FRONTEND_LOG="$PID_DIR/frontend.log"
COMPOSE_DEV="Docker/docker-compose.dev.yml"
COMPOSE_FULL="Docker/docker-compose.yml"
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
NGINX_PORT=8888

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
    echo -e "        ${YELLOW}⚠️  $1${NC}"
}

info() {
    echo -e "        ${DIM}$1${NC}"
}

err() {
    echo -e "        ${RED}✖  $1${NC}"
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
    # Method 1: lsof
    local pids
    pids=$(lsof -ti ":$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 0.3
    fi
    # Method 2: fuser
    fuser -k "${port}/tcp" 2>/dev/null || true
    sleep 0.3
}

port_is_free() {
    local port=$1
    ! ss -tlnH 2>/dev/null | grep -q ":${port} "
}

# Check that a required port is free — exit with helpful message if not
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

wait_for_backend() {
    local port=${1:-8000}
    local max_wait=${2:-300}
    local waited=0

    while [ $waited -lt $max_wait ]; do
        if ss -tlnH 2>/dev/null | grep -q ":${port} "; then
            success "FastAPI backend is live on port ${port}  (${waited}s)"
            return 0
        fi

        # Fail early if reloader/main process already died.
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
    echo "  ║       ${STOP}  Shutting down Fehres...             ║"
    echo "  ╚══════════════════════════════════════════════╝"
    echo -e "  ${NC}"

    # Kill frontend
    kill_pid_file "$FRONTEND_PID"
    free_port 5173
    info "Frontend stopped"

    # Kill backend
    kill_pid_file "$BACKEND_PID"
    free_port 8000
    info "Backend stopped"

    # Stop Docker infra
    docker compose -f "$PROJECT_ROOT/$COMPOSE_DEV" down 2>/dev/null || true
    info "Docker infrastructure stopped"

    # Cleanup
    rm -f "$BACKEND_LOG" "$FRONTEND_LOG"
    echo ""
    echo -e "  ${GREEN}${CHECK} All services stopped cleanly.${NC}"
    echo ""
    exit 0
}

trap cleanup SIGINT SIGTERM

# ══════════════════════════════════════════════════════════════════
#                          MAIN FLOW
# ══════════════════════════════════════════════════════════════════

print_banner

# ── STEP 0: Clean up everything ───────────────────────────────────
step 0 4 "Preparing environment" "$GEAR"

# Kill our own previous processes
kill_pid_file "$BACKEND_PID"
kill_pid_file "$FRONTEND_PID"

# Stop and remove ALL known containers (covers zombie docker-proxy cases)
info "Stopping any existing Docker services..."
OLD_CONTAINERS="fastapi frontend nginx pgvector qdrant prometheus grafana postgres_exporter node_exporter cloudflared fehres-pgvector fehres-qdrant fehres-nginx fehres-cloudflared"
for c in $OLD_CONTAINERS; do
    docker stop "$c" 2>/dev/null && docker rm "$c" 2>/dev/null || true
done
# Also bring down both compose files
docker compose -f "$PROJECT_ROOT/$COMPOSE_FULL" down --remove-orphans 2>/dev/null || true
docker compose -f "$PROJECT_ROOT/$COMPOSE_DEV" down --remove-orphans 2>/dev/null || true

# Try to free the ports we need
free_port 8000
free_port 5173
free_port "$NGINX_PORT"

# Brief pause to let sockets release
sleep 1

# Strict check — ports MUST be free before we proceed
require_port_free 8000 "FastAPI backend"
require_port_free 5173 "Vite frontend"
require_port_free "$NGINX_PORT" "Nginx reverse proxy"

success "Environment is clean"

# ── STEP 1: Docker infrastructure ─────────────────────────────────
step 1 4 "Starting hybrid Docker services" "$DB"

info "Starting pgvector + Qdrant + Nginx (+ Cloudflare if configured) via Docker..."
docker compose -f "$PROJECT_ROOT/$COMPOSE_DEV" up -d 2>&1 | tail -8

# Wait for PostgreSQL to be healthy
info "Waiting for PostgreSQL to accept connections..."
PG_WAIT_TIMEOUT=${PG_WAIT_TIMEOUT:-180}
pg_waited=0
while [ $pg_waited -lt "$PG_WAIT_TIMEOUT" ]; do
    # Prefer container health status when available.
    pg_health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' fehres-pgvector 2>/dev/null || echo "missing")

    if [ "$pg_health" = "healthy" ] || docker exec fehres-pgvector pg_isready -h 127.0.0.1 -U postgres -d minirag >/dev/null 2>&1; then
        break
    fi

    # Fail fast when healthcheck explicitly reports an unhealthy container.
    if [ "$pg_health" = "unhealthy" ]; then
        break
    fi

    sleep 1
    pg_waited=$((pg_waited + 1))
done
if [ $pg_waited -ge "$PG_WAIT_TIMEOUT" ] || [ "$pg_health" = "unhealthy" ]; then
    err "PostgreSQL failed to become healthy in ${PG_WAIT_TIMEOUT}s"
    docker ps --filter name=fehres-pgvector --format '        {{.Names}} {{.Status}}' 2>/dev/null || true
    info "Last 40 lines from pgvector logs:"
    docker compose -f "$PROJECT_ROOT/$COMPOSE_DEV" logs --tail=40 pgvector 2>/dev/null | sed 's/^/        /' || true
    exit 1
fi
success "PostgreSQL (pgvector) is ready on :5433  (${pg_waited}s)"

# Quick check for Qdrant
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

# Check Nginx reverse proxy
nginx_waited=0
nginx_code="000"
while [ $nginx_waited -lt 30 ]; do
    # In hybrid mode, upstream services may still be booting, so 502 is acceptable here.
    nginx_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${NGINX_PORT}" 2>/dev/null || echo "000")
    if [ "$nginx_code" != "000" ]; then
        break
    fi
    sleep 1
    nginx_waited=$((nginx_waited + 1))
done
if [ $nginx_waited -lt 30 ]; then
    success "Nginx reverse proxy is reachable on :${NGINX_PORT}  (HTTP ${nginx_code}, ${nginx_waited}s)"
else
    err "Nginx did not become ready on :${NGINX_PORT}"
    docker compose -f "$PROJECT_ROOT/$COMPOSE_DEV" logs --tail=40 nginx 2>/dev/null | sed 's/^/        /' || true
    exit 1
fi

# Cloudflare tunnel startup/status (optional)
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^cloudflared\.service'; then
    info "Ensuring host cloudflared service is running..."
    systemctl start cloudflared >/dev/null 2>&1 || true
    sleep 1
    if systemctl is-active --quiet cloudflared; then
        success "Cloudflare tunnel is running via systemd (host)"
    else
        warn "Host cloudflared service exists but is not active"
    fi
elif docker ps --format '{{.Names}}' | grep -q '^fehres-cloudflared$'; then
    success "Cloudflare tunnel container is running"
else
    info "Trying to start cloudflared via Docker compose..."
    docker compose -f "$PROJECT_ROOT/$COMPOSE_DEV" up -d cloudflared >/dev/null 2>&1 || true
    sleep 1
    if docker ps --format '{{.Names}}' | grep -q '^fehres-cloudflared$'; then
        success "Cloudflare tunnel container is running"
    else
        warn "Cloudflare tunnel is not running (check Docker/env/.env.cloudflared token)"
    fi
fi

# ── STEP 3: Backend ───────────────────────────────────────────────
step 2 4 "Starting FastAPI backend" "$BOLT"

cd "$PROJECT_ROOT/SRC"

# Ensure stale uvicorn instances from previous runs do not interfere.
pkill -f "uvicorn main:app --host 0.0.0.0 --port 8000" 2>/dev/null || true
sleep 0.5

# Ensure deps
info "Syncing Python dependencies with uv..."
uv sync --quiet 2>&1 || true

# Launch uvicorn
info "Launching uvicorn on :8000 with hot-reload..."
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "$BACKEND_LOG" 2>&1 &
echo $! > "$BACKEND_PID"

BACKEND_WAIT_TIMEOUT=${BACKEND_WAIT_TIMEOUT:-300}
if ! wait_for_backend 8000 "$BACKEND_WAIT_TIMEOUT"; then
    err "Backend failed to start. Last 15 lines of log:"
    tail -15 "$BACKEND_LOG" 2>/dev/null | sed 's/^/        /'
    info "Backend processes:"
    ps -ef | grep -E "uvicorn|main:app|watchfiles" | grep -v grep | sed 's/^/        /' || true
    exit 1
fi

cd "$PROJECT_ROOT"

# ── STEP 4: Frontend ──────────────────────────────────────────────
step 3 4 "Starting Vite frontend" "$GLOBE"

cd "$PROJECT_ROOT/frontend"

# Ensure deps
info "Installing frontend dependencies..."
pnpm install --frozen-lockfile --silent 2>&1 || pnpm install --silent 2>&1 || true

# Launch Vite with strict port so it fails instead of silently switching
info "Launching Vite on :5173 with HMR..."
pnpm dev -- --host --port 5173 --strictPort > "$FRONTEND_LOG" 2>&1 &
echo $! > "$FRONTEND_PID"

if ! wait_for_port 5173 "Vite frontend" 30; then
    err "Frontend failed to start. Last 15 lines of log:"
    tail -15 "$FRONTEND_LOG" 2>/dev/null | sed 's/^/        /'
    exit 1
fi

cd "$PROJECT_ROOT"

# ══════════════════════════════════════════════════════════════════
#                      DASHBOARD
# ══════════════════════════════════════════════════════════════════

echo ""
echo -e "  ${GREEN}${BOLD}"
echo "  ╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╗"
echo -e "  ║              ${SPARKLE}  ${NC}${GREEN}${BOLD}Fehres is LIVE${NC}${GREEN}${BOLD}  ${SPARKLE}                        ║"
echo "  ╠═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════╣"
echo -e "  ║                                                                                                                    ║"
echo -e "  ║  ${NC}${CYAN} Frontend  ${NC}${GREEN}→${NC}  ${BOLD}http://localhost:5173${NC}               ${GREEN}              ║"
echo -e "  ║  ${NC}${CYAN} Nginx     ${NC}${GREEN}→${NC}  ${BOLD}http://localhost:${NGINX_PORT}${NC}               ${GREEN}     ║"
echo -e "  ║  ${NC}${CYAN} API Docs  ${NC}${GREEN}→${NC}  ${BOLD}http://localhost:8000/docs${NC}          ${GREEN}              ║"
echo -e "  ║  ${NC}${CYAN} Postgres  ${NC}${GREEN}→${NC}  ${BOLD}localhost:5433${NC}                      ${GREEN}              ║"
echo -e "  ║  ${NC}${CYAN} Qdrant    ${NC}${GREEN}→${NC}  ${BOLD}localhost:6333${NC}                      ${GREEN}              ║"
echo -e "  ║                                                                                                                    ║"
echo -e "  ${GREEN}╚══════════════════════════════════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${DIM}Press ${BOLD}Ctrl+C${NC}${DIM} to stop all services${NC}"
echo ""

# ── Tail logs ──────────────────────────────────────────────────────
echo -e "  ${MAGENTA}${BOLD}═══ Live Logs ════════════════════════════════════${NC}"
echo ""

tail -f "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null &
TAIL_PID=$!

# Wait forever (until Ctrl+C triggers cleanup)
wait $TAIL_PID 2>/dev/null || true
