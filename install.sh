#!/usr/bin/env bash
# install.sh — установка всего набора инструментов rustemmustafingovua-byte одной командой.
#
#   curl -fsSL https://raw.githubusercontent.com/rustemmustafingovua-byte/opencode-free-stack/main/install.sh | bash
#
# Ставит CLI-инструменты из tarball-релизов (без npm-логина и без токена).
# Флаг --only принимает список через запятую: --only mcp-doctor,free-web-mcp
set -euo pipefail

OWNER="rustemmustafingovua-byte"
VERSION="${LUMEN_INSTALL_VERSION:-}"   # пусто = брать последний релиз
REGISTRY="https://github.com/$OWNER"

ALL="opencode-free-stack agent-browser-mcp wallet-hygiene free-web-mcp agent-x402 mcp-doctor mcp-proxy tool-schema-lint prompt-budget agent-cost-guard opencode-doctor free-tier-tracker x402-priceboard prompt-injection-guard readme-doctor lumen-chain"

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

echo "→ ставлю из $REGISTRY:"
FAILED=""
for p in $PKGS; do
  ver="$VERSION"
  if [ -z "$ver" ]; then
    # последний релиз из GitHub API
    ver=$(curl -sf --max-time 15 "https://api.github.com/repos/$OWNER/$p/releases/latest" \
      | sed -n 's/.*"tag_name": *"v\([0-9.]*\)".*/\1/p' | head -1)
    [ -n "$ver" ] || ver="0.1.0"
  fi
  url="$REGISTRY/$p/releases/download/v$ver/$p-$ver.tgz"
  printf '  %-22s v%-8s' "$p" "$ver"
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
  echo "поставь вручную: npm i -g https://github.com/$OWNER/<пакет>/releases/download/v<версия>/<пакет>-<версия>.tgz"
  exit 1
fi

echo
echo "готово. что дальше:"
echo "  mcp-doctor --help          диагностика MCP-конфигов"
echo "  opencode-doctor --help     аудит установки opencode"
echo "  tool-schema-lint --help    линтер схем инструментов"
echo "  lumen explorer             состояние сети Lumen"
echo "  agent-browser-mcp          настоящий браузер для агента (MCP)"
echo "  wallet-hygiene             контроль над своими кошельками"
