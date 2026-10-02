<?php
/**
 * Single post template.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

while ( have_posts() ) :
	the_post();

	$post_id    = get_the_ID();
	$author_id  = get_the_author_meta( 'ID' );
	$categories = get_the_category();
	$reading_time = pringomart_get_reading_time( $post_id );

	if ( function_exists( 'pringomart_count_view' ) ) {
		pringomart_count_view( $post_id );
	}
	?>

	<div class="pringomart-container pringomart-section">
		<div class="pringomart-layout has-sidebar">

			<main class="pringomart-content pringomart-single">

				<?php if ( get_theme_mod( 'pringomart_after_title_ad_enabled' ) && get_theme_mod( 'pringomart_after_title_ad_code' ) ) : ?>
					<div class="pringomart-ad-slot pringomart-ad-after-title">
						<?php echo wp_kses_post( get_theme_mod( 'pringomart_after_title_ad_code' ) ); ?>
					</div>
				<?php endif; ?>

				<article <?php post_class( 'pringomart-single-post' ); ?>>

					<?php if ( has_post_thumbnail() ) : ?>
						<div class="pringomart-single-thumb">
							<?php the_post_thumbnail( 'full' ); ?>
						</div>
					<?php endif; ?>

					<header class="pringomart-single-header">
						<?php if ( ! empty( $categories ) ) : ?>
							<a href="<?php echo esc_url( get_category_link( $categories[0]->term_id ) ); ?>" class="pringomart-category-badge pringomart-category-badge-static">
								<?php echo esc_html( $categories[0]->name ); ?>
							</a>
						<?php endif; ?>

						<h1 class="pringomart-single-title"><?php the_title(); ?></h1>

						<div class="pringomart-author-bar">
							<?php get_template_part( 'template-parts/user-avatar', null, array( 'user_id' => $author_id, 'size' => 44, 'show_online' => true, 'show_rank' => true ) ); ?>
							<div class="pringomart-author-bar-meta">
								<span class="pringomart-author-name">
									<a href="<?php echo esc_url( get_author_posts_url( $author_id ) ); ?>"><?php the_author(); ?></a>
								</span>
								<div class="pringomart-post-submeta">
									<span><?php echo esc_html( get_the_date() ); ?></span>
									<span>· <?php echo esc_html( sprintf( _n( '%s মিনিটের পড়া', '%s মিনিটের পড়া', $reading_time, 'pringomart' ), pringomart_to_bengali_number( $reading_time ) ) ); ?></span>
									<?php if ( function_exists( 'pringomart_get_views' ) ) : ?>
										<span>· 👁 <?php echo esc_html( pringomart_format_number( pringomart_get_views( $post_id ), true ) ); ?> <?php esc_html_e( 'বার দেখা হয়েছে', 'pringomart' ); ?></span>
									<?php endif; ?>
								</div>
							</div>
						</div>
					</header>

					<div class="pringomart-single-content">
						<?php the_content(); ?>
					</div>

					<?php if ( get_theme_mod( 'pringomart_after_content_ad_enabled' ) && get_theme_mod( 'pringomart_after_content_ad_code' ) ) : ?>
						<div class="pringomart-ad-slot pringomart-ad-after-content">
							<?php echo wp_kses_post( get_theme_mod( 'pringomart_after_content_ad_code' ) ); ?>
						</div>
					<?php endif; ?>

					<?php get_template_part( 'template-parts/reaction-bar', null, array( 'post_id' => $post_id ) ); ?>

					<?php
					$tags = get_the_tags();
					if ( $tags ) :
						?>
						<div class="pringomart-post-tags">
							<?php foreach ( $tags as $tag ) : ?>
								<a href="<?php echo esc_url( get_tag_link( $tag->term_id ) ); ?>" class="pringomart-tag">#<?php echo esc_html( $tag->name ); ?></a>
							<?php endforeach; ?>
						</div>
					<?php endif; ?>

					<div class="pringomart-author-bio-box">
						<?php get_template_part( 'template-parts/user-avatar', null, array( 'user_id' => $author_id, 'size' => 64, 'link' => false ) ); ?>
						<div class="pringomart-author-bio-content">
							<h3><?php the_author(); ?> <?php echo pringomart_render_rank_badge( $author_id ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped internally. ?></h3>
							<p><?php echo esc_html( get_the_author_meta( 'description', $author_id ) ); ?></p>
						</div>
					</div>

				</article>

				<?php
				/* -------------------------------------------------------
				 * Related posts — 4 from the same primary category.
				 * ----------------------------------------------------- */
				if ( ! empty( $categories ) ) :
					$related_query = new WP_Query(
						array(
							'post_type'      => 'post',
							'post_status'    => 'publish',
							'cat'            => $categories[0]->term_id,
							'posts_per_page' => 4,
							'post__not_in'   => array( $post_id ),
							'no_found_rows'  => true,
						)
					);

					if ( $related_query->have_posts() ) :
						?>
						<section class="pringomart-section pringomart-related-posts">
							<div class="pringomart-section-header">
								<h2><?php esc_html_e( 'সম্পর্কিত পোস্ট', 'pringomart' ); ?></h2>
							</div>
							<div class="pringomart-grid">
								<?php
								while ( $related_query->have_posts() ) :
									$related_query->the_post();
									get_template_part( 'template-parts/post-card' );
								endwhile;
								?>
							</div>
						</section>
						<?php
						wp_reset_postdata();
					endif;
				endif;
				?>

				<section class="pringomart-section pringomart-comments-section">
					<?php comments_template(); ?>
				</section>

			</main>

			<?php get_sidebar(); ?>
		</div>
	</div>

	<?php
endwhile;

get_footer();
