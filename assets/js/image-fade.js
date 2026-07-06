// image-fade.js — fade content images in once decoded, removing the pop-in flicker.
// Crash-proof: images only start hidden when the .js-img class is present (set
// inline in <head>), so a JS failure leaves them fully visible.
(function () {
  var SEL = ".home-cover-img,.about-cover-img,.notes-cover-img,.library-cover-img,.contact-cover-img,.home-evidence-item img,.home-proof img,.about-signature img";
  var imgs = document.querySelectorAll(SEL);
  Array.prototype.forEach.call(imgs, function (img) {
    img.decoding = "async";
    function done() { img.classList.add("is-loaded"); }
    if (img.complete && img.naturalWidth > 0) { done(); }
    else {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
  });
})();
