<?php
/**
 * Shared front-end AJAX endpoints (live search, newsletter) that aren't
 * tied to a single module.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Live search — AJAX, min 3 chars, returns thumbnail/title/category/date.
 */
function pringomart_ajax_live_search() {
	check_ajax_referer( 'pringomart_nonce', 'nonce' );

	$query = isset( $_GET['query'] ) ? sanitize_text_field( wp_unslash( $_GET['query'] ) ) : '';

	if ( mb_strlen( $query ) < 3 ) {
		wp_send_json_success( array() );
	}

	$posts = get_posts(
		array(
			's'              => $query,
			'post_type'       => 'post',
			'post_status'     => 'publish',
			'posts_per_page'  => 8,
			'no_found_rows'   => true,
			'suppress_filters' => false,
		)
	);

	$results = array();

	foreach ( $posts as $found_post ) {
		$categories = get_the_category( $found_post->ID );

		$results[] = array(
			'url'       => get_permalink( $found_post ),
			'title'     => get_the_title( $found_post ),
			'thumbnail' => get_the_post_thumbnail_url( $found_post, 'thumbnail' ) ?: PRINGOMART_URI . '/assets/images/default-avatar.png',
			'category'  => ! empty( $categories ) ? esc_html( $categories[0]->name ) : '',
			'date'      => get_the_date( '', $found_post ),
		);
	}

	wp_send_json_success( $results );
}
add_action( 'wp_ajax_pringomart_live_search', 'pringomart_ajax_live_search' );
add_action( 'wp_ajax_nopriv_pringomart_live_search', 'pringomart_ajax_live_search' );

/**
 * Newsletter subscription — stores email in a simple option-based list.
 * (No external ESP wired up; swap pringomart_store_newsletter_email()
 * for a real provider integration later if needed.)
 */
function pringomart_handle_newsletter_submit() {
	if ( empty( $_POST['pringomart_newsletter_email'] ) || empty( $_POST['pringomart_newsletter_nonce'] ) ) {
		return;
	}

	if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['pringomart_newsletter_nonce'] ) ), 'pringomart_newsletter' ) ) {
		return;
	}

	$email = sanitize_email( wp_unslash( $_POST['pringomart_newsletter_email'] ) );

	if ( ! is_email( $email ) ) {
		return;
	}

	$subscribers = get_option( 'pringomart_newsletter_subscribers', array() );

	if ( ! in_array( $email, $subscribers, true ) ) {
		$subscribers[] = $email;
		update_option( 'pringomart_newsletter_subscribers', $subscribers );
	}
}
add_action( 'init', 'pringomart_handle_newsletter_submit' );
