<?php
/**
 * The default sidebar template.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! get_theme_mod( 'pringomart_show_sidebar', true ) ) {
	return;
}
?>
<aside class="pringomart-sidebar">

	<?php if ( get_theme_mod( 'pringomart_header_ad_enabled' ) && get_theme_mod( 'pringomart_header_ad_code' ) ) : ?>
		<div class="pringomart-sidebar-widget pringomart-ad-slot">
			<?php echo wp_kses_post( get_theme_mod( 'pringomart_header_ad_code' ) ); ?>
		</div>
	<?php endif; ?>

	<?php if ( function_exists( 'pringomart_get_leaderboard' ) && pringomart_is_module_enabled( 'points' ) ) : ?>
		<div class="pringomart-sidebar-widget">
			<h3>🏆 <?php esc_html_e( 'টপ কন্ট্রিবিউটরস', 'pringomart' ); ?></h3>
			<ul class="pringomart-leaderboard-list">
				<?php foreach ( pringomart_get_leaderboard( 5 ) as $index => $leader ) : ?>
					<li>
						<span class="rank-position">#<?php echo esc_html( $index + 1 ); ?></span>
						<img src="<?php echo esc_url( pringomart_get_avatar_url( $leader->user_id, 32 ) ); ?>" class="pringomart-avatar" alt="" />
						<span class="name"><?php echo esc_html( get_the_author_meta( 'display_name', $leader->user_id ) ); ?></span>
						<?php echo pringomart_render_rank_badge( $leader->user_id ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped internally. ?>
					</li>
				<?php endforeach; ?>
			</ul>
		</div>
	<?php endif; ?>

	<?php if ( function_exists( 'pringomart_get_popular_posts' ) && pringomart_is_module_enabled( 'view_counter' ) ) : ?>
		<div class="pringomart-sidebar-widget">
			<h3>🔥 <?php esc_html_e( 'সপ্তাহের জনপ্রিয়', 'pringomart' ); ?></h3>
			<ul class="pringomart-popular-list">
				<?php foreach ( pringomart_get_popular_posts( 7, 5 ) as $popular_post ) : ?>
					<li>
						<a href="<?php echo esc_url( get_permalink( $popular_post->ID ) ); ?>">
							<?php echo esc_html( wp_trim_words( get_the_title( $popular_post->ID ), 8 ) ); ?>
						</a>
						<span class="views">👁 <?php echo esc_html( pringomart_format_number( pringomart_get_views( $popular_post->ID ), true ) ); ?></span>
					</li>
				<?php endforeach; ?>
			</ul>
		</div>
	<?php endif; ?>

	<div class="pringomart-sidebar-widget">
		<h3>📁 <?php esc_html_e( 'ক্যাটাগরি', 'pringomart' ); ?></h3>
		<ul class="pringomart-category-list">
			<?php foreach ( get_categories( array( 'hide_empty' => true, 'number' => 10 ) ) as $category ) : ?>
				<li>
					<a href="<?php echo esc_url( get_category_link( $category->term_id ) ); ?>">
						<?php echo esc_html( $category->name ); ?>
						<span class="count">(<?php echo esc_html( pringomart_to_bengali_number( $category->count ) ); ?>)</span>
					</a>
				</li>
			<?php endforeach; ?>
		</ul>
	</div>

	<?php if ( get_theme_mod( 'pringomart_sidebar_ad_enabled' ) && get_theme_mod( 'pringomart_sidebar_ad_code' ) ) : ?>
		<div class="pringomart-sidebar-widget pringomart-ad-slot">
			<?php echo wp_kses_post( get_theme_mod( 'pringomart_sidebar_ad_code' ) ); ?>
		</div>
	<?php endif; ?>

	<?php if ( function_exists( 'pringomart_online_count' ) && pringomart_is_module_enabled( 'online_users' ) ) : ?>
		<div class="pringomart-sidebar-widget pringomart-online-widget">
			🟢 <strong><?php echo esc_html( pringomart_to_bengali_number( pringomart_online_count() ) ); ?></strong> <?php esc_html_e( 'জন অনলাইন', 'pringomart' ); ?>
		</div>
	<?php endif; ?>

	<?php if ( is_active_sidebar( 'pringomart-sidebar' ) ) : ?>
		<?php dynamic_sidebar( 'pringomart-sidebar' ); ?>
	<?php endif; ?>
</aside>
