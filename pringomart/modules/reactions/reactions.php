<?php
/**
 * Reaction system — love/fire/wow/haha/sad reactions on posts.
 *
 * Table: wp_pringomart_reactions (post_id, user_id, reaction_type, created_at)
 * Unique (post_id, user_id) — one reaction per user per post; switching
 * reaction type updates the existing row instead of inserting a new one.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PRINGOMART_REACTION_TYPES', array( 'love', 'fire', 'wow', 'haha', 'sad' ) );

/**
 * Add or switch a user's reaction on a post.
 *
 * @param int    $post_id Post ID.
 * @param int    $user_id User ID.
 * @param string $type    One of PRINGOMART_REACTION_TYPES.
 * @return bool
 */
function pringomart_add_reaction( $post_id, $user_id, $type ) {
	global $wpdb;

	if ( ! in_array( $type, PRINGOMART_REACTION_TYPES, true ) ) {
		return false;
	}

	$table    = $wpdb->prefix . 'pringomart_reactions';
	$existing = $wpdb->get_row( $wpdb->prepare( "SELECT id, reaction_type FROM {$table} WHERE post_id = %d AND user_id = %d", $post_id, $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name only.

	if ( $existing ) {
		if ( $existing->reaction_type === $type ) {
			return true; // No change.
		}

		$wpdb->update(
			$table,
			array(
				'reaction_type' => $type,
				'created_at'    => current_time( 'mysql' ),
			),
			array( 'id' => $existing->id ),
			array( '%s', '%s' ),
			array( '%d' )
		);

		return true;
	}

	$inserted = $wpdb->insert(
		$table,
		array(
			'post_id'       => $post_id,
			'user_id'       => $user_id,
			'reaction_type' => $type,
			'created_at'    => current_time( 'mysql' ),
		),
		array( '%d', '%d', '%s', '%s' )
	);

	if ( $inserted ) {
		/**
		 * Fires when a brand new reaction is added (not when switching type).
		 *
		 * @param int    $post_id Post ID.
		 * @param int    $user_id Reacting user ID.
		 * @param string $type    Reaction type.
		 */
		do_action( 'pringomart_reaction_added', $post_id, $user_id, $type );
	}

	return (bool) $inserted;
}

/**
 * Remove a user's reaction on a post.
 *
 * @param int $post_id Post ID.
 * @param int $user_id User ID.
 * @return bool
 */
function pringomart_remove_reaction( $post_id, $user_id ) {
	global $wpdb;

	$table   = $wpdb->prefix . 'pringomart_reactions';
	$deleted = $wpdb->delete( $table, array( 'post_id' => $post_id, 'user_id' => $user_id ), array( '%d', '%d' ) );

	return (bool) $deleted;
}

/**
 * Get reaction counts for a post, keyed by type (zero-filled).
 *
 * @param int $post_id Post ID.
 * @return array<string,int>
 */
function pringomart_get_reactions( $post_id ) {
	global $wpdb;

	$cache_key = 'pringomart_reactions_' . $post_id;
	$cached    = wp_cache_get( $cache_key, 'pringomart' );

	if ( false !== $cached ) {
		return $cached;
	}

	$table   = $wpdb->prefix . 'pringomart_reactions';
	$rows    = $wpdb->get_results( $wpdb->prepare( "SELECT reaction_type, COUNT(*) as total FROM {$table} WHERE post_id = %d GROUP BY reaction_type", $post_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name only.

	$counts = array_fill_keys( PRINGOMART_REACTION_TYPES, 0 );

	foreach ( $rows as $row ) {
		if ( isset( $counts[ $row->reaction_type ] ) ) {
			$counts[ $row->reaction_type ] = (int) $row->total;
		}
	}

	wp_cache_set( $cache_key, $counts, 'pringomart', 300 );

	return $counts;
}

/**
 * Get the current user's reaction type on a post, or '' if none.
 *
 * @param int $post_id Post ID.
 * @param int $user_id User ID.
 * @return string
 */
function pringomart_get_user_reaction( $post_id, $user_id ) {
	global $wpdb;

	if ( ! $user_id ) {
		return '';
	}

	$table = $wpdb->prefix . 'pringomart_reactions';
	$type  = $wpdb->get_var( $wpdb->prepare( "SELECT reaction_type FROM {$table} WHERE post_id = %d AND user_id = %d", $post_id, $user_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name only.

	return $type ? $type : '';
}

/**
 * Invalidate the cached reaction counts for a post.
 *
 * @param int $post_id Post ID.
 */
function pringomart_clear_reactions_cache( $post_id ) {
	wp_cache_delete( 'pringomart_reactions_' . $post_id, 'pringomart' );
}
add_action( 'pringomart_reaction_added', 'pringomart_clear_reactions_cache' );
add_action( 'pringomart_reaction_removed', 'pringomart_clear_reactions_cache' );

/**
 * AJAX: toggle/switch a reaction. Guests are rejected (login required).
 *
 * POST: nonce, post_id, reaction_type ('' to remove)
 */
function pringomart_ajax_react() {
	check_ajax_referer( 'pringomart_nonce', 'nonce' );

	if ( ! is_user_logged_in() ) {
		wp_send_json_error( array( 'message' => __( 'রিয়েকশন দিতে লগইন করুন।', 'pringomart' ) ), 403 );
	}

	if ( ! pringomart_is_module_enabled( 'reactions' ) ) {
		wp_send_json_error( array( 'message' => __( 'রিয়েকশন সিস্টেম বন্ধ রয়েছে।', 'pringomart' ) ), 403 );
	}

	$post_id = isset( $_POST['post_id'] ) ? (int) $_POST['post_id'] : 0;
	$type    = isset( $_POST['reaction_type'] ) ? sanitize_text_field( wp_unslash( $_POST['reaction_type'] ) ) : '';
	$user_id = get_current_user_id();

	if ( ! $post_id || 'post' !== get_post_type( $post_id ) ) {
		wp_send_json_error( array( 'message' => __( 'পোস্ট পাওয়া যায়নি।', 'pringomart' ) ), 404 );
	}

	$current = pringomart_get_user_reaction( $post_id, $user_id );

	if ( '' === $type || $current === $type ) {
		// Empty type, or clicking the same reaction again, removes it.
		pringomart_remove_reaction( $post_id, $user_id );
		do_action( 'pringomart_reaction_removed', $post_id );
		$user_reaction = '';
	} else {
		pringomart_add_reaction( $post_id, $user_id, $type );
		pringomart_clear_reactions_cache( $post_id );
		$user_reaction = $type;
	}

	wp_send_json_success(
		array(
			'counts'       => pringomart_get_reactions( $post_id ),
			'userReaction' => $user_reaction,
		)
	);
}
add_action( 'wp_ajax_pringomart_react', 'pringomart_ajax_react' );
add_action( 'wp_ajax_nopriv_pringomart_react', 'pringomart_ajax_react' );

/**
 * Award the post author points + a notification when someone reacts.
 *
 * @param int    $post_id Post ID.
 * @param int    $user_id Reacting user ID.
 * @param string $type    Reaction type.
 */
function pringomart_handle_reaction_added( $post_id, $user_id, $type ) {
	$author_id = (int) get_post_field( 'post_author', $post_id );

	if ( ! $author_id || $author_id === $user_id ) {
		return; // Don't reward self-reactions.
	}

	if ( function_exists( 'pringomart_add_points' ) ) {
		pringomart_add_points( $author_id, 'receive_reaction', $post_id, __( 'পোস্টে রিয়েকশন পাওয়ার জন্য', 'pringomart' ) );
	}

	if ( function_exists( 'pringomart_notify' ) ) {
		pringomart_notify(
			$author_id,
			'post_reaction',
			array(
				'title'   => __( 'নতুন রিয়েকশন', 'pringomart' ),
				'message' => sprintf(
					/* translators: %s: reacting user's display name. */
					__( '%s আপনার পোস্টে রিয়েকশন দিয়েছেন।', 'pringomart' ),
					get_the_author_meta( 'display_name', $user_id )
				),
				'url'     => get_permalink( $post_id ),
			)
		);
	}
}
add_action( 'pringomart_reaction_added', 'pringomart_handle_reaction_added', 10, 3 );
