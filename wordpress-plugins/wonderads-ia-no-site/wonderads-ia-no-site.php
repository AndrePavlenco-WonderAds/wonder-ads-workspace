<?php
/**
 * Plugin Name:       WonderAds — IA no site
 * Plugin URI:        https://wonder-ads.com
 * Description:       Conta as vezes que assistentes de IA (ChatGPT, Claude, Perplexity, Mistral) abrem páginas deste site para responder a alguém — no computador ou na app do telemóvel. Os números entram no relatório mensal da WonderAds. Não guarda dados de pessoas: só a contagem por dia, por assistente e por página.
 * Version:           1.1.0
 * Requires at least: 5.3
 * Requires PHP:      7.2
 * Author:            WonderAds
 * Author URI:        https://wonder-ads.com
 * License:           GPL-2.0-or-later
 * Text Domain:       wonderads-ia-no-site
 *
 * COMO FUNCIONA
 * Quando alguém pergunta algo a um assistente de IA, o assistente pode abrir a
 * página no momento para responder — e identifica-se no pedido («ChatGPT-User»,
 * «Claude-User», «Perplexity-User», «MistralAI-User»). Este plugin conta esses
 * pedidos. O workspace da WonderAds lê os totais com uma chave própria do site
 * (Definições → WonderAds IA) e mostra-os no relatório mensal.
 *
 * CACHE DE PÁGINA: se a cache servir a página antes de o WordPress correr, o
 * pedido não chega aqui. O plugin tira os 4 assistentes da cache dos plugins
 * de cache que conhece (includes/cache.php) e verifica-se a si próprio todos
 * os dias (includes/check.php). A cache do alojamento (WP Engine, por
 * exemplo) só o alojamento a ajusta — a página de definições diz o que pedir.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WA_IA_VERSION', '1.1.0' );
define( 'WA_IA_FILE', __FILE__ );
define( 'WA_IA_DB_VERSION', '1' );
define( 'WA_IA_OPT_COUNTS', 'wa_ia_counts' ); // 1.0.0 — agora só leitura (ou recurso).
define( 'WA_IA_OPT_KEY', 'wa_ia_key' );
define( 'WA_IA_OPT_TEST', 'wa_ia_last_test' );
define( 'WA_IA_OPT_CHECK', 'wa_ia_check' );
define( 'WA_IA_OPT_SINCE', 'wa_ia_since' );
define( 'WA_IA_OPT_DB', 'wa_ia_db' );
define( 'WA_IA_OPT_VERSION', 'wa_ia_version' );
define( 'WA_IA_OPT_CACHE', 'wa_ia_cache' );
define( 'WA_IA_KEEP_DAYS', 400 );
define( 'WA_IA_KEEP_MONTHS', 14 );
define( 'WA_IA_MAX_PATHS', 300 );
define( 'WA_IA_UPDATE_ORIGIN', 'https://workspace.wonder-ads.com' );
define( 'WA_IA_UPDATE_URL', WA_IA_UPDATE_ORIGIN . '/api/wp-plugin/ia-no-site' );
define( 'WA_IA_CRON', 'wa_ia_daily' );
define( 'WA_IA_CRON_CHECK', 'wa_ia_check_soon' );

require_once __DIR__ . '/includes/counter.php';
require_once __DIR__ . '/includes/cache.php';
require_once __DIR__ . '/includes/check.php';
require_once __DIR__ . '/includes/rest.php';
require_once __DIR__ . '/includes/updater.php';
if ( is_admin() ) {
	require_once __DIR__ . '/includes/admin.php';
}

/**
 * A chave do site — criada na ativação, mostrada em Definições → WonderAds IA.
 *
 * @return string
 */
function wa_ia_key() {
	$key = get_option( WA_IA_OPT_KEY );
	if ( ! is_string( $key ) || strlen( $key ) < 32 ) {
		$key = wp_generate_password( 40, false, false );
		update_option( WA_IA_OPT_KEY, $key, false );
	}
	return $key;
}

/**
 * Instalação e atualização (a ativação e o «substituir pela versão
 * carregada» passam ambos por aqui — a atualização não chama o hook de
 * ativação, por isso a versão gravada é que decide).
 */
function wa_ia_upgrade() {
	if ( WA_IA_VERSION === get_option( WA_IA_OPT_VERSION ) && wa_ia_table_ready() ) {
		return;
	}
	// Um só pedido faz a atualização, mesmo com vários a chegar ao mesmo tempo.
	if ( get_transient( 'wa_ia_upgrading' ) ) {
		return;
	}
	set_transient( 'wa_ia_upgrading', 1, MINUTE_IN_SECONDS );

	wa_ia_key();
	wa_ia_since();
	wa_ia_install_table();
	// Ajustar as caches mexe em ficheiros e definições de outros plugins:
	// num pedido do painel faz-se já; num pedido qualquer do site fica para a
	// verificação daqui a um minuto (corre no cron, com tudo carregado).
	if ( is_admin() ) {
		wa_ia_cache_apply();
	}
	if ( ! wp_next_scheduled( WA_IA_CRON ) ) {
		wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', WA_IA_CRON );
	}
	// A verificação faz pedidos ao próprio site: fica para daqui a um minuto,
	// para não atrasar a ativação nem apanhar a cache a meio de se limpar.
	if ( ! wp_next_scheduled( WA_IA_CRON_CHECK ) ) {
		wp_schedule_single_event( time() + MINUTE_IN_SECONDS, WA_IA_CRON_CHECK );
	}
	update_option( WA_IA_OPT_VERSION, WA_IA_VERSION, true );
	delete_transient( 'wa_ia_upgrading' );
}
add_action( 'plugins_loaded', 'wa_ia_upgrade', 20 );

register_activation_hook(
	__FILE__,
	function () {
		delete_option( WA_IA_OPT_VERSION );
		delete_transient( 'wa_ia_upgrading' );
		wa_ia_upgrade();
	}
);

register_deactivation_hook(
	__FILE__,
	function () {
		wp_clear_scheduled_hook( WA_IA_CRON );
		wp_clear_scheduled_hook( WA_IA_CRON_CHECK );
		wa_ia_cache_revert();
		delete_option( WA_IA_OPT_VERSION );
	}
);

/**
 * Desinstalar apaga tudo o que o plugin criou.
 */
function wa_ia_uninstall() {
	global $wpdb;
	foreach ( array( WA_IA_OPT_COUNTS, WA_IA_OPT_KEY, WA_IA_OPT_TEST, WA_IA_OPT_CHECK, WA_IA_OPT_SINCE, WA_IA_OPT_DB, WA_IA_OPT_VERSION, WA_IA_OPT_CACHE ) as $opt ) {
		delete_option( $opt );
	}
	delete_site_transient( 'wa_ia_update_info' );
	$wpdb->query( 'DROP TABLE IF EXISTS ' . $wpdb->prefix . 'wa_ia_hits' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
}
register_uninstall_hook( __FILE__, 'wa_ia_uninstall' );

add_action(
	WA_IA_CRON,
	function () {
		wa_ia_prune();
		wa_ia_cache_apply();
		wa_ia_self_check();
	}
);
add_action(
	WA_IA_CRON_CHECK,
	function () {
		wa_ia_cache_apply();
		wa_ia_self_check();
	}
);

// Contar já, enquanto o WordPress carrega os plugins: um plugin de cache que
// sirva a página a meio do arranque (ex.: WP Fastest Cache «via php») já não
// impede a contagem. Os plugins carregam por ordem alfabética e «wonderads»
// vem antes de «wp-*».
wa_ia_record();
