<?php
// WordPress simulado — só o necessário para correr o plugin em testes.
// Escrito à mão para estes testes; nada aqui vem de fora.
error_reporting( E_ALL );
ini_set( 'display_errors', '1' );
set_error_handler( function ( $no, $str, $file, $line ) {
	if ( ! ( error_reporting() & $no ) ) { return true; } // @ suprimido
	fwrite( STDERR, "PHP AVISO [$no] $str em $file:$line\n" );
	$GLOBALS['__warnings'][] = "$str @ " . basename( $file ) . ":$line";
	return true;
} );

define( 'ABSPATH', getenv( 'WA_IA_FAKEROOT' ) . '/' );
define( 'WPINC', 'wp-includes' );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );
define( 'ARRAY_A', 'ARRAY_A' );
$GLOBALS['wp_version'] = '7.1.4';

$GLOBALS['__opts']      = isset( $GLOBALS['__opts'] ) ? $GLOBALS['__opts'] : array();
$GLOBALS['__hooks']     = array();
$GLOBALS['__transient'] = array();
$GLOBALS['__is_admin']  = false;
$GLOBALS['__http']      = array(); // respostas simuladas do wp_remote_get

function get_option( $k, $d = false ) { return array_key_exists( $k, $GLOBALS['__opts'] ) ? $GLOBALS['__opts'][ $k ] : $d; }
function update_option( $k, $v, $a = null ) { $GLOBALS['__opts'][ $k ] = $v; return true; }
function add_option( $k, $v = '', $d = '', $a = 'yes' ) { if ( ! array_key_exists( $k, $GLOBALS['__opts'] ) ) { $GLOBALS['__opts'][ $k ] = $v; } return true; }
function delete_option( $k ) { unset( $GLOBALS['__opts'][ $k ] ); return true; }
function get_transient( $k ) { return isset( $GLOBALS['__transient'][ $k ] ) ? $GLOBALS['__transient'][ $k ] : false; }
function set_transient( $k, $v, $e = 0 ) { $GLOBALS['__transient'][ $k ] = $v; return true; }
function delete_transient( $k ) { unset( $GLOBALS['__transient'][ $k ] ); return true; }
function get_site_transient( $k ) { return get_transient( 'site_' . $k ); }
function set_site_transient( $k, $v, $e = 0 ) { return set_transient( 'site_' . $k, $v, $e ); }
function delete_site_transient( $k ) { return delete_transient( 'site_' . $k ); }
function add_action( $h, $cb, $p = 10, $n = 1 ) { $GLOBALS['__hooks'][ $h ][] = $cb; return true; }
function add_filter( $h, $cb, $p = 10, $n = 1 ) { $GLOBALS['__hooks'][ $h ][] = $cb; return true; }
function apply_filters( $h, $v ) { $args = func_get_args(); array_shift( $args ); foreach ( isset( $GLOBALS['__hooks'][ $h ] ) ? $GLOBALS['__hooks'][ $h ] : array() as $cb ) { $args[0] = call_user_func_array( $cb, $args ); } return $args[0]; }
function do_action( $h ) { $args = func_get_args(); array_shift( $args ); foreach ( isset( $GLOBALS['__hooks'][ $h ] ) ? $GLOBALS['__hooks'][ $h ] : array() as $cb ) { call_user_func_array( $cb, $args ); } }
function has_action( $h ) { return ! empty( $GLOBALS['__hooks'][ $h ] ); }
function remove_filter( $h, $cb ) { if ( empty( $GLOBALS['__hooks'][ $h ] ) ) { return false; } foreach ( $GLOBALS['__hooks'][ $h ] as $i => $c ) { if ( $c === $cb ) { unset( $GLOBALS['__hooks'][ $h ][ $i ] ); return true; } } return false; }
function has_filter( $h ) { return ! empty( $GLOBALS['__hooks'][ $h ] ); }
function register_activation_hook( $f, $cb ) { $GLOBALS['__activate'] = $cb; }
function register_deactivation_hook( $f, $cb ) { $GLOBALS['__deactivate'] = $cb; }
function register_uninstall_hook( $f, $cb ) { $GLOBALS['__uninstall'] = $cb; }
function plugin_basename( $f ) { return 'wonderads-ia-no-site/' . basename( $f ); }
function is_admin() { return $GLOBALS['__is_admin']; }
function wp_doing_ajax() { return false; }
function wp_doing_cron() { return false; }
function is_multisite() { return false; }
function wp_unslash( $v ) { return is_string( $v ) ? stripslashes( $v ) : $v; }
function sanitize_text_field( $v ) { return trim( preg_replace( '/[\r\n\t ]+/', ' ', strip_tags( (string) $v ) ) ); }
function wp_parse_url( $u, $c = -1 ) { return parse_url( $u, $c ); }
function current_time( $f ) { return gmdate( $f ); }
function wp_generate_password( $n = 12, $s = true, $x = false ) { return substr( str_repeat( bin2hex( random_bytes( 32 ) ), 2 ), 0, $n ); }
function wp_next_scheduled( $h ) { return isset( $GLOBALS['__cron'][ $h ] ) ? $GLOBALS['__cron'][ $h ] : false; }
function wp_schedule_event( $t, $r, $h ) { $GLOBALS['__cron'][ $h ] = $t; return true; }
function wp_schedule_single_event( $t, $h ) { $GLOBALS['__cron'][ $h ] = $t; return true; }
function wp_clear_scheduled_hook( $h ) { unset( $GLOBALS['__cron'][ $h ] ); return 1; }
function home_url( $p = '' ) { return 'https://exemplo.test' . $p; }
function admin_url( $p = '' ) { return 'https://exemplo.test/wp-admin/' . $p; }
function trailingslashit( $s ) { return rtrim( $s, '/\\' ) . '/'; }
function get_home_path() { return ABSPATH; }
function maybe_unserialize( $v ) { if ( is_string( $v ) ) { $u = @unserialize( $v ); if ( false !== $u || 'b:0;' === $v ) { return $u; } } return $v; }
function wp_timezone_string() { return 'Europe/Lisbon'; }
function rest_ensure_response( $d ) { return new WP_REST_Response( $d ); }
function is_wp_error( $x ) { return $x instanceof WP_Error; }
function wp_remote_get( $url, $args = array() ) {
	$GLOBALS['__http_log'][] = array( 'url' => $url, 'args' => $args );
	$h = isset( $GLOBALS['__http_handler'] ) ? $GLOBALS['__http_handler'] : null;
	return $h ? $h( $url, $args ) : new WP_Error( 'x', 'sem rede nos testes' );
}
function wp_remote_retrieve_response_code( $r ) { return is_array( $r ) ? $r['response']['code'] : ''; }
function wp_remote_retrieve_body( $r ) { return is_array( $r ) ? $r['body'] : ''; }
function wp_remote_retrieve_header( $r, $h ) { return is_array( $r ) && isset( $r['headers'][ $h ] ) ? $r['headers'][ $h ] : ''; }
function dbDelta( $sql ) { $GLOBALS['__dbdelta'][] = $sql; $GLOBALS['wpdb']->tables[ $GLOBALS['wpdb']->prefix . 'wa_ia_hits' ] = true; return array(); }

class WP_Error { public $m; function __construct( $c = '', $m = '' ) { $this->m = $m; } function get_error_message() { return $this->m; } }
class WP_REST_Response { public $data; public $headers = array(); function __construct( $d ) { $this->data = $d; } function header( $k, $v ) { $this->headers[ $k ] = $v; } }
class WP_REST_Request {
	private $h; private $p;
	function __construct( $h = array(), $p = array() ) { $this->h = array_change_key_case( $h ); $this->p = $p; }
	function get_header( $k ) { $k = strtolower( $k ); return isset( $this->h[ $k ] ) ? $this->h[ $k ] : null; }
	function get_param( $k ) { return isset( $this->p[ $k ] ) ? $this->p[ $k ] : null; }
}

// wpdb simulado: guarda as linhas da tabela num array e percebe as 4 queries do plugin.
class FakeWpdb {
	public $prefix = 'wp_';
	public $options = 'wp_options';
	public $tables = array();
	public $rows = array(); // "day|agent|path" => hits
	public $queries = array();
	public $fail_inserts = false;
	function get_charset_collate() { return 'DEFAULT CHARSET=utf8mb4'; }
	function suppress_errors( $s = true ) { return false; }
	function prepare( $q ) {
		$args = func_get_args(); array_shift( $args );
		if ( isset( $args[0] ) && is_array( $args[0] ) ) { $args = $args[0]; }
		$q = str_replace( '%%', '##PCT##', $q );
		$i = 0;
		$q = preg_replace_callback( '/%[sd]/', function ( $m ) use ( &$i, $args ) { $v = $args[ $i++ ]; return "'" . addslashes( (string) $v ) . "'"; }, $q );
		return str_replace( '##PCT##', '%', $q );
	}
	function query( $q ) {
		$this->queries[] = $q;
		if ( preg_match( "/^INSERT INTO (\S+) \(day, agent, path, hits\) VALUES \('([^']*)', '([^']*)', '([^']*)', 1\) ON DUPLICATE KEY UPDATE hits = hits \+ 1$/", $q, $m ) ) {
			if ( $this->fail_inserts || empty( $this->tables[ $m[1] ] ) ) { return false; }
			$k = $m[2] . '|' . $m[3] . '|' . stripslashes( $m[4] );
			$this->rows[ $k ] = ( isset( $this->rows[ $k ] ) ? $this->rows[ $k ] : 0 ) + 1;
			return 1;
		}
		if ( preg_match( "/^DELETE FROM (\S+) WHERE day < '([^']*)'$/", $q, $m ) ) {
			$n = 0; foreach ( array_keys( $this->rows ) as $k ) { if ( substr( $k, 0, 10 ) < $m[2] ) { unset( $this->rows[ $k ] ); $n++; } } return $n;
		}
		if ( 0 === strpos( $q, 'DROP TABLE' ) ) { $this->tables = array(); $this->rows = array(); return true; }
		throw new Exception( "query inesperada: $q" );
	}
	function get_var( $q ) {
		$this->queries[] = $q;
		if ( preg_match( "/^SHOW TABLES LIKE '([^']*)'$/", $q, $m ) ) { return isset( $this->tables[ $m[1] ] ) ? $m[1] : null; }
		if ( preg_match( "/FROM wp_options WHERE option_name = '([^']*)'/", $q, $m ) ) { return isset( $GLOBALS['__opts'][ $m[1] ] ) ? serialize( $GLOBALS['__opts'][ $m[1] ] ) : null; }
		throw new Exception( "get_var inesperado: $q" );
	}
	function get_results( $q, $o = null ) {
		$this->queries[] = $q;
		if ( preg_match( "/^SELECT day, agent, SUM\(hits\) AS n FROM \S+ WHERE day BETWEEN '([^']*)' AND '([^']*)' GROUP BY day, agent$/", $q, $m ) ) {
			$agg = array();
			foreach ( $this->rows as $k => $n ) { list( $d, $a ) = explode( '|', $k ); if ( $d >= $m[1] && $d <= $m[2] ) { $agg["$d|$a"] = ( isset( $agg["$d|$a"] ) ? $agg["$d|$a"] : 0 ) + $n; } }
			$out = array(); foreach ( $agg as $k => $n ) { list( $d, $a ) = explode( '|', $k ); $out[] = array( 'day' => $d, 'agent' => $a, 'n' => (string) $n ); } return $out;
		}
		if ( preg_match( "/^SELECT DATE_FORMAT\(day, '%Y-%m'\) AS month, agent, path, SUM\(hits\) AS n FROM \S+ WHERE day BETWEEN '([^']*)' AND '([^']*)' GROUP BY month, agent, path$/", $q, $m ) ) {
			$agg = array();
			foreach ( $this->rows as $k => $n ) { list( $d, $a, $p ) = explode( '|', $k, 3 ); if ( $d >= $m[1] && $d <= $m[2] ) { $kk = substr( $d, 0, 7 ) . "|$a|$p"; $agg[ $kk ] = ( isset( $agg[ $kk ] ) ? $agg[ $kk ] : 0 ) + $n; } }
			$out = array(); foreach ( $agg as $k => $n ) { list( $mo, $a, $p ) = explode( '|', $k, 3 ); $out[] = array( 'month' => $mo, 'agent' => $a, 'path' => $p, 'n' => (string) $n ); } return $out;
		}
		throw new Exception( "get_results inesperado: $q" );
	}
}
$GLOBALS['wpdb'] = new FakeWpdb();
@mkdir( ABSPATH . 'wp-admin/includes', 0777, true );
@file_put_contents( ABSPATH . 'wp-admin/includes/upgrade.php', "<?php\n" );
@file_put_contents( ABSPATH . 'wp-admin/includes/file.php', "<?php\n" );
@file_put_contents( ABSPATH . 'wp-admin/includes/misc.php', "<?php\n" );

function load_plugin() {
	require PLUGIN_DIR . '/wonderads-ia-no-site.php';
}
function ok( $cond, $label ) {
	echo ( $cond ? "  ✓ " : "  ✗ FALHOU: " ) . $label . "\n";
	if ( ! $cond ) { $GLOBALS['__failed'] = true; }
}
