// Changelog modal — opened from the footer version chip.
(function () {
  var backdrop = document.getElementById('cl-backdrop');
  var chip = document.getElementById('cl-chip');
  var closeBtn = document.getElementById('cl-close');
  if (!backdrop || !chip || !closeBtn) return;

  var lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }
  function close() {
    backdrop.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  chip.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !backdrop.hidden) close();
  });
})();
