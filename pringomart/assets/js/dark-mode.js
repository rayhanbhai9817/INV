/**
 * Dark / Light mode toggle — vanilla JS, no jQuery.
 */
( function () {
	'use strict';

	function getTheme() {
		return document.documentElement.getAttribute( 'data-theme' ) || 'light';
	}

	function setTheme( theme ) {
		document.documentElement.setAttribute( 'data-theme', theme );

		try {
			localStorage.setItem( 'pringomart-theme', theme );
		} catch ( e ) {
			// localStorage unavailable (private mode, etc) — ignore.
		}

		document.querySelectorAll( '.pringomart-theme-toggle' ).forEach( function ( btn ) {
			btn.setAttribute( 'aria-pressed', theme === 'dark' ? 'true' : 'false' );
			btn.textContent = theme === 'dark' ? '☀️' : '🌙';
		} );

		if ( window.pringomartData && window.pringomartData.isLoggedIn ) {
			fetch( window.pringomartData.ajaxUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams( {
					action: 'pringomart_save_theme_mode',
					nonce: window.pringomartData.nonce,
					mode: theme,
				} ),
			} ).catch( function () {} );
		}
	}

	function toggleTheme() {
		setTheme( getTheme() === 'dark' ? 'light' : 'dark' );
	}

	document.addEventListener( 'DOMContentLoaded', function () {
		document.querySelectorAll( '.pringomart-theme-toggle' ).forEach( function ( btn ) {
			var theme = getTheme();
			btn.setAttribute( 'aria-pressed', theme === 'dark' ? 'true' : 'false' );
			btn.textContent = theme === 'dark' ? '☀️' : '🌙';
			btn.addEventListener( 'click', toggleTheme );
		} );
	} );
} )();
