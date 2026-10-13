#!/usr/bin/env bash
# Creates (or re-creates) the reimbursement_db database with sample data.
#
#   ./db/setup.sh                      # uses the docker-compose MySQL on port 3307
#   MYSQL_PORT=3306 MYSQL_PWD=... ./db/setup.sh   # any other MySQL 8.0.16+ server
#
# WARNING: 01_schema.sql drops reimbursement_db first.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
HOST="${MYSQL_HOST:-127.0.0.1}"
PORT="${MYSQL_PORT:-3307}"
USER="${MYSQL_USER:-root}"
export MYSQL_PWD="${MYSQL_PWD:-rootpass}"

for f in 01_schema.sql 02_views.sql 03_triggers.sql 04_app_user.sql 05_seed.sql; do
    echo "running $f"
    mysql --protocol=TCP -h "$HOST" -P "$PORT" -u "$USER" --comments < "$DIR/$f"
done
echo "done: database reimbursement_db is ready"
