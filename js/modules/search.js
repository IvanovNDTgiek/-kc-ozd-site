import { debounce } from './utils.js';

/**
 * @param {Document} doc
 */
export function initSiteSearch(doc) {
  var input = doc.querySelector('[data-site-search]');
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  var roots = doc.querySelectorAll('[data-search-root]');

  function applyQuery(q) {
    var query = q.trim().toLowerCase();
    roots.forEach(function (root) {
      var items = root.querySelectorAll('[data-search-item]');
      var emptyMsg = root.parentElement && root.parentElement.querySelector('[data-search-empty]');
      var visible = 0;
      items.forEach(function (item) {
        var hay = (item.getAttribute('data-search-text') || item.textContent || '').toLowerCase();
        var show = !query || hay.indexOf(query) !== -1;
        item.classList.toggle('is-hidden', !show);
        if (show) {
          visible++;
        }
      });
      if (emptyMsg instanceof HTMLElement) {
        emptyMsg.hidden = visible > 0 || !query;
      }
    });
  }

  var debounced = debounce(function () {
    applyQuery(input.value);
  }, 200);

  input.addEventListener('input', debounced);
  input.addEventListener('search', function () {
    applyQuery(input.value);
  });
}
