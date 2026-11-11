#!/bin/sh
# Faz o .zip do plugin «WonderAds — IA no site» e publica-o em /wp-plugin/
# (público: é daí que os WordPress dos clientes se atualizam sozinhos).
#   public/wp-plugin/wonderads-ia-no-site-<versão>.zip  ← o que o updater instala
#   public/wp-plugin/wonderads-ia-no-site.zip           ← o botão «Descarregar»
# Recusa se as versões não baterem certo ou se algum PHP tiver erro de sintaxe.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/wordpress-plugins/wonderads-ia-no-site"
OUT="$ROOT/public/wp-plugin"

v_header=$(sed -n 's/^ \* Version: *\([0-9.]*\).*/\1/p' "$SRC/wonderads-ia-no-site.php")
v_const=$(sed -n "s/^define( 'WA_IA_VERSION', '\([0-9.]*\)' );/\1/p" "$SRC/wonderads-ia-no-site.php")
v_readme=$(sed -n 's/^Stable tag: *\([0-9.]*\).*/\1/p' "$SRC/readme.txt")
v_ts=$(sed -n 's/^  version: "\([0-9.]*\)",/\1/p' "$ROOT/src/lib/report/wp-plugin-release.ts")
if [ "$v_header" != "$v_const" ] || [ "$v_header" != "$v_readme" ] || [ "$v_header" != "$v_ts" ]; then
  echo "versões diferentes: cabeçalho=$v_header WA_IA_VERSION=$v_const readme=$v_readme release.ts=$v_ts" >&2
  exit 1
fi
if command -v php >/dev/null 2>&1; then
  for f in $(find "$SRC" -name '*.php'); do php -l "$f" >/dev/null || { echo "erro de sintaxe: $f" >&2; exit 1; }; done
  sh "$ROOT/wordpress-plugins/tests/run-all.sh"
else
  echo "aviso: sem php — sintaxe e testes não verificados" >&2
fi

mkdir -p "$OUT"
rm -f "$OUT"/wonderads-ia-no-site*.zip
cd "$ROOT/wordpress-plugins"
zip -qr -X "$OUT/wonderads-ia-no-site-$v_header.zip" wonderads-ia-no-site -x '*.DS_Store'
cp "$OUT/wonderads-ia-no-site-$v_header.zip" "$OUT/wonderads-ia-no-site.zip"
echo "ok: $v_header → public/wp-plugin/wonderads-ia-no-site-$v_header.zip"
