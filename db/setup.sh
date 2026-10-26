#!/usr/bin/env bash
# Builds the rms database from scratch: schema, views, triggers, app user, seed data.
#
#   ./db/setup.sh                      # Docker MySQL from docker-compose.yml (port 3307)
#   DB_PORT=3306 DB_ROOT_PASSWORD=... ./db/setup.sh    # a local MySQL install
#
# Uses the mysql command-line client, because the trigger files rely on its
# DELIMITER command. Warning: 01_schema.sql drops and recreates the database.
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3307}"
DB_ROOT_USER="${DB_ROOT_USER:-root}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-rootpass}"

DIR="$(cd "$(dirname "$0")" && pwd)"
export MYSQL_PWD="$DB_ROOT_PASSWORD"

for f in 01_schema.sql 02_views.sql 03_triggers.sql 04_app_user.sql 05_seed.sql; do
    echo "-> $f"
    # --comments keeps the comments inside trigger bodies (SHOW CREATE TRIGGER shows them)
    mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_ROOT_USER" --protocol=TCP --comments < "$DIR/$f"
done

echo "Database 'rms' is ready."
