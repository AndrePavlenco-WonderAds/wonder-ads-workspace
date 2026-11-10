<?php
/**
 * Plugin Name:       WonderAds — IA no site
 * Plugin URI:        https://wonder-ads.com
 * Description:       Conta as vezes que assistentes de IA (ChatGPT, Claude, Perplexity, Mistral) abrem páginas deste site para responder a alguém — no computador ou na app do telemóvel. Os números entram no relatório mensal da WonderAds. Não guarda dados de pessoas: só a contagem por dia, por assistente e por página.
 * Version:           1.0.0
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
 * CACHE DE PÁGINA: se o alojamento servir a página da cache antes de o
 * WordPress correr, o pedido não chega aqui. O botão «Testar» do workspace
 * deteta isso; no WP Rocket estes assistentes saem da cache sozinhos.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WA_IA_VERSION', '1.0.0' );
define( 'WA_IA_OPT_COUNTS', 'wa_ia_counts' );
define( 'WA_IA_OPT_KEY', 'wa_ia_key' );
define( 'WA_IA_OPT_TEST', 'wa_ia_last_test' );
define( 'WA_IA_KEEP_DAYS', 400 );
define( 'WA_IA_KEEP_MONTHS', 14 );
define( 'WA_IA_MAX_PATHS', 300 );

/**
 * Os robôs que contamos, e de que tipo são:
 *  - «user»     abre a página no momento em que alguém faz uma pergunta;
 *  - «search»   indexa para a pesquisa do assistente;
 *  - «training» recolhe para treino.
 * O primeiro nome que aparecer no User-Agent ganha.
 *
 * @return array<string,string>
 */
function wa_ia_agents() {
	return array(
		'ChatGPT-User'     => 'user',
		'Claude-User'      => 'user',
		'Perplexity-User'  => 'user',
		'MistralAI-User'   => 'user',
		'OAI-SearchBot'    => 'search',
		'Claude-SearchBot' => 'search',
		'PerplexityBot'    => 'search',
		'GPTBot'           => 'training',
		'ClaudeBot'        => 'training',
	);
}

/**
 * Os que respondem a pessoas — os únicos que saem da cache de página.
 *
 * @return string[]
 */
function wa_ia_user_agents() {
	$out = array();
	foreach ( wa_ia_agents() as $agent => $kind ) {
		if ( 'user' === $kind ) {
			$out[] = $agent;
		}
	}
	return $out;
}

/**
 * @param string $ua User-Agent do pedido.
 * @return string|null O nome do robô, ou null.
 */
function wa_ia_match_agent( $ua ) {
	if ( ! is_string( $ua ) || '' === $ua ) {
		return null;
	}
	foreach ( array_keys( wa_ia_agents() ) as $agent ) {
		if ( false !== stripos( $ua, $agent ) ) {
			return $agent;
		}
	}
	return null;
}

/**
 * Regista o pedido, se vier de um dos robôs. Corre o mais cedo possível.
 */
function wa_ia_record() {
	if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
		return;
	}
	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		return;
	}
	$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : 'GET';
	if ( 'GET' !== $method && 'HEAD' !== $method ) {
		return;
	}
	$ua    = isset( $_SERVER['HTTP_USER_AGENT'] ) ? (string) wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) : '';
	$agent = wa_ia_match_agent( $ua );
	if ( null === $agent ) {
		return;
	}

	$uri  = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
	$path = wp_parse_url( $uri, PHP_URL_PATH );
	if ( ! is_string( $path ) || '' === $path ) {
		$path = '/';
	}
	// O que não é uma página: a API, o login, o robots.txt (que o robô lê
	// antes da página e contaria o mesmo pedido duas vezes).
	if ( false !== strpos( $uri, 'rest_route=' ) || false !== strpos( $path, '/wp-json' ) ) {
		return;
	}
	$base = strtolower( basename( $path ) );
	if ( in_array( $base, array( 'robots.txt', 'wp-login.php', 'xmlrpc.php', 'wp-cron.php', 'favicon.ico' ), true ) ) {
		return;
	}
	$path = substr( $path, 0, 200 );

	// Pedido de teste do workspace: fica registado à parte, nunca conta.
	$test = isset( $_SERVER['HTTP_X_WA_IA_TEST'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_WA_IA_TEST'] ) ) : '';
	if ( '' !== $test ) {
		update_option(
			WA_IA_OPT_TEST,
			array(
				'nonce' => substr( $test, 0, 64 ),
				'agent' => $agent,
				'path'  => $path,
				'at'    => time(),
			),
			false
		);
		return;
	}

	wa_ia_increment( $agent, $path );
}
add_action( 'plugins_loaded', 'wa_ia_record', 0 );

/**
 * @param string $agent Nome do robô.
 * @param string $path  Caminho da página.
 */
function wa_ia_increment( $agent, $path ) {
	$data = get_option( WA_IA_OPT_COUNTS );
	if ( ! is_array( $data ) ) {
		$data = array();
	}
	if ( ! isset( $data['days'] ) || ! is_array( $data['days'] ) ) {
		$data['days'] = array();
	}
	if ( ! isset( $data['pages'] ) || ! is_array( $data['pages'] ) ) {
		$data['pages'] = array();
	}

	// Dia no fuso do site (Definições → Geral).
	$day   = current_time( 'Y-m-d' );
	$month = substr( $day, 0, 7 );

	if ( ! isset( $data['days'][ $day ] ) || ! is_array( $data['days'][ $day ] ) ) {
		$data['days'][ $day ] = array();
	}
	if ( ! isset( $data['days'][ $day ][ $agent ] ) ) {
		$data['days'][ $day ][ $agent ] = 0;
	}
	$data['days'][ $day ][ $agent ] = (int) $data['days'][ $day ][ $agent ] + 1;

	if ( ! isset( $data['pages'][ $month ] ) || ! is_array( $data['pages'][ $month ] ) ) {
		$data['pages'][ $month ] = array();
	}
	$page_key = $agent . ' ' . $path;
	if ( isset( $data['pages'][ $month ][ $page_key ] ) ) {
		$data['pages'][ $month ][ $page_key ] = (int) $data['pages'][ $month ][ $page_key ] + 1;
	} elseif ( count( $data['pages'][ $month ] ) < WA_IA_MAX_PATHS ) {
		$data['pages'][ $month ][ $page_key ] = 1;
	}

	if ( count( $data['days'] ) > WA_IA_KEEP_DAYS ) {
		ksort( $data['days'] );
		$data['days'] = array_slice( $data['days'], -WA_IA_KEEP_DAYS, null, true );
	}
	if ( count( $data['pages'] ) > WA_IA_KEEP_MONTHS ) {
		ksort( $data['pages'] );
		$data['pages'] = array_slice( $data['pages'], -WA_IA_KEEP_MONTHS, null, true );
	}

	update_option( WA_IA_OPT_COUNTS, $data, false );
}

/**
 * WP Rocket: os assistentes que respondem a pessoas saem da cache de página,
 * para o pedido chegar ao WordPress. Os de indexação e treino ficam na cache
 * (são muitos e não interessam ao relatório).
 */
add_filter(
	'rocket_cache_reject_ua',
	function ( $ua ) {
		$ua = is_array( $ua ) ? $ua : array();
		return array_values( array_unique( array_merge( $ua, wa_ia_user_agents() ) ) );
	}
);

/**
 * @return string[] Os sistemas de cache que conseguimos reconhecer.
 */
function wa_ia_detect_cache() {
	$found = array();
	if ( defined( 'PWP_NAME' ) || defined( 'WPE_APIKEY' ) || function_exists( 'is_wpe' ) ) {
		$found[] = 'WP Engine';
	}
	if ( defined( 'LSCWP_V' ) ) {
		$found[] = 'LiteSpeed Cache';
	}
	if ( defined( 'WP_ROCKET_VERSION' ) ) {
		$found[] = 'WP Rocket';
	}
	if ( defined( 'W3TC' ) ) {
		$found[] = 'W3 Total Cache';
	}
	if ( function_exists( 'wp_cache_phase2' ) ) {
		$found[] = 'WP Super Cache';
	}
	return $found;
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

function wa_ia_activate() {
	wa_ia_key();
	if ( false === get_option( WA_IA_OPT_COUNTS ) ) {
		add_option( WA_IA_OPT_COUNTS, array(), '', 'no' );
	}
	// O WP Rocket só aplica a lista de exclusões quando regenera a config.
	if ( function_exists( 'rocket_generate_config_file' ) ) {
		rocket_generate_config_file();
	}
}
register_activation_hook( __FILE__, 'wa_ia_activate' );

function wa_ia_uninstall() {
	delete_option( WA_IA_OPT_COUNTS );
	delete_option( WA_IA_OPT_KEY );
	delete_option( WA_IA_OPT_TEST );
}
register_uninstall_hook( __FILE__, 'wa_ia_uninstall' );

/* ------------------------------------------------------------------------
 * Leitura pelo workspace — GET /wp-json/wonderads/v1/ai-visibility
 * (ou /?rest_route=/wonderads/v1/ai-visibility), cabeçalho X-WA-Key.
 * --------------------------------------------------------------------- */

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
 * @param WP_REST_Request $request Pedido.
 * @return WP_REST_Response
 */
function wa_ia_rest( $request ) {
	$from = (string) $request->get_param( 'from' );
	$to   = (string) $request->get_param( 'to' );
	if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $from ) ) {
		$from = '0000-00-00';
	}
	if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $to ) ) {
		$to = '9999-99-99';
	}

	$data = get_option( WA_IA_OPT_COUNTS );
	if ( ! is_array( $data ) ) {
		$data = array();
	}
	$all_days  = ( isset( $data['days'] ) && is_array( $data['days'] ) ) ? $data['days'] : array();
	$all_pages = ( isset( $data['pages'] ) && is_array( $data['pages'] ) ) ? $data['pages'] : array();

	$days = array();
	foreach ( $all_days as $day => $counts ) {
		$day = (string) $day;
		if ( $day >= $from && $day <= $to && is_array( $counts ) ) {
			$days[ $day ] = $counts;
		}
	}

	$from_month = substr( $from, 0, 7 );
	$to_month   = substr( $to, 0, 7 );
	$pages      = array();
	foreach ( $all_pages as $month => $entries ) {
		$month = (string) $month;
		if ( $month < $from_month || $month > $to_month || ! is_array( $entries ) ) {
			continue;
		}
		foreach ( $entries as $page_key => $count ) {
			$parts = explode( ' ', (string) $page_key, 2 );
			$pages[] = array(
				'month' => $month,
				'agent' => $parts[0],
				'path'  => isset( $parts[1] ) ? $parts[1] : '/',
				'count' => (int) $count,
			);
		}
	}

	$timezone = function_exists( 'wp_timezone_string' ) ? wp_timezone_string() : (string) get_option( 'timezone_string' );
	$test     = get_option( WA_IA_OPT_TEST );

	$response = rest_ensure_response(
		array(
			'plugin'   => WA_IA_VERSION,
			'timezone' => $timezone,
			'agents'   => wa_ia_agents(),
			'days'     => (object) $days,
			'pages'    => $pages,
			'lastTest' => is_array( $test ) ? $test : null,
			'cache'    => wa_ia_detect_cache(),
		)
	);
	$response->header( 'Cache-Control', 'no-store, max-age=0' );
	return $response;
}

/* ------------------------------------------------------------------------
 * Definições → WonderAds IA
 * --------------------------------------------------------------------- */

add_action(
	'admin_menu',
	function () {
		add_options_page( 'WonderAds IA', 'WonderAds IA', 'manage_options', 'wonderads-ia', 'wa_ia_settings_page' );
	}
);

add_action(
	'admin_post_wa_ia_new_key',
	function () {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissões.' );
		}
		check_admin_referer( 'wa_ia_new_key' );
		update_option( WA_IA_OPT_KEY, wp_generate_password( 40, false, false ), false );
		wp_safe_redirect( admin_url( 'options-general.php?page=wonderads-ia&nova=1' ) );
		exit;
	}
);

add_filter(
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	function ( $links ) {
		$links[] = '<a href="' . esc_url( admin_url( 'options-general.php?page=wonderads-ia' ) ) . '">Chave e números</a>';
		return $links;
	}
);

function wa_ia_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$key   = wa_ia_key();
	$data  = get_option( WA_IA_OPT_COUNTS );
	$days  = ( is_array( $data ) && isset( $data['days'] ) && is_array( $data['days'] ) ) ? $data['days'] : array();
	$month = current_time( 'Y-m' );
	$sum   = array();
	foreach ( wa_ia_user_agents() as $agent ) {
		$sum[ $agent ] = 0;
	}
	foreach ( $days as $day => $counts ) {
		if ( 0 !== strpos( (string) $day, $month ) || ! is_array( $counts ) ) {
			continue;
		}
		foreach ( $counts as $agent => $n ) {
			if ( isset( $sum[ $agent ] ) ) {
				$sum[ $agent ] += (int) $n;
			}
		}
	}
	$test  = get_option( WA_IA_OPT_TEST );
	$cache = wa_ia_detect_cache();
	?>
	<div class="wrap">
		<h1>WonderAds — IA no site</h1>
		<?php if ( isset( $_GET['nova'] ) ) : ?>
			<div class="notice notice-success"><p>Chave nova criada. Copia-a outra vez para o workspace — a antiga deixou de funcionar.</p></div>
		<?php endif; ?>
		<p>Conta as vezes que o ChatGPT, o Claude, o Perplexity e o Mistral abrem páginas deste site para responder a alguém. Os números entram no relatório mensal da WonderAds.</p>

		<h2>Chave do site</h2>
		<p>Copia esta chave para o workspace (relatório mensal do cliente → Configuração do cliente → <strong>IA no site (plugin WordPress)</strong>).</p>
		<p><input type="text" class="regular-text code" readonly value="<?php echo esc_attr( $key ); ?>" onclick="this.select();" style="width: 28em;" /></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="wa_ia_new_key" />
			<?php wp_nonce_field( 'wa_ia_new_key' ); ?>
			<?php submit_button( 'Gerar chave nova', 'secondary', 'submit', false ); ?>
		</form>

		<h2>Este mês</h2>
		<table class="widefat striped" style="max-width: 32em;">
			<tbody>
			<?php foreach ( $sum as $agent => $n ) : ?>
				<tr><td><?php echo esc_html( $agent ); ?></td><td style="text-align:right;"><strong><?php echo esc_html( (string) $n ); ?></strong></td></tr>
			<?php endforeach; ?>
			</tbody>
		</table>

		<h2>Estado</h2>
		<ul style="list-style: disc; padding-left: 1.5em;">
			<li>Cache detetada: <?php echo esc_html( $cache ? implode( ', ', $cache ) : 'nenhuma reconhecida' ); ?></li>
			<li>Último teste do workspace:
				<?php
				if ( is_array( $test ) && isset( $test['at'] ) ) {
					echo esc_html( wp_date( 'd/m/Y H:i', (int) $test['at'] ) . ' — chegou ao WordPress' );
				} else {
					echo 'ainda nenhum';
				}
				?>
			</li>
		</ul>
	</div>
	<?php
}
