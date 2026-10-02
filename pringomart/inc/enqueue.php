<?php
/**
 * Register and enqueue all theme CSS/JS.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function pringomart_enqueue_assets() {
	// Core stylesheet (CSS variables + layout + components).
	wp_enqueue_style( 'pringomart-main', PRINGOMART_URI . '/assets/css/main.css', array(), PRINGOMART_VERSION );

	// Dark mode overrides — only needed when the module is enabled.
	if ( pringomart_is_module_enabled( 'dark_mode' ) || true ) {
		wp_enqueue_style( 'pringomart-dark-mode', PRINGOMART_URI . '/assets/css/dark-mode.css', array( 'pringomart-main' ), PRINGOMART_VERSION );
	}

	wp_enqueue_style( 'dashicons' );

	// Vanilla JS, no jQuery dependency.
	wp_enqueue_script( 'pringomart-main', PRINGOMART_URI . '/assets/js/main.js', array(), PRINGOMART_VERSION, true );
	wp_enqueue_script( 'pringomart-dark-mode', PRINGOMART_URI . '/assets/js/dark-mode.js', array(), PRINGOMART_VERSION, true );

	if ( pringomart_is_module_enabled( 'reactions' ) ) {
		wp_enqueue_script( 'pringomart-reactions', PRINGOMART_URI . '/assets/js/reactions.js', array(), PRINGOMART_VERSION, true );
	}

	if ( is_user_logged_in() && pringomart_is_module_enabled( 'notifications' ) ) {
		wp_enqueue_script( 'pringomart-notifications', PRINGOMART_URI . '/assets/js/notifications.js', array(), PRINGOMART_VERSION, true );
	}

	wp_localize_script(
		'pringomart-main',
		'pringomartData',
		array(
			'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
			'nonce'        => wp_create_nonce( 'pringomart_nonce' ),
			'isLoggedIn'   => is_user_logged_in(),
			'currentUser'  => get_current_user_id(),
			'themeUri'     => PRINGOMART_URI,
			'homeUrl'      => home_url( '/' ),
			'i18n'         => array(
				'loginToComment' => __( 'মন্তব্য করতে লগইন করুন', 'pringomart' ),
				'loading'        => __( 'লোড হচ্ছে...', 'pringomart' ),
				'noResults'      => __( 'কোনো ফলাফল পাওয়া যায়নি', 'pringomart' ),
			),
		)
	);

	if ( is_singular( 'post' ) ) {
		wp_enqueue_script( 'pringomart-view-counter', PRINGOMART_URI . '/modules/view-counter/view-counter.js', array(), PRINGOMART_VERSION, true );
	}
}
add_action( 'wp_enqueue_scripts', 'pringomart_enqueue_assets' );

/**
 * Enqueue admin-only assets for Pringomart admin panel screens.
 *
 * @param string $hook Current admin page hook.
 */
function pringomart_enqueue_admin_assets( $hook ) {
	if ( strpos( $hook, 'pringomart' ) === false ) {
		return;
	}

	wp_enqueue_style( 'pringomart-admin', PRINGOMART_URI . '/assets/css/admin.css', array(), PRINGOMART_VERSION );
}
add_action( 'admin_enqueue_scripts', 'pringomart_enqueue_admin_assets' );
