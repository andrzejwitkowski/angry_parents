#!/usr/bin/env bash
# start-db.sh — Start Docker Compose services using Podman or Docker
# Works on machines with either `podman` or `docker` installed.

set -e

if command -v podman &> /dev/null; then
    echo "[DB] Starting services with Podman Compose..."
    podman compose up -d
elif command -v docker &> /dev/null; then
    echo "[DB] Starting services with Docker Compose..."
    docker compose up -d
else
    echo "[DB] ERROR: Neither podman nor docker found. Please install one of them."
    exit 1
fi

echo "[DB] Services started."
