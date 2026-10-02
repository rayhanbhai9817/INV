<?php
/**
 * Pringomart theme bootstrap.
 *
 * Loads theme setup, enqueueing, widgets, helpers, AJAX handlers,
 * the Customizer, admin panel and all built-in modules.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PRINGOMART_VERSION', '1.0.0' );
define( 'PRINGOMART_DIR', get_template_directory() );
define( 'PRINGOMART_URI', get_template_directory_uri() );

/**
 * Require a file if it exists, so a missing optional file never produces
 * a fatal white-screen during development.
 *
 * @param string $relative_path Path relative to the theme root.
 */
function pringomart_require( $relative_path ) {
	$path = PRINGOMART_DIR . '/' . ltrim( $relative_path, '/' );
	if ( file_exists( $path ) ) {
		require_once $path;
	}
}

/* ----------------------------------------------------------------------
 * Core includes
 * -------------------------------------------------------------------- */
$pringomart_core_includes = array(
	'inc/helpers.php',    // Shared helper/utility functions (load first).
	'inc/setup.php',      // Theme support, menus, image sizes, DB table setup.
	'inc/enqueue.php',    // CSS/JS registration & enqueueing.
	'inc/widgets.php',    // Custom widgets (Top Contributors, Popular Posts, etc).
	'inc/customizer.php', // Theme Customizer: Pringomart Settings panel.
	'inc/ajax.php',       // Shared/front-end AJAX endpoints not tied to a single module.
);

foreach ( $pringomart_core_includes as $pringomart_file ) {
	pringomart_require( $pringomart_file );
}

/* ----------------------------------------------------------------------
 * Built-in modules (each self-contained under /modules/)
 * -------------------------------------------------------------------- */
$pringomart_modules = array(
	'modules/dark-mode/dark-mode.php',
	'modules/view-counter/view-counter.php',
	'modules/online-users/online-users.php',
	'modules/points/points.php',
	'modules/points/points-admin.php',
	'modules/reactions/reactions.php',
	'modules/notifications/notifications.php',
	'modules/community/community.php',
	'modules/community/community-template.php',
);

foreach ( $pringomart_modules as $pringomart_module ) {
	pringomart_require( $pringomart_module );
}

/* ----------------------------------------------------------------------
 * Admin panel (only needed in wp-admin, but harmless to load either way
 * since each file guards its own hooks with is_admin() checks)
 * -------------------------------------------------------------------- */
$pringomart_admin_includes = array(
	'admin/admin-menu.php',
	'admin/admin-points.php',
	'admin/admin-reactions.php',
	'admin/admin-community.php',
);

foreach ( $pringomart_admin_includes as $pringomart_admin_file ) {
	pringomart_require( $pringomart_admin_file );
}

/* ----------------------------------------------------------------------
 * Load the theme textdomain for translations (Bengali included).
 * -------------------------------------------------------------------- */
function pringomart_load_textdomain() {
	load_theme_textdomain( 'pringomart', PRINGOMART_DIR . '/languages' );
}
add_action( 'after_setup_theme', 'pringomart_load_textdomain' );
