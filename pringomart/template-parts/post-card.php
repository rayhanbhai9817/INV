<?php
/**
 * Post card template part — standard (large) size.
 * Full version with reactions/views/author meta lands with Step 4/5.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$categories = get_the_category();
?>
<article <?php post_class( 'pringomart-card' ); ?>>
	<a href="<?php the_permalink(); ?>" class="pringomart-card-thumb">
		<?php if ( has_post_thumbnail() ) : ?>
			<?php the_post_thumbnail( 'pringomart-card' ); ?>
		<?php endif; ?>
		<?php if ( ! empty( $categories ) ) : ?>
			<span class="pringomart-category-badge"><?php echo esc_html( $categories[0]->name ); ?></span>
		<?php endif; ?>
	</a>
	<div class="pringomart-card-body">
		<h3 class="pringomart-card-title">
			<a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
		</h3>
		<div class="pringomart-card-meta">
			<img src="<?php echo esc_url( pringomart_get_avatar_url( get_the_author_meta( 'ID' ), 24 ) ); ?>" class="pringomart-avatar" alt="" width="24" height="24" />
			<span><?php the_author(); ?></span>
			<span>· <?php echo esc_html( pringomart_time_ago( get_the_date( 'Y-m-d H:i:s' ) ) ); ?></span>
		</div>
		<div class="pringomart-card-stats">
			<?php if ( function_exists( 'pringomart_get_views' ) ) : ?>
				<span>👁 <?php echo esc_html( pringomart_format_number( pringomart_get_views( get_the_ID() ), true ) ); ?></span>
			<?php endif; ?>
			<span>💬 <?php echo esc_html( pringomart_to_bengali_number( get_comments_number() ) ); ?></span>
			<?php if ( function_exists( 'pringomart_get_reactions' ) ) : ?>
				<span>❤️ <?php echo esc_html( pringomart_to_bengali_number( array_sum( pringomart_get_reactions( get_the_ID() ) ) ) ); ?></span>
			<?php endif; ?>
		</div>
	</div>
</article>
