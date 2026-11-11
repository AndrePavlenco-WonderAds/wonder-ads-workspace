<?php
/**
 * Leitura pelo workspace — GET /wp-json/wonderads/v1/ai-visibility
 * (ou /?rest_route=/wonderads/v1/ai-visibility), cabeçalho X-WA-Key.
 * Os campos da 1.0.0 mantêm-se iguais; os novos só acrescentam.
 *
 * @package WonderAds_IA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'wonderads/v1',
			'/ai-visibility',
			array(
				'methods'             => 'GET',
				'callback'            => 'wa_ia_rest',
				'permission_callback' => 'wa_ia_rest_permission',
			)
		);
	}
);

/**
 * @param WP_REST_Request $request Pedido.
 * @return bool
 */
function wa_ia_rest_permission( $request ) {
	$key   = get_option( WA_IA_OPT_KEY );
	$given = (string) $request->get_header( 'x-wa-key' );
	return is_string( $key ) && '' !== $key && '' !== $given && hash_equals( $key, $given );
}

/**
 * Os plugins ativos (só o nome da pasta) — para o workspace perceber que
 * cache ou que segurança o site tem.
 *
 * @return string[]
 */
function wa_ia_active_plugin_slugs() {
	$out = array();
	foreach ( (array) get_option( 'active_plugins', array() ) as $file ) {
		$slug = strtok( (string) $file, '/' );
		if ( is_string( $slug ) && '' !== $slug ) {
			$out[] = preg_replace( '/\.php$/', '', $slug );
		}
	}
	sort( $out );
	return array_values( array_unique( $out ) );
}

/**
 * @param WP_REST_Request $request Pedido.
 * @return WP_REST_Response
 */
function wa_ia_rest( $request ) {
	$from = (string) $request->get_param( 'from' );
	$to   = (string) $request->get_param( 'to' );
	if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $from ) ) {
		$from = '1970-01-01';
	}
	if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $to ) || $to > '2999-12-31' ) {
		$to = '2999-12-31';
	}

	$timezone = function_exists( 'wp_timezone_string' ) ? wp_timezone_string() : (string) get_option( 'timezone_string' );
	$test     = get_option( WA_IA_OPT_TEST );
	$check    = get_option( WA_IA_OPT_CHECK );
	global $wp_version;

	$response = rest_ensure_response(
		array(
			'plugin'   => WA_IA_VERSION,
			'timezone' => $timezone,
			'agents'   => wa_ia_agents(),
			'days'     => (object) wa_ia_days( $from, $to ),
			'pages'    => wa_ia_pages( $from, $to ),
			'lastTest' => is_array( $test ) ? $test : null,
			'cache'    => wa_ia_detect_cache(),
			// 1.1.0 ↓
			'since'    => wa_ia_since(),
			'storage'  => wa_ia_table_ready() ? 'table' : 'option',
			'caches'   => wa_ia_cache_status(),
			'check'    => is_array( $check ) ? array_merge( $check, array( 'verdict' => wa_ia_check_verdict( $check ) ) ) : null,
			'env'      => array(
				'wp'         => (string) $wp_version,
				'php'        => PHP_VERSION,
				'server'     => isset( $_SERVER['SERVER_SOFTWARE'] ) ? substr( sanitize_text_field( wp_unslash( $_SERVER['SERVER_SOFTWARE'] ) ), 0, 80 ) : '',
				'multisite'  => is_multisite(),
				'autoUpdate' => ! ( defined( 'WA_IA_NO_AUTO_UPDATE' ) && WA_IA_NO_AUTO_UPDATE ),
			),
			'plugins'  => wa_ia_active_plugin_slugs(),
		)
	);
	$response->header( 'Cache-Control', 'no-store, max-age=0' );
	return $response;
}
