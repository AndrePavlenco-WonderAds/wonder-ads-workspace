<?php
/**
 * Verificação do próprio site: os pedidos das IAs chegam ao WordPress? Há
 * alguma regra a bloqueá-los? Corre na ativação/atualização, uma vez por dia
 * e quando alguém carrega em «Verificar agora».
 *
 * @package WonderAds_IA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Como cada assistente se apresenta a um site (formato público de cada um).
 *
 * @return array<string,string>
 */
function wa_ia_test_user_agents() {
	return array(
		'ChatGPT-User'    => 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
		'Claude-User'     => 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
		'Perplexity-User' => 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
		'MistralAI-User'  => 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)',
	);
}

/**
 * Lê o último pedido de teste direto da base de dados — a cache de options
 * deste processo não sabe que outro pedido o acabou de gravar.
 *
 * @return array|null
 */
function wa_ia_read_last_test() {
	global $wpdb;
	$raw = $wpdb->get_var( $wpdb->prepare( "SELECT option_value FROM {$wpdb->options} WHERE option_name = %s LIMIT 1", WA_IA_OPT_TEST ) );
	if ( null === $raw ) {
		return null;
	}
	$val = maybe_unserialize( $raw );
	return is_array( $val ) ? $val : null;
}

/**
 * O cabeçalho de cache de uma resposta (o primeiro que existir).
 *
 * @param array|WP_Error $res Resposta do wp_remote_get.
 * @return string|null
 */
function wa_ia_cache_header( $res ) {
	foreach ( array( 'x-cache', 'x-litespeed-cache', 'x-proxy-cache', 'x-cache-status', 'x-nginx-cache', 'x-hcdn-cache-status', 'cf-cache-status' ) as $h ) {
		$v = wp_remote_retrieve_header( $res, $h );
		if ( is_string( $v ) && '' !== $v ) {
			return $h . ': ' . substr( $v, 0, 40 );
		}
	}
	return null;
}

/**
 * Pede a página inicial ao próprio site como cada um dos 4 assistentes, duas
 * vezes (uma cache com a página expirada deixa passar o primeiro pedido e
 * serve os seguintes). Os pedidos levam o cabeçalho de teste: não contam.
 *
 * @return array
 */
function wa_ia_self_check() {
	$home   = home_url( '/' );
	$result = array(
		'at'     => time(),
		'url'    => $home,
		'agents' => array(),
		'error'  => null,
	);
	foreach ( wa_ia_test_user_agents() as $agent => $ua ) {
		$row = array(
			'reached'  => 0,
			'attempts' => 0,
			'status'   => array(),
			'cache'    => array(),
		);
		for ( $i = 0; $i < 2; $i++ ) {
			$nonce = 'self-' . wp_generate_password( 24, false, false );
			$res   = wp_remote_get(
				$home,
				array(
					'timeout'            => 8,
					'redirection'        => 3,
					'user-agent'         => $ua,
					'headers'            => array( 'X-WA-IA-Test' => $nonce ),
					'sslverify'          => false,
					'reject_unsafe_urls' => false,
				)
			);
			if ( is_wp_error( $res ) ) {
				$result['error'] = substr( $res->get_error_message(), 0, 200 );
				continue;
			}
			++$row['attempts'];
			$row['status'][] = (int) wp_remote_retrieve_response_code( $res );
			$row['cache'][]  = wa_ia_cache_header( $res );
			$last            = wa_ia_read_last_test();
			if ( is_array( $last ) && isset( $last['nonce'] ) && $last['nonce'] === $nonce ) {
				++$row['reached'];
			}
		}
		$result['agents'][ $agent ] = $row;
	}
	$result['blocks'] = wa_ia_scan_htaccess();
	update_option( WA_IA_OPT_CHECK, $result, false );
	return $result;
}

/**
 * Resumo da última verificação: «ok», «cache», «blocked», «error» ou null.
 *
 * @param array|null $check Resultado de wa_ia_self_check().
 * @return string|null
 */
function wa_ia_check_verdict( $check ) {
	if ( ! is_array( $check ) || empty( $check['agents'] ) ) {
		return is_array( $check ) && ! empty( $check['error'] ) ? 'error' : null;
	}
	$attempts = 0;
	$reached  = 0;
	$blocked  = false;
	foreach ( $check['agents'] as $row ) {
		$attempts += (int) $row['attempts'];
		$reached  += (int) $row['reached'];
		foreach ( (array) $row['status'] as $code ) {
			if ( in_array( (int) $code, array( 401, 403, 406, 429, 444, 503 ), true ) ) {
				$blocked = true;
			}
		}
	}
	if ( $blocked ) {
		return 'blocked';
	}
	if ( 0 === $attempts ) {
		return 'error';
	}
	return $reached === $attempts ? 'ok' : 'cache';
}

/**
 * O .htaccess do site (onde o WordPress o escreve).
 *
 * @return string|null
 */
function wa_ia_htaccess_path() {
	if ( ! function_exists( 'get_home_path' ) ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
	}
	$path = trailingslashit( get_home_path() ) . '.htaccess';
	return is_file( $path ) ? $path : null;
}

/**
 * Procura no .htaccess regras que mencionam robôs de IA — para dizer à
 * equipa ONDE está um bloqueio (linha e bloco do plugin que a escreveu).
 * Só lê; nunca altera regras de outros.
 *
 * @return array{file:bool,lines:array}
 */
function wa_ia_scan_htaccess() {
	$file = wa_ia_htaccess_path();
	if ( ! $file || ! is_readable( $file ) ) {
		return array(
			'file'  => false,
			'lines' => array(),
		);
	}
	$lines = @file( $file, FILE_IGNORE_NEW_LINES ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
	if ( ! is_array( $lines ) ) {
		return array(
			'file'  => false,
			'lines' => array(),
		);
	}
	$bots  = '/(ChatGPT|GPTBot|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|anthropic|Perplexity|MistralAI|Bytespider|CCBot|Amazonbot|Google-Extended|Applebot-Extended|cohere)/i';
	$block = null;
	$hits  = array();
	foreach ( $lines as $i => $line ) {
		if ( preg_match( '/^\s*#\s*BEGIN\s+(.+)$/i', $line, $m ) ) {
			$block = trim( $m[1] );
			continue;
		}
		if ( preg_match( '/^\s*#\s*END\s+/i', $line ) ) {
			$block = null;
			continue;
		}
		if ( preg_match( '/^\s*#/', $line ) || 'WonderAds IA' === $block ) {
			continue;
		}
		if ( ! preg_match( $bots, $line ) ) {
			continue;
		}
		// «!» antes do padrão = exclusão (ex.: a cache NÃO serve estes
		// robôs) — não é um bloqueio.
		$negated = (bool) preg_match( '/HTTP_USER_AGENT\}?\s+"?!/i', $line );
		$hits[]  = array(
			'line'  => $i + 1,
			'text'  => substr( trim( $line ), 0, 240 ),
			'block' => $block,
			'kind'  => $negated ? 'exclusion' : 'possible-block',
		);
		if ( count( $hits ) >= 25 ) {
			break;
		}
	}
	return array(
		'file'  => true,
		'lines' => $hits,
	);
}
