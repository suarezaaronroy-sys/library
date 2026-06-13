/* ==========================================================
   personality.js — Aaron Suarez Library
   Features: wallpaper · typewriter · cursor glow · scroll reveal · ghost vpet
   ========================================================== */
(function () {
  'use strict';

  /* ── 1. DOT NOTEBOOK WALLPAPER ─────────────────────────── */
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
    pat.setAttribute('width', '22');
    pat.setAttribute('height', '22');
    pat.setAttribute('patternUnits', 'userSpaceOnUse');

    var dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', '11');
    dot.setAttribute('cy', '11');
    dot.setAttribute('r', '1');
    dot.setAttribute('fill', '#1C1917');
    dot.setAttribute('opacity', '0.09');

    pat.appendChild(dot);
    defs.appendChild(pat);

    var rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'url(#grim-pat)');

    svg.appendChild(defs);
    svg.appendChild(rect);
    document.body.appendChild(svg);
  }

  /* ── 2. TYPEWRITER/* ── 2. TYPEWRITER HERO ─────────────────────────────────── */
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

  /* ── 5. GRIMOIRE GHOST VPET ─────────────────────────────── */
  function initGhost() {
    var SIZE = 72;
    var wrap = document.createElement('div');
    wrap.id = 'grimoire-ghost';
    wrap.setAttribute('title', 'Grimoire Ghost — the library spirit');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', 'Animated library ghost mascot');

    var canvas = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);

    var ctx = canvas.getContext('2d');
    var bounce  = { active: false, t: 0 };
    var excited = false;

    wrap.addEventListener('click', function () {
      if (!bounce.active) { bounce.active = true; bounce.t = 0; }
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
      if (blink) {
        ctx.strokeStyle = '#1C1917';
        ctx.lineWidth   = 1.8;
        ctx.lineCap     = 'round';
        ctx.beginPath(); ctx.moveTo(-8, eyeY); ctx.lineTo(-4, eyeY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( 4, eyeY); ctx.lineTo( 8, eyeY); ctx.stroke();
      } else {
        ctx.fillStyle = '#1C1917';
        ctx.beginPath(); ctx.arc(-6, eyeY, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( 6, eyeY, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-5.2, eyeY - 0.8, 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( 6.8, eyeY - 0.8, 0.9, 0, Math.PI * 2); ctx.fill();
      }

      /* mouth */
      ctx.fillStyle = 'rgba(194,65,12,0.55)';
      ctx.beginPath();
      if (excited) {
        ctx.ellipse(0, -bodyH / 2 + 15, 3.5, 2.5, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(0, -bodyH / 2 + 15, 1.8, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.restore();

      /* sparkles */
      var sparks = [
        { dx: -25, dy: -15, ph: 0   },
        { dx:  26, dy: -19, ph: 1.3 },
        { dx: -20, dy:  12, ph: 2.5 },
        { dx:  22, dy:  11, ph: 0.7 },
      ];
      sparks.forEach(function (sp) {
        var alpha = 0.22 + 0.55 * Math.sin(ms / 650 + sp.ph);
        ctx.save();
        ctx.translate(SIZE / 2 + sp.dx, SIZE / 2 + sp.dy + floatY * 0.35);
        ctx.rotate(ms / 2400 + sp.ph);
        ctx.fillStyle = 'rgba(194,65,12,' + alpha.toFixed(2) + ')';
        for (var arm = 0; arm < 4; arm++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0.8, 3.5);
          ctx.lineTo(0, 7);
          ctx.lineTo(-0.8, 3.5);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      });

      /* bounce */
      if (bounce.active) {
        bounce.t++;
        wrap.style.transform = 'translateY(' +
          (-Math.abs(Math.sin(bounce.t * 0.13)) * 16).toFixed(1) + 'px)';
        if (bounce.t > 48) {
          bounce.active = false;
          wrap.style.transform = '';
        }
      }
    }

    requestAnimationFrame(function loop(ts) {
      drawGhost(ts || 0);
      requestAnimationFrame(loop);
    });
  }

  /* ── BOOT ──────────────────────────────────────────────── */
  function boot() {
    initWallpaper();
    initTypewriter();
    initCursorGlow();
    initScrollReveal();
    initGhost();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

}());
