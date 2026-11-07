#!/usr/bin/env bash

set -euo pipefail

docker compose --profile all down --volumes
bin/init.sh