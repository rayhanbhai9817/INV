<?php
/**
 * Dark / Light mode module.
 *
 * Persists the user's preference in localStorage (guests) and user meta
 * (logged-in users), and injects an inline script in <head> — before any
 * CSS paints — so there is no flash of the wrong theme on load.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Print the no-flash inline script as early as possible in <head>.
 */
function pringomart_dark_mode_inline_script() {
	$user_pref = '';

	if ( is_user_logged_in() ) {
		$user_pref = get_user_meta( get_current_user_id(), 'pringomart_theme_mode', true );
	}

	$user_pref = in_array( $user_pref, array( 'dark', 'light' ), true ) ? $user_pref : '';
	?>
	<script>
	(function() {
		try {
			var userPref = <?php echo wp_json_encode( $user_pref ); ?>;
			var saved = userPref || localStorage.getItem('pringomart-theme');
			var theme = saved === 'dark' || saved === 'light'
				? saved
				: (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
			document.documentElement.setAttribute('data-theme', theme);
		} catch (e) {
			document.documentElement.setAttribute('data-theme', 'light');
		}
	})();
	</script>
	<?php
}
add_action( 'wp_head', 'pringomart_dark_mode_inline_script', 1 );

/**
 * AJAX: persist the logged-in user's theme preference to user meta.
 */
function pringomart_ajax_save_theme_mode() {
	check_ajax_referer( 'pringomart_nonce', 'nonce' );

	if ( ! is_user_logged_in() ) {
		wp_send_json_success(); // Guests rely on localStorage only.
	}

	$mode = isset( $_POST['mode'] ) ? sanitize_text_field( wp_unslash( $_POST['mode'] ) ) : '';

	if ( ! in_array( $mode, array( 'dark', 'light' ), true ) ) {
		wp_send_json_error( array( 'message' => __( 'Invalid theme mode.', 'pringomart' ) ), 400 );
	}

	update_user_meta( get_current_user_id(), 'pringomart_theme_mode', $mode );

	wp_send_json_success( array( 'mode' => $mode ) );
}
add_action( 'wp_ajax_pringomart_save_theme_mode', 'pringomart_ajax_save_theme_mode' );
add_action( 'wp_ajax_nopriv_pringomart_save_theme_mode', 'pringomart_ajax_save_theme_mode' );
