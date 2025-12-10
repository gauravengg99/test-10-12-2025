// Main JS: mobile menu, sticky header, smooth scroll, fade-in on scroll, lazy loading support
(() => {
  'use strict';

  // Mobile menu toggle
  function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (!hamburger || !mobileMenu) return;
    
    hamburger.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });

    // Close menu when link is clicked
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
      });
    });
  }

  // Sticky header shadow on scroll
  function initStickyHeader() {
    const header = document.getElementById('site-header');
    if (!header) return;

    const onScroll = () => {
      if (window.scrollY > 10) {
        header.classList.add('sticky', 'shadow-md');
      } else {
        header.classList.remove('sticky', 'shadow-md');
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Smooth scroll for internal links
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const target = document.querySelector(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // Fade in on scroll using IntersectionObserver
  function initFadeIn() {
    const options = {
      threshold: 0.12,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, options);

    document.querySelectorAll('.fade-in').forEach(el => {
      observer.observe(el);
    });
  }

  // Lazy load images fallback for browsers that don't support loading="lazy"
  function initLazyLoad() {
    // Check if browser supports loading="lazy"
    if ('loading' in HTMLImageElement.prototype) {
      return; // Native lazy loading supported
    }

    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
          }
          imageObserver.unobserve(img);
        }
      });
    });

    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
      imageObserver.observe(img);
    });
  }

  // Smooth page transitions
  function initPageTransitions() {
    document.querySelectorAll('a:not([target="_blank"]):not([download])').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('http')) return; // Skip external links
      
      link.addEventListener('click', function(e) {
        // Let normal navigation happen, but fade out page
        document.body.style.opacity = '0.95';
      });
    });

    // Fade in on page load
    window.addEventListener('load', () => {
      document.body.style.opacity = '1';
    });
  }

  // Performance: Debounce scroll events
  function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  // Initialize everything when DOM is ready
  function init() {
    initMobileMenu();
    initStickyHeader();
    initSmoothScroll();
    initFadeIn();
    initLazyLoad();
    initPageTransitions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
