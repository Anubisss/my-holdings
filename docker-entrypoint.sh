#!/bin/bash
set -euo pipefail

# Start the API (runs DB migrations on boot) in the background.
node /app/apps/api/dist/index.js &
API_PID=$!

# Start nginx in the foreground (as a managed background job here so we can
# wait on both and tear everything down if either one exits).
nginx -g 'daemon off;' &
NGINX_PID=$!

shutdown() {
  kill -TERM "$API_PID" "$NGINX_PID" 2>/dev/null || true
}
trap shutdown TERM INT

# If either process exits, stop the other and propagate the exit code so the
# container doesn't linger half-dead.
wait -n "$API_PID" "$NGINX_PID"
EXIT_CODE=$?
shutdown
wait || true
exit "$EXIT_CODE"
