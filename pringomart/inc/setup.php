<?php
/**
 * Theme setup: supports, menus, image sizes, and activation routine
 * that creates all wp_pringomart_* database tables and default pages.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ----------------------------------------------------------------------
 * Basic theme supports / registrations
 * -------------------------------------------------------------------- */
function pringomart_theme_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'script', 'style' ) );
	add_theme_support( 'customize-selective-refresh-widgets' );
	add_theme_support(
		'custom-logo',
		array(
			'height'      => 60,
			'width'       => 200,
			'flex-height' => true,
			'flex-width'  => true,
		)
	);

	set_post_thumbnail_size( 640, 360, true );
	add_image_size( 'pringomart-card', 400, 225, true );
	add_image_size( 'pringomart-slider', 1200, 600, true );

	register_nav_menus(
		array(
			'primary' => __( 'Primary Menu', 'pringomart' ),
			'footer'  => __( 'Footer Menu', 'pringomart' ),
		)
	);
}
add_action( 'after_setup_theme', 'pringomart_theme_setup' );

/* ----------------------------------------------------------------------
 * Database schema
 *
 * All custom tables are created/updated via dbDelta so re-running the
 * routine (e.g. after a theme update) safely applies schema changes.
 * -------------------------------------------------------------------- */
function pringomart_get_db_schema() {
	global $wpdb;

	$charset_collate = $wpdb->get_charset_collate();
	$prefix           = $wpdb->prefix . 'pringomart_';

	$schema = array();

	$schema['reactions'] = "CREATE TABLE {$prefix}reactions (
		id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
		post_id BIGINT UNSIGNED NOT NULL,
		user_id BIGINT UNSIGNED NOT NULL,
		reaction_type VARCHAR(20) NOT NULL,
		created_at DATETIME NOT NULL,
		PRIMARY KEY  (id),
		UNIQUE KEY post_user (post_id, user_id),
		KEY post_id (post_id),
		KEY user_id (user_id)
	) {$charset_collate};";

	$schema['views'] = "CREATE TABLE {$prefix}views (
		id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
		post_id BIGINT UNSIGNED NOT NULL,
		user_id BIGINT UNSIGNED NULL,
		ip_address VARCHAR(45) NOT NULL,
		viewed_at DATETIME NOT NULL,
		PRIMARY KEY  (id),
		KEY post_id (post_id),
		KEY viewed_at (viewed_at)
	) {$charset_collate};";

	$schema['points'] = "CREATE TABLE {$prefix}points (
		id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
		user_id BIGINT UNSIGNED NOT NULL,
		points INT NOT NULL,
		action VARCHAR(50) NOT NULL,
		description VARCHAR(255) NULL,
		post_id BIGINT UNSIGNED NULL,
		created_at DATETIME NOT NULL,
		PRIMARY KEY  (id),
		KEY user_id (user_id)
	) {$charset_collate};";

	$schema['follows'] = "CREATE TABLE {$prefix}follows (
		id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
		follower_id BIGINT UNSIGNED NOT NULL,
		following_id BIGINT UNSIGNED NOT NULL,
		created_at DATETIME NOT NULL,
		PRIMARY KEY  (id),
		UNIQUE KEY follower_following (follower_id, following_id),
		KEY following_id (following_id)
	) {$charset_collate};";

	$schema['notifications'] = "CREATE TABLE {$prefix}notifications (
		id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
		user_id BIGINT UNSIGNED NOT NULL,
		type VARCHAR(50) NOT NULL,
		title VARCHAR(255) NOT NULL,
		message TEXT NULL,
		url VARCHAR(255) NULL,
		is_read TINYINT(1) NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL,
		PRIMARY KEY  (id),
		KEY user_id_is_read (user_id, is_read)
	) {$charset_collate};";

	$schema['questions'] = "CREATE TABLE {$prefix}questions (
		id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
		user_id BIGINT UNSIGNED NOT NULL,
		title VARCHAR(255) NOT NULL,
		slug VARCHAR(255) NOT NULL,
		body LONGTEXT NOT NULL,
		tags VARCHAR(255) NULL,
		status VARCHAR(20) NOT NULL DEFAULT 'open',
		vote_count INT NOT NULL DEFAULT 0,
		view_count INT NOT NULL DEFAULT 0,
		answer_count INT NOT NULL DEFAULT 0,
		is_pinned TINYINT(1) NOT NULL DEFAULT 0,
		solved_at DATETIME NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		PRIMARY KEY  (id),
		UNIQUE KEY slug (slug),
		KEY user_id (user_id),
		KEY status (status)
	) {$charset_collate};";

	$schema['answers'] = "CREATE TABLE {$prefix}answers (
		id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
		question_id BIGINT UNSIGNED NOT NULL,
		user_id BIGINT UNSIGNED NOT NULL,
		body LONGTEXT NOT NULL,
		vote_count INT NOT NULL DEFAULT 0,
		is_best_answer TINYINT(1) NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		PRIMARY KEY  (id),
		KEY question_id (question_id),
		KEY user_id (user_id)
	) {$charset_collate};";

	$schema['votes'] = "CREATE TABLE {$prefix}votes (
		id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
		user_id BIGINT UNSIGNED NOT NULL,
		voteable_type VARCHAR(20) NOT NULL,
		voteable_id BIGINT UNSIGNED NOT NULL,
		vote_type TINYINT(1) NOT NULL,
		created_at DATETIME NOT NULL,
		PRIMARY KEY  (id),
		UNIQUE KEY user_voteable (user_id, voteable_type, voteable_id),
		KEY voteable (voteable_type, voteable_id)
	) {$charset_collate};";

	return $schema;
}

/**
 * Run dbDelta against every table in the schema.
 */
function pringomart_create_tables() {
	require_once ABSPATH . 'wp-admin/includes/upgrade.php';

	foreach ( pringomart_get_db_schema() as $sql ) {
		dbDelta( $sql );
	}
}

/* ----------------------------------------------------------------------
 * Default option values (point rules, rank levels, module toggles)
 * -------------------------------------------------------------------- */
function pringomart_set_default_options() {
	if ( false === get_option( 'pringomart_point_rules' ) ) {
		update_option(
			'pringomart_point_rules',
			array(
				'publish_post'     => 10,
				'post_approved'    => 5,
				'write_comment'    => 2,
				'receive_like'     => 1,
				'receive_reaction' => 1,
				'daily_login'      => 1,
				'best_answer'      => 15,
				'refer_user'       => 20,
			)
		);
	}

	if ( false === get_option( 'pringomart_rank_levels' ) ) {
		update_option(
			'pringomart_rank_levels',
			array(
				'beginner' => array(
					'label' => __( 'Beginner', 'pringomart' ),
					'min'   => 0,
					'max'   => 99,
					'badge' => '⚪',
				),
				'bronze'   => array(
					'label' => __( 'Bronze', 'pringomart' ),
					'min'   => 100,
					'max'   => 499,
					'badge' => '🥉',
				),
				'silver'   => array(
					'label' => __( 'Silver', 'pringomart' ),
					'min'   => 500,
					'max'   => 999,
					'badge' => '🥈',
				),
				'gold'     => array(
					'label' => __( 'Gold', 'pringomart' ),
					'min'   => 1000,
					'max'   => 4999,
					'badge' => '🥇',
				),
				'diamond'  => array(
					'label' => __( 'Diamond', 'pringomart' ),
					'min'   => 5000,
					'max'   => null,
					'badge' => '💎',
				),
			)
		);
	}

	if ( false === get_option( 'pringomart_module_settings' ) ) {
		update_option(
			'pringomart_module_settings',
			array(
				'reactions'          => 1,
				'points'             => 1,
				'view_counter'       => 1,
				'notifications'      => 1,
				'online_users'       => 1,
				'post_approval'      => 0,
				'registration_open'  => 1,
			)
		);
	}
}

/* ----------------------------------------------------------------------
 * Default pages: Community + Leaderboard
 * -------------------------------------------------------------------- */
function pringomart_create_default_pages() {
	$pages = array(
		'community'   => array(
			'title'    => __( 'Community', 'pringomart' ),
			'template' => 'templates/template-community.php',
			'option'   => 'pringomart_community_page_id',
		),
		'leaderboard' => array(
			'title'    => __( 'Leaderboard', 'pringomart' ),
			'template' => 'templates/template-leaderboard.php',
			'option'   => 'pringomart_leaderboard_page_id',
		),
	);

	foreach ( $pages as $slug => $data ) {
		$existing_id = get_option( $data['option'] );

		if ( $existing_id && get_post( $existing_id ) ) {
			continue;
		}

		$page_id = wp_insert_post(
			array(
				'post_title'   => $data['title'],
				'post_name'    => $slug,
				'post_status'  => 'publish',
				'post_type'    => 'page',
				'post_content' => '',
			)
		);

		if ( $page_id && ! is_wp_error( $page_id ) ) {
			update_post_meta( $page_id, '_wp_page_template', $data['template'] );
			update_option( $data['option'], $page_id );
		}
	}
}

/* ----------------------------------------------------------------------
 * Theme activation routine
 * -------------------------------------------------------------------- */
function pringomart_activate() {
	pringomart_create_tables();
	pringomart_set_default_options();
	pringomart_create_default_pages();
	flush_rewrite_rules();
}
add_action( 'after_switch_theme', 'pringomart_activate' );
