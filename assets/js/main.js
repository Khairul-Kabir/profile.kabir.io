(function () {
  'use strict';

  /* ---- Navbar scroll effect ---- */
  const navbar = document.getElementById('navbar');
  const onScroll = () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Mobile nav toggle ---- */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      const isOpen = navLinks.classList.contains('open');
      navToggle.setAttribute('aria-expanded', isOpen);
    });

    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
      });
    });
  }

  /* ---- Active nav link on scroll ---- */
  const sections = document.querySelectorAll('section[id], div[id]');
  const navLinkItems = document.querySelectorAll('.nav-links .nav-link[href^="#"]');

  const updateActiveLink = () => {
    const scrollPos = window.scrollY + 100;
    sections.forEach(section => {
      const top = section.offsetTop;
      const bottom = top + section.offsetHeight;
      if (scrollPos >= top && scrollPos < bottom) {
        navLinkItems.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + section.id);
        });
      }
    });
  };

  window.addEventListener('scroll', updateActiveLink, { passive: true });
  updateActiveLink();

  /* ---- Back to top ---- */
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
  }

  /* ---- Typed.js hero animation ---- */
  const typedEl = document.querySelector('.typed');
  if (typedEl && typeof Typed !== 'undefined') {
    const items = typedEl.getAttribute('data-typed-items').split(',');
    new Typed('.typed', {
      strings: items,
      loop: true,
      typeSpeed: 80,
      backSpeed: 40,
      backDelay: 2400,
    });
  }

  /* ---- Testimonials Swiper ---- */
  if (typeof Swiper !== 'undefined') {
    new Swiper('.testimonials-slider', {
      speed: 600,
      loop: true,
      autoplay: {
        delay: 5500,
        disableOnInteraction: false,
      },
      slidesPerView: 1,
      spaceBetween: 30,
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      breakpoints: {
        768: { slidesPerView: 1 },
        1024: { slidesPerView: 1 },
      },
    });
  }

  /* ---- PureCounter ---- */
  if (typeof PureCounter !== 'undefined') {
    new PureCounter();
  }

  /* ---- Contact form (FormSubmit AJAX) ---- */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    const loading = contactForm.querySelector('.loading');
    const errorMsg = contactForm.querySelector('.error-message');
    const sentMsg = contactForm.querySelector('.sent-message');
    const submitBtn = contactForm.querySelector('.btn-submit');

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (loading) loading.style.display = 'block';
      if (errorMsg) errorMsg.style.display = 'none';
      if (sentMsg) sentMsg.style.display = 'none';
      if (submitBtn) submitBtn.disabled = true;

      const data = Object.fromEntries(new FormData(contactForm));

      try {
        const res = await fetch('https://formsubmit.co/ajax/me@khairulkabir.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(data),
        });
        const result = await res.json().catch(() => ({}));

        if (loading) loading.style.display = 'none';

        if (res.ok && (result.success === 'true' || result.success === true)) {
          if (sentMsg) sentMsg.style.display = 'block';
          contactForm.reset();
        } else {
          if (errorMsg) {
            errorMsg.textContent = result.message || 'Sorry, something went wrong. Please email me directly at me@khairulkabir.com.';
            errorMsg.style.display = 'block';
          }
        }
      } catch (err) {
        if (loading) loading.style.display = 'none';
        if (errorMsg) {
          errorMsg.textContent = 'Network error. Please email me directly at me@khairulkabir.com.';
          errorMsg.style.display = 'block';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  /* ---- Scroll-reveal animations ---- */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right').forEach(el => {
    revealObserver.observe(el);
  });

})();
