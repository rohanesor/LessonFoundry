#!/bin/bash
set -eu

MIGRATION_BASELINE="${MIGRATION_BASELINE:-012}"

# Initialize migration tracking table
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U lessonfoundry -d lessonfoundry <<SQL
CREATE TABLE IF NOT EXISTS lessonfoundry_schema_migrations (
  version varchar(32) PRIMARY KEY,
  filename text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

# Apply post-baseline migrations in order
for f in backend/migrations/*.sql; do
  [ -f "$f" ] || continue
  version="$(basename "$f" | cut -d_ -f1)"
  [ "$version" -gt "$MIGRATION_BASELINE" ] || continue

  already_applied="$(docker compose exec -T db psql -At -U lessonfoundry -d lessonfoundry -c "SELECT 1 FROM lessonfoundry_schema_migrations WHERE version = '$version'" | tr -d '[:space:]')"
  if [ "$already_applied" = "1" ]; then
    echo "Skipping applied migration $f"
    continue
  fi

  echo "Applying migration $f"
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U lessonfoundry -d lessonfoundry -f - < "$f"
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U lessonfoundry -d lessonfoundry -c "INSERT INTO lessonfoundry_schema_migrations(version, filename) VALUES ('$version', '$f')"
done

echo "Migrations completed successfully."
