<?php
/**
 * Comments template — nested replies (2 levels), like + report per
 * comment, logged-in-only comment form.
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( post_password_required() ) {
	return;
}
?>

<div class="pringomart-comments-wrap" id="comments">

	<?php if ( have_comments() ) : ?>
		<h2 class="pringomart-comments-title">
			<?php
			printf(
				/* translators: %s: number of comments. */
				esc_html( _n( '%s টি মন্তব্য', '%s টি মন্তব্য', get_comments_number(), 'pringomart' ) ),
				esc_html( pringomart_to_bengali_number( get_comments_number() ) )
			);
			?>
		</h2>

		<ol class="pringomart-comment-list">
			<?php
			wp_list_comments(
				array(
					'style'       => 'ol',
					'short_ping'  => true,
					'max_depth'   => 2,
					'avatar_size' => 40,
					'callback'    => 'pringomart_comment_callback',
				)
			);
			?>
		</ol>

		<?php the_comments_pagination( array( 'prev_text' => __( '← আগের', 'pringomart' ), 'next_text' => __( 'পরের →', 'pringomart' ) ) ); ?>

	<?php endif; ?>

	<?php if ( ! comments_open() && get_comments_number() ) : ?>
		<p class="pringomart-comments-closed"><?php esc_html_e( 'এই পোস্টে মন্তব্য বন্ধ রয়েছে।', 'pringomart' ); ?></p>
	<?php endif; ?>

	<?php if ( is_user_logged_in() ) : ?>
		<?php
		comment_form(
			array(
				'title_reply'         => __( 'একটি মন্তব্য লিখুন', 'pringomart' ),
				'label_submit'        => __( 'মন্তব্য পাঠান', 'pringomart' ),
				'comment_notes_before' => '',
				'comment_notes_after'  => '',
				'logged_in_as'         => '',
				'comment_field'        => '<p class="comment-form-comment"><textarea id="comment" name="comment" class="pringomart-comment-textarea" placeholder="' . esc_attr__( 'আপনার মন্তব্য লিখুন...', 'pringomart' ) . '" rows="4" required></textarea></p>',
			)
		);
		?>
	<?php else : ?>
		<div class="pringomart-comment-login-notice">
			<p><?php esc_html_e( 'মন্তব্য করতে লগইন করুন', 'pringomart' ); ?></p>
			<a href="<?php echo esc_url( wp_login_url( get_permalink() ) ); ?>" class="pringomart-btn"><?php esc_html_e( 'লগইন করুন', 'pringomart' ); ?></a>
		</div>
	<?php endif; ?>

</div>

<?php
/**
 * Custom comment markup with like + report actions.
 *
 * @param WP_Comment $comment Comment object.
 * @param array      $args    wp_list_comments() args.
 * @param int        $depth   Current nesting depth.
 */
function pringomart_comment_callback( $comment, $args, $depth ) {
	$comment_id   = get_comment_ID();
	$likes        = get_comment_meta( $comment_id, '_pringomart_comment_likes', true );
	$likes        = is_array( $likes ) ? $likes : array();
	$like_count   = count( $likes );
	$user_liked   = is_user_logged_in() && in_array( get_current_user_id(), $likes, true );
	?>
	<li <?php comment_class( 'pringomart-comment' ); ?> id="comment-<?php comment_ID(); ?>">
		<div class="pringomart-comment-body">
			<?php get_template_part( 'template-parts/user-avatar', null, array( 'user_id' => $comment->user_id, 'size' => 40 ) ); ?>

			<div class="pringomart-comment-content">
				<div class="pringomart-comment-meta">
					<span class="pringomart-comment-author"><?php comment_author(); ?></span>
					<span class="pringomart-comment-date">· <?php echo esc_html( pringomart_time_ago( get_comment_date( 'Y-m-d H:i:s', $comment_id ) ) ); ?></span>
				</div>

				<?php if ( '0' === $comment->comment_approved ) : ?>
					<p class="pringomart-comment-pending"><?php esc_html_e( 'আপনার মন্তব্যটি অনুমোদনের অপেক্ষায় রয়েছে।', 'pringomart' ); ?></p>
				<?php endif; ?>

				<div class="pringomart-comment-text">
					<?php comment_text(); ?>
				</div>

				<div class="pringomart-comment-actions">
					<button type="button" class="pringomart-comment-like-btn <?php echo $user_liked ? 'is-active' : ''; ?>" data-comment-id="<?php echo esc_attr( $comment_id ); ?>">
						👍 <span class="count"><?php echo esc_html( pringomart_to_bengali_number( $like_count ) ); ?></span>
					</button>

					<?php if ( $depth < (int) $args['max_depth'] ) : ?>
						<?php
						comment_reply_link(
							array_merge(
								$args,
								array(
									'depth'     => $depth,
									'max_depth' => $args['max_depth'],
									'reply_text' => __( 'উত্তর দিন', 'pringomart' ),
								)
							)
						);
						?>
					<?php endif; ?>

					<?php if ( is_user_logged_in() ) : ?>
						<button type="button" class="pringomart-comment-report-btn" data-comment-id="<?php echo esc_attr( $comment_id ); ?>">
							<?php esc_html_e( 'রিপোর্ট', 'pringomart' ); ?>
						</button>
					<?php endif; ?>
				</div>
			</div>
		</div>
	<?php
	// </li> is closed by WordPress for the 'ol' style.
}
