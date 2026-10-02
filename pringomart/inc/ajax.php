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
 * AJAX: toggle a like on a post. Meta key: _pringomart_likes (user ID array).
 */
function pringomart_ajax_toggle_like() {
	check_ajax_referer( 'pringomart_nonce', 'nonce' );

	if ( ! is_user_logged_in() ) {
		wp_send_json_error( array( 'message' => __( 'লাইক করতে লগইন করুন।', 'pringomart' ) ), 403 );
	}

	$post_id = isset( $_POST['post_id'] ) ? (int) $_POST['post_id'] : 0;
	$user_id = get_current_user_id();

	if ( ! $post_id || 'post' !== get_post_type( $post_id ) ) {
		wp_send_json_error( array( 'message' => __( 'পোস্ট পাওয়া যায়নি।', 'pringomart' ) ), 404 );
	}

	$likes = get_post_meta( $post_id, '_pringomart_likes', true );
	$likes = is_array( $likes ) ? $likes : array();
	$liked = in_array( $user_id, $likes, true );

	if ( $liked ) {
		$likes = array_diff( $likes, array( $user_id ) );
	} else {
		$likes[] = $user_id;

		$author_id = (int) get_post_field( 'post_author', $post_id );
		if ( $author_id && $author_id !== $user_id ) {
			if ( function_exists( 'pringomart_add_points' ) ) {
				pringomart_add_points( $author_id, 'receive_like', $post_id, __( 'পোস্টে লাইক পাওয়ার জন্য', 'pringomart' ) );
			}
			if ( function_exists( 'pringomart_notify' ) ) {
				pringomart_notify(
					$author_id,
					'post_like',
					array(
						'title'   => __( 'নতুন লাইক', 'pringomart' ),
						'message' => sprintf(
							/* translators: %s: liking user's display name. */
							__( '%s আপনার পোস্ট লাইক করেছেন।', 'pringomart' ),
							get_the_author_meta( 'display_name', $user_id )
						),
						'url'     => get_permalink( $post_id ),
					)
				);
			}
		}
	}

	update_post_meta( $post_id, '_pringomart_likes', array_values( array_unique( $likes ) ) );

	wp_send_json_success(
		array(
			'liked' => ! $liked,
			'count' => count( $likes ),
		)
	);
}
add_action( 'wp_ajax_pringomart_toggle_like', 'pringomart_ajax_toggle_like' );

/**
 * AJAX: toggle a bookmark. User meta key: _pringomart_bookmarks.
 */
function pringomart_ajax_toggle_bookmark() {
	check_ajax_referer( 'pringomart_nonce', 'nonce' );

	if ( ! is_user_logged_in() ) {
		wp_send_json_error( array( 'message' => __( 'বুকমার্ক করতে লগইন করুন।', 'pringomart' ) ), 403 );
	}

	$post_id = isset( $_POST['post_id'] ) ? (int) $_POST['post_id'] : 0;
	$user_id = get_current_user_id();

	if ( ! $post_id || 'post' !== get_post_type( $post_id ) ) {
		wp_send_json_error( array( 'message' => __( 'পোস্ট পাওয়া যায়নি।', 'pringomart' ) ), 404 );
	}

	$bookmarks   = get_user_meta( $user_id, '_pringomart_bookmarks', true );
	$bookmarks   = is_array( $bookmarks ) ? $bookmarks : array();
	$bookmarked  = in_array( $post_id, $bookmarks, true );

	if ( $bookmarked ) {
		$bookmarks = array_diff( $bookmarks, array( $post_id ) );
	} else {
		$bookmarks[] = $post_id;
	}

	update_user_meta( $user_id, '_pringomart_bookmarks', array_values( array_unique( $bookmarks ) ) );

	wp_send_json_success( array( 'bookmarked' => ! $bookmarked ) );
}
add_action( 'wp_ajax_pringomart_toggle_bookmark', 'pringomart_ajax_toggle_bookmark' );

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
