// GitHub Pages cannot issue HTTP redirects. Preserve deep links client-side.
(function () {
  var path = window.location.pathname.replace(/^\/library(?=\/|$)/, '') || '/';
  window.location.replace('https://dlibrary-omega.vercel.app' + path + window.location.search + window.location.hash);
}());
