<?php
/**
 * Community question card — used on homepage preview and /community/.
 * Expects $args['question'] (an object with the questions table columns).
 *
 * @package Pringomart
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$question = isset( $args['question'] ) ? $args['question'] : null;

if ( ! $question ) {
	return;
}

$question_url = home_url( '/community/question/' . $question->slug . '/' );
$is_solved    = ! empty( $question->solved_at );
?>
<div class="pringomart-community-card">
	<div class="pringomart-vote-col">
		<span class="pringomart-vote-count"><?php echo esc_html( pringomart_to_bengali_number( $question->vote_count ) ); ?></span>
		<span class="pringomart-vote-label"><?php esc_html_e( 'ভোট', 'pringomart' ); ?></span>
	</div>

	<div class="pringomart-community-card-body">
		<h3 class="pringomart-community-card-title">
			<a href="<?php echo esc_url( $question_url ); ?>"><?php echo esc_html( $question->title ); ?></a>
			<?php if ( $is_solved ) : ?>
				<span class="pringomart-solved-badge">✅ <?php esc_html_e( 'সমাধান হয়েছে', 'pringomart' ); ?></span>
			<?php endif; ?>
		</h3>
		<p class="pringomart-community-card-excerpt">
			<?php echo esc_html( wp_trim_words( wp_strip_all_tags( $question->body ), 20 ) ); ?>
		</p>
		<div class="pringomart-community-card-meta">
			<img src="<?php echo esc_url( pringomart_get_avatar_url( $question->user_id, 24 ) ); ?>" class="pringomart-avatar" alt="" width="24" height="24" />
			<span><?php echo esc_html( get_the_author_meta( 'display_name', $question->user_id ) ); ?></span>
			<span>· <?php echo esc_html( pringomart_time_ago( $question->created_at ) ); ?></span>
			<span class="pringomart-answer-count">💬 <?php echo esc_html( pringomart_to_bengali_number( $question->answer_count ) ); ?></span>
		</div>
	</div>
</div>
