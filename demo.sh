#!/usr/bin/env bash
# demo.sh — прогон всех инструментов портфеля и печать результата.
#
#   bash demo.sh            # всё, что можно без сети
#   bash demo.sh --live     # плюс живые сетевые проверки
#
# Нулевой бюджет: ничего не оплачивается, ключи не обязательны.
set -uo pipefail

OK=$'\x1b[32m'; BAD=$'\x1b[31m'; DIM=$'\x1b[2m'; END=$'\x1b[0m'
LIVE=0
[ "${1:-}" = "--live" ] && LIVE=1

cd "$(dirname "$0")" || exit 1

step() { printf "%s→%s %s\n" "$DIM" "$END" "$1"; }
pass() { printf "   %s✔%s %s\n" "$OK" "$END" "$1"; }
fail() { printf "   %s✘%s %s\n" "$BAD" "$END" "$1"; }

echo
echo "═══ Lumen portfolio demo ═══"
echo

# 1) тесты
step "тесты (node)"
total=0; failed=0
for d in opencode-free-stack free-web-mcp agent-x402 agent-browser-mcp mcp-doctor mcp-proxy \
         tool-schema-lint prompt-budget agent-cost-guard opencode-doctor free-tier-tracker \
         x402-priceboard prompt-injection-guard readme-doctor; do
  [ -d "../$d" ] || continue
  out=$(cd "../$d" && npm test 2>&1 | grep -E "^ℹ (pass|fail)" | tr '\n' ' ')
  p=$(echo "$out" | sed -n 's/.*pass \([0-9]*\).*/\1/p')
  f=$(echo "$out" | sed -n 's/.*fail \([0-9]*\).*/\1/p')
  total=$((total + ${p:-0})); failed=$((failed + ${f:-0}))
done
if [ "${failed:-0}" -eq 0 ]; then pass "все пакеты: $total тестов зелёные"; else fail "упало тестов: $failed"; fi

# 2) Lumen
step "Lumen: цепь и VM"
if [ -d ../lumen-chain ]; then
  out=$(cd ../lumen-chain && npm test 2>&1 | grep -E "^ℹ (pass|fail)" | tr '\n' ' ')
  p=$(echo "$out" | sed -n 's/.*pass \([0-9]*\).*/\1/p')
  f=$(echo "$out" | sed -n 's/.*fail \([0-9]*\).*/\1/p')
  total=$((total + ${p:-0})); failed=$((failed + ${f:-0}))
  if [ -x "$HOME/.foundry/bin/forge" ]; then
    ft=$(cd ../lumen-chain && PATH="$HOME/.foundry/bin:$PATH" forge test 2>&1 | grep -oE "[0-9]+ passed" | head -1)
    [ -n "$ft" ] && pass "контракты (forge): $ft"
  fi
fi

# 3) инструменты по одному разу
step "инструменты"
run_tool() {
  local name="$1"; shift
  if out=$(eval "$@" 2>&1); then
    pass "$name: $(echo "$out" | tail -1 | cut -c1-70)"
  else
    fail "$name: $(echo "$out" | tail -1 | cut -c1-70)"
  fi
}
run_tool "prompt-injection-guard" "cd ../prompt-injection-guard && node bin/prompt-injection-guard.js ../free-web-mcp/README.md"
run_tool "tool-schema-lint" "cd ../tool-schema-lint && node bin/tool-schema-lint.js --help"
run_tool "mcp-doctor" "cd ../mcp-doctor && node bin/mcp-doctor.js --json"
run_tool "free-tier-tracker" "cd ../free-tier-tracker && node bin/free-tier-tracker.js status"
run_tool "x402-priceboard" "cd ../x402-priceboard && node bin/x402-priceboard.js --help"
run_tool "lumen (node)" "cd ../lumen-chain && npx tsx cli/lumen.ts explorer"
run_tool "lumen (keeper check)" "cd ../lumen-chain && npx tsx cli/lumen.ts keeper check"

# 4) живые сервисы
if [ "$LIVE" = "1" ]; then
  step "живые сервисы"
  FW=$(cat "$HOME/.local/state/free-web-url.txt" 2>/dev/null || echo "")
  LM=$(cat "$HOME/.local/state/lumen-url.txt" 2>/dev/null || echo "")
  [ -n "$FW" ] && (curl -sf -o /dev/null --max-time 15 "$FW/health" && pass "free-web MCP: $FW" || fail "free-web MCP недоступен")
  [ -n "$LM" ] && (curl -sf -o /dev/null --max-time 15 "$LM/" && pass "Lumen explorer: $LM" || fail "Lumen explorer недоступен")
fi

echo
echo "   итого тестов: $total, провалов: $failed"
echo
