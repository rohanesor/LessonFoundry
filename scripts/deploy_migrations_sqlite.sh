#!/bin/bash
# SQLite migration script for EC2 systemd deployment.
# 
# For SQLite, SQLAlchemy's create_all(checkfirst=True) handles table creation
# on app startup. This script ensures indexes exist and records migration versions
# so we know which schema version is deployed.
#
# PostgreSQL-specific syntax (RLS, roles, DO blocks) is skipped.
set -eu

DATABASE_PATH="${DATABASE_PATH:-/opt/lessonfoundry/lessonfoundry-live.sqlite3}"
MIGRATION_BASELINE="${MIGRATION_BASELINE:-014}"

# Verify database exists
if [ ! -f "$DATABASE_PATH" ]; then
  echo "Database not found: $DATABASE_PATH"
  exit 1
fi

# Initialize migration tracking table
sqlite3 "$DATABASE_PATH" <<SQL
CREATE TABLE IF NOT EXISTS lessonfoundry_schema_migrations (
  version TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
SQL

cd /opt/lessonfoundry

# SQLite-compatible migrations that add indexes if not present.
# Tables are created by SQLAlchemy; migrations just ensure indexes.
apply_sqlite_indexes() {
  sqlite3 "$DATABASE_PATH" <<SQL
-- 015: Quiz attempts indexes
CREATE INDEX IF NOT EXISTS ix_quiz_attempts_student ON quiz_attempts(student_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS ix_quiz_attempts_unit ON quiz_attempts(unit_id);
CREATE INDEX IF NOT EXISTS ix_quiz_attempts_classroom ON quiz_attempts(classroom_id);
CREATE INDEX IF NOT EXISTS ix_quiz_attempts_objective ON quiz_attempts(objective_id);
CREATE INDEX IF NOT EXISTS ix_quiz_attempts_slot ON quiz_attempts(slot);

-- 016: Learning plans indexes
CREATE INDEX IF NOT EXISTS ix_learning_plans_student ON learning_plans(student_id);
CREATE INDEX IF NOT EXISTS ix_learning_plans_classroom ON learning_plans(classroom_id);
CREATE INDEX IF NOT EXISTS ix_learning_plans_status ON learning_plans(status);
CREATE INDEX IF NOT EXISTS ix_plan_items_plan ON plan_items(plan_id);
CREATE INDEX IF NOT EXISTS ix_plan_items_day ON plan_items(plan_id, day_number);
CREATE INDEX IF NOT EXISTS ix_coding_problems_topic ON coding_problems(topic);
CREATE INDEX IF NOT EXISTS ix_coding_problems_unit ON coding_problems(unit_id);
CREATE INDEX IF NOT EXISTS ix_code_submissions_problem ON code_submissions(problem_id);
CREATE INDEX IF NOT EXISTS ix_code_submissions_student ON code_submissions(student_id, submitted_at DESC);
SQL
  echo "SQLite indexes ensured."
}

# Record migration versions as applied (even if handled by SQLAlchemy)
record_versions() {
  for f in backend/migrations/*.sql; do
    [ -f "$f" ] || continue
    version="$(basename "$f" | cut -d_ -f1)"
    
    # Skip non-numeric prefixes and baseline/earlier
    if ! [[ "$version" =~ ^[0-9]+$ ]]; then
      continue
    fi
    if [ "$version" -le "$MIGRATION_BASELINE" ] 2>/dev/null; then
      continue
    fi
    # Skip _sqlite variants (handled inline)
    case "$f" in *_sqlite.sql) continue ;; esac

    already_applied="$(sqlite3 "$DATABASE_PATH" "SELECT 1 FROM lessonfoundry_schema_migrations WHERE version = '$version';" 2>/dev/null || echo "")"
    if [ "$already_applied" != "1" ]; then
      echo "Recording migration $f as applied (schema from SQLAlchemy)"
      sqlite3 "$DATABASE_PATH" "INSERT OR IGNORE INTO lessonfoundry_schema_migrations(version, filename) VALUES ('$version', '$f');"
    fi
  done
}

apply_sqlite_indexes
record_versions

echo "Migrations completed successfully."
