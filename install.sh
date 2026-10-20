#!/usr/bin/env bash
# install.sh — установка всего набора инструментов rustemmustafingovua-byte одной командой.
#
#   curl -fsSL https://raw.githubusercontent.com/rustemmustafingovua-byte/opencode-free-stack/main/install.sh | bash
#
# Ставит CLI-инструменты из tarball-релизов (без npm-логина и без токена).
# Флаг --only принимает список через запятую: --only mcp-doctor,free-web-mcp
set -euo pipefail

OWNER="rustemmustafingovua-byte"
VERSION="0.1.0"
REGISTRY="https://github.com/$OWNER"

ALL="opencode-free-stack free-web-mcp agent-x402 mcp-doctor mcp-proxy tool-schema-lint prompt-budget agent-cost-guard opencode-doctor free-tier-tracker x402-priceboard prompt-injection-guard readme-doctor lumen-chain"

ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --only) ONLY="${2:-}"; shift 2 ;;
    --version) VERSION="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "неизвестный флаг: $1" >&2; exit 1 ;;
  esac
done

if [ -n "$ONLY" ]; then
  PKGS=$(echo "$ONLY" | tr ',' ' ')
else
  PKGS="$ALL"
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "нужен npm (Node.js 20+): https://nodejs.org" >&2
  exit 1
fi

echo "→ ставлю из $REGISTRY (v$VERSION):"
FAILED=""
for p in $PKGS; do
  url="$REGISTRY/$p/releases/download/v$VERSION/$p-$VERSION.tgz"
  printf '  %-22s' "$p"
  if npm i -g "$url" >/dev/null 2>&1; then
    echo "ok"
  else
    echo "не удалось"
    FAILED="$FAILED $p"
  fi
done

if [ -n "$FAILED" ]; then
  echo
  echo "не установились:$FAILED"
  echo "поставь вручную: npm i -g https://github.com/$OWNER/<пакет>/releases/download/v$VERSION/<пакет>-$VERSION.tgz"
  exit 1
fi

echo
echo "готово. что дальше:"
echo "  mcp-doctor --help          диагностика MCP-конфигов"
echo "  opencode-doctor --help     аудит установки opencode"
echo "  tool-schema-lint --help    линтер схем инструментов"
echo "  lumen explorer             состояние сети Lumen"
