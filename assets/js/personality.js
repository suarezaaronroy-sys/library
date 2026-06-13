/* ==========================================================
   personality.js — Aaron Suarez Library
   Features: wallpaper · typewriter · cursor glow · scroll reveal · ghost vpet
   ========================================================== */
(function () {
  'use strict';

  /* ── 1. DIAGONAL WALLPAPER ──────────────────────────────── */
  function initWallpaper() {
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.id = 'grim-wallpaper';
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('aria-hidden', 'true');

    var defs = document.createElementNS(svgNS, 'defs');

    var pat = document.createElementNS(svgNS, 'pattern');
    pat.setAttribute('id', 'grim-pat');
    pat.setAttribute('x', '0');
    pat.setAttribute('y', '0');
    pat.setAttribute('width', '196');
    pat.setAttribute('height', '40');
    pat.setAttribute('patternUnits', 'userSpaceOnUse');
    pat.setAttribute('patternTransform', 'rotate(-45)');

    var txt = document.createElementNS(svgNS, 'text');
    txt.setAttribute('x', '6');
    txt.setAttribute('y', '28');
    txt.setAttribute('font-family', 'monospace');
    txt.setAttribute('font-size', '9');
    txt.setAttribute('letter-spacing', '7');
    txt.setAttribute('fill', '#1C1917');
    txt.setAttribute('opacity', '0.038');
    txt.textContent = 'GRIMOIRE .';

    pat.appendChild(txt);
    defs.appendChild(pat);

    var rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'url(#grim-pat)');

    svg.appendChild(defs);
    svg.appendChild(rect);
    document.body.appendChild(svg);
  }

  /* ── 2. TYPEWRITER HERO ─────────────────────────────────── */
  function initTypewriter() {
    var h1 = document.querySelector('.hero h1');
    if (!h1 || !h1.textContent.includes('Everything I build')) return;

    var plain  = 'Everything I build, ';
    var italic = 'I write down.';

    h1.setAttribute('aria-label', plain + italic);
    h1.innerHTML =
      '<span class="tw-plain"></span>' +
      '<em class="tw-em"></em>' +
      '<span class="tw-cursor" aria-hidden="true"></span>';

    var plainEl  = h1.querySelector('.tw-plain');
    var emEl     = h1.querySelector('.tw-em');
    var cursorEl = h1.querySelector('.tw-cursor');
    var pi = 0, ei = 0, phase = 0;

    function jitter(base) { return base + Math.random() * 22; }

    function tick() {
      if (phase === 0) {
        if (pi < plain.length) {
          plainEl.textContent = plain.slice(0, ++pi);
          setTimeout(tick, pi < 5 ? 130 : jitter(48));
        } else {
          phase = 1;
          setTimeout(tick, 240);
        }
      } else {
        if (ei < italic.length) {
          emEl.textContent = italic.slice(0, ++ei);
          setTimeout(tick, ei < 2 ? 170 : jitter(55));
        } else {
          cursorEl.style.transition = 'opacity .6s';
          cursorEl.style.opacity = '0';
          setTimeout(function () { if (cursorEl.parentNode) cursorEl.remove(); }, 700);
        }
      }
    }

    setTimeout(tick, 500);
  }

  /* ── 3. CURSOR GLOW ─────────────────────────────────────── */
  function initCursorGlow() {
    var darkSections = document.querySelectorAll('.trilogy-band');
    darkSections.forEach(function (section) {
      var glow = document.createElement('div');
      glow.className = 'cursor-glow';
      glow.setAttribute('aria-hidden', 'true');
      section.style.overflow = 'hidden';
      section.appendChild(glow);

      var raf = null;
      var targetX = 0, targetY = 0;
      var curX = 0, curY = 0;

      section.addEventListener('mousemove', function (e) {
        var r = section.getBoundingClientRect();
        targetX = e.clientX - r.left;
        targetY = e.clientY - r.top;
        glow.style.opacity = '1';
        if (!raf) raf = requestAnimationFrame(step);
      });

      section.addEventListener('mouseleave', function () {
        glow.style.opacity = '0';
        cancelAnimationFrame(raf);
        raf = null;
      });

      function step() {
        curX += (targetX - curX) * 0.12;
        curY += (targetY - curY) * 0.12;
        glow.style.left = curX + 'px';
        glow.style.top  = curY + 'px';
        raf = requestAnimationFrame(step);
      }
    });
  }

  /* ── 4. SCROLL REVEAL ───────────────────────────────────── */
  function initScrollReveal() {
    var sel = '.g-card, .note-row, .section-h, .proof-pill, .cta-band';
    var targets = Array.from(document.querySelectorAll(sel));
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('reveal-in'); });
      return;
    }

    var vh = window.innerHeight;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var peers = Array.from(el.parentElement.querySelectorAll('.reveal-pending'));
        var idx   = peers.indexOf(el);
        setTimeout(function () {
          el.classList.remove('reveal-pending');
          el.classList.add('reveal-in');
        }, Math.max(0, idx) * 55);
        observer.unobserve(el);
      });
    }, { threshold: 0.1 });

    targets.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top > vh * 0.85) {
        el.classList.add('reveal-pending');
        observer.observe(el);
      }
    });
  }

  /* ── 5. GRIMOIRE GHOST + POPUP ──────────────────────────── */
  function initGhost() {
    /* ── POPUP ── */
    var overlay = document.createElement('div');
    overlay.id = 'ghost-popup-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Where do you want to start?');

    overlay.innerHTML = [
      '<div id="ghost-popup">',
      '  <button id="ghost-popup-close" aria-label="Close">&times;</button>',
      '  <div id="ghost-popup-icon">👻</div>',
      '  <p id="ghost-popup-hed">Where do you want to start?</p>',
      '  <p id="ghost-popup-sub">Pick one — I\'ll open it for you.</p>',
      '  <div id="ghost-popup-cards">',
      '    <a class="gp-card" href="/grimoires/014-remote-work-101.html">',
      '      <span class="gp-card-emoji">🌏</span>',
      '      <strong>Are you new here?</strong>',
      '      <span>Remote Work 101 — the Filipino VA field manual. Start here.</span>',
      '    </a>',
      '    <a class="gp-card" href="/grimoires/011-organizational-physics.html">',
      '      <span class="gp-card-emoji">🔬</span>',
      '      <strong>Are you a client?</strong>',
      '      <span>Organizational Physics — why systems keep producing the same problems.</span>',
      '    </a>',
      '    <a class="gp-card" href="/grimoires/001-ghl-crm-101.html">',
      '      <span class="gp-card-emoji">⚙️</span>',
      '      <strong>Just browsing?</strong>',
      '      <span>GHL CRM 101 — 76 fields, 24 automations, full QA layer.</span>',
      '    </a>',
      '  </div>',
      '  <p id="ghost-popup-footer"><a href="/projects/">Browse all 14 grimoires →</a></p>',
      '</div>'
    ].join('\n');

    document.body.appendChild(overlay);

    function openPopup() {
      overlay.classList.add('gp-visible');
      document.body.style.overflow = 'hidden';
    }
    function closePopup() {
      overlay.classList.remove('gp-visible');
      document.body.style.overflow = '';
    }

    document.getElementById('ghost-popup-close').addEventListener('click', closePopup);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePopup();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePopup();
    });

    // auto-open once per session
    if (!sessionStorage.getItem('gp-seen')) {
      setTimeout(function () {
        openPopup();
        sessionStorage.setItem('gp-seen', '1');
      }, 1800);
    }

    /* ── GHOST (now opens popup on click) ── */
    var SIZE = 72;
    var wrap = document.createElement('div');
    wrap.id = 'grimoire-ghost';
    wrap.setAttribute('title', 'Click to open the reading guide');
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', 'Open reading guide');

    var canvas = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);

    var ctx = canvas.getContext('2d');
    var bounce  = { active: false, t: 0 };
    var excited = false;

    wrap.addEventListener('click', function () {
      openPopup();
      if (!bounce.active) { bounce.active = true; bounce.t = 0; }
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') openPopup();
    });
    wrap.addEventListener('mouseenter', function () { excited = true; });
    wrap.addEventListener('mouseleave', function () { excited = false; });

    function drawGhost(ms) {
      ctx.clearRect(0, 0, SIZE, SIZE);

      var floatY  = Math.sin(ms / 750) * 4.5;
      var blink   = (Math.floor(ms / 1000) % 7 === 0) && (Math.floor(ms / 80) % 5 < 1);
      var waveAmp = excited ? 4 : 1.4;

      ctx.save();
      ctx.translate(SIZE / 2, SIZE / 2 + floatY);

      /* body */
      var R = 17, bodyH = 20;
      ctx.shadowColor = 'rgba(194,65,12,0.20)';
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = '#F5F2EC';
      ctx.strokeStyle = 'rgba(28,25,23,0.10)';
      ctx.lineWidth   = 0.9;

      ctx.beginPath();
      ctx.arc(0, -bodyH / 2, R, Math.PI, 0);
      ctx.lineTo(R, bodyH / 2 + 1);

      var bumpW = (R * 2) / 6;
      for (var i = 6; i >= 0; i--) {
        var bx = -R + i * bumpW;
        var by = bodyH / 2 + (i % 2 === 0 ? 3.5 : 0)
               + Math.sin(ms / (excited ? 180 : 600) + i * 0.9) * waveAmp;
        ctx.lineTo(bx, by);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();

      /* eyes */
      var eyeY = -bodyH / 2 + 9;
      if (b