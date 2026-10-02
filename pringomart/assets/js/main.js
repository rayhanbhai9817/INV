/**
 * Pringomart core front-end JS — mobile drawer, live search.
 * Vanilla JS + Fetch API, no jQuery.
 */
( function () {
	'use strict';

	document.addEventListener( 'DOMContentLoaded', function () {
		initMobileDrawer();
		initLiveSearch();
	} );

	function initMobileDrawer() {
		var toggle = document.querySelector( '.pringomart-hamburger' );
		var drawer = document.querySelector( '.pringomart-mobile-drawer' );
		var overlay = document.querySelector( '.pringomart-drawer-overlay' );

		if ( ! toggle || ! drawer || ! overlay ) {
			return;
		}

		function closeDrawer() {
			drawer.classList.remove( 'is-open' );
			overlay.classList.remove( 'is-open' );
		}

		toggle.addEventListener( 'click', function () {
			drawer.classList.add( 'is-open' );
			overlay.classList.add( 'is-open' );
		} );

		overlay.addEventListener( 'click', closeDrawer );
	}

	function initLiveSearch() {
		var input = document.querySelector( '.pringomart-search-input' );
		var resultsBox = document.querySelector( '.pringomart-search-results' );

		if ( ! input || ! resultsBox || ! window.pringomartData ) {
			return;
		}

		var debounceTimer;

		input.addEventListener( 'input', function () {
			var query = input.value.trim();

			clearTimeout( debounceTimer );

			if ( query.length < 3 ) {
				resultsBox.classList.remove( 'is-active' );
				resultsBox.innerHTML = '';
				return;
			}

			debounceTimer = setTimeout( function () {
				runSearch( query );
			}, 300 );
		} );

		document.addEventListener( 'click', function ( e ) {
			if ( ! resultsBox.contains( e.target ) && e.target !== input ) {
				resultsBox.classList.remove( 'is-active' );
			}
		} );

		function runSearch( query ) {
			resultsBox.innerHTML = '<div class="pringomart-search-loading">' + window.pringomartData.i18n.loading + '</div>';
			resultsBox.classList.add( 'is-active' );

			var params = new URLSearchParams( {
				action: 'pringomart_live_search',
				nonce: window.pringomartData.nonce,
				query: query,
			} );

			fetch( window.pringomartData.ajaxUrl + '?' + params.toString() )
				.then( function ( res ) {
					return res.json();
				} )
				.then( function ( json ) {
					renderResults( json && json.data ? json.data : [] );
				} )
				.catch( function () {
					resultsBox.innerHTML = '';
				} );
		}

		function renderResults( items ) {
			if ( ! items.length ) {
				resultsBox.innerHTML = '<div class="pringomart-search-empty">' + window.pringomartData.i18n.noResults + '</div>';
				return;
			}

			resultsBox.innerHTML = items
				.map( function ( item ) {
					return (
						'<a class="pringomart-search-result" href="' + item.url + '">' +
						'<img src="' + item.thumbnail + '" alt="" />' +
						'<div><div class="title">' + item.title + '</div>' +
						'<div class="meta">' + item.category + ' · ' + item.date + '</div></div>' +
						'</a>'
					);
				} )
				.join( '' );
		}
	}
} )();
