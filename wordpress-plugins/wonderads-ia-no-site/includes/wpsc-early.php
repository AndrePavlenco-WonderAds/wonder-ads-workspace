<?php
/**
 * Carregado pelo WP Super Cache ANTES do WordPress (wp-cache-phase1.php),
 * por isso aqui não há funções do WordPress. Se o pedido vier de um dos 4
 * assistentes de IA, o WP Super Cache não serve a página da cache: o
 * WordPress corre e o plugin «WonderAds — IA no site» conta o pedido.
 *
 * @package WonderAds_IA
 */

if ( ! defined( 'ABSPATH' ) ) {
	return;
}
if (
	! defined( 'WPSC_SERVE_DISABLED' ) &&
	isset( $_SERVER['HTTP_USER_AGENT'] ) &&
	preg_match( '/ChatGPT-User|Claude-User|Perplexity-User|MistralAI-User/i', (string) $_SERVER['HTTP_USER_AGENT'] )
) {
	define( 'WPSC_SERVE_DISABLED', true );
}
