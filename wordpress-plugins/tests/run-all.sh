#!/bin/sh
# Testes do plugin «WonderAds — IA no site» num WordPress simulado (sem rede,
# sem base de dados): contagem, atualização a partir da 1.0.0, endpoint,
# verificação do próprio site, atualizações automáticas e os adaptadores de
# cache (WP Fastest Cache, LiteSpeed, WP-Optimize, WP Rocket, WP Super Cache).
# Corre sozinho antes de cada .zip (scripts/wordpress-zip-ia-plugin.sh).
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT/wp-content/plugins"
cp -R "$HERE/../wonderads-ia-no-site" "$ROOT/wp-content/plugins/"
export WA_IA_FAKEROOT="$ROOT"
PD="$ROOT/wp-content/plugins/wonderads-ia-no-site"
fail=0
for sc in fresh-install-and-count skips early-record-at-load fallback-legacy-option upgrade-from-100 rest-permission self-check htaccess-scan updater prune-and-uninstall cache-wpfc cache-litespeed cache-wpo cache-rocket cache-wpsc cache-status-hosts cache-apply-isolated admin-render; do
  out=$(php "$HERE/run.php" "$sc" "$PD" 2>&1) || fail=1
  bad=$(echo "$out" | grep -c "✗\|Fatal" || true)
  printf "  %-26s %s\n" "$sc" "$([ "$bad" = 0 ] && echo ok || echo FALHOU)"
  [ "$bad" = 0 ] || echo "$out" | grep "✗\|Fatal" | head -5
done
for ua in "Claude-User/1.0" "Mozilla/5.0 Chrome/131"; do
  php -r 'define("ABSPATH","/x/"); $_SERVER["HTTP_USER_AGENT"]=$argv[2]; include $argv[1]; echo defined("WPSC_SERVE_DISABLED") ? "1" : "0";' "$PD/includes/wpsc-early.php" "$ua" > "$ROOT/o"
  case "$ua" in Claude*) [ "$(cat "$ROOT/o")" = 1 ] || { echo "  wpsc-early FALHOU ($ua)"; fail=1; };; *) [ "$(cat "$ROOT/o")" = 0 ] || { echo "  wpsc-early FALHOU ($ua)"; fail=1; };; esac
done
[ $fail = 0 ] && echo "testes: tudo ok" || { echo "testes: HÁ FALHAS" >&2; exit 1; }
