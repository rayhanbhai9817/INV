<?php
/**
 * Widget area registration.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function pringomart_register_sidebars() {
	register_sidebar(
		array(
			'name'          => __( 'Primary Sidebar', 'pringomart' ),
			'id'            => 'pringomart-sidebar',
			'description'   => __( 'Appears below the built-in widgets on single posts, archives and the homepage.', 'pringomart' ),
			'before_widget' => '<div class="pringomart-sidebar-widget %2$s">',
			'after_widget'  => '</div>',
			'before_title'  => '<h3>',
			'after_title'   => '</h3>',
		)
	);

	register_sidebar(
		array(
			'name'          => __( 'Footer Widgets', 'pringomart' ),
			'id'            => 'pringomart-footer',
			'description'   => __( 'Optional extra footer widget area.', 'pringomart' ),
			'before_widget' => '<div class="pringomart-footer-widget %2$s">',
			'after_widget'  => '</div>',
			'before_title'  => '<h4>',
			'after_title'   => '</h4>',
		)
	);
}
add_action( 'widgets_init', 'pringomart_register_sidebars' );
