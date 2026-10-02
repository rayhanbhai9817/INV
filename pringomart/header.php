<?php
/**
 * The header template.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<header class="pringomart-header" id="pringomart-header">
	<div class="pringomart-container pringomart-header-inner">

		<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="pringomart-logo">
			<?php
			$dark_logo  = get_theme_mod( 'pringomart_dark_logo' );
			$light_logo = get_theme_mod( 'pringomart_light_logo' );

			if ( has_custom_logo() ) {
				the_custom_logo();
			} elseif ( $light_logo ) {
				echo '<img src="' . esc_url( $light_logo ) . '" alt="' . esc_attr( get_bloginfo( 'name' ) ) . '" class="pringomart-logo-light" />';
				if ( $dark_logo ) {
					echo '<img src="' . esc_url( $dark_logo ) . '" alt="' . esc_attr( get_bloginfo( 'name' ) ) . '" class="pringomart-logo-dark" />';
				}
			} else {
				echo '<span class="pringomart-logo-text">' . esc_html( get_bloginfo( 'name' ) ) . '</span>';
			}
			?>
		</a>

		<nav class="pringomart-main-nav" aria-label="<?php esc_attr_e( 'প্রাথমিক মেনু', 'pringomart' ); ?>">
			<?php
			wp_nav_menu(
				array(
					'theme_location' => 'primary',
					'container'      => false,
					'menu_class'     => '',
					'fallback_cb'    => false,
				)
			);
			?>
		</nav>

		<form class="pringomart-search-form" role="search" method="get" action="<?php echo esc_url( home_url( '/' ) ); ?>">
			<input type="search" class="pringomart-search-input" placeholder="<?php esc_attr_e( 'খুঁজুন...', 'pringomart' ); ?>" autocomplete="off" />
			<div class="pringomart-search-results"></div>
		</form>

		<div class="pringomart-header-actions">

			<button type="button" class="pringomart-icon-btn pringomart-theme-toggle" aria-label="<?php esc_attr_e( 'থিম পরিবর্তন করুন', 'pringomart' ); ?>">🌙</button>

			<?php if ( is_user_logged_in() ) : ?>
				<?php
				$current_user_id = get_current_user_id();
				$unread_count    = function_exists( 'pringomart_unread_count' ) ? pringomart_unread_count( $current_user_id ) : 0;
				?>
				<div class="pringomart-notification-wrap">
					<button type="button" class="pringomart-icon-btn pringomart-notification-bell" aria-label="<?php esc_attr_e( 'নোটিফিকেশন', 'pringomart' ); ?>">
						🔔
						<?php if ( $unread_count > 0 ) : ?>
							<span class="pringomart-badge pringomart-unread-count"><?php echo esc_html( pringomart_format_number( $unread_count ) ); ?></span>
						<?php endif; ?>
					</button>
					<div class="pringomart-notification-dropdown"></div>
				</div>

				<div class="pringomart-user-menu">
					<button type="button" class="pringomart-user-menu-toggle">
						<img src="<?php echo esc_url( pringomart_get_avatar_url( $current_user_id, 36 ) ); ?>" alt="" class="pringomart-avatar" />
					</button>
					<div class="pringomart-user-dropdown">
						<a href="<?php echo esc_url( get_author_posts_url( $current_user_id ) ); ?>"><?php esc_html_e( 'প্রোফাইল', 'pringomart' ); ?></a>
						<a href="<?php echo esc_url( home_url( '/profile/bookmarks/' ) ); ?>"><?php esc_html_e( 'বুকমার্ক', 'pringomart' ); ?></a>
						<a href="<?php echo esc_url( home_url( '/submit-post/' ) ); ?>"><?php esc_html_e( 'পোস্ট লিখুন', 'pringomart' ); ?></a>
						<a href="<?php echo esc_url( wp_logout_url( home_url( '/' ) ) ); ?>"><?php esc_html_e( 'লগআউট', 'pringomart' ); ?></a>
					</div>
				</div>
			<?php else : ?>
				<a href="<?php echo esc_url( home_url( '/login/' ) ); ?>" class="pringomart-btn pringomart-btn-outline"><?php esc_html_e( 'লগইন', 'pringomart' ); ?></a>
				<a href="<?php echo esc_url( home_url( '/register/' ) ); ?>" class="pringomart-btn"><?php esc_html_e( 'নিবন্ধন', 'pringomart' ); ?></a>
			<?php endif; ?>

			<button type="button" class="pringomart-hamburger" aria-label="<?php esc_attr_e( 'মেনু খুলুন', 'pringomart' ); ?>">☰</button>
		</div>
	</div>
</header>

<div class="pringomart-drawer-overlay"></div>
<aside class="pringomart-mobile-drawer">
	<?php
	wp_nav_menu(
		array(
			'theme_location' => 'primary',
			'container'      => false,
			'menu_class'     => 'pringomart-drawer-menu',
			'fallback_cb'    => false,
		)
	);
	?>
</aside>

<div class="pringomart-site-content">
