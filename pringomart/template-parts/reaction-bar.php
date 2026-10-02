<?php
/**
 * Reaction bar — love/fire/wow/haha/sad reactions + like + share.
 * Degrades gracefully (renders disabled buttons) until the reactions
 * module (Step 7) is active.
 *
 * Expected $args: post_id (int)
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$post_id = isset( $args['post_id'] ) ? (int) $args['post_id'] : get_the_ID();

if ( ! $post_id ) {
	return;
}

$reaction_types = array(
	'love' => '❤️',
	'fire' => '🔥',
	'wow'  => '😮',
	'haha' => '😂',
	'sad'  => '😢',
);

$reactions_enabled = function_exists( 'pringomart_get_reactions' ) && pringomart_is_module_enabled( 'reactions' );
$counts             = $reactions_enabled ? pringomart_get_reactions( $post_id ) : array_fill_keys( array_keys( $reaction_types ), 0 );
$user_reaction      = ( $reactions_enabled && is_user_logged_in() && function_exists( 'pringomart_get_user_reaction' ) )
	? pringomart_get_user_reaction( $post_id, get_current_user_id() )
	: '';

$likes      = get_post_meta( $post_id, '_pringomart_likes', true );
$likes      = is_array( $likes ) ? $likes : array();
$like_count = count( $likes );
$user_liked = is_user_logged_in() && in_array( get_current_user_id(), $likes, true );
?>
<div class="pringomart-reaction-bar" data-post-id="<?php echo esc_attr( $post_id ); ?>">

	<div class="pringomart-reactions" role="group" aria-label="<?php esc_attr_e( 'রিয়েকশন', 'pringomart' ); ?>">
		<?php foreach ( $reaction_types as $type => $emoji ) : ?>
			<button
				type="button"
				class="pringomart-reaction-btn <?php echo $user_reaction === $type ? 'is-active' : ''; ?>"
				data-reaction-type="<?php echo esc_attr( $type ); ?>"
				<?php disabled( ! $reactions_enabled ); ?>
			>
				<span class="emoji"><?php echo esc_html( $emoji ); ?></span>
				<span class="count"><?php echo esc_html( pringomart_to_bengali_number( isset( $counts[ $type ] ) ? $counts[ $type ] : 0 ) ); ?></span>
			</button>
		<?php endforeach; ?>
	</div>

	<div class="pringomart-post-actions">
		<button type="button" class="pringomart-like-btn <?php echo $user_liked ? 'is-active' : ''; ?>" data-post-id="<?php echo esc_attr( $post_id ); ?>">
			❤️ <span class="pringomart-like-count"><?php echo esc_html( pringomart_to_bengali_number( $like_count ) ); ?></span>
		</button>

		<button type="button" class="pringomart-bookmark-btn" data-post-id="<?php echo esc_attr( $post_id ); ?>" aria-label="<?php esc_attr_e( 'বুকমার্ক', 'pringomart' ); ?>">
			🔖
		</button>

		<button type="button" class="pringomart-share-btn" data-url="<?php echo esc_url( get_permalink( $post_id ) ); ?>" data-title="<?php echo esc_attr( get_the_title( $post_id ) ); ?>">
			📤 <?php esc_html_e( 'শেয়ার', 'pringomart' ); ?>
		</button>
	</div>
</div>
