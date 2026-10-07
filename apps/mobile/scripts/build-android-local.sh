#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${APP_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${APP_DIR}/.env"
  set +a
fi

if [[ -z "${ANDROID_HOME:-}" && -d "${HOME}/Android/Sdk" ]]; then
  export ANDROID_HOME="${HOME}/Android/Sdk"
fi

if [[ -z "${ANDROID_SDK_ROOT:-}" && -n "${ANDROID_HOME:-}" ]]; then
  export ANDROID_SDK_ROOT="${ANDROID_HOME}"
fi

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
  echo "Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT before running the local Android build." >&2
  exit 1
fi

export NODE_ENV="${NODE_ENV:-production}"

# eas-cli's env-var fetch uses node-fetch, which has no Happy Eyeballs fallback:
# if IPv6 resolves for api.expo.dev but isn't actually routable here, it hangs
# until ETIMEDOUT instead of falling back to IPv4 the way curl does.
export NODE_OPTIONS="${NODE_OPTIONS:-} --dns-result-order=ipv4first"

exec eas build --platform android --profile local --local
