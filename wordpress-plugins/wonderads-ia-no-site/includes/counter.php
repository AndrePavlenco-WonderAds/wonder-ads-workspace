<?php
/**
 * Contagem: que robôs contamos, como reconhecemos o pedido e onde fica.
 *
 * Desde a 1.1.0 a contagem vive numa tabela própria com soma atómica
 * (INSERT … ON DUPLICATE KEY UPDATE): dois pedidos ao mesmo tempo já não se
 * apagam um ao outro, como acontecia com o ler-somar-gravar de uma option.
 * A option da 1.0.0 (`wa_ia_counts`) fica só para leitura — os números
 * antigos continuam a contar no endpoint.
 *
 * @package WonderAds_IA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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
 * Os que respondem a pessoas — os únicos que tiramos da cache de página.
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
 * @return string Nome completo da tabela.
 */
function wa_ia_table() {
	global $wpdb;
	return $wpdb->prefix . 'wa_ia_hits';
}

/**
 * A tabela existe e está na versão certa?
 *
 * @return bool
 */
function wa_ia_table_ready() {
	return WA_IA_DB_VERSION === get_option( WA_IA_OPT_DB );
}

/**
 * Cria (ou atualiza) a tabela. Só corre na instalação/atualização.
 *
 * @return bool A tabela ficou pronta.
 */
function wa_ia_install_table() {
	global $wpdb;
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	$table   = wa_ia_table();
	$charset = $wpdb->get_charset_collate();
	// path a 191: o máximo indexável em utf8mb4 nas versões antigas do MySQL.
	dbDelta(
		"CREATE TABLE {$table} (
  day date NOT NULL,
  agent varchar(32) NOT NULL,
  path varchar(191) NOT NULL,
  hits int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY  (day,agent,path),
  KEY agent_day (agent,day)
) {$charset};"
	);
	$exists = ( $table === $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) );
	if ( $exists ) {
		update_option( WA_IA_OPT_DB, WA_IA_DB_VERSION, true );
	}
	return $exists;
}

/**
 * Regista o pedido, se vier de um dos robôs. Corre no momento em que o
 * WordPress carrega este plugin — o mais cedo que um plugin consegue —, para
 * apanhar também os pedidos que um plugin de cache serve a meio do arranque.
 */
function wa_ia_record() {
	static $done = false;
	if ( $done ) {
		return;
	}
	$done = true;

	if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
		return;
	}
	if ( defined( 'WP_CLI' ) && WP_CLI ) {
		return;
	}
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		return;
	}
	$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( (string) $_SERVER['REQUEST_METHOD'] ) : 'GET';
	// Só GET: um HEAD seguido do GET seria o mesmo pedido contado duas vezes.
	if ( 'GET' !== $method ) {
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
	if ( in_array( $base, array( 'robots.txt', 'wp-login.php', 'xmlrpc.php', 'wp-cron.php', 'favicon.ico', 'admin-ajax.php' ), true ) ) {
		return;
	}
	if ( 0 === strpos( $path, '/wp-admin' ) ) {
		return;
	}

	// Pedido de teste (workspace ou verificação do próprio plugin): fica
	// registado à parte e nunca conta.
	$test = isset( $_SERVER['HTTP_X_WA_IA_TEST'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_WA_IA_TEST'] ) ) : '';
	if ( '' !== $test ) {
		update_option(
			WA_IA_OPT_TEST,
			array(
				'nonce' => substr( $test, 0, 64 ),
				'agent' => $agent,
				'path'  => substr( $path, 0, 191 ),
				'at'    => time(),
			),
			false
		);
		return;
	}

	wa_ia_increment( $agent, substr( $path, 0, 191 ) );
}

/**
 * Soma um pedido. Atómico na tabela; na option só se a tabela não existir.
 *
 * @param string $agent Nome do robô.
 * @param string $path  Caminho da página (≤ 191).
 */
function wa_ia_increment( $agent, $path ) {
	global $wpdb;
	$day = current_time( 'Y-m-d' );
	if ( wa_ia_table_ready() ) {
		$table      = wa_ia_table();
		$suppressed = $wpdb->suppress_errors( true );
		$ok         = $wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (day, agent, path, hits) VALUES (%s, %s, %s, 1) ON DUPLICATE KEY UPDATE hits = hits + 1", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$day,
				$agent,
				$path
			)
		);
		$wpdb->suppress_errors( $suppressed );
		if ( false !== $ok ) {
			return;
		}
	}
	wa_ia_increment_legacy( $agent, $path, $day );
}

/**
 * O método da 1.0.0 (option), só como recurso se a tabela falhar.
 *
 * @param string $agent Nome do robô.
 * @param string $path  Caminho da página.
 * @param string $day   AAAA-MM-DD.
 */
function wa_ia_increment_legacy( $agent, $path, $day ) {
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
	$month = substr( $day, 0, 7 );
	if ( ! isset( $data['days'][ $day ][ $agent ] ) ) {
		$data['days'][ $day ][ $agent ] = 0;
	}
	$data['days'][ $day ][ $agent ] = (int) $data['days'][ $day ][ $agent ] + 1;
	$page_key                       = $agent . ' ' . $path;
	if ( isset( $data['pages'][ $month ][ $page_key ] ) ) {
		$data['pages'][ $month ][ $page_key ] = (int) $data['pages'][ $month ][ $page_key ] + 1;
	} elseif ( ! isset( $data['pages'][ $month ] ) || count( $data['pages'][ $month ] ) < WA_IA_MAX_PATHS ) {
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
 * Totais por dia e por robô entre duas datas (tabela + option antiga).
 *
 * @param string $from AAAA-MM-DD.
 * @param string $to   AAAA-MM-DD.
 * @return array<string,array<string,int>>
 */
function wa_ia_days( $from, $to ) {
	global $wpdb;
	$out = array();
	if ( wa_ia_table_ready() ) {
		$table = wa_ia_table();
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT day, agent, SUM(hits) AS n FROM {$table} WHERE day BETWEEN %s AND %s GROUP BY day, agent", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$from,
				$to
			),
			ARRAY_A
		);
		foreach ( (array) $rows as $r ) {
			$out[ $r['day'] ][ $r['agent'] ] = (int) $r['n'];
		}
	}
	$legacy = get_option( WA_IA_OPT_COUNTS );
	if ( is_array( $legacy ) && isset( $legacy['days'] ) && is_array( $legacy['days'] ) ) {
		foreach ( $legacy['days'] as $day => $counts ) {
			$day = (string) $day;
			if ( $day < $from || $day > $to || ! is_array( $counts ) ) {
				continue;
			}
			foreach ( $counts as $agent => $n ) {
				$out[ $day ][ $agent ] = ( isset( $out[ $day ][ $agent ] ) ? $out[ $day ][ $agent ] : 0 ) + (int) $n;
			}
		}
	}
	ksort( $out );
	return $out;
}

/**
 * As páginas por mês e por robô entre dois meses (tabela + option antiga).
 * Por mês e por robô, só as 150 mais pedidas — o resto não cabe num relatório.
 *
 * @param string $from AAAA-MM-DD.
 * @param string $to   AAAA-MM-DD.
 * @return array<int,array{month:string,agent:string,path:string,count:int}>
 */
function wa_ia_pages( $from, $to ) {
	global $wpdb;
	$sum = array();
	if ( wa_ia_table_ready() ) {
		$table = wa_ia_table();
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT DATE_FORMAT(day, '%%Y-%%m') AS month, agent, path, SUM(hits) AS n FROM {$table} WHERE day BETWEEN %s AND %s GROUP BY month, agent, path", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$from,
				$to
			),
			ARRAY_A
		);
		foreach ( (array) $rows as $r ) {
			$sum[ $r['month'] ][ $r['agent'] ][ $r['path'] ] = (int) $r['n'];
		}
	}
	$legacy = get_option( WA_IA_OPT_COUNTS );
	if ( is_array( $legacy ) && isset( $legacy['pages'] ) && is_array( $legacy['pages'] ) ) {
		$from_month = substr( $from, 0, 7 );
		$to_month   = substr( $to, 0, 7 );
		foreach ( $legacy['pages'] as $month => $entries ) {
			$month = (string) $month;
			if ( $month < $from_month || $month > $to_month || ! is_array( $entries ) ) {
				continue;
			}
			foreach ( $entries as $page_key => $n ) {
				$parts = explode( ' ', (string) $page_key, 2 );
				$agent = $parts[0];
				$path  = isset( $parts[1] ) ? $parts[1] : '/';
				$sum[ $month ][ $agent ][ $path ] = ( isset( $sum[ $month ][ $agent ][ $path ] ) ? $sum[ $month ][ $agent ][ $path ] : 0 ) + (int) $n;
			}
		}
	}
	$out = array();
	foreach ( $sum as $month => $agents ) {
		foreach ( $agents as $agent => $paths ) {
			arsort( $paths );
			foreach ( array_slice( $paths, 0, 150, true ) as $path => $n ) {
				$out[] = array(
					'month' => (string) $month,
					'agent' => (string) $agent,
					'path'  => (string) $path,
					'count' => (int) $n,
				);
			}
		}
	}
	return $out;
}

/**
 * O primeiro dia em que o plugin contou — gravado na instalação; numa
 * atualização a partir da 1.0.0, o primeiro dia da option antiga.
 *
 * @return string AAAA-MM-DD
 */
function wa_ia_since() {
	$since = get_option( WA_IA_OPT_SINCE );
	if ( is_string( $since ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $since ) ) {
		return $since;
	}
	$since  = current_time( 'Y-m-d' );
	$legacy = get_option( WA_IA_OPT_COUNTS );
	if ( is_array( $legacy ) && ! empty( $legacy['days'] ) && is_array( $legacy['days'] ) ) {
		$days = array_keys( $legacy['days'] );
		sort( $days );
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $days[0] ) && $days[0] < $since ) {
			$since = (string) $days[0];
		}
	}
	update_option( WA_IA_OPT_SINCE, $since, false );
	return $since;
}

/**
 * Apaga da tabela o que já passou dos 400 dias (cron diário).
 */
function wa_ia_prune() {
	global $wpdb;
	if ( ! wa_ia_table_ready() ) {
		return;
	}
	$table  = wa_ia_table();
	$cutoff = gmdate( 'Y-m-d', time() - WA_IA_KEEP_DAYS * DAY_IN_SECONDS );
	$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE day < %s", $cutoff ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
}
