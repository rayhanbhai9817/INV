<?php
/**
 * The footer template.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
</div><!-- .pringomart-site-content -->

<footer class="pringomart-footer">
	<div class="pringomart-container">

		<?php if ( get_theme_mod( 'pringomart_footer_ad_enabled' ) && get_theme_mod( 'pringomart_footer_ad_code' ) ) : ?>
			<div class="pringomart-ad-slot pringomart-ad-footer">
				<?php echo wp_kses_post( get_theme_mod( 'pringomart_footer_ad_code' ) ); ?>
			</div>
		<?php endif; ?>

		<div class="pringomart-footer-grid">
			<div class="pringomart-footer-col">
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="pringomart-logo">
					<?php if ( has_custom_logo() ) : ?>
						<?php the_custom_logo(); ?>
					<?php else : ?>
						<span class="pringomart-logo-text"><?php bloginfo( 'name' ); ?></span>
					<?php endif; ?>
				</a>
				<p><?php echo esc_html( get_theme_mod( 'pringomart_footer_tagline', get_bloginfo( 'description' ) ) ); ?></p>

				<div class="pringomart-social-links">
					<?php
					$socials = array(
						'facebook'  => array( '📘', get_theme_mod( 'pringomart_social_facebook' ) ),
						'twitter'   => array( '🐦', get_theme_mod( 'pringomart_social_twitter' ) ),
						'youtube'   => array( '📺', get_theme_mod( 'pringomart_social_youtube' ) ),
						'instagram' => array( '📷', get_theme_mod( 'pringomart_social_instagram' ) ),
						'linkedin'  => array( '💼', get_theme_mod( 'pringomart_social_linkedin' ) ),
						'telegram'  => array( '✈️', get_theme_mod( 'pringomart_social_telegram' ) ),
					);
					foreach ( $socials as $key => $data ) :
						list( $icon, $url ) = $data;
						if ( empty( $url ) ) {
							continue;
						}
						?>
						<a href="<?php echo esc_url( $url ); ?>" target="_blank" rel="noopener noreferrer" aria-label="<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $icon ); ?></a>
					<?php endforeach; ?>
				</div>

				<?php if ( function_exists( 'pringomart_online_count' ) && pringomart_is_module_enabled( 'online_users' ) ) : ?>
					<p class="pringomart-online-count">
						🟢 <?php echo esc_html( pringomart_to_bengali_number( pringomart_online_count() ) ); ?> <?php esc_html_e( 'জন অনলাইন', 'pringomart' ); ?>
					</p>
				<?php endif; ?>
			</div>

			<div class="pringomart-footer-col">
				<h4><?php esc_html_e( 'কুইক লিংক', 'pringomart' ); ?></h4>
				<?php
				wp_nav_menu(
					array(
						'theme_location' => 'footer',
						'container'      => false,
						'menu_class'     => '',
						'fallback_cb'    => false,
					)
				);
				?>
			</div>

			<div class="pringomart-footer-col">
				<h4><?php esc_html_e( 'ক্যাটাগরি', 'pringomart' ); ?></h4>
				<ul>
					<?php
					$categories = get_categories( array( 'number' => 6, 'hide_empty' => true ) );
					foreach ( $categories as $category ) :
						?>
						<li><a href="<?php echo esc_url( get_category_link( $category->term_id ) ); ?>"><?php echo esc_html( $category->name ); ?></a></li>
					<?php endforeach; ?>
				</ul>
			</div>

			<div class="pringomart-footer-col">
				<h4><?php esc_html_e( 'নিউজলেটার', 'pringomart' ); ?></h4>
				<p><?php esc_html_e( 'নতুন পোস্টের আপডেট পেতে সাবস্ক্রাইব করুন।', 'pringomart' ); ?></p>
				<form class="pringomart-newsletter-form" method="post">
					<input type="email" name="pringomart_newsletter_email" placeholder="<?php esc_attr_e( 'আপনার ইমেইল', 'pringomart' ); ?>" required />
					<button type="submit" class="pringomart-btn"><?php esc_html_e( 'সাবস্ক্রাইব', 'pringomart' ); ?></button>
					<?php wp_nonce_field( 'pringomart_newsletter', 'pringomart_newsletter_nonce' ); ?>
				</form>
			</div>
		</div>

		<div class="pringomart-footer-bottom">
			<p>
				<?php
				echo esc_html(
					get_theme_mod(
						'pringomart_copyright_text',
						sprintf(
							/* translators: %d: current year. */
							__( '© %d Pringomart — Hasnat Rayhan. সর্বস্বত্ব সংরক্ষিত। Developed by Hasnat Rayhan', 'pringomart' ),
							gmdate( 'Y' )
						)
					)
				);
				?>
			</p>
			<p>
				<a href="<?php echo esc_url( home_url( '/privacy-policy/' ) ); ?>"><?php esc_html_e( 'প্রাইভেসি পলিসি', 'pringomart' ); ?></a>
				|
				<a href="<?php echo esc_url( home_url( '/terms/' ) ); ?>"><?php esc_html_e( 'শর্তাবলী', 'pringomart' ); ?></a>
				|
				<a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>"><?php esc_html_e( 'যোগাযোগ', 'pringomart' ); ?></a>
			</p>
		</div>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
