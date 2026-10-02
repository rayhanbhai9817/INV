/**
 * Pringomart core front-end JS — mobile drawer, live search.
 * Vanilla JS + Fetch API, no jQuery.
 */
( function () {
	'use strict';

	document.addEventListener( 'DOMContentLoaded', function () {
		initMobileDrawer();
		initLiveSearch();
		initFeaturedSlider();
	} );

	function initFeaturedSlider() {
		var slider = document.querySelector( '[data-pringomart-slider]' );

		if ( ! slider ) {
			return;
		}

		var slides = Array.prototype.slice.call( slider.querySelectorAll( '.pringomart-slide' ) );
		var dotsWrap = slider.querySelector( '.pringomart-slider-dots' );
		var prevBtn = slider.querySelector( '.pringomart-slider-prev' );
		var nextBtn = slider.querySelector( '.pringomart-slider-next' );

		if ( slides.length < 2 ) {
			if ( prevBtn ) prevBtn.style.display = 'none';
			if ( nextBtn ) nextBtn.style.display = 'none';
			return;
		}

		var current = slides.findIndex( function ( s ) {
			return s.classList.contains( 'is-active' );
		} );
		current = current === -1 ? 0 : current;

		var dots = slides.map( function ( _, index ) {
			var dot = document.createElement( 'button' );
			dot.type = 'button';
			dot.setAttribute( 'aria-label', 'Slide ' + ( index + 1 ) );
			if ( index === current ) {
				dot.classList.add( 'is-active' );
			}
			dot.addEventListener( 'click', function () {
				goTo( index );
			} );
			dotsWrap.appendChild( dot );
			return dot;
		} );

		var timer;

		function goTo( index ) {
			slides[ current ].classList.remove( 'is-active' );
			dots[ current ].classList.remove( 'is-active' );
			current = ( index + slides.length ) % slides.length;
			slides[ current ].classList.add( 'is-active' );
			dots[ current ].classList.add( 'is-active' );
		}

		function next() {
			goTo( current + 1 );
		}

		function prev() {
			goTo( current - 1 );
		}

		function startAutoplay() {
			timer = setInterval( next, 5000 );
		}

		function stopAutoplay() {
			clearInterval( timer );
		}

		if ( nextBtn ) nextBtn.addEventListener( 'click', function () { stopAutoplay(); next(); startAutoplay(); } );
		if ( prevBtn ) prevBtn.addEventListener( 'click', function () { stopAutoplay(); prev(); startAutoplay(); } );

		slider.addEventListener( 'mouseenter', stopAutoplay );
		slider.addEventListener( 'mouseleave', startAutoplay );

		startAutoplay();
	}

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
