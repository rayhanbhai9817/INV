/**
 * Reaction bar + like button — vanilla JS, Fetch API.
 */
( function () {
	'use strict';

	document.addEventListener( 'DOMContentLoaded', function () {
		document.querySelectorAll( '.pringomart-reaction-bar' ).forEach( initReactionBar );
	} );

	function initReactionBar( bar ) {
		var postId = bar.getAttribute( 'data-post-id' );

		bar.querySelectorAll( '.pringomart-reaction-btn' ).forEach( function ( btn ) {
			btn.addEventListener( 'click', function () {
				if ( btn.disabled ) {
					return;
				}
				if ( ! window.pringomartData || ! window.pringomartData.isLoggedIn ) {
					window.location.href = window.pringomartData.homeUrl + 'login/';
					return;
				}

				var type = btn.classList.contains( 'is-active' ) ? '' : btn.getAttribute( 'data-reaction-type' );
				sendReaction( bar, postId, type );
			} );
		} );

		var likeBtn = bar.querySelector( '.pringomart-like-btn' );
		if ( likeBtn ) {
			likeBtn.addEventListener( 'click', function () {
				toggleLike( likeBtn, postId );
			} );
		}

		var bookmarkBtn = bar.querySelector( '.pringomart-bookmark-btn' );
		if ( bookmarkBtn ) {
			bookmarkBtn.addEventListener( 'click', function () {
				toggleBookmark( bookmarkBtn, postId );
			} );
		}

		var shareBtn = bar.querySelector( '.pringomart-share-btn' );
		if ( shareBtn ) {
			shareBtn.addEventListener( 'click', function () {
				var url = shareBtn.getAttribute( 'data-url' );
				var title = shareBtn.getAttribute( 'data-title' );

				if ( navigator.share ) {
					navigator.share( { title: title, url: url } ).catch( function () {} );
				} else {
					navigator.clipboard && navigator.clipboard.writeText( url );
					alert( title + '\n' + url );
				}
			} );
		}
	}

	function sendReaction( bar, postId, type ) {
		fetch( window.pringomartData.ajaxUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams( {
				action: 'pringomart_react',
				nonce: window.pringomartData.nonce,
				post_id: postId,
				reaction_type: type,
			} ),
		} )
			.then( function ( res ) {
				return res.json();
			} )
			.then( function ( json ) {
				if ( ! json.success ) {
					return;
				}
				var data = json.data;

				bar.querySelectorAll( '.pringomart-reaction-btn' ).forEach( function ( btn ) {
					var btnType = btn.getAttribute( 'data-reaction-type' );
					btn.classList.toggle( 'is-active', btnType === data.userReaction );
					var countEl = btn.querySelector( '.count' );
					if ( countEl && data.counts[ btnType ] !== undefined ) {
						countEl.textContent = data.counts[ btnType ];
					}
				} );
			} )
			.catch( function () {} );
	}

	function toggleLike( btn, postId ) {
		if ( ! window.pringomartData || ! window.pringomartData.isLoggedIn ) {
			window.location.href = window.pringomartData.homeUrl + 'login/';
			return;
		}

		fetch( window.pringomartData.ajaxUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams( {
				action: 'pringomart_toggle_like',
				nonce: window.pringomartData.nonce,
				post_id: postId,
			} ),
		} )
			.then( function ( res ) {
				return res.json();
			} )
			.then( function ( json ) {
				if ( ! json.success ) {
					return;
				}
				btn.classList.toggle( 'is-active', json.data.liked );
				var countEl = btn.querySelector( '.pringomart-like-count' );
				if ( countEl ) {
					countEl.textContent = json.data.count;
				}
			} )
			.catch( function () {} );
	}

	function toggleBookmark( btn, postId ) {
		if ( ! window.pringomartData || ! window.pringomartData.isLoggedIn ) {
			window.location.href = window.pringomartData.homeUrl + 'login/';
			return;
		}

		fetch( window.pringomartData.ajaxUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams( {
				action: 'pringomart_toggle_bookmark',
				nonce: window.pringomartData.nonce,
				post_id: postId,
			} ),
		} )
			.then( function ( res ) {
				return res.json();
			} )
			.then( function ( json ) {
				if ( json.success ) {
					btn.classList.toggle( 'is-active', json.data.bookmarked );
				}
			} )
			.catch( function () {} );
	}
} )();
