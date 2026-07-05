#!/bin/bash
set -e

# -----------------------------------------------------------
# sskodbox Docker Entrypoint
# Handles initialization and service startup
# -----------------------------------------------------------

KODBOX_DIR="/var/www/kod"
DATA_DIR="${KODBOX_DIR}/data"
INSTALL_LOCK="${DATA_DIR}/system/install.lock"
SETTING_USER="${KODBOX_DIR}/config/setting_user.php"

# --- Env defaults ---
DB_TYPE="${DB_TYPE:-sqlite}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-sskodbox}"
DB_USER="${DB_USER:-sskodbox}"
DB_PASS="${DB_PASS:-sskodbox}"
DB_ROOT_PASS="${DB_ROOT_PASS:-root123}"

CACHE_TYPE="${CACHE_TYPE:-file}"
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_AUTH="${REDIS_AUTH:-}"
# Skip redis if extension not loaded
if [ "$CACHE_TYPE" = "redis" ] && ! php -m | grep -qi redis; then
    log "WARNING: redis extension not available, falling back to file cache"
    CACHE_TYPE="file"
fi

ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"
ADMIN_AUTO_PASS="${ADMIN_AUTO_PASS:-0}"
ADMIN_RESET="${ADMIN_RESET:-0}"

TIMEZONE="${TIMEZONE:-Asia/Shanghai}"

log() {
    echo "[sskodbox] $*"
}

# --- 1. Setup timezone ---
if [ -n "$TIMEZONE" ]; then
    cp "/usr/share/zoneinfo/${TIMEZONE}" /etc/localtime 2>/dev/null || true
    echo "$TIMEZONE" > /etc/timezone
fi

# --- 2. Ensure writable directories ---
mkdir -p "${DATA_DIR}"/system \
         "${DATA_DIR}"/temp/files \
         "${DATA_DIR}"/temp/log \
         "${DATA_DIR}"/temp/thumb \
         "${DATA_DIR}"/files \
         /run/php81

chmod -R 777 "${DATA_DIR}"

# --- 3. Wait for MySQL if needed ---
wait_for_mysql() {
    log "Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
    for i in $(seq 1 60); do
        if php -r "
            try {
                new PDO('mysql:host=${DB_HOST};port=${DB_PORT}', '${DB_USER}', '${DB_PASS}');
                echo 'ok';
            } catch(Exception \$e) { echo 'no'; }
        " 2>/dev/null | grep -q ok; then
            log "MySQL is ready."
            return 0
        fi
        sleep 2
    done
    log "ERROR: MySQL did not become ready in time."
    exit 1
}

if [ "$DB_TYPE" = "mysql" ]; then
    wait_for_mysql
fi

# --- 4. Wait for Redis if needed ---
wait_for_redis() {
    log "Waiting for Redis at ${REDIS_HOST}:${REDIS_PORT}..."
    for i in $(seq 1 30); do
        if php -r "
            try {
                \$r = new Redis();
                \$r->connect('${REDIS_HOST}', ${REDIS_PORT}, 2);
                echo 'ok';
            } catch(Exception \$e) { echo 'no'; }
        " 2>/dev/null | grep -q ok; then
            log "Redis is ready."
            return 0
        fi
        sleep 2
    done
    log "WARNING: Redis not available, falling back to file cache."
    CACHE_TYPE="file"
}

if [ "$CACHE_TYPE" = "redis" ]; then
    wait_for_redis
fi

# --- 5. Regenerate config if lost (container recreated but volume persists) ---
gen_setting_user() {
    log "Regenerating config/setting_user.php from env..."
    cat > "${SETTING_USER}" <<EOF
<?php
\$config['database'] = array(
    'DB_TYPE'    => '$([ "$DB_TYPE" = "mysql" ] && echo "mysqli" || echo "sqlite")',
    'DB_HOST'    => '${DB_HOST}',
    'DB_PORT'    => ${DB_PORT},
    'DB_USER'    => '${DB_USER}',
    'DB_PWD'     => '${DB_PASS}',
    'DB_NAME'    => '${DB_NAME}',
    'DB_CHARSET' => 'utf8',
    'DB_SQL_LOG' => true,
    'DB_FIELDS_CACHE' => true,
);
\$config['cache']['sessionType'] = '${CACHE_TYPE}';
\$config['cache']['cacheType'] = '${CACHE_TYPE}';
EOF
    if [ "$CACHE_TYPE" = "redis" ]; then
        cat >> "${SETTING_USER}" <<EOF
\$config['cache']['redis']['host'] = '${REDIS_HOST}';
\$config['cache']['redis']['port'] = '${REDIS_PORT}';
EOF
        [ -n "$REDIS_AUTH" ] && echo "\$config['cache']['redis']['auth'] = '${REDIS_AUTH}';" >> "${SETTING_USER}"
    fi
    chmod 644 "${SETTING_USER}"
    log "Config file regenerated."
}

if [ -f "$INSTALL_LOCK" ] && [ ! -f "$SETTING_USER" ]; then
    gen_setting_user
fi

# --- 6. Initialize kodbox if not installed ---
if [ ! -f "$INSTALL_LOCK" ]; then
    log "Initializing sskodbox..."

    # Build CLI install args
    CLI_ARGS=()

    if [ "$DB_TYPE" = "mysql" ]; then
        CLI_ARGS+=(--database mysql)
        CLI_ARGS+=(--database-host "${DB_HOST}:${DB_PORT}")
        CLI_ARGS+=(--database-user "${DB_USER}")
        CLI_ARGS+=(--database-pass "${DB_PASS}")
        CLI_ARGS+=(--database-name "${DB_NAME}")
    else
        CLI_ARGS+=(--database sqlite)
    fi

    if [ "$CACHE_TYPE" = "redis" ]; then
        CLI_ARGS+=(--cache redis)
        CLI_ARGS+=(--redis-host "${REDIS_HOST}")
        CLI_ARGS+=(--redis-port "${REDIS_PORT}")
        if [ -n "$REDIS_AUTH" ]; then
            CLI_ARGS+=(--redis-auth "${REDIS_AUTH}")
        fi
    else
        CLI_ARGS+=(--cache file)
    fi

    if [ "$ADMIN_RESET" = "1" ]; then
        CLI_ARGS+=(--user-reset 1)
    fi

    if [ "$ADMIN_AUTO_PASS" = "1" ]; then
        CLI_ARGS+=(--user-auto 1)
    fi

    CLI_ARGS+=(--user-name "${ADMIN_USER}")
    CLI_ARGS+=(--user-pass "${ADMIN_PASS}")

    # Run CLI installer
    cd "${KODBOX_DIR}"
    if php index.php "install/index/auto" "${CLI_ARGS[@]}" 2>&1; then
        log "Installation successful!"
    else
        log "ERROR: Installation failed!"
        # Fall back: try web installer by removing any partial config
        rm -f "${SETTING_USER}" "${INSTALL_LOCK}"
        log "Removed partial config. Please complete installation via web UI."
    fi
else
    log "sskodbox already initialized."
    # Ensure permissions on every restart
    chmod -R 777 "${DATA_DIR}"
fi

# Always ensure files directory is writable by PHP-FPM (nobody)
chmod -R 777 "${DATA_DIR}/files" "${DATA_DIR}/temp" 2>/dev/null || true

# --- 7. Start services ---
log "Starting services..."
exec supervisord -c /etc/supervisord.conf
