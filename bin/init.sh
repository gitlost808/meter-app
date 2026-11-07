#!/usr/bin/env bash

set -euo pipefail

echo "UID=$UID" >> .env
npm i
docker compose --profile all up -d --build --remove-orphans
