// A versão publicada do plugin WordPress «WonderAds — IA no site».
//
// Os sites com o plugin perguntam a /api/wp-plugin/ia-no-site se há versão
// nova e atualizam-se sozinhos (WordPress 6.6+ desfaz a atualização se ela
// partir o site). Para publicar uma versão:
//   1. subir `Version:` e WA_IA_VERSION em wordpress-plugins/wonderads-ia-no-site/
//   2. subir `version` aqui (+ a entrada em `changes`)
//   3. correr scripts/wordpress-zip-ia-plugin.sh (recusa se não baterem certo)
// O .zip fica público em /wp-plugin/ — não tem segredos (a chave é de cada site).

export const IA_PLUGIN_RELEASE = {
  slug: "wonderads-ia-no-site",
  version: "1.2.0",
  requires: "5.3",
  requiresPhp: "7.2",
  tested: "7.1",
  lastUpdated: "2026-11-16",
  changes: [
    {
      version: "1.2.0",
      items: [
        "Só conta quando o site responde com a página: deixa de contar scanners que fingem ser o ChatGPT (404, ficheiros escondidos, .json/.xml) e os redirecionamentos que contavam duas vezes.",
        "Os pedidos de teste identificam-se no User-Agent, para ficarem de fora também nos registos do servidor.",
        "No WP Engine, diz ao workspace o nome da instalação — o workspace conta as visitas também nos registos do servidor, incluindo as que a cache serviu.",
      ],
    },
    {
      version: "1.1.0",
      items: [
        "Tira o ChatGPT, o Claude, o Perplexity e o Mistral da cache dos plugins de cache conhecidos, para os pedidos chegarem ao WordPress.",
        "Verifica-se sozinho todos os dias e mostra o que falta (cache do alojamento, regras que bloqueiam IAs).",
        "Conta mais cedo e sem perder pedidos que chegam ao mesmo tempo (tabela própria).",
        "Atualiza-se sozinho a partir do workspace da WonderAds.",
      ],
    },
    {
      version: "1.0.0",
      items: ["Primeira versão: conta os pedidos dos 4 assistentes e mostra a chave em Definições → WonderAds IA."],
    },
  ],
} as const;

export const IA_PLUGIN_PUBLIC_DIR = "/wp-plugin";

export function iaPluginZipPath(version: string = IA_PLUGIN_RELEASE.version): string {
  return `${IA_PLUGIN_PUBLIC_DIR}/${IA_PLUGIN_RELEASE.slug}-${version}.zip`;
}
