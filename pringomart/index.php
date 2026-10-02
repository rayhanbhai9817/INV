<?php
/**
 * Fallback main template — the full homepage design lands in Step 4.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<div class="pringomart-container pringomart-section">
	<div class="pringomart-layout has-sidebar">
		<main class="pringomart-content">
			<?php if ( have_posts() ) : ?>
				<div class="pringomart-grid">
					<?php
					while ( have_posts() ) :
						the_post();
						get_template_part( 'template-parts/post-card' );
					endwhile;
					?>
				</div>
				<?php the_posts_pagination(); ?>
			<?php else : ?>
				<p><?php esc_html_e( 'কোনো পোস্ট পাওয়া যায়নি।', 'pringomart' ); ?></p>
			<?php endif; ?>
		</main>

		<?php get_sidebar(); ?>
	</div>
</div>

<?php
get_footer();
