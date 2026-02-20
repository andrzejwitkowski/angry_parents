#!/usr/bin/env bash
# stop-db.sh — Stop Docker Compose services using Podman or Docker

if command -v podman &> /dev/null; then
    echo "[DB] Stopping services with Podman Compose..."
    podman compose down
elif command -v docker &> /dev/null; then
    echo "[DB] Stopping services with Docker Compose..."
    docker compose down
else
    echo "[DB] Neither podman nor docker found."
fi
