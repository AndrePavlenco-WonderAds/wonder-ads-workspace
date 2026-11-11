<?php
/**
 * Definições → WonderAds IA: a chave, o estado (com o que falta fazer, se
 * faltar) e os números do mês.
 *
 * @package WonderAds_IA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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

add_action(
	'admin_post_wa_ia_check_now',
	function () {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissões.' );
		}
		check_admin_referer( 'wa_ia_check_now' );
		wa_ia_cache_apply();
		wa_ia_self_check();
		wp_safe_redirect( admin_url( 'options-general.php?page=wonderads-ia&verificado=1' ) );
		exit;
	}
);

add_filter(
	'plugin_action_links_' . plugin_basename( WA_IA_FILE ),
	function ( $links ) {
		$links[] = '<a href="' . esc_url( admin_url( 'options-general.php?page=wonderads-ia' ) ) . '">Chave e estado</a>';
		return $links;
	}
);

/**
 * @param bool   $ok   Verde ou vermelho.
 * @param string $text Texto.
 */
function wa_ia_admin_item( $ok, $text ) {
	printf(
		'<li style="margin:.35em 0"><span style="display:inline-block;width:1.4em;color:%s;font-weight:700">%s</span>%s</li>',
		$ok ? '#0a7d32' : '#b32d2e',
		$ok ? '✓' : '✗',
		wp_kses( $text, array( 'strong' => array(), 'code' => array(), 'br' => array() ) )
	);
}

function wa_ia_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$key     = wa_ia_key();
	$month   = current_time( 'Y-m' );
	$days    = wa_ia_days( $month . '-01', $month . '-31' );
	$users   = array_fill_keys( wa_ia_user_agents(), 0 );
	$robots  = array();
	foreach ( $days as $counts ) {
		foreach ( $counts as $agent => $n ) {
			if ( isset( $users[ $agent ] ) ) {
				$users[ $agent ] += (int) $n;
			} else {
				$robots[ $agent ] = ( isset( $robots[ $agent ] ) ? $robots[ $agent ] : 0 ) + (int) $n;
			}
		}
	}
	arsort( $robots );
	$check   = get_option( WA_IA_OPT_CHECK );
	$verdict = wa_ia_check_verdict( $check );
	$caches  = wa_ia_cache_status();
	$info    = wa_ia_remote_info();
	?>
	<div class="wrap">
		<h1>WonderAds — IA no site</h1>
		<?php if ( isset( $_GET['nova'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
			<div class="notice notice-success"><p>Chave nova criada. Copia-a outra vez para o workspace — a antiga deixou de funcionar.</p></div>
		<?php endif; ?>
		<?php if ( isset( $_GET['verificado'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
			<div class="notice notice-success"><p>Verificação feita.</p></div>
		<?php endif; ?>
		<p>Conta as vezes que o ChatGPT, o Claude, o Perplexity e o Mistral abrem páginas deste site para responder a alguém — também nas apps do telemóvel. Os números entram no relatório mensal da WonderAds. Não guarda dados de pessoas.</p>

		<h2>Estado</h2>
		<ul style="max-width:60em">
			<?php
			if ( 'ok' === $verdict ) {
				wa_ia_admin_item( true, 'Os pedidos das IAs chegam ao WordPress e estão a ser contados.' );
			} elseif ( 'cache' === $verdict ) {
				wa_ia_admin_item( false, '<strong>A cache de página serve os pedidos das IAs antes do WordPress</strong> — só são contados quando a página expira. Vê abaixo o que falta.' );
			} elseif ( 'blocked' === $verdict ) {
				wa_ia_admin_item( false, '<strong>O site recusa os pedidos de pelo menos uma IA</strong> (403/429…). Essa IA não consegue ler o site — nem para responder a quem pergunta. Vê abaixo se a regra está no .htaccess; se não estiver, está no alojamento ou numa firewall.' );
			} elseif ( 'error' === $verdict ) {
				wa_ia_admin_item( false, 'Não foi possível verificar: o site não consegue fazer pedidos a si próprio' . ( ! empty( $check['error'] ) ? ' (<code>' . esc_html( $check['error'] ) . '</code>)' : '' ) . '. O botão «Testar» do workspace faz a mesma verificação de fora.' );
			} else {
				wa_ia_admin_item( false, 'Ainda não verificado — carrega em «Verificar agora».' );
			}
			foreach ( $caches as $c ) {
				if ( 'auto' === $c['handled'] ) {
					wa_ia_admin_item( (bool) $c['applied'], '<strong>' . esc_html( $c['name'] ) . '</strong>: ' . ( $c['applied'] ? 'ajustada automaticamente — não serve a página da cache aos 4 assistentes.' : 'não foi possível ajustar automaticamente. ' . esc_html( (string) $c['note'] ) ) );
				} else {
					wa_ia_admin_item( false, '<strong>' . esc_html( $c['name'] ) . '</strong>: ' . esc_html( (string) $c['note'] ) );
				}
			}
			?>
		</ul>
		<?php if ( is_array( $check ) && ! empty( $check['agents'] ) ) : ?>
			<table class="widefat striped" style="max-width:44em">
				<thead><tr><th>Assistente</th><th>Chegaram ao WordPress</th><th>Resposta do site</th></tr></thead>
				<tbody>
				<?php foreach ( $check['agents'] as $agent => $row ) : ?>
					<tr>
						<td><?php echo esc_html( $agent ); ?></td>
						<td><?php echo esc_html( (int) $row['reached'] . ' de ' . (int) $row['attempts'] ); ?></td>
						<td><code><?php echo esc_html( implode( ', ', array_map( 'strval', (array) $row['status'] ) ) ); ?></code></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<p class="description">Última verificação: <?php echo esc_html( wp_date( 'd/m/Y H:i', (int) $check['at'] ) ); ?>. Repete-se sozinha uma vez por dia.</p>
		<?php endif; ?>
		<?php
		$block_lines = array();
		if ( is_array( $check ) && ! empty( $check['blocks']['lines'] ) ) {
			foreach ( $check['blocks']['lines'] as $l ) {
				if ( 'possible-block' === $l['kind'] ) {
					$block_lines[] = $l;
				}
			}
		}
		?>
		<?php if ( $block_lines ) : ?>
			<h3>Regras no .htaccess que mencionam robôs de IA</h3>
			<p>Se alguma destas bloqueia o ChatGPT-User, o Claude-User, o Perplexity-User ou o MistralAI-User, essa IA não consegue ler o site. O plugin não mexe em regras de outros — retira estes nomes à mão (ou pede a quem as pôs).</p>
			<table class="widefat striped" style="max-width:60em">
				<thead><tr><th>Linha</th><th>Regra</th><th>Bloco</th></tr></thead>
				<tbody>
				<?php foreach ( $block_lines as $l ) : ?>
					<tr><td><?php echo (int) $l['line']; ?></td><td><code><?php echo esc_html( $l['text'] ); ?></code></td><td><?php echo esc_html( (string) $l['block'] ); ?></td></tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top:1em">
			<input type="hidden" name="action" value="wa_ia_check_now" />
			<?php wp_nonce_field( 'wa_ia_check_now' ); ?>
			<?php submit_button( 'Verificar agora', 'primary', 'submit', false ); ?>
		</form>

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
			<?php foreach ( $users as $agent => $n ) : ?>
				<tr><td><?php echo esc_html( $agent ); ?></td><td style="text-align:right;"><strong><?php echo esc_html( (string) $n ); ?></strong></td></tr>
			<?php endforeach; ?>
			</tbody>
		</table>
		<?php if ( $robots ) : ?>
			<p class="description">Robôs de indexação e treino (não entram no relatório):
				<?php
				$parts = array();
				foreach ( $robots as $agent => $n ) {
					$parts[] = esc_html( $agent . ' ' . $n );
				}
				echo implode( ' · ', $parts ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				?>
			</p>
		<?php endif; ?>
		<p class="description">A contar desde <?php echo esc_html( implode( '/', array_reverse( explode( '-', wa_ia_since() ) ) ) ); ?>.</p>

		<h2>Versão</h2>
		<p>Instalada: <strong><?php echo esc_html( WA_IA_VERSION ); ?></strong>
			<?php if ( $info && version_compare( (string) $info->version, WA_IA_VERSION, '>' ) ) : ?>
				· disponível: <strong><?php echo esc_html( (string) $info->version ); ?></strong> (atualiza-se sozinho; ou Painel → Atualizações)
			<?php endif; ?>
			· atualizações automáticas: <?php echo ( defined( 'WA_IA_NO_AUTO_UPDATE' ) && WA_IA_NO_AUTO_UPDATE ) ? 'desligadas no wp-config.php' : 'ligadas'; ?>.
		</p>
	</div>
	<?php
}
