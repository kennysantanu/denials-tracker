#!/usr/bin/env bash
# Denials Tracker — interactive installer (Linux / macOS / WSL).
#
# Usage:
#   ./install.sh                # interactive
#   ./install.sh app            # non-interactive, app-only
#   ./install.sh bundled        # non-interactive, app + Supabase
#
# Env flags:
#   RESET_DATA=1   skip the volume-wipe prompt and always wipe stale Supabase
#                  data volumes when regenerating .env in bundled mode.

set -euo pipefail
cd "$(dirname "$0")"

color_cyan() { printf '\033[36m%s\033[0m\n' "$1"; }
color_green() { printf '\033[32m%s\033[0m\n' "$1"; }
color_yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
header() {
  echo ""
  color_cyan "======================================================================"
  color_cyan "  $1"
  color_cyan "======================================================================"
}

random_secret() {
  # 48 url-safe-ish chars from /dev/urandom.
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "${1:-48}"
}

b64url() {
  # stdin -> base64url (no padding).
  openssl base64 -A | tr -d '=' | tr '/+' '_-'
}

mint_jwt() {
  # mint_jwt <role> <secret>
  local role="$1" secret="$2"
  local now exp header payload signing_input sig
  now=$(date +%s)
  exp=$((now + 60 * 60 * 24 * 365 * 10))
  header='{"alg":"HS256","typ":"JWT"}'
  payload="{\"role\":\"$role\",\"iss\":\"supabase\",\"iat\":$now,\"exp\":$exp}"
  local h p
  h=$(printf '%s' "$header" | b64url)
  p=$(printf '%s' "$payload" | b64url)
  signing_input="$h.$p"
  sig=$(printf '%s' "$signing_input" \
    | openssl dgst -sha256 -mac HMAC -macopt "key:$secret" -binary \
    | b64url)
  echo "$signing_input.$sig"
}

# -----------------------------------------------------------------------------

header 'Denials Tracker installer'

command -v docker >/dev/null 2>&1 || {
  echo "ERROR: docker is not installed or not on PATH." >&2
  exit 1
}
command -v openssl >/dev/null 2>&1 || {
  echo "ERROR: openssl is required (used for JWT signing)." >&2
  exit 1
}

mode="${1:-}"
if [ -z "$mode" ]; then
  echo ""
  echo "Choose deployment mode:"
  echo "  [1] App only           (you already have a Supabase project, cloud or self-hosted)"
  echo "  [2] App + Supabase     (bundled local self-hosted Supabase, single host)"
  echo ""
  while :; do
    read -r -p "Enter 1 or 2: " choice
    case "$choice" in
      1) mode="app";     break ;;
      2) mode="bundled"; break ;;
    esac
  done
fi

case "$mode" in
  app|bundled) ;;
  *) echo "ERROR: invalid mode '$mode' (expected 'app' or 'bundled')" >&2; exit 1 ;;
esac

color_green "Selected mode: $mode"

skip_env=false
if [ -f .env ]; then
  echo ""
  read -r -p ".env already exists. Overwrite? [y/N]: " ow
  case "$ow" in
    y|Y) ;;
    *) color_yellow "Keeping existing .env. Skipping config generation."; skip_env=true ;;
  esac
fi

if ! $skip_env; then
  header 'Generating .env'

  if [ "$mode" = "bundled" ]; then
    project_name=$(basename "$PWD" | tr '[:upper:]' '[:lower:]')
    bundled_volumes=(
      "${project_name}_supabase-db-data"
      "${project_name}_supabase-db-config"
      "${project_name}_supabase-storage-data"
    )
    existing=()
    while IFS= read -r v; do
      for target in "${bundled_volumes[@]}"; do
        [ "$v" = "$target" ] && existing+=("$v")
      done
    done < <(docker volume ls --format '{{.Name}}' 2>/dev/null)

    if [ ${#existing[@]} -gt 0 ]; then
      echo ""
      color_yellow "WARNING: existing Supabase data volumes detected:"
      for v in "${existing[@]}"; do color_yellow "  - $v"; done
      color_yellow "A new .env will mint new database/JWT secrets that cannot"
      color_yellow "authenticate against these volumes. They must be removed"
      color_yellow "or you must keep the existing .env."
      printf '\033[31m%s\033[0m\n' "This will DELETE all database data, uploads, and users."

      reset=${RESET_DATA:-}
      if [ -z "$reset" ]; then
        read -r -p "Delete these volumes and start fresh? [y/N]: " ans
        case "$ans" in y|Y) reset=1 ;; *) reset=0 ;; esac
      fi

      if [ "$reset" != "1" ]; then
        echo "ERROR: cannot regenerate .env without resetting data volumes." >&2
        echo "       Re-run with RESET_DATA=1, answer y at the prompt, or keep your existing .env." >&2
        exit 1
      fi

      echo "Stopping containers and removing volumes..."
      docker compose -f docker-compose.yml -f docker-compose.supabase.yml down -v --remove-orphans >/dev/null 2>&1 || true
      for v in "${existing[@]}"; do
        docker volume rm "$v" >/dev/null 2>&1 || true
      done
    fi
  fi

  read -r -p "App host port [3000]: " host_port
  host_port="${host_port:-3000}"

  read -r -p "Public origin of the app [http://localhost:$host_port]: " origin
  origin="${origin:-http://localhost:$host_port}"

  if [ "$mode" = "bundled" ]; then
    read -r -p "Supabase API (Kong) host port [8000]: " kong_port
    kong_port="${kong_port:-8000}"

    echo "Generating secrets and JWTs..."
    pg_password=$(random_secret 32)
    jwt_secret=$(random_secret 48)
    pg_meta_crypto_key=$(random_secret 32)
    dashboard_password=$(random_secret 24)
    anon_key=$(mint_jwt anon "$jwt_secret")
    service_key=$(mint_jwt service_role "$jwt_secret")
    public_supabase_url="http://localhost:$kong_port"
    database_url="postgres://postgres:$pg_password@db:5432/postgres"

    cat > .env <<EOF
# Generated by install.sh on $(date -Iseconds)
PUBLIC_SUPABASE_URL=$public_supabase_url
PUBLIC_SUPABASE_ANON_KEY=$anon_key
SUPABASE_SERVICE_ROLE_KEY=$service_key
SUPABASE_INTERNAL_URL=http://kong:8000
DATABASE_URL=$database_url
ORIGIN=$origin
HOST_PORT=$host_port

SESSION_TIMEOUT_MINUTES=30
MAX_LOGIN_ATTEMPTS=5
PASSWORD_EXPIRY_DAYS=90

POSTGRES_PASSWORD=$pg_password
POSTGRES_PORT=5432
POSTGRES_DB=postgres
JWT_SECRET=$jwt_secret
JWT_EXPIRY=3600
PG_META_CRYPTO_KEY=$pg_meta_crypto_key

DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=$dashboard_password
KONG_HTTP_PORT=$kong_port
KONG_HTTPS_PORT=8443
STUDIO_PORT=54323

DISABLE_SIGNUP=true
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true

SMTP_ADMIN_EMAIL=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=Denials Tracker
EOF
    echo ""
    color_green ".env written. Save these credentials somewhere safe:"
    color_yellow "  Studio admin password:  $dashboard_password"
    color_yellow "  Postgres password:      $pg_password"
  else
    echo ""
    color_cyan "Enter your Supabase project credentials:"
    read -r -p "  Supabase URL (e.g. https://xxx.supabase.co): " public_supabase_url
    read -r -p "  Supabase anon key: " anon_key
    read -r -p "  Supabase service-role key: " service_key
    read -r -p "  Database URL (postgresql://postgres:PWD@host:5432/postgres): " database_url

    cat > .env <<EOF
# Generated by install.sh on $(date -Iseconds)
PUBLIC_SUPABASE_URL=$public_supabase_url
PUBLIC_SUPABASE_ANON_KEY=$anon_key
SUPABASE_SERVICE_ROLE_KEY=$service_key
DATABASE_URL=$database_url
ORIGIN=$origin
HOST_PORT=$host_port

SESSION_TIMEOUT_MINUTES=30
MAX_LOGIN_ATTEMPTS=5
PASSWORD_EXPIRY_DAYS=90
EOF
    color_green ".env written."
  fi
fi

# -----------------------------------------------------------------------------

header 'Starting containers'

if [ "$mode" = "bundled" ]; then
  docker compose -f docker-compose.yml -f docker-compose.supabase.yml up -d --build
else
  docker compose up -d --build
fi

echo ""
color_green 'Containers started. Useful commands:'
echo '  docker compose logs -f app        # tail app logs'
echo '  docker compose ps                 # see status'
echo '  docker compose run --rm migrate   # re-apply pending migrations'
echo ''
origin_line=$(grep -E '^ORIGIN=' .env | cut -d= -f2-)
color_cyan "App URL:    $origin_line"
if [ "$mode" = "bundled" ]; then
  studio_port=$(grep -E '^STUDIO_PORT=' .env | cut -d= -f2-)
  color_cyan "Studio UI:  http://localhost:$studio_port  (basic auth, see DASHBOARD_USERNAME/PASSWORD in .env)"
fi
