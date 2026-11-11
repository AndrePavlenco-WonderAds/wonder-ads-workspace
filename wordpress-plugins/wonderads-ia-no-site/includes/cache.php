<?php
/**
 * Cache de página: tirar os 4 assistentes da cache dos plugins de cache que
 * conhecemos, para os pedidos chegarem ao WordPress e serem contados.
 *
 * Regras de ouro (o código-fonte de cada plugin foi lido a 11/11/2026):
 *  - mexemos SÓ na lista de «user agents a excluir» de cada plugin, pelas
 *    funções do próprio plugin, e é ele que reescreve as suas regras;
 *  - nunca tocamos em regras de outros no .htaccess;
 *  - tudo o que acrescentamos sai ao desativar o plugin;
 *  - cada passo está protegido: se um plugin de cache mudar, falha em
 *    silêncio e a página de definições diz o que fazer à mão.
 * O teste real (os pedidos chegam ou não?) é o de includes/check.php.
 *
 * @package WonderAds_IA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WA_IA_WPSC_EARLY_FILE', __DIR__ . '/wpsc-early.php' );

/**
 * Junta os nossos nomes a uma lista (sem repetir).
 *
 * @param array $list Lista atual.
 * @param array $add  O que juntar.
 * @return array
 */
function wa_ia_list_add( $list, $add ) {
	return array_values( array_unique( array_merge( array_values( (array) $list ), $add ) ) );
}

/**
 * Tira os nossos nomes de uma lista.
 *
 * @param array $list   Lista atual.
 * @param array $remove O que tirar.
 * @return array
 */
function wa_ia_list_remove( $list, $remove ) {
	return array_values( array_diff( (array) $list, $remove ) );
}

/**
 * Uma lista que pode vir como array, JSON ou texto com uma por linha.
 *
 * @param mixed $raw Valor guardado.
 * @return string[]
 */
function wa_ia_decode_list( $raw ) {
	if ( is_array( $raw ) ) {
		return array_values( array_filter( array_map( 'strval', $raw ), 'strlen' ) );
	}
	if ( ! is_string( $raw ) || '' === trim( $raw ) ) {
		return array();
	}
	$json = json_decode( $raw, true );
	if ( is_array( $json ) ) {
		return array_values( array_filter( array_map( 'strval', $json ), 'strlen' ) );
	}
	return array_values( array_filter( array_map( 'trim', preg_split( '/[\r\n]+/', $raw ) ), 'strlen' ) );
}

/* ------------------------------------------------------------------------
 * Filtros sempre ligados (entram sempre que o plugin de cache se reescreve)
 * --------------------------------------------------------------------- */

/**
 * WP Rocket: a regra do .htaccess compara o INÍCIO do User-Agent
 * (`!^(…).*`), e os 4 começam por «Mozilla/5.0…» — por isso vão como
 * «(.*)ChatGPT-User(.*)», como o exemplo do próprio WP Rocket.
 *
 * @param array $ua Lista do WP Rocket.
 * @return array
 */
function wa_ia_rocket_reject_ua( $ua ) {
	$ours = array();
	foreach ( wa_ia_user_agents() as $agent ) {
		$ours[] = '(.*)' . $agent . '(.*)';
	}
	return wa_ia_list_add( is_array( $ua ) ? $ua : array(), $ours );
}
add_filter( 'rocket_cache_reject_ua', 'wa_ia_rocket_reject_ua' );

/**
 * WP Super Cache (modo mod_rewrite): uma condição a mais nas regras dele.
 *
 * @param array $rules Condições do WP Super Cache.
 * @return array
 */
function wa_ia_wpsc_conditions( $rules ) {
	$rules   = is_array( $rules ) ? $rules : array();
	$rules[] = 'RewriteCond %{HTTP_USER_AGENT} !(' . implode( '|', wa_ia_user_agents() ) . ') [NC]';
	return $rules;
}
add_filter( 'supercacherewriteconditions', 'wa_ia_wpsc_conditions' );

/**
 * WP-Optimize: sempre que alguém grava as definições da cache, os 4 nomes
 * continuam na lista de exceções.
 *
 * @param array $config Configuração da cache do WP-Optimize.
 * @return array
 */
function wa_ia_wpo_config( $config ) {
	if ( is_array( $config ) ) {
		$config['cache_exception_browser_agents'] = wa_ia_list_add( wa_ia_decode_list( isset( $config['cache_exception_browser_agents'] ) ? $config['cache_exception_browser_agents'] : array() ), wa_ia_user_agents() );
	}
	return $config;
}
add_filter( 'wpo_cache_update_config', 'wa_ia_wpo_config' );

/* ------------------------------------------------------------------------
 * Deteção
 * --------------------------------------------------------------------- */

/**
 * As caches que este site tem (nomes para pessoas).
 *
 * @return string[]
 */
function wa_ia_detect_cache() {
	$slugs = function_exists( 'wa_ia_active_plugin_slugs' ) ? wa_ia_active_plugin_slugs() : array();
	$has   = function ( $slug ) use ( $slugs ) {
		return in_array( $slug, $slugs, true );
	};
	$found = array();
	if ( defined( 'PWP_NAME' ) || defined( 'WPE_APIKEY' ) || function_exists( 'is_wpe' ) || class_exists( 'WpeCommon' ) ) {
		$found[] = 'WP Engine';
	}
	if ( defined( 'KINSTAMU_VERSION' ) || isset( $_SERVER['KINSTA_CACHE_ZONE'] ) ) {
		$found[] = 'Kinsta';
	}
	if ( $has( 'sg-cachepress' ) ) {
		$found[] = 'SiteGround Optimizer';
	}
	if ( defined( 'LSCWP_V' ) ) {
		$found[] = 'LiteSpeed Cache';
	}
	if ( defined( 'WP_ROCKET_VERSION' ) ) {
		$found[] = 'WP Rocket';
	}
	if ( isset( $GLOBALS['wp_fastest_cache'] ) || class_exists( 'WpFastestCache' ) ) {
		$found[] = 'WP Fastest Cache';
	}
	if ( function_exists( 'wp_cache_setting' ) || defined( 'WPCACHEHOME' ) ) {
		$found[] = 'WP Super Cache';
	}
	if ( wa_ia_wpo_page_cache_on() ) {
		$found[] = 'WP-Optimize';
	}
	if ( defined( 'W3TC' ) ) {
		$found[] = 'W3 Total Cache';
	}
	if ( defined( 'NITROPACK_VERSION' ) || $has( 'nitropack' ) ) {
		$found[] = 'NitroPack';
	}
	if ( class_exists( 'Cache_Enabler' ) || $has( 'cache-enabler' ) ) {
		$found[] = 'Cache Enabler';
	}
	if ( defined( 'BREEZE_VERSION' ) || $has( 'breeze' ) ) {
		$found[] = 'Breeze';
	}
	if ( defined( 'WPHB_VERSION' ) || $has( 'hummingbird-performance' ) || $has( 'wp-hummingbird' ) ) {
		$found[] = 'Hummingbird';
	}
	if ( $has( 'comet-cache' ) ) {
		$found[] = 'Comet Cache';
	}
	return $found;
}

/**
 * O WP-Optimize tem a cache de página ligada? (Há muitos sites que o usam
 * só para limpar a base de dados.)
 *
 * @return bool
 */
function wa_ia_wpo_page_cache_on() {
	if ( ! class_exists( 'WPO_Cache_Config' ) || ! method_exists( 'WPO_Cache_Config', 'instance' ) ) {
		return false;
	}
	try {
		$cfg = WPO_Cache_Config::instance()->get();
		return is_array( $cfg ) && ! empty( $cfg['enable_page_caching'] );
	} catch ( Throwable $e ) {
		return false;
	}
}

/* ------------------------------------------------------------------------
 * Adaptadores — cada um devolve true (feito), false (falhou) ou null (não
 * se aplica a este site). $add = false desfaz.
 * --------------------------------------------------------------------- */

/**
 * LiteSpeed Cache: «Do Not Cache User Agents». O próprio LSCWP escreve no
 * .htaccess `RewriteRule .* - [E=Cache-Control:no-cache]` para estes nomes,
 * o que faz o servidor LiteSpeed não servir a cache.
 *
 * @param bool $add Acrescentar (true) ou tirar (false).
 * @return bool|null
 */
function wa_ia_cache_litespeed( $add ) {
	if ( ! defined( 'LSCWP_V' ) ) {
		return null;
	}
	$opt  = 'litespeed.conf.cache-exc_useragents';
	$list = wa_ia_decode_list( get_option( $opt ) );
	$want = $add ? wa_ia_list_add( $list, wa_ia_user_agents() ) : wa_ia_list_remove( $list, wa_ia_user_agents() );
	if ( $want === $list ) {
		return true;
	}
	if ( ! has_action( 'litespeed_save_conf' ) ) {
		return false;
	}
	do_action( 'litespeed_save_conf', array( 'cache-exc_useragents' => $want ) );
	$after = wa_ia_decode_list( get_option( $opt ) );
	return $add ? ! array_diff( wa_ia_user_agents(), $after ) : ! array_intersect( wa_ia_user_agents(), $after );
}

/**
 * WP Rocket: o filtro acima já junta os nomes; aqui só pedimos ao WP Rocket
 * que reescreva o .htaccess e o ficheiro de configuração dele.
 *
 * @param bool $add Acrescentar (true) ou tirar (false).
 * @return bool|null
 */
function wa_ia_cache_rocket( $add ) {
	if ( ! defined( 'WP_ROCKET_VERSION' ) ) {
		return null;
	}
	if ( ! $add ) {
		remove_filter( 'rocket_cache_reject_ua', 'wa_ia_rocket_reject_ua' );
	}
	if ( ! function_exists( 'flush_rocket_htaccess' ) || ! function_exists( 'rocket_generate_config_file' ) ) {
		return false;
	}
	flush_rocket_htaccess();
	rocket_generate_config_file();
	if ( ! function_exists( 'get_rocket_cache_reject_ua' ) ) {
		return true;
	}
	$has = false !== strpos( (string) get_rocket_cache_reject_ua(), 'ChatGPT-User' );
	return $add ? $has : ! $has;
}

/**
 * WP Fastest Cache: regras de exclusão «useragent / contém». O WPFC aplica-as
 * ao servir via PHP e escreve-as no bloco «WPFC Exclude» do .htaccess.
 *
 * @param bool $add Acrescentar (true) ou tirar (false).
 * @return bool|null
 */
function wa_ia_cache_wpfc( $add ) {
	$wpfc = isset( $GLOBALS['wp_fastest_cache'] ) ? $GLOBALS['wp_fastest_cache'] : null;
	if ( ! is_object( $wpfc ) ) {
		return null;
	}
	$json  = get_option( 'WpFastestCacheExclude' );
	$rules = ( is_string( $json ) && '' !== $json && 'null' !== $json ) ? json_decode( $json ) : array();
	if ( ! is_array( $rules ) ) {
		return false; // JSON que não percebemos: não mexer.
	}
	$ours    = wa_ia_user_agents();
	$present = array();
	$kept    = array();
	foreach ( $rules as $r ) {
		$is_ours = is_object( $r ) && isset( $r->type, $r->content ) && 'useragent' === $r->type && in_array( (string) $r->content, $ours, true );
		if ( $is_ours ) {
			$present[] = (string) $r->content;
			if ( ! $add ) {
				continue;
			}
		}
		$kept[] = $r;
	}
	$changed = false;
	if ( $add ) {
		foreach ( array_diff( $ours, $present ) as $agent ) {
			$kept[]  = (object) array(
				'prefix'  => 'contain',
				'content' => $agent,
				'type'    => 'useragent',
			);
			$changed = true;
		}
	} else {
		$changed = (bool) $present;
	}
	if ( $changed ) {
		update_option( 'WpFastestCacheExclude', wp_json_encode( array_values( $kept ) ) );
	}

	// .htaccess: só se o bloco do WPFC lá estiver e o ficheiro for nosso de
	// ler e escrever (o método do WPFC escreve o ficheiro inteiro).
	$file = ABSPATH . '.htaccess';
	$sub  = method_exists( $wpfc, 'is_subdirectory_install' ) ? (bool) $wpfc->is_subdirectory_install() : false;
	if ( ! $sub && is_file( $file ) && is_readable( $file ) && is_writable( $file ) && method_exists( $wpfc, 'modify_htaccess_for_exclude' ) ) {
		$ht = (string) file_get_contents( $file );
		if ( preg_match( '/#\s?Start\sWPFC\sExclude/', $ht ) ) {
			$in_ht = false !== strpos( $ht, 'ChatGPT\-User' );
			if ( $add !== $in_ht ) {
				$wpfc->modify_htaccess_for_exclude();
			}
		}
	}

	$after = json_decode( (string) get_option( 'WpFastestCacheExclude' ) );
	$now   = array();
	foreach ( is_array( $after ) ? $after : array() as $r ) {
		if ( is_object( $r ) && isset( $r->type, $r->content ) && 'useragent' === $r->type ) {
			$now[] = (string) $r->content;
		}
	}
	return $add ? ! array_diff( $ours, $now ) : ! array_intersect( $ours, $now );
}

/**
 * WP Super Cache: a lista «Rejected User Agents» dele NÃO impede servir a
 * cache (só impede criar). Por isso: (1) um ficheirinho que o WP Super Cache
 * carrega antes do WordPress e que, para estes 4, desliga o servir da cache;
 * (2) no modo mod_rewrite, a condição do filtro acima nas regras dele.
 *
 * @param bool $add Acrescentar (true) ou tirar (false).
 * @return bool|null
 */
function wa_ia_cache_wpsc( $add ) {
	if ( ! function_exists( 'wp_cache_setting' ) ) {
		return null;
	}
	global $wpsc_plugins, $wp_cache_mod_rewrite;
	if ( 0 !== strpos( WA_IA_WPSC_EARLY_FILE, ABSPATH ) ) {
		return false; // fora do ABSPATH o WP Super Cache não o encontra.
	}
	$rel = substr( WA_IA_WPSC_EARLY_FILE, strlen( ABSPATH ) );
	$in  = is_array( $wpsc_plugins ) && in_array( $rel, $wpsc_plugins, true );
	if ( $add && ! $in && function_exists( 'wpsc_add_plugin' ) ) {
		wpsc_add_plugin( WA_IA_WPSC_EARLY_FILE );
	} elseif ( ! $add && $in && function_exists( 'wpsc_delete_plugin' ) ) {
		wpsc_delete_plugin( WA_IA_WPSC_EARLY_FILE );
	}
	if ( ! $add ) {
		remove_filter( 'supercacherewriteconditions', 'wa_ia_wpsc_conditions' );
	}
	if ( ! empty( $wp_cache_mod_rewrite ) && function_exists( 'update_mod_rewrite_rules' ) ) {
		$file = ABSPATH . '.htaccess';
		$ht   = is_readable( $file ) ? (string) file_get_contents( $file ) : '';
		if ( '' !== $ht && $add !== ( false !== strpos( $ht, implode( '|', wa_ia_user_agents() ) ) ) ) {
			update_mod_rewrite_rules();
		}
	}
	$in = is_array( $wpsc_plugins ) && in_array( $rel, $wpsc_plugins, true );
	return $add ? $in : ! $in;
}

/**
 * WP-Optimize: lista de exceções de «browser agents» (bloqueia servir e
 * criar cache para estes nomes) + limpar a cache.
 *
 * @param bool $add Acrescentar (true) ou tirar (false).
 * @return bool|null
 */
function wa_ia_cache_wpo( $add ) {
	if ( ! wa_ia_wpo_page_cache_on() ) {
		return null;
	}
	$inst = WPO_Cache_Config::instance();
	$cfg  = $inst->get();
	$list = wa_ia_decode_list( isset( $cfg['cache_exception_browser_agents'] ) ? $cfg['cache_exception_browser_agents'] : array() );
	$want = $add ? wa_ia_list_add( $list, wa_ia_user_agents() ) : wa_ia_list_remove( $list, wa_ia_user_agents() );
	if ( $want !== $list ) {
		if ( ! $add ) {
			remove_filter( 'wpo_cache_update_config', 'wa_ia_wpo_config' );
		}
		$cfg['cache_exception_browser_agents'] = $want;
		$inst->update( $cfg, true );
		if ( class_exists( 'WPO_Page_Cache' ) && method_exists( 'WPO_Page_Cache', 'instance' ) ) {
			$cache = WPO_Page_Cache::instance();
			if ( method_exists( $cache, 'purge' ) ) {
				$cache->purge();
			}
		}
	}
	$after = $inst->get();
	$now   = wa_ia_decode_list( isset( $after['cache_exception_browser_agents'] ) ? $after['cache_exception_browser_agents'] : array() );
	return $add ? ! array_diff( wa_ia_user_agents(), $now ) : ! array_intersect( wa_ia_user_agents(), $now );
}

/**
 * Os adaptadores, pelo nome com que aparecem em wa_ia_detect_cache().
 *
 * @return array<string,callable>
 */
function wa_ia_cache_adapters() {
	return array(
		'LiteSpeed Cache'  => 'wa_ia_cache_litespeed',
		'WP Rocket'        => 'wa_ia_cache_rocket',
		'WP Fastest Cache' => 'wa_ia_cache_wpfc',
		'WP Super Cache'   => 'wa_ia_cache_wpsc',
		'WP-Optimize'      => 'wa_ia_cache_wpo',
	);
}

/**
 * Corre os adaptadores e guarda o resultado de cada um.
 *
 * @param bool $add Acrescentar (true) ou tirar (false).
 * @return array
 */
function wa_ia_cache_run( $add ) {
	$results = array();
	foreach ( wa_ia_cache_adapters() as $name => $fn ) {
		try {
			$r = call_user_func( $fn, $add );
		} catch ( Throwable $e ) {
			$results[ $name ] = array(
				'applied' => false,
				'at'      => time(),
				'error'   => substr( $e->getMessage(), 0, 200 ),
			);
			continue;
		}
		if ( null === $r ) {
			continue;
		}
		$results[ $name ] = array(
			'applied' => (bool) $r,
			'at'      => time(),
			'error'   => null,
		);
	}
	update_option( WA_IA_OPT_CACHE, $add ? $results : array(), false );
	return $results;
}

function wa_ia_cache_apply() {
	return wa_ia_cache_run( true );
}

function wa_ia_cache_revert() {
	return wa_ia_cache_run( false );
}

/**
 * O que dizer de cada cache: «auto» (o plugin trata), «host» (só o
 * alojamento) ou «manual» (alguém tem de mudar uma definição).
 *
 * @return array<int,array{name:string,handled:string,applied:bool,note:string|null}>
 */
function wa_ia_cache_status() {
	$done  = get_option( WA_IA_OPT_CACHE );
	$done  = is_array( $done ) ? $done : array();
	$names = implode( ', ', wa_ia_user_agents() );
	$host  = array(
		'WP Engine'            => 'A cache do WP Engine fica antes do WordPress: pede ao suporte do WP Engine para não servir da cache os pedidos com estes User-Agents: ' . $names . '.',
		'Kinsta'               => 'A cache da Kinsta fica antes do WordPress: pede ao suporte da Kinsta para não servir da cache os pedidos com estes User-Agents: ' . $names . '.',
		'SiteGround Optimizer' => 'A cache dinâmica da SiteGround fica no servidor: pede ao suporte da SiteGround para não servir da cache os pedidos com estes User-Agents: ' . $names . '.',
	);
	$manual = array(
		'W3 Total Cache' => 'Performance → Page Cache → «Rejected user agents»: acrescenta ' . $names . ' (um por linha) e grava.',
		'NitroPack'      => 'A NitroPack serve as páginas da cache dela: no painel da NitroPack, exclui estes User-Agents (' . $names . ') ou pede ao suporte.',
		'Cache Enabler'  => 'O Cache Enabler não tem exclusão por User-Agent: considera trocar por uma cache que tenha (ex.: LiteSpeed Cache ou WP Fastest Cache).',
		'Breeze'         => 'Breeze → Advanced Options: exclui estes User-Agents (' . $names . ') se a versão o permitir; se não, fala com a Cloudways.',
		'Hummingbird'    => 'Hummingbird → Caching → Page Caching → Exclusions → User agents: acrescenta ' . $names . '.',
		'Comet Cache'    => 'Comet Cache → User-Agent Exclusion Patterns: acrescenta ' . $names . '.',
	);
	$out = array();
	foreach ( wa_ia_detect_cache() as $name ) {
		if ( isset( $host[ $name ] ) ) {
			$out[] = array(
				'name'    => $name,
				'handled' => 'host',
				'applied' => false,
				'note'    => $host[ $name ],
			);
		} elseif ( isset( $manual[ $name ] ) ) {
			$out[] = array(
				'name'    => $name,
				'handled' => 'manual',
				'applied' => false,
				'note'    => $manual[ $name ],
			);
		} else {
			$r     = isset( $done[ $name ] ) ? $done[ $name ] : null;
			$out[] = array(
				'name'    => $name,
				'handled' => 'auto',
				'applied' => $r ? (bool) $r['applied'] : false,
				'note'    => ! $r ? 'ainda não ajustada — acontece na próxima verificação (ou carrega em «Verificar agora»).' : ( $r['applied'] ? null : 'não foi possível ajustar automaticamente' . ( $r['error'] ? ' (' . $r['error'] . ')' : '' ) . '. Na definição de «user agents» a excluir desta cache, acrescenta: ' . $names . '.' ),
			);
		}
	}
	return $out;
}
