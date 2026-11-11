<?php
/**
 * Atualizações a partir do workspace da WonderAds. O WordPress pergunta ao
 * workspace se há versão nova (como faz com o wordpress.org) e atualiza
 * sozinho — o WordPress 6.6+ desfaz a atualização se ela partir o site.
 * Para desligar a atualização automática num site:
 * define( 'WA_IA_NO_AUTO_UPDATE', true ); no wp-config.php.
 *
 * @package WonderAds_IA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A ficha da última versão, guardada 6 h (1 h se o workspace falhar).
 *
 * @param bool $force Ignora a cache.
 * @return object|null
 */
function wa_ia_remote_info( $force = false ) {
	$cached = get_site_transient( 'wa_ia_update_info' );
	if ( ! $force && false !== $cached ) {
		return is_object( $cached ) ? $cached : null;
	}
	$res  = wp_remote_get(
		WA_IA_UPDATE_URL,
		array(
			'timeout' => 8,
			'headers' => array( 'Accept' => 'application/json' ),
		)
	);
	$info = null;
	if ( ! is_wp_error( $res ) && 200 === (int) wp_remote_retrieve_response_code( $res ) ) {
		$body = json_decode( wp_remote_retrieve_body( $res ) );
		if (
			is_object( $body ) && ! empty( $body->version ) && ! empty( $body->download_url ) &&
			preg_match( '/^\d+\.\d+\.\d+$/', (string) $body->version ) &&
			// O pacote só pode vir do workspace — nunca de outro sítio.
			0 === strpos( (string) $body->download_url, WA_IA_UPDATE_ORIGIN . '/' )
		) {
			$info = $body;
		}
	}
	set_site_transient( 'wa_ia_update_info', $info ? $info : 'none', $info ? 6 * HOUR_IN_SECONDS : HOUR_IN_SECONDS );
	return $info;
}

add_filter(
	'pre_set_site_transient_update_plugins',
	function ( $transient ) {
		if ( ! is_object( $transient ) ) {
			return $transient;
		}
		$basename = plugin_basename( WA_IA_FILE );
		$info     = wa_ia_remote_info();
		$item     = array(
			'id'           => 'wonderads-ia-no-site',
			'slug'         => 'wonderads-ia-no-site',
			'plugin'       => $basename,
			'new_version'  => WA_IA_VERSION,
			'url'          => 'https://wonder-ads.com',
			'package'      => '',
			'icons'        => array(),
			'banners'      => array(),
			'tested'       => '',
			'requires'     => '5.3',
			'requires_php' => '7.2',
		);
		if ( $info && version_compare( (string) $info->version, WA_IA_VERSION, '>' ) ) {
			$item['new_version']  = (string) $info->version;
			$item['package']      = (string) $info->download_url;
			$item['tested']       = isset( $info->tested ) ? (string) $info->tested : '';
			$item['requires']     = isset( $info->requires ) ? (string) $info->requires : '5.3';
			$item['requires_php'] = isset( $info->requires_php ) ? (string) $info->requires_php : '7.2';
			$transient->response[ $basename ] = (object) $item;
			unset( $transient->no_update[ $basename ] );
		} else {
			// Na lista «sem atualização» o WordPress mostra o interruptor de
			// atualizações automáticas deste plugin.
			$transient->no_update[ $basename ] = (object) $item;
			unset( $transient->response[ $basename ] );
		}
		return $transient;
	}
);

add_filter(
	'plugins_api',
	function ( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || ! is_object( $args ) || empty( $args->slug ) || 'wonderads-ia-no-site' !== $args->slug ) {
			return $result;
		}
		$info = wa_ia_remote_info();
		if ( ! $info ) {
			return $result;
		}
		return (object) array(
			'name'          => 'WonderAds — IA no site',
			'slug'          => 'wonderads-ia-no-site',
			'version'       => (string) $info->version,
			'author'        => '<a href="https://wonder-ads.com">WonderAds</a>',
			'homepage'      => 'https://wonder-ads.com',
			'requires'      => isset( $info->requires ) ? (string) $info->requires : '5.3',
			'tested'        => isset( $info->tested ) ? (string) $info->tested : '',
			'requires_php'  => isset( $info->requires_php ) ? (string) $info->requires_php : '7.2',
			'last_updated'  => isset( $info->last_updated ) ? (string) $info->last_updated : '',
			'sections'      => isset( $info->sections ) ? (array) $info->sections : array(),
			'download_link' => (string) $info->download_url,
		);
	},
	10,
	3
);

// Atualização automática ligada por omissão para este plugin.
add_filter(
	'auto_update_plugin',
	function ( $update, $item ) {
		if ( defined( 'WA_IA_NO_AUTO_UPDATE' ) && WA_IA_NO_AUTO_UPDATE ) {
			return $update;
		}
		if ( is_object( $item ) && isset( $item->plugin ) && plugin_basename( WA_IA_FILE ) === $item->plugin ) {
			return true;
		}
		return $update;
	},
	10,
	2
);
