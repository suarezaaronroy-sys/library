// grimoire-anchors.js — deep-link support shared by all grimoire pages.
// Grimoires are self-contained HTML; this is their only site dependency and
// every feature no-ops safely if the file is viewed standalone.
// 1. Lands #hash arrivals precisely (instant scroll, immune to the pages'
//    smooth-scroll/sidebar-sync cancellation) with a brief highlight pulse.
// 2. Adds a hover ¶ copy-link to every anchored section, chapter, and heading.
(function () {
  "use strict";

  var style = document.createElement("style");
  style.textContent =
    "[id]{scroll-margin-top:84px}" +
    ".ga-link{margin-left:.45rem;font:inherit;font-size:.75em;text-decoration:none;color:#0D9488;opacity:0;transition:opacity .15s;cursor:pointer}" +
    ":hover>.ga-link,.ga-link:focus{opacity:.7}" +
    ".ga-link:hover{opacity:1}" +
    "@keyframes gaPulse{0%{box-shadow:0 0 0 3px rgba(13,148,136,.55)}100%{box-shadow:0 0 0 6px rgba(13,148,136,0)}}" +
    ".ga-arrived{animation:gaPulse 2s ease-out 1;border-radius:4px}";
  document.head.appendChild(style);

  var SKIP = { top: 1, main: 1, "main-content": 1 };

  function anchoredElements() {
    var all = document.querySelectorAll("section[id],h2[id],h3[id],div[id]");
    return Array.prototype.filter.call(all, function (el) {
      if (SKIP[el.id]) return false;
      if (el.tagName === "DIV" && !/(^|\s)chapter(\s|$)/.test(el.className)) return false;
      return true;
    });
  }

  function headingFor(el) {
    if (/^H[23]$/.test(el.tagName)) return el;
    return el.querySelector(".module-title,.chapter-header h2,h1,h2,h3,h4");
  }

  function mark(el) {
    el.classList.remove("ga-arrived");
    void el.offsetWidth;
    el.classList.add("ga-arrived");
  }

  function flash(link, glyph) {
    var original = link.textContent;
    link.textContent = glyph;
    setTimeout(function () { link.textContent = original; }, 1200);
  }

  function addLinks() {
    anchoredElements().forEach(function (el) {
      var heading = headingFor(el);
      if (!heading || heading.querySelector(".ga-link")) return;
      var link = document.createElement("a");
      link.className = "ga-link";
      link.href = "#" + el.id;
      link.textContent = "¶";
      link.setAttribute("aria-label", "Copy link to this section");
      link.addEventListener("click", function (event) {
        event.preventDefault();
        var url = location.origin + location.pathname + "#" + el.id;
        history.replaceState(null, "", "#" + el.id);
        var copy = navigator.clipboard && navigator.clipboard.writeText
          ? navigator.clipboard.writeText(url)
          : Promise.reject();
        copy.then(function () { flash(link, "✓"); }, function () { flash(link, "#"); });
        mark(el);
      });
      heading.appendChild(link);
    });
  }

  function landOnHash(instant) {
    if (!location.hash) return;
    var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!target) return;
    if (instant) target.scrollIntoView({ behavior: "instant", block: "start" });
    mark(target);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addLinks);
  } else {
    addLinks();
  }
  window.addEventListener("load", function () {
    setTimeout(function () { landOnHash(true); }, 80);
  });
  window.addEventListener("hashchange", function () { landOnHash(false); });
})();
