<?php
/**
 * The homepage template: featured slider, per-category sections,
 * community Q&A preview, and sidebar.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

$show_sidebar     = get_theme_mod( 'pringomart_show_sidebar', true );
$per_category     = (int) get_theme_mod( 'pringomart_posts_per_category', 4 );
$featured_count    = (int) get_theme_mod( 'pringomart_featured_count', 6 );
$show_community    = get_theme_mod( 'pringomart_show_community_section', true );
?>

<div class="pringomart-container pringomart-section">
	<div class="pringomart-layout <?php echo $show_sidebar ? 'has-sidebar' : ''; ?>">

		<main class="pringomart-content">

			<?php
			/* -----------------------------------------------------------
			 * 1. Featured posts slider (posts tagged "featured")
			 * --------------------------------------------------------- */
			$featured_query = new WP_Query(
				array(
					'post_type'      => 'post',
					'post_status'    => 'publish',
					'tag'            => 'featured',
					'posts_per_page' => $featured_count > 0 ? $featured_count : 6,
					'no_found_rows'  => true,
				)
			);

			if ( $featured_query->have_posts() ) :
				?>
				<section class="pringomart-slider" data-pringomart-slider aria-label="<?php esc_attr_e( 'ফিচার্ড পোস্ট', 'pringomart' ); ?>">
					<div class="pringomart-slider-track">
						<?php
						$slide_index = 0;
						while ( $featured_query->have_posts() ) :
							$featured_query->the_post();
							$categories = get_the_category();
							?>
							<div class="pringomart-slide <?php echo 0 === $slide_index ? 'is-active' : ''; ?>">
								<a href="<?php the_permalink(); ?>" class="pringomart-slide-link">
									<?php if ( has_post_thumbnail() ) : ?>
										<?php the_post_thumbnail( 'pringomart-slider' ); ?>
									<?php endif; ?>
									<div class="pringomart-slide-overlay">
										<?php if ( ! empty( $categories ) ) : ?>
											<span class="pringomart-category-badge"><?php echo esc_html( $categories[0]->name ); ?></span>
										<?php endif; ?>
										<h2 class="pringomart-slide-title"><?php the_title(); ?></h2>
										<div class="pringomart-slide-meta">
											<img src="<?php echo esc_url( pringomart_get_avatar_url( get_the_author_meta( 'ID' ), 28 ) ); ?>" class="pringomart-avatar" alt="" width="28" height="28" />
											<span><?php the_author(); ?></span>
										</div>
									</div>
								</a>
							</div>
							<?php
							$slide_index++;
						endwhile;
						wp_reset_postdata();
						?>
					</div>
					<div class="pringomart-slider-dots"></div>
					<button type="button" class="pringomart-slider-arrow pringomart-slider-prev" aria-label="<?php esc_attr_e( 'আগের', 'pringomart' ); ?>">‹</button>
					<button type="button" class="pringomart-slider-arrow pringomart-slider-next" aria-label="<?php esc_attr_e( 'পরের', 'pringomart' ); ?>">›</button>
				</section>
				<?php
			else :
				wp_reset_postdata();
			endif;

			/* -----------------------------------------------------------
			 * 2. Category sections — N posts per category
			 * --------------------------------------------------------- */
			$home_categories = get_categories(
				array(
					'hide_empty' => true,
					'number'     => 6,
					'orderby'    => 'count',
					'order'      => 'DESC',
				)
			);

			foreach ( $home_categories as $home_category ) :
				$category_query = new WP_Query(
					array(
						'post_type'      => 'post',
						'post_status'    => 'publish',
						'cat'            => $home_category->term_id,
						'posts_per_page' => $per_category > 0 ? $per_category : 4,
						'no_found_rows'  => true,
					)
				);

				if ( ! $category_query->have_posts() ) {
					wp_reset_postdata();
					continue;
				}
				?>
				<section class="pringomart-section pringomart-category-section">
					<div class="pringomart-section-header">
						<h2><span class="pringomart-cat-icon">📁</span> <?php echo esc_html( $home_category->name ); ?></h2>
						<a href="<?php echo esc_url( get_category_link( $home_category->term_id ) ); ?>" class="pringomart-see-more">
							<?php esc_html_e( 'আরো দেখুন →', 'pringomart' ); ?>
						</a>
					</div>
					<div class="pringomart-grid">
						<?php
						while ( $category_query->have_posts() ) :
							$category_query->the_post();
							get_template_part( 'template-parts/post-card' );
						endwhile;
						wp_reset_postdata();
						?>
					</div>
				</section>
				<?php
			endforeach;

			/* -----------------------------------------------------------
			 * 3. Community Q&A preview
			 * --------------------------------------------------------- */
			if ( $show_community && function_exists( 'pringomart_get_latest_questions' ) ) :
				$latest_questions = pringomart_get_latest_questions( 6 );
				?>
				<section class="pringomart-section pringomart-community-section">
					<div class="pringomart-section-header">
						<h2>💬 <?php esc_html_e( 'কমিউনিটি প্রশ্নোত্তর', 'pringomart' ); ?></h2>
						<a href="<?php echo esc_url( home_url( '/community/' ) ); ?>" class="pringomart-see-more">
							<?php esc_html_e( 'আরো দেখুন →', 'pringomart' ); ?>
						</a>
					</div>
					<?php if ( ! empty( $latest_questions ) ) : ?>
						<div class="pringomart-community-grid">
							<?php foreach ( $latest_questions as $question ) : ?>
								<?php get_template_part( 'template-parts/community-card', null, array( 'question' => $question ) ); ?>
							<?php endforeach; ?>
						</div>
					<?php else : ?>
						<p><?php esc_html_e( 'এখনো কোনো প্রশ্ন করা হয়নি।', 'pringomart' ); ?></p>
					<?php endif; ?>
					<div class="pringomart-community-cta">
						<a href="<?php echo esc_url( home_url( '/community/ask/' ) ); ?>" class="pringomart-btn">
							<?php esc_html_e( 'কমিউনিটিতে প্রশ্ন করুন', 'pringomart' ); ?>
						</a>
					</div>
				</section>
				<?php
			endif;
			?>

		</main>

		<?php if ( $show_sidebar ) : ?>
			<?php get_sidebar(); ?>
		<?php endif; ?>
	</div>
</div>

<?php
get_footer();
