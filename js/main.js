/* ============================================================
   INSOLAB — Motion system
   Lenis smooth scroll + GSAP ScrollTrigger choreography
   ============================================================ */

(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;

  /* ---------------------------------------------------------
     1. LENIS SMOOTH SCROLL
     --------------------------------------------------------- */
  let lenis = null;

  function initLenis() {
    if (prefersReduced || typeof Lenis === 'undefined') return null;

    const instance = new Lenis({
      duration: 1.3,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1.1,
      touchMultiplier: 1.8,
      infinite: false
    });

    // drive ScrollTrigger from Lenis
    if (window.ScrollTrigger) {
      instance.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => instance.raf(time * 1000));
      gsap.ticker.lagSmoothing(500, 33);
    } else {
      function raf(time) {
        instance.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }

    return instance;
  }

  /* ---------------------------------------------------------
     2. SMOOTH ANCHORS (Lenis-aware)
     --------------------------------------------------------- */
  function initAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        if (lenis) lenis.scrollTo(target, { offset: -80, duration: 1.6 });
        else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        closeNav();
      });
    });
  }

  /* ---------------------------------------------------------
     3. HEADER STATE + PROGRESS BAR
     --------------------------------------------------------- */
  function initChrome() {
    const hdr = document.querySelector('.hdr');
    const progress = document.querySelector('.progress');

    function onScroll() {
      const y = window.scrollY || window.pageYOffset;
      const stuck = y > 40;
      if (hdr) hdr.classList.toggle('is-stuck', stuck);
      // The desktop nav is a sibling of .hdr (so the mobile overlay is not
      // clamped by the header's transform), so it needs the same stuck state.
      document.documentElement.classList.toggle('hdr-stuck', stuck);

      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (y / max) * 100 : 0;
        progress.style.width = pct + '%';
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------
     4. MOBILE NAV
     --------------------------------------------------------- */
  function closeNav() {
    const nav = document.querySelector('.nav');
    const toggle = document.querySelector('.nav-toggle');
    if (nav) nav.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
  }

  function openNav() {
    const nav = document.querySelector('.nav');
    const toggle = document.querySelector('.nav-toggle');
    if (!nav) return;
    nav.classList.add('is-open');
    document.body.classList.add('nav-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop();
  }

  function initNav() {
    const toggle = document.querySelector('.nav-toggle');
    const closeBtn = document.querySelector('.nav-close');
    const nav = document.querySelector('.nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      nav.classList.contains('is-open') ? closeNav() : openNav();
    });

    // Without this the only way out of the overlay was re-tapping the
    // hamburger, which sat underneath the panel.
    if (closeBtn) closeBtn.addEventListener('click', closeNav);

    // Escape closes the menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) closeNav();
    });

    // Keep aria-expanded honest if the panel is closed by any other route
    // (anchor click, resize past the breakpoint).
    window.addEventListener('resize', () => {
      if (window.innerWidth > 760 && nav.classList.contains('is-open')) closeNav();
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     5. FAQ ACCORDION (height-animated)
     --------------------------------------------------------- */
  function initFaq() {
    document.querySelectorAll('.faq-item').forEach((item) => {
      const btn = item.querySelector('.faq-q');
      const panel = item.querySelector('.faq-a');
      if (!btn || !panel) return;

      btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');

        // close siblings in the same group
        const group = item.parentElement;
        if (group) {
          group.querySelectorAll('.faq-item.is-open').forEach((other) => {
            if (other === item) return;
            other.classList.remove('is-open');
            const op = other.querySelector('.faq-a');
            const ob = other.querySelector('.faq-q');
            if (op) op.style.height = '0px';
            if (ob) ob.setAttribute('aria-expanded', 'false');
          });
        }

        item.classList.toggle('is-open', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
        panel.style.height = isOpen ? '0px' : panel.scrollHeight + 'px';
      });
    });

    // keep open panels correctly sized on resize
    window.addEventListener('resize', () => {
      document.querySelectorAll('.faq-item.is-open .faq-a').forEach((p) => {
        p.style.height = p.scrollHeight + 'px';
      });
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     6. ORDER FORM → confirmation view
     --------------------------------------------------------- */
  const PRODUCTS = {
    'omfad-1':   { name: 'On My Feet All Day',        qty: '1 unit', price: 399 },
    'nea-1':     { name: 'Normal Everyday Activity',  qty: '1 unit', price: 399 },
    'bundle-2':  { name: '2 Unit Package',            qty: '2 unit', price: 650 }
  };

  let selected = 'omfad-1';

  function renderSummary() {
    const p = PRODUCTS[selected];
    const el = {
      name:  document.getElementById('sum-name'),
      qty:   document.getElementById('sum-qty'),
      total: document.getElementById('sum-total'),
      cta:   document.getElementById('cta-total')
    };
    if (el.name)  el.name.textContent  = p.name;
    if (el.qty)   el.qty.textContent   = p.qty;
    if (el.total) el.total.textContent = 'RM' + p.price;
    if (el.cta)   el.cta.textContent   = 'RM' + p.price;
  }

  function initForm() {
    document.querySelectorAll('[data-product]').forEach((opt) => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('[data-product]').forEach((o) => o.classList.remove('is-picked'));
        opt.classList.add('is-picked');
        selected = opt.getAttribute('data-product');
        renderSummary();
      });
    });
    renderSummary();

    const form = document.getElementById('order-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const fd = new FormData(form);
      const p = PRODUCTS[selected];
      const no = 'ISL-' + Math.floor(100000 + Math.random() * 900000);

      const set = (id, val) => {
        const n = document.getElementById(id);
        if (n) n.textContent = val;
      };

      set('cf-no', no);
      set('cf-name', fd.get('name') || '—');
      set('cf-phone', fd.get('phone') || '—');
      set('cf-product', p.name + ' — ' + p.qty);
      set('cf-total', 'RM' + p.price);

      // swap views
      const checkout = document.getElementById('view-checkout');
      const done = document.getElementById('view-confirm');
      if (checkout) checkout.hidden = true;
      if (done) done.hidden = false;

      if (lenis) lenis.scrollTo(0, { immediate: false, duration: 0.9 });
      else window.scrollTo({ top: 0, behavior: 'smooth' });

      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  }

  /* ---------------------------------------------------------
     7. GSAP CHOREOGRAPHY
     --------------------------------------------------------- */
  function initGsap() {
    // Safety: the hero headline starts hidden (translateY 115%) so GSAP can
    // slide it in. If GSAP never loads (CDN blocked, slow net, JS error) the
    // H1 would stay invisible forever — reveal it unconditionally first.
    const revealHero = () => {
      document.querySelectorAll('.hero .line-inner').forEach((el) => {
        el.style.transform = 'none';
      });
      document.querySelectorAll('.hero-sub, .hero-actions, .hero-meta, .hero-visual')
        .forEach((el) => { el.style.opacity = '1'; });
    };

    if (typeof gsap === 'undefined') { revealHero(); return; }
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

    const reduced = prefersReduced;

    /* ---- hero line masks ---- */
    if (!reduced) {
      gsap.to('.hero .line-inner', {
        y: 0,
        duration: 1.25,
        ease: 'expo.out',
        stagger: 0.09,
        delay: 0.15
      });
      gsap.from('.hero-sub, .hero-actions, .hero-meta', {
        y: 26, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1, delay: 0.55
      });
      gsap.from('.hero-visual', {
        y: 60, opacity: 0, scale: 0.96, duration: 1.5, ease: 'expo.out', delay: 0.35
      });
      gsap.from('.hero .scroll-hint', { opacity: 0, duration: 1, delay: 1.4 });

      // Belt-and-braces: if the intro tween was interrupted (tab backgrounded
      // mid-load, animation frame starved) force the final state.
      setTimeout(revealHero, 4000);
      // Same safety net for the scroll reveals: anything still hidden after
      // the intro must not stay invisible.
      setTimeout(() => {
        document.querySelectorAll('[data-reveal]').forEach((el) => {
          if (getComputedStyle(el).opacity === '0') {
            el.style.opacity = '1';
            el.style.transform = 'none';
          }
        });
      }, 6000);
    } else {
      gsap.set('.hero .line-inner', { y: 0 });
    }

    if (!window.ScrollTrigger) return;

    /* ---- generic reveals ---- */
    if (!reduced) {
      document.querySelectorAll('[data-reveal]').forEach((el) => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 1.05,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
      });

      /* staggered groups */
      ['[data-reveal-group]'].forEach((sel) => {
        document.querySelectorAll(sel).forEach((group) => {
          const kids = group.querySelectorAll('[data-reveal]');
          if (!kids.length) return;
          gsap.to(kids, {
            opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.09,
            scrollTrigger: { trigger: group, start: 'top 82%', once: true }
          });
        });
      });
    } else {
      gsap.set('[data-reveal]', { opacity: 1, y: 0 });
    }

    /* ---- parallax: split visuals ---- */
    if (!reduced && !isTouch) {
      document.querySelectorAll('.split-visual-inner').forEach((inner) => {
        gsap.fromTo(inner,
          { yPercent: -7 },
          {
            yPercent: 7,
            ease: 'none',
            scrollTrigger: {
              trigger: inner.closest('.split-visual'),
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1
            }
          }
        );
      });
    }

    /* ---- hero: subtle parallax + fade as you leave ---- */
    if (!reduced) {
      const heroInner = document.querySelector('.hero-inner');
      if (heroInner) {
        gsap.to(heroInner, {
          y: -70,
          opacity: 0.45,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.3 }
        });
      }
      const heroVisual = document.querySelector('.hero-visual');
      if (heroVisual) {
        gsap.to(heroVisual, {
          y: -140,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 }
        });
      }
      /* ---- hero background: zoom out + parallax on scroll ---- */
      const heroBg = document.querySelector('.hero-bg-img');
      if (heroBg) {
        gsap.fromTo(heroBg,
          { scale: 1.15 },
          {
            scale: 1.0,
            ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 }
          }
        );
      }
      const heroOverlay = document.querySelector('.hero-bg-overlay');
      if (heroOverlay) {
        gsap.to(heroOverlay, {
          opacity: 0.4,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 }
        });
      }
    }

    /* ---- process rows: staggered entry ---- */
    if (!reduced) {
      gsap.from('.process-row', {
        opacity: 0,
        y: 30,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: '.process-list', start: 'top 82%', once: true }
      });
    }

    /* ---- product cards: handled by data-reveal-group above ---- */

    /* ---- section headings: gentle rise ---- */
    if (!reduced) {
      document.querySelectorAll('.section-head h2').forEach((h) => {
        gsap.from(h, {
          opacity: 0, y: 34, duration: 1.1, ease: 'expo.out',
          scrollTrigger: { trigger: h, start: 'top 88%', once: true }
        });
      });
    }

    ScrollTrigger.refresh();
  }

  /* ---------------------------------------------------------
     8. PROCESS FILMS
     --------------------------------------------------------- */
  function initFilms() {
    const films = Array.from(document.querySelectorAll('.split-visual-film'));
    if (!films.length) return;

    // reduced motion: no autoplay, the poster frame stays put
    if (prefersReduced) {
      films.forEach((v) => {
        v.removeAttribute('autoplay');
        v.pause();
        v.addEventListener('play', () => v.pause());
      });
      return;
    }

    // Autoplay is blocked until the clip is actually visible, and we stop it
    // again once it scrolls away — two always-on videos would keep the GPU
    // busy for no reason on a laptop like this one.
    films.forEach((v) => {
      const play = () => {
        const p = v.play();
        if (p && p.catch) p.catch(() => {});   // ignore autoplay rejections
      };
      if (!('IntersectionObserver' in window)) { play(); return; }
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) play();
          else v.pause();
        });
      }, { threshold: 0.25 });
      io.observe(v);
    });

    // If the browser refuses to autoplay at all, the poster frame is still a
    // usable image, so there is nothing to fall back to.
  }

  /* ---------------------------------------------------------
     9. PRELOADER
     --------------------------------------------------------- */
  function initLoader() {
    const loader = document.getElementById('loader');
    const bar = document.getElementById('loader-bar');
    const pct = document.getElementById('loader-pct');
    if (!loader) {
      document.body.classList.remove('is-loading');
      return;
    }

    let p = 0;
    let done = false;

    const timer = setInterval(() => {
      // ease toward 92 while assets settle, then finish
      const step = p < 70 ? 9 : p < 90 ? 3 : 1.2;
      p = Math.min(p + step, 100);
      if (bar) bar.style.width = p + '%';
      if (pct) pct.textContent = String(Math.round(p)).padStart(3, '0') + '%';

      if (p >= 100 && !done) {
        done = true;
        clearInterval(timer);
        setTimeout(finish, 260);
      }
    }, 55);

    function finish() {
      loader.classList.add('is-done');
      document.body.classList.remove('is-loading');
      if (lenis) lenis.start();
      if (window.ScrollTrigger) ScrollTrigger.refresh();
      setTimeout(() => loader.remove(), 800);
    }

    // hard safety: never trap the user behind the loader
    setTimeout(() => {
      if (!done) { done = true; clearInterval(timer); finish(); }
    }, 4000);
  }

  /* ---------------------------------------------------------
     10. BOOT
     --------------------------------------------------------- */
  function boot() {
    if (prefersReduced) document.documentElement.classList.add('no-motion');

    // Opt in to the hidden-until-revealed state only now that JS is running.
    // The CSS default is visible, so a failed script leaves the page readable.
    if (typeof gsap !== 'undefined') {
      document.documentElement.classList.add('js-reveal');
    }

    lenis = initLenis();
    if (lenis) lenis.stop(); // hold scroll until loader clears

    initChrome();
    initNav();
    initAnchors();
    initFaq();
    initForm();
    initFilms();
    initGsap();
    initLoader();

    // year stamp
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    // expose for debugging / teardown
    window.__insolab = {
      lenis,
      reduced: prefersReduced,
      scrollTo: (t) => (lenis ? lenis.scrollTo(t) : window.scrollTo(0, t))
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
