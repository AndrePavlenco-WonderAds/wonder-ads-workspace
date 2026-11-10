#!/bin/sh
# Volta a fazer o .zip do plugin «WonderAds — IA no site» que o workspace
# serve em /seo/plugin/wonderads-ia-no-site.zip (só com sessão iniciada).
set -e
cd "$(dirname "$0")/../wordpress-plugins"
mkdir -p ../public/seo/plugin
rm -f ../public/seo/plugin/wonderads-ia-no-site.zip
zip -qr -X ../public/seo/plugin/wonderads-ia-no-site.zip wonderads-ia-no-site
echo "ok: public/seo/plugin/wonderads-ia-no-site.zip"
