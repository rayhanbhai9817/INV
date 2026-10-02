<?php
/**
 * Shared helper/utility functions used across the theme and modules.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Bengali-aware "time ago" string (e.g. "২ ঘন্টা আগে").
 *
 * @param string $datetime MySQL datetime or any strtotime()-parsable string.
 * @return string
 */
function pringomart_time_ago( $datetime ) {
	$timestamp = is_numeric( $datetime ) ? (int) $datetime : strtotime( $datetime );

	if ( ! $timestamp ) {
		return '';
	}

	$diff = current_time( 'timestamp' ) - $timestamp;

	if ( $diff < 60 ) {
		return __( 'এইমাত্র', 'pringomart' );
	}

	$units = array(
		YEAR_IN_SECONDS   => __( 'বছর', 'pringomart' ),
		MONTH_IN_SECONDS  => __( 'মাস', 'pringomart' ),
		WEEK_IN_SECONDS   => __( 'সপ্তাহ', 'pringomart' ),
		DAY_IN_SECONDS    => __( 'দিন', 'pringomart' ),
		HOUR_IN_SECONDS   => __( 'ঘন্টা', 'pringomart' ),
		MINUTE_IN_SECONDS => __( 'মিনিট', 'pringomart' ),
	);

	foreach ( $units as $seconds => $label ) {
		$count = floor( $diff / $seconds );
		if ( $count >= 1 ) {
			/* translators: 1: number of units, 2: unit label (year/month/day/etc). */
			return sprintf( __( '%1$s %2$s আগে', 'pringomart' ), pringomart_to_bengali_number( $count ), $label );
		}
	}

	return __( 'এইমাত্র', 'pringomart' );
}

/**
 * Convert English digits in a number to Bengali digits.
 *
 * @param int|string $number Number to convert.
 * @return string
 */
function pringomart_to_bengali_number( $number ) {
	$english = array( '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' );
	$bengali = array( '০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯' );

	return str_replace( $english, $bengali, (string) $number );
}

/**
 * Format large numbers as 1.2K / 1.2M, with Bengali digit option.
 *
 * @param int  $number   Raw number.
 * @param bool $bengali  Whether to render digits in Bengali.
 * @return string
 */
function pringomart_format_number( $number, $bengali = false ) {
	$number = (int) $number;

	if ( $number >= 1000000 ) {
		$formatted = round( $number / 1000000, 1 ) . 'M';
	} elseif ( $number >= 1000 ) {
		$formatted = round( $number / 1000, 1 ) . 'K';
	} else {
		$formatted = (string) $number;
	}

	return $bengali ? pringomart_to_bengali_number( $formatted ) : $formatted;
}

/**
 * Get a user's avatar URL, falling back to the theme default avatar.
 *
 * @param int $user_id User ID.
 * @param int $size    Avatar size in pixels.
 * @return string
 */
function pringomart_get_avatar_url( $user_id, $size = 48 ) {
	$avatar_url = get_avatar_url(
		$user_id,
		array(
			'size'    => $size,
			'default' => PRINGOMART_URI . '/assets/images/default-avatar.png',
		)
	);

	return $avatar_url ? $avatar_url : PRINGOMART_URI . '/assets/images/default-avatar.png';
}

/**
 * Estimate reading time in minutes for Bengali content (~200 wpm) and
 * cache it as post meta.
 *
 * @param int $post_id Post ID.
 * @return int Minutes.
 */
function pringomart_get_reading_time( $post_id ) {
	$cached = get_post_meta( $post_id, '_pringomart_reading_time', true );

	if ( '' !== $cached ) {
		return (int) $cached;
	}

	$content    = get_post_field( 'post_content', $post_id );
	$word_count = str_word_count( wp_strip_all_tags( $content ) );
	$minutes    = max( 1, (int) ceil( $word_count / 200 ) );

	update_post_meta( $post_id, '_pringomart_reading_time', $minutes );

	return $minutes;
}

/**
 * Recalculate and store reading time whenever a post is saved.
 */
function pringomart_save_reading_time( $post_id ) {
	if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
		return;
	}

	if ( 'post' !== get_post_type( $post_id ) ) {
		return;
	}

	delete_post_meta( $post_id, '_pringomart_reading_time' );
	pringomart_get_reading_time( $post_id );
}
add_action( 'save_post', 'pringomart_save_reading_time' );

/**
 * Check whether a given Pringomart module is enabled via Customizer/options.
 *
 * @param string $module Module key (reactions, points, view_counter, notifications, online_users, post_approval, registration_open).
 * @return bool
 */
function pringomart_is_module_enabled( $module ) {
	$settings = get_option( 'pringomart_module_settings', array() );
	return ! empty( $settings[ $module ] );
}

/**
 * Get the current visitor's IP address (handles common proxy headers).
 *
 * @return string
 */
function pringomart_get_client_ip() {
	$keys = array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' );

	foreach ( $keys as $key ) {
		if ( ! empty( $_SERVER[ $key ] ) ) {
			$ip = sanitize_text_field( wp_unslash( $_SERVER[ $key ] ) );
			$ip = trim( explode( ',', $ip )[0] );
			if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
				return $ip;
			}
		}
	}

	return '0.0.0.0';
}

/**
 * Render a user's rank badge emoji + label, e.g. "🥇 Gold".
 *
 * Declared here as a thin wrapper so templates can call it even before
 * the points module loads; the real calculation lives in points.php.
 *
 * @param int $user_id User ID.
 * @return string Escaped HTML-safe string.
 */
function pringomart_render_rank_badge( $user_id ) {
	if ( ! function_exists( 'pringomart_get_rank' ) ) {
		return '';
	}

	$rank = pringomart_get_rank( $user_id );

	if ( empty( $rank ) ) {
		return '';
	}

	return sprintf(
		'<span class="pringomart-rank-badge" title="%s">%s %s</span>',
		esc_attr( $rank['label'] ),
		esc_html( $rank['badge'] ),
		esc_html( $rank['label'] )
	);
}
