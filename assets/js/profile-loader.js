/* =====================================================================
   profile-loader.js
   Fetches data/profile.json and populates the dynamic regions of the
   home page, then loads main.js so vendor widgets (Typed, Swiper,
   PureCounter) initialize against the populated DOM.

   If the fetch fails, the page keeps whatever static fallback content
   is in index.html — so the site stays usable.
   ===================================================================== */
(function () {
  'use strict';

  const PROFILE_URL = 'data/profile.json?_=' + Date.now();
  const MAIN_JS = 'assets/js/main.js';

  fetch(PROFILE_URL)
    .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
    .then(populate)
    .catch(err => {
      console.warn('[profile-loader] using static fallback:', err.message);
    })
    .finally(loadMain);

  function loadMain() {
    const s = document.createElement('script');
    s.src = MAIN_JS;
    s.defer = false;
    document.body.appendChild(s);
  }

  function setText(sel, val) {
    const el = document.querySelector(sel);
    if (el && val != null) el.textContent = val;
  }
  function setAttr(sel, attr, val) {
    const el = document.querySelector(sel);
    if (el && val != null) el.setAttribute(attr, val);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function tagsHtml(tags) {
    return (tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  }

  function populate(d) {
    /* ── Hero ── */
    if (d.hero) {
      setText('.hero-greeting', d.hero.greeting);
      setText('.hero-name', d.hero.name);
      setText('.hero-bio', d.hero.bio);
      if (Array.isArray(d.hero.typedItems)) {
        setAttr('.typed', 'data-typed-items', d.hero.typedItems.join(','));
      }
      const cv = document.querySelector('.btn-hero-primary');
      if (cv && d.hero.cvFile) {
        cv.setAttribute('href', d.hero.cvFile);
        cv.setAttribute('download', d.hero.cvFile.split('/').pop());
      }
    }

    /* ── Stats ── */
    if (d.stats) {
      const stats = document.querySelectorAll('.stats-bar .purecounter');
      const order = ['years', 'companies', 'projects', 'certifications'];
      order.forEach((k, i) => {
        if (stats[i] && d.stats[k] != null) {
          stats[i].setAttribute('data-purecounter-end', d.stats[k]);
          stats[i].textContent = '0';
        }
      });
    }

    /* ── About ── */
    if (d.about) {
      setText('[data-bind-text="about.heading"]', d.about.heading);
      const paras = document.querySelectorAll('[data-bind-text="about.paragraph"]');
      (d.about.paragraphs || []).forEach((p, i) => {
        if (paras[i]) paras[i].textContent = p;
      });
      if (d.about.info) {
        for (const k of ['name', 'role', 'email', 'location', 'status']) {
          setText(`[data-bind-text="about.info.${k}"]`, d.about.info[k]);
        }
      }
    }

    /* ── Skills ── */
    const skillsHost = document.querySelector('[data-render="skills"]');
    if (skillsHost && Array.isArray(d.skills)) {
      skillsHost.innerHTML = d.skills.map((s, i) => `
        <div class="col-md-6 col-lg-4 reveal-up" style="--delay: ${i * 100}ms">
          <div class="skill-card">
            <div class="skill-card-icon">
              <i class="bi ${esc(s.icon)}"></i>
            </div>
            <h3>${esc(s.title)}</h3>
            <p>${esc(s.description)}</p>
            <div class="tags-wrap">${tagsHtml(s.tags)}</div>
          </div>
        </div>
      `).join('');
    }

    /* ── Experience ── */
    const expHost = document.querySelector('[data-render="experience"]');
    if (expHost && Array.isArray(d.experience)) {
      const last = d.experience.length - 1;
      expHost.innerHTML = d.experience.map((e, i) => {
        const dotClass = e.current ? 'tl-dot tl-dot-active' : (i === last ? 'tl-dot tl-dot-last' : 'tl-dot');
        const badge = e.current
          ? '<span class="tl-badge tl-badge-active">' + esc(e.badge || 'Current') + '</span>'
          : (e.badge ? '<span class="tl-badge">' + esc(e.badge) + '</span>' : '');
        return `
        <div class="timeline-item reveal-up">
          <div class="${dotClass}"></div>
          <div class="tl-card">
            <div class="tl-card-top">
              <div class="tl-title-group">
                <h3 class="tl-role">${esc(e.role)}</h3>
                <span class="tl-company">${esc(e.company)}</span>
              </div>
              ${badge}
            </div>
            <div class="tl-meta">
              <span><i class="bi bi-calendar3"></i> ${esc(e.period)}</span>
              <span><i class="bi bi-geo-alt"></i> ${esc(e.location)}</span>
            </div>
            <p class="tl-desc">${esc(e.description)}</p>
            <div class="tags-wrap">${tagsHtml(e.tags)}</div>
          </div>
        </div>
      `;
      }).join('');
    }

    /* ── Projects ── */
    const projHost = document.querySelector('[data-render="projects"]');
    if (projHost && Array.isArray(d.projects)) {
      projHost.innerHTML = d.projects.map((p, i) => `
        <div class="col-lg-6 reveal-up"${i > 0 ? ` style="--delay: ${i * 150}ms"` : ''}>
          <div class="project-card${p.featured ? ' project-card-featured' : ''}">
            <div class="project-card-header">
              <div class="project-icon">
                <i class="bi ${esc(p.icon)}"></i>
              </div>
              ${p.link ? `<a href="${esc(p.link)}" target="_blank" class="project-ext-link" title="View Project"><i class="bi bi-arrow-up-right"></i></a>` : ''}
            </div>
            <h3>${esc(p.title)}</h3>
            <p>${esc(p.description)}</p>
            <div class="tags-wrap">${tagsHtml(p.tags)}</div>
          </div>
        </div>
      `).join('');
    }

    /* ── Testimonials ── */
    const testHost = document.querySelector('[data-render="testimonials"]');
    if (testHost && Array.isArray(d.testimonials)) {
      testHost.innerHTML = d.testimonials.map(t => `
        <div class="swiper-slide">
          <div class="testimonial-card">
            <i class="bi bi-quote testimonial-quote-icon"></i>
            <p class="testimonial-text">${esc(t.text)}</p>
            <div class="testimonial-author">
              <img src="${esc(t.avatar)}" alt="${esc(t.author)}" class="testimonial-avatar">
              <div class="testimonial-author-info">
                <strong>${esc(t.author)}</strong>
                <span>${esc(t.role)}</span>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    }

    /* ── Education ── */
    if (d.education) {
      setText('[data-bind-text="education.degree"]', d.education.degree);
      setText('[data-bind-text="education.institution"]', d.education.institution);
      const periodEl = document.querySelector('[data-bind-text="education.period"]');
      if (periodEl) periodEl.innerHTML = '<i class="bi bi-calendar3"></i> ' + esc(d.education.period);
    }

    /* ── Certifications ── */
    const certHost = document.querySelector('[data-render="certifications"]');
    if (certHost && Array.isArray(d.certifications)) {
      certHost.innerHTML = d.certifications.map(c => `
        <div class="cert-item">
          <div class="cert-icon"><i class="bi bi-patch-check-fill"></i></div>
          <div>
            <strong>${esc(c.title)}</strong>
            <span>${esc(c.issuer)}</span>
          </div>
        </div>
      `).join('');
    }

    /* ── Contact ── */
    if (d.contact) {
      setText('[data-bind-text="contact.intro"]', d.contact.intro);
      setText('[data-bind-text="contact.location"]', d.contact.location);
      const emailEl = document.querySelector('[data-bind-text="contact.email"]');
      if (emailEl && d.contact.email) {
        emailEl.innerHTML = `<a href="mailto:${esc(d.contact.email)}">${esc(d.contact.email)}</a>`;
      }
    }

    /* ── Social links (hero, contact, footer) ── */
    if (d.social) {
      const socialMap = {
        linkedin: '.bi-linkedin',
        github: '.bi-github',
        facebook: '.bi-facebook',
        twitter: '.bi-twitter-x',
        instagram: '.bi-instagram'
      };
      for (const [key, iconSel] of Object.entries(socialMap)) {
        if (!d.social[key]) continue;
        document.querySelectorAll(iconSel).forEach(icon => {
          const a = icon.closest('a');
          if (a) a.setAttribute('href', d.social[key]);
        });
      }
    }

    /* ── Footer ── */
    if (d.footer) {
      setText('[data-bind-text="footer.tagline"]', d.footer.tagline);
      setText('[data-bind-text="footer.copyright"]', d.footer.copyright);
    }
  }
})();
