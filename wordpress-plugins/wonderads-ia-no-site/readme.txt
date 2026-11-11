=== WonderAds — IA no site ===
Contributors: wonderads
Requires at least: 5.3
Tested up to: 7.1
Requires PHP: 7.2
Stable tag: 1.1.0
License: GPLv2 or later

Conta as vezes que o ChatGPT, o Claude, o Perplexity e o Mistral abrem páginas deste site para responder a alguém. Os números entram no relatório mensal da WonderAds.

== Instalação ==

1. Plugins → Adicionar novo → Carregar plugin → escolher o .zip → Instalar → Ativar.
2. Definições → WonderAds IA → copiar a chave.
3. No workspace: relatório mensal do cliente → Configuração do cliente → «IA no site (plugin WordPress)» → colar a chave → Guardar → Testar.

== Privacidade ==

Não guarda dados de pessoas. Só conta, por dia e por página, os pedidos feitos por robôs de assistentes de IA que se identificam como tal.

== Atualizações ==

O plugin atualiza-se sozinho a partir do workspace da WonderAds (o WordPress 6.6+ desfaz a atualização se ela partir o site). Para desligar num site: define( 'WA_IA_NO_AUTO_UPDATE', true ); no wp-config.php.

== Changelog ==

= 1.1.0 =
* Tira o ChatGPT, o Claude, o Perplexity e o Mistral da cache dos plugins de cache conhecidos.
* Verifica-se sozinho todos os dias e mostra o que falta (cache do alojamento, regras que bloqueiam IAs).
* Conta mais cedo e sem perder pedidos que chegam ao mesmo tempo (tabela própria).
* Atualiza-se sozinho a partir do workspace da WonderAds.

= 1.0.0 =
* Primeira versão.
