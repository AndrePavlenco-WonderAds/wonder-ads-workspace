<?php
// Cenários do plugin. Cada cenário corre num processo PHP próprio:
//   php run.php <cenario> <pasta-do-plugin>
$scenario = $argv[1];
define( 'PLUGIN_DIR', $argv[2] );
require __DIR__ . '/wp-stub.php';

function req( $ua, $uri = '/', $method = 'GET', $extra = array() ) {
	$_SERVER = array_merge( array( 'REQUEST_METHOD' => $method, 'REQUEST_URI' => $uri, 'HTTP_USER_AGENT' => $ua, 'SERVER_SOFTWARE' => 'Apache' ), $extra );
}
$CGPT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot';
$day  = gmdate( 'Y-m-d' );

switch ( $scenario ) {
	case 'fresh-install-and-count':
		// Instalação nova: ativação cria a tabela; um pedido do ChatGPT conta.
		req( 'Mozilla/5.0 Chrome', '/' );
		load_plugin();
		call_user_func( $GLOBALS['__activate'] );
		ok( wa_ia_table_ready(), 'tabela criada e marcada como pronta' );
		ok( '1.1.0' === get_option( 'wa_ia_version' ), 'versão gravada' );
		ok( strlen( get_option( 'wa_ia_key' ) ) === 40, 'chave de 40 caracteres' );
		ok( $day === get_option( 'wa_ia_since' ), 'since = hoje' );
		ok( isset( $GLOBALS['__cron']['wa_ia_daily'] ) && isset( $GLOBALS['__cron']['wa_ia_check_soon'] ), 'cron diário + verificação daqui a 1 min' );
		ok( empty( $GLOBALS['wpdb']->rows ), 'pedido de pessoa (Chrome) não contou' );
		// agora um pedido do ChatGPT, três vezes, e um do Claude noutra página
		foreach ( array( 1, 2, 3 ) as $i ) { req( $CGPT, '/servicos/?utm=x' ); wa_ia_increment_for_test(); }
		req( 'Claude-User/1.0', '/blog/post/' ); wa_ia_increment_for_test();
		ok( 3 === $GLOBALS['wpdb']->rows[ "$day|ChatGPT-User|/servicos/" ], 'ChatGPT 3× na mesma página (sem query string)' );
		ok( 1 === $GLOBALS['wpdb']->rows[ "$day|Claude-User|/blog/post/" ], 'Claude 1×' );
		break;

	case 'skips':
		load_plugin();
		call_user_func( $GLOBALS['__activate'] );
		$cases = array(
			array( $CGPT, '/wp-json/wp/v2/posts', 'GET', array(), 'wp-json' ),
			array( $CGPT, '/?rest_route=/x', 'GET', array(), 'rest_route' ),
			array( $CGPT, '/robots.txt', 'GET', array(), 'robots.txt' ),
			array( $CGPT, '/', 'HEAD', array(), 'HEAD' ),
			array( $CGPT, '/', 'POST', array(), 'POST' ),
			array( $CGPT, '/wp-admin/admin-ajax.php', 'GET', array(), 'admin-ajax' ),
			array( $CGPT, '/wp-login.php', 'GET', array(), 'login' ),
		);
		foreach ( $cases as $c ) {
			req( $c[0], $c[1], $c[2], $c[3] ); wa_ia_increment_for_test();
			ok( empty( $GLOBALS['wpdb']->rows ), 'não contou: ' . $c[4] );
		}
		// pedido de teste: vai para lastTest, não conta
		req( $CGPT, '/', 'GET', array( 'HTTP_X_WA_IA_TEST' => 'abc-123' ) ); wa_ia_increment_for_test();
		$t = get_option( 'wa_ia_last_test' );
		ok( empty( $GLOBALS['wpdb']->rows ) && 'abc-123' === $t['nonce'] && 'ChatGPT-User' === $t['agent'], 'pedido de teste registado à parte e não contado' );
		break;

	case 'early-record-at-load':
		// O plugin conta no momento em que é carregado (antes do plugins_loaded).
		req( $CGPT, '/contactos/' );
		$GLOBALS['__opts']['wa_ia_db'] = '1';
		$GLOBALS['wpdb']->tables['wp_wa_ia_hits'] = true;
		load_plugin();
		ok( 1 === $GLOBALS['wpdb']->rows[ "$day|ChatGPT-User|/contactos/" ], 'contado ao carregar o ficheiro do plugin' );
		break;

	case 'fallback-legacy-option':
		// Sem tabela (ex.: sem permissão para CREATE): conta na option como na 1.0.0.
		req( $CGPT, '/a/' );
		load_plugin();
		ok( ! wa_ia_table_ready(), 'tabela não está pronta' );
		$c = get_option( 'wa_ia_counts' );
		ok( 1 === $c['days'][ $day ]['ChatGPT-User'], 'contou na option antiga' );
		$GLOBALS['__opts']['wa_ia_db'] = '1'; $GLOBALS['wpdb']->tables['wp_wa_ia_hits'] = true; $GLOBALS['wpdb']->fail_inserts = true;
		req( $CGPT, '/a/' ); wa_ia_increment_for_test();
		$c = get_option( 'wa_ia_counts' );
		ok( 2 === $c['days'][ $day ]['ChatGPT-User'], 'INSERT a falhar → recurso na option' );
		break;

	case 'upgrade-from-100':
		// Site com a 1.0.0 (option com contagens, sem versão gravada) → 1.1.0.
		$GLOBALS['__opts']['wa_ia_key']    = str_repeat( 'k', 40 );
		$GLOBALS['__opts']['wa_ia_counts'] = array(
			'days'  => array( '2026-11-10' => array( 'ClaudeBot' => 35, 'PerplexityBot' => 2, 'ChatGPT-User' => 4 ) ),
			'pages' => array( '2026-11' => array( 'ClaudeBot /' => 6, 'ChatGPT-User /servicos/' => 4 ) ),
		);
		req( 'Mozilla/5.0 Chrome', '/' );
		load_plugin();
		do_action( 'plugins_loaded' ); // a atualização corre aqui (não há hook de ativação)
		ok( wa_ia_table_ready() && '1.1.0' === get_option( 'wa_ia_version' ), 'atualizou: tabela + versão' );
		ok( str_repeat( 'k', 40 ) === get_option( 'wa_ia_key' ), 'a chave antiga manteve-se (o workspace continua ligado)' );
		ok( '2026-11-10' === get_option( 'wa_ia_since' ), 'since = primeiro dia da 1.0.0' );
		// conta mais 1 ChatGPT na tabela hoje e lê tudo pelo endpoint
		req( $CGPT, '/servicos/' ); wa_ia_increment_for_test();
		$r = wa_ia_rest( new WP_REST_Request( array( 'x-wa-key' => str_repeat( 'k', 40 ) ), array( 'from' => '2026-11-01', 'to' => '2026-11-30' ) ) );
		$d = (array) $r->data['days'];
		ok( 4 === $d['2026-11-10']['ChatGPT-User'] && 35 === $d['2026-11-10']['ClaudeBot'], 'endpoint junta os números da 1.0.0' );
		if ( $day >= '2026-11-01' && $day <= '2026-11-30' ) {
			ok( 1 === $d[ $day ]['ChatGPT-User'] + ( '2026-11-10' === $day ? 4 : 0 ) - ( '2026-11-10' === $day ? 4 : 0 ), 'e os da tabela' );
		}
		$pg = array();
		foreach ( $r->data['pages'] as $p ) { $pg[ $p['month'] . ' ' . $p['agent'] . ' ' . $p['path'] ] = $p['count']; }
		ok( 4 + ( substr( $day, 0, 7 ) === '2026-11' ? 1 : 0 ) === $pg['2026-11 ChatGPT-User /servicos/'], 'páginas somam option + tabela' );
		ok( '2026-11-10' === $r->data['since'] && 'table' === $r->data['storage'], 'since e storage no endpoint' );
		ok( 'no-store, max-age=0' === $r->headers['Cache-Control'], 'resposta sem cache' );
		break;

	case 'rest-permission':
		$GLOBALS['__opts']['wa_ia_key'] = str_repeat( 'a', 40 );
		load_plugin();
		ok( true === wa_ia_rest_permission( new WP_REST_Request( array( 'X-WA-Key' => str_repeat( 'a', 40 ) ) ) ), 'chave certa entra' );
		ok( false === wa_ia_rest_permission( new WP_REST_Request( array( 'X-WA-Key' => str_repeat( 'b', 40 ) ) ) ), 'chave errada não entra' );
		ok( false === wa_ia_rest_permission( new WP_REST_Request( array() ) ), 'sem chave não entra' );
		$GLOBALS['__opts']['wa_ia_key'] = '';
		ok( false === wa_ia_rest_permission( new WP_REST_Request( array( 'X-WA-Key' => '' ) ) ), 'chave vazia nunca entra' );
		break;

	case 'self-check':
		// O site responde a si próprio: ChatGPT chega 2/2, Claude 0/2 (cache), Perplexity 403.
		$GLOBALS['__opts']['wa_ia_key'] = str_repeat( 'a', 40 );
		load_plugin();
		$GLOBALS['__http_handler'] = function ( $url, $args ) {
			$ua = $args['user-agent']; $nonce = $args['headers']['X-WA-IA-Test'];
			if ( false !== strpos( $ua, 'Perplexity-User' ) ) { return array( 'response' => array( 'code' => 403 ), 'body' => '', 'headers' => array() ); }
			if ( false !== strpos( $ua, 'ChatGPT-User' ) || false !== strpos( $ua, 'MistralAI-User' ) ) {
				$GLOBALS['__opts']['wa_ia_last_test'] = array( 'nonce' => $nonce, 'agent' => 'x', 'path' => '/', 'at' => time() );
				return array( 'response' => array( 'code' => 200 ), 'body' => '', 'headers' => array( 'x-cache' => 'MISS' ) );
			}
			return array( 'response' => array( 'code' => 200 ), 'body' => '', 'headers' => array( 'x-cache' => 'HIT' ) );
		};
		$c = wa_ia_self_check();
		ok( 2 === $c['agents']['ChatGPT-User']['reached'] && 2 === $c['agents']['ChatGPT-User']['attempts'], 'ChatGPT 2/2' );
		ok( 0 === $c['agents']['Claude-User']['reached'] && 'x-cache: HIT' === $c['agents']['Claude-User']['cache'][0], 'Claude 0/2 com x-cache HIT' );
		ok( array( 403, 403 ) === $c['agents']['Perplexity-User']['status'], 'Perplexity 403' );
		ok( 'blocked' === wa_ia_check_verdict( $c ), 'veredicto: bloqueado (tem prioridade)' );
		unset( $c['agents']['Perplexity-User'] );
		ok( 'cache' === wa_ia_check_verdict( $c ), 'sem o 403: veredicto cache' );
		unset( $c['agents']['Claude-User'] );
		ok( 'ok' === wa_ia_check_verdict( $c ), 'só os que chegam: ok' );
		$GLOBALS['__http_handler'] = null;
		$c = wa_ia_self_check();
		ok( 'error' === wa_ia_check_verdict( $c ) && 'sem rede nos testes' === $c['error'], 'sem loopback: erro com a razão' );
		break;

	case 'htaccess-scan':
		file_put_contents( ABSPATH . '.htaccess', implode( "\n", array(
			'# BEGIN WP Rocket',
			'RewriteCond %{HTTP_USER_AGENT} !^(facebookexternalhit|ChatGPT-User).* [NC]',
			'# END WP Rocket',
			'# BEGIN Bloqueio',
			'RewriteCond %{HTTP_USER_AGENT} (GPTBot|ClaudeBot|AhrefsBot) [NC]',
			'RewriteRule .* - [F,L]',
			'SetEnvIfNoCase User-Agent "ChatGPT-User" bad_bot',
			'# END Bloqueio',
			'# uma linha comentada com GPTBot',
			'# BEGIN WonderAds IA',
			'RewriteCond %{HTTP_USER_AGENT} (ChatGPT-User|Claude-User) [NC]',
			'# END WonderAds IA',
		) ) );
		load_plugin();
		$s = wa_ia_scan_htaccess();
		$kinds = array();
		foreach ( $s['lines'] as $l ) { $kinds[ $l['line'] ] = $l['kind'] . '@' . $l['block']; }
		ok( 'exclusion@WP Rocket' === $kinds[2], 'linha 2: exclusão de cache (WP Rocket), não bloqueio' );
		ok( 'possible-block@Bloqueio' === $kinds[5], 'linha 5: bloqueio provável' );
		ok( 'possible-block@Bloqueio' === $kinds[7], 'linha 7: SetEnvIf bad_bot' );
		ok( ! isset( $kinds[9] ) && ! isset( $kinds[11] ), 'ignora comentários e o nosso próprio bloco' );
		@unlink( ABSPATH . '.htaccess' );
		break;

	case 'updater':
		load_plugin();
		$GLOBALS['__http_handler'] = function ( $url, $args ) {
			return array( 'response' => array( 'code' => 200 ), 'headers' => array(), 'body' => json_encode( array(
				'version' => '1.2.0', 'download_url' => 'https://workspace.wonder-ads.com/wp-plugin/wonderads-ia-no-site-1.2.0.zip',
				'requires' => '5.3', 'requires_php' => '7.2', 'tested' => '7.1', 'sections' => array( 'changelog' => '<p>x</p>' ),
			) ) );
		};
		$t = apply_filters( 'pre_set_site_transient_update_plugins', (object) array( 'response' => array(), 'no_update' => array() ) );
		$b = 'wonderads-ia-no-site/wonderads-ia-no-site.php';
		ok( isset( $t->response[ $b ] ) && '1.2.0' === $t->response[ $b ]->new_version, 'há atualização para 1.2.0' );
		ok( 0 === strpos( $t->response[ $b ]->package, 'https://workspace.wonder-ads.com/' ), 'pacote vem do workspace' );
		$info = apply_filters( 'plugins_api', false, 'plugin_information', (object) array( 'slug' => 'wonderads-ia-no-site' ) );
		ok( is_object( $info ) && '1.2.0' === $info->version, 'ficha do plugin (Ver detalhes)' );
		ok( false === apply_filters( 'plugins_api', false, 'plugin_information', (object) array( 'slug' => 'outro' ) ), 'não mexe na ficha de outros plugins' );
		ok( true === apply_filters( 'auto_update_plugin', false, (object) array( 'plugin' => $b ) ), 'atualização automática ligada para este plugin' );
		ok( false === apply_filters( 'auto_update_plugin', false, (object) array( 'plugin' => 'outro/outro.php' ) ), 'não liga a de outros plugins' );
		// pacote de outro sítio → recusado
		delete_site_transient( 'wa_ia_update_info' );
		$GLOBALS['__http_handler'] = function () {
			return array( 'response' => array( 'code' => 200 ), 'headers' => array(), 'body' => json_encode( array( 'version' => '9.9.9', 'download_url' => 'https://mau.example/x.zip' ) ) );
		};
		$t = apply_filters( 'pre_set_site_transient_update_plugins', (object) array( 'response' => array(), 'no_update' => array() ) );
		ok( ! isset( $t->response[ $b ] ) && isset( $t->no_update[ $b ] ), 'pacote fora do workspace é ignorado' );
		break;

	case 'prune-and-uninstall':
		load_plugin();
		call_user_func( $GLOBALS['__activate'] );
		$GLOBALS['wpdb']->rows = array( '2020-01-01|ChatGPT-User|/' => 3, gmdate( 'Y-m-d' ) . '|ChatGPT-User|/' => 1 );
		wa_ia_prune();
		ok( 1 === count( $GLOBALS['wpdb']->rows ), 'apaga o que tem mais de 400 dias' );
		call_user_func( $GLOBALS['__uninstall'] );
		ok( false === get_option( 'wa_ia_key' ) && empty( $GLOBALS['wpdb']->tables ), 'desinstalar apaga options e tabela' );
		break;

	case 'cache-wpfc':
		class WpFastestCache { public $calls = 0; function is_subdirectory_install() { return false; } function modify_htaccess_for_exclude() { $this->calls++; $ht = file_get_contents( ABSPATH . '.htaccess' ); $rules = json_decode( get_option( 'WpFastestCacheExclude' ) ); $ua = ''; foreach ( $rules as $r ) { if ( 'useragent' === $r->type ) { $ua .= 'RewriteCond %{HTTP_USER_AGENT} !' . preg_quote( $r->content, '/' ) . " [NC]\n"; } } file_put_contents( ABSPATH . '.htaccess', preg_replace( "/# Start WPFC Exclude[^#]*# End WPFC Exclude\n/", "# Start WPFC Exclude\n" . $ua . "# End WPFC Exclude\n", $ht ) ); } }
		$GLOBALS['wp_fastest_cache'] = new WpFastestCache();
		$GLOBALS['__opts']['WpFastestCacheExclude'] = json_encode( array( array( 'prefix' => 'exact', 'content' => 'carrinho', 'type' => 'page' ) ) );
		file_put_contents( ABSPATH . '.htaccess', "# BEGIN WpFastestCache\n# Start WPFC Exclude\n# End WPFC Exclude\nRewriteRule x y\n# END WpFastestCache\n" );
		function wp_json_encode( $d ) { return json_encode( $d ); }
		load_plugin();
		ok( true === wa_ia_cache_wpfc( true ), 'WPFC: aplicado' );
		$r = json_decode( get_option( 'WpFastestCacheExclude' ) );
		ok( 5 === count( $r ) && 'carrinho' === $r[0]->content, 'WPFC: 4 regras de user agent + a do cliente intacta' );
		ok( false !== strpos( file_get_contents( ABSPATH . '.htaccess' ), 'ChatGPT\-User' ), 'WPFC: .htaccess reescrito pelo próprio WPFC' );
		ok( true === wa_ia_cache_wpfc( true ) && 1 === $GLOBALS['wp_fastest_cache']->calls, 'WPFC: segunda vez não mexe em nada' );
		ok( true === wa_ia_cache_wpfc( false ), 'WPFC: desfeito' );
		$r = json_decode( get_option( 'WpFastestCacheExclude' ) );
		ok( 1 === count( $r ) && false === strpos( file_get_contents( ABSPATH . '.htaccess' ), 'ChatGPT' ), 'WPFC: fica como estava' );
		$GLOBALS['__opts']['WpFastestCacheExclude'] = '{isto não é json';
		ok( false === wa_ia_cache_wpfc( true ) && '{isto não é json' === get_option( 'WpFastestCacheExclude' ), 'WPFC: JSON estranho → não mexe' );
		@unlink( ABSPATH . '.htaccess' );
		break;

	case 'cache-litespeed':
		define( 'LSCWP_V', '7.9.3' );
		$GLOBALS['__opts']['litespeed.conf.cache-exc_useragents'] = '["Googlebot-Image"]';
		add_action( 'litespeed_save_conf', function ( $m ) { $GLOBALS['__opts']['litespeed.conf.cache-exc_useragents'] = json_encode( $m['cache-exc_useragents'] ); $GLOBALS['__ls_saves'] = ( isset( $GLOBALS['__ls_saves'] ) ? $GLOBALS['__ls_saves'] : 0 ) + 1; } );
		load_plugin();
		ok( true === wa_ia_cache_litespeed( true ), 'LiteSpeed: aplicado' );
		ok( array( 'Googlebot-Image', 'ChatGPT-User', 'Claude-User', 'Perplexity-User', 'MistralAI-User' ) === json_decode( get_option( 'litespeed.conf.cache-exc_useragents' ) ), 'LiteSpeed: lista junta, a do cliente primeiro' );
		ok( true === wa_ia_cache_litespeed( true ) && 1 === $GLOBALS['__ls_saves'], 'LiteSpeed: segunda vez não grava' );
		ok( true === wa_ia_cache_litespeed( false ) && array( 'Googlebot-Image' ) === json_decode( get_option( 'litespeed.conf.cache-exc_useragents' ) ), 'LiteSpeed: desfeito' );
		break;

	case 'cache-wpo':
		class WPO_Cache_Config { static $i; static function instance() { return self::$i ? self::$i : ( self::$i = new self() ); } function get() { return get_option( 'wpo_cache_config', array( 'enable_page_caching' => false, 'cache_exception_browser_agents' => array() ) ); } function update( $c, $s = false ) { $c = apply_filters( 'wpo_cache_update_config', $c ); update_option( 'wpo_cache_config', $c ); return true; } }
		class WPO_Page_Cache { static $i; public $purges = 0; static function instance() { return self::$i ? self::$i : ( self::$i = new self() ); } function purge() { $this->purges++; } }
		$GLOBALS['__opts']['wpo_cache_config'] = array( 'enable_page_caching' => true, 'cache_exception_browser_agents' => array( 'Foo' ) );
		load_plugin();
		ok( in_array( 'WP-Optimize', wa_ia_detect_cache(), true ), 'WPO: detetado (cache ligada)' );
		ok( true === wa_ia_cache_wpo( true ), 'WPO: aplicado' );
		$c = get_option( 'wpo_cache_config' );
		ok( array( 'Foo', 'ChatGPT-User', 'Claude-User', 'Perplexity-User', 'MistralAI-User' ) === $c['cache_exception_browser_agents'] && 1 === WPO_Page_Cache::instance()->purges, 'WPO: lista junta + cache limpa' );
		ok( true === wa_ia_cache_wpo( false ), 'WPO: desfeito (o filtro não volta a pôr os nomes)' );
		$c = get_option( 'wpo_cache_config' );
		ok( array( 'Foo' ) === $c['cache_exception_browser_agents'], 'WPO: fica como estava' );
		$GLOBALS['__opts']['wpo_cache_config']['enable_page_caching'] = false;
		ok( null === wa_ia_cache_wpo( true ) && ! in_array( 'WP-Optimize', wa_ia_detect_cache(), true ), 'WPO só de limpeza da base de dados: ignorado' );
		break;

	case 'cache-rocket':
		define( 'WP_ROCKET_VERSION', '3.24' );
		$GLOBALS['__rk'] = array();
		function flush_rocket_htaccess() { $GLOBALS['__rk'][] = 'flush'; }
		function rocket_generate_config_file() { $GLOBALS['__rk'][] = 'config'; }
		function get_rocket_cache_reject_ua() { return implode( '|', apply_filters( 'rocket_cache_reject_ua', array( 'facebookexternalhit' ) ) ); }
		load_plugin();
		ok( true === wa_ia_cache_rocket( true ) && array( 'flush', 'config' ) === $GLOBALS['__rk'], 'Rocket: pede ao WP Rocket para reescrever .htaccess e config' );
		ok( false !== strpos( get_rocket_cache_reject_ua(), 'facebookexternalhit|(.*)ChatGPT-User(.*)|(.*)Claude-User(.*)' ), 'Rocket: padrão (.*)X(.*) (a regra dele é ancorada no início)' );
		$re = '#^(' . get_rocket_cache_reject_ua() . ').*#i';
		ok( 1 === preg_match( $re, 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot' ), 'Rocket: a regra apanha o User-Agent real do ChatGPT' );
		ok( 0 === preg_match( $re, 'Mozilla/5.0 (Macintosh) Chrome/131' ), 'Rocket: e não apanha um browser normal' );
		ok( true === wa_ia_cache_rocket( false ) && false === strpos( get_rocket_cache_reject_ua(), 'ChatGPT' ), 'Rocket: desfeito' );
		break;

	case 'cache-wpsc':
		$GLOBALS['wpsc_plugins'] = array( 'outro/plugin.php' );
		function wp_cache_setting( $f, $v ) { $GLOBALS[ $f ] = $v; }
		function wpsc_add_plugin( $file ) { global $wpsc_plugins; if ( substr( $file, 0, strlen( ABSPATH ) ) == ABSPATH ) { $file = substr( $file, strlen( ABSPATH ) ); } if ( ! in_array( $file, $wpsc_plugins ) ) { $wpsc_plugins[] = $file; wp_cache_setting( 'wpsc_plugins', $wpsc_plugins ); } }
		function wpsc_delete_plugin( $file ) { global $wpsc_plugins; if ( substr( $file, 0, strlen( ABSPATH ) ) == ABSPATH ) { $file = substr( $file, strlen( ABSPATH ) ); } if ( in_array( $file, $wpsc_plugins ) ) { unset( $wpsc_plugins[ array_search( $file, $wpsc_plugins ) ] ); wp_cache_setting( 'wpsc_plugins', $wpsc_plugins ); } }
		load_plugin();
		ok( true === wa_ia_cache_wpsc( true ), 'WPSC: aplicado' );
		ok( in_array( 'wp-content/plugins/wonderads-ia-no-site/includes/wpsc-early.php', $GLOBALS['wpsc_plugins'], true ) && in_array( 'outro/plugin.php', $GLOBALS['wpsc_plugins'], true ), 'WPSC: ficheiro registado (caminho relativo), o do cliente fica' );
		ok( true === wa_ia_cache_wpsc( false ) && array( 'outro/plugin.php' ) === array_values( $GLOBALS['wpsc_plugins'] ), 'WPSC: desfeito' );
		break;

	case 'cache-status-hosts':
		define( 'WPE_APIKEY', 'x' ); define( 'W3TC', true );
		load_plugin();
		$st = array(); foreach ( wa_ia_cache_status() as $c ) { $st[ $c['name'] ] = $c; }
		ok( 'host' === $st['WP Engine']['handled'] && false !== strpos( $st['WP Engine']['note'], 'suporte do WP Engine' ), 'WP Engine: pede ao alojamento' );
		ok( 'manual' === $st['W3 Total Cache']['handled'], 'W3TC: instrução manual' );
		break;

	case 'cache-apply-isolated':
		// Um adaptador que rebenta não impede os outros.
		define( 'LSCWP_V', 'x' );
		add_action( 'litespeed_save_conf', function () { throw new RuntimeException( 'LSCWP mudou' ); } );
		define( 'WP_ROCKET_VERSION', '3.24' );
		function flush_rocket_htaccess() {}
		function rocket_generate_config_file() {}
		function get_rocket_cache_reject_ua() { return implode( '|', apply_filters( 'rocket_cache_reject_ua', array() ) ); }
		load_plugin();
		$r = wa_ia_cache_apply();
		ok( false === $r['LiteSpeed Cache']['applied'] && 'LSCWP mudou' === $r['LiteSpeed Cache']['error'], 'LiteSpeed falhou e ficou registado' );
		ok( true === $r['WP Rocket']['applied'], 'WP Rocket aplicou na mesma' );
		$st = array(); foreach ( wa_ia_cache_status() as $c ) { $st[ $c['name'] ] = $c; }
		ok( false !== strpos( $st['LiteSpeed Cache']['note'], 'acrescenta' ), 'o estado diz o que fazer à mão' );
		break;

	case 'admin-render':
		$GLOBALS['__is_admin'] = true;
		function current_user_can() { return true; }
		function add_options_page() {}
		function esc_html( $s ) { return htmlspecialchars( (string) $s ); }
		function esc_attr( $s ) { return htmlspecialchars( (string) $s ); }
		function esc_url( $s ) { return (string) $s; }
		function wp_kses( $s ) { return (string) $s; }
		function wp_date( $f, $t ) { return gmdate( $f, $t ); }
		function wp_nonce_field() { echo '<nonce>'; }
		function submit_button( $t ) { echo "<button>$t</button>"; }
		function check_admin_referer() { return true; }
		function wp_safe_redirect() {}
		define( 'WPE_APIKEY', 'x' ); define( 'LSCWP_V', 'x' );
		load_plugin();
		$GLOBALS['__opts']['wa_ia_db'] = '1'; $GLOBALS['wpdb']->tables['wp_wa_ia_hits'] = true;
		$GLOBALS['wpdb']->rows = array( gmdate( 'Y-m-d' ) . '|ChatGPT-User|/' => 3, gmdate( 'Y-m-d' ) . '|ClaudeBot|/x/' => 9 );
		$GLOBALS['__opts']['wa_ia_check'] = array( 'at' => time(), 'error' => null, 'agents' => array( 'ChatGPT-User' => array( 'reached' => 0, 'attempts' => 2, 'status' => array( 403, 403 ), 'cache' => array( null, null ) ) ), 'blocks' => array( 'file' => true, 'lines' => array( array( 'line' => 12, 'text' => 'RewriteCond %{HTTP_USER_AGENT} (GPTBot|ChatGPT-User) [NC]', 'block' => null, 'kind' => 'possible-block' ) ) ) );
		set_site_transient( 'wa_ia_update_info', (object) array( 'version' => '1.2.0', 'download_url' => 'https://workspace.wonder-ads.com/x.zip' ) );
		ob_start(); wa_ia_settings_page(); $html = ob_get_clean();
		ok( false !== strpos( $html, 'O site recusa os pedidos de pelo menos uma IA' ), 'admin: mostra o bloqueio' );
		ok( false !== strpos( $html, 'linha' ) || false !== strpos( $html, '<td>12</td>' ), 'admin: mostra a linha do .htaccess' );
		ok( false !== strpos( $html, 'suporte do WP Engine' ), 'admin: diz o que pedir ao WP Engine' );
		ok( false !== strpos( $html, 'ChatGPT-User</td><td style="text-align:right;"><strong>3' ), 'admin: ChatGPT 3 este mês' );
		ok( false !== strpos( $html, 'ClaudeBot 9' ), 'admin: robôs de treino à parte' );
		ok( false !== strpos( $html, 'disponível: <strong>1.2.0' ), 'admin: versão nova disponível' );
		
		break;
}

if ( ! empty( $GLOBALS['__warnings'] ) ) {
	echo "  ✗ avisos de PHP: " . implode( ' | ', $GLOBALS['__warnings'] ) . "\n";
	exit( 1 );
}
exit( empty( $GLOBALS['__failed'] ) ? 0 : 1 );

/** Volta a correr o registo (o static do plugin só deixa uma vez por pedido). */
function wa_ia_increment_for_test() {
	// mesma lógica do wa_ia_record, sem o static: recarrega via closure
	static $fn = null;
	if ( null === $fn ) {
		$src = file_get_contents( PLUGIN_DIR . '/includes/counter.php' );
		preg_match( '/function wa_ia_record\(\) \{(.*?)\n\}\n/s', $src, $m );
		$body = str_replace( array( "static \$done = false;\n\tif ( \$done ) {\n\t\treturn;\n\t}\n\t\$done = true;\n" ), '', $m[1] );
		$fn   = eval( 'return function () {' . $body . '};' );
	}
	$fn();
}
