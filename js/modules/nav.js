/**
 * @param {Document} doc
 */
export function initNav(doc) {
  var toggle = doc.querySelector('[data-nav-toggle]');
  var nav = doc.getElementById('site-nav');
  if (!toggle || !nav) {
    return;
  }
  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  doc.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}
