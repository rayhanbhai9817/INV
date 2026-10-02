<?php
/**
 * Reusable user avatar with optional online-status dot and rank badge.
 *
 * Expected $args:
 *   user_id       (int)    required
 *   size          (int)    avatar pixel size, default 40
 *   show_online   (bool)   show the green online dot, default false
 *   show_rank     (bool)   show the rank badge next to the avatar, default false
 *   link          (bool)   wrap in a link to the author's archive, default true
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$user_id     = isset( $args['user_id'] ) ? (int) $args['user_id'] : 0;
$size        = isset( $args['size'] ) ? (int) $args['size'] : 40;
$show_online = ! empty( $args['show_online'] );
$show_rank   = ! empty( $args['show_rank'] );
$link        = ! isset( $args['link'] ) || $args['link'];

if ( ! $user_id ) {
	return;
}

$avatar_html  = '<span class="pringomart-avatar-wrap">';
$avatar_html .= '<img src="' . esc_url( pringomart_get_avatar_url( $user_id, $size ) ) . '" class="pringomart-avatar" width="' . esc_attr( $size ) . '" height="' . esc_attr( $size ) . '" alt="" />';

if ( $show_online && function_exists( 'pringomart_is_online' ) && pringomart_is_online( $user_id ) ) {
	$avatar_html .= '<span class="pringomart-online-dot" title="' . esc_attr__( 'অনলাইন', 'pringomart' ) . '"></span>';
}

$avatar_html .= '</span>';

if ( $link ) {
	printf( '<a href="%s" class="pringomart-user-avatar-link">%s</a>', esc_url( get_author_posts_url( $user_id ) ), $avatar_html ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built from escaped parts above.
} else {
	echo $avatar_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built from escaped parts above.
}

if ( $show_rank ) {
	echo pringomart_render_rank_badge( $user_id ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped internally.
}
