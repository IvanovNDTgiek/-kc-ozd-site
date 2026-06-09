import { readIds, readFavoriteMeta, syncFavoriteButtons } from './favorites.js';
import { FAVORITES_CATALOG } from './favorites-catalog.js';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {Document} doc
 */
export function initFavoritesPage(doc) {
  var root = doc.querySelector('[data-favorites-list]');
  var empty = doc.querySelector('[data-favorites-empty]');
  if (!root) {
    return;
  }

  function resolveMeta(id) {
    if (FAVORITES_CATALOG[id]) {
      return FAVORITES_CATALOG[id];
    }
    var dyn = readFavoriteMeta()[id];
    if (!dyn || !dyn.title || !dyn.href) {
      return null;
    }
    return {
      href: dyn.href,
      title: dyn.title,
      kind: dyn.kind || 'Избранное',
      snippet: dyn.excerpt || '',
    };
  }

  function render() {
    var ids = readIds();
    var rows = ids
      .map(function (id) {
        var meta = resolveMeta(id);
        return meta ? { id: id, meta: meta } : null;
      })
      .filter(Boolean);

    if (!rows.length) {
      root.innerHTML = '';
      root.hidden = true;
      if (empty instanceof HTMLElement) {
        empty.hidden = false;
      }
      return;
    }

    root.hidden = false;
    if (empty instanceof HTMLElement) {
      empty.hidden = true;
    }

    root.innerHTML = rows
      .map(function (row) {
        var m = row.meta;
        var id = row.id;
        var safeTitle = escapeHtml(m.title);
        var safeKind = escapeHtml(m.kind);
        var safeSnippet = escapeHtml(m.snippet);
        var ext = /^https?:\/\//i.test(m.href);
        var linkAttrs = ext ? ' target="_blank" rel="noopener noreferrer"' : '';
        return (
          '<li class="favorites-list__item" data-favorite-item="" data-fav-title="' +
          escapeHtml(m.title) +
          '" data-fav-url="' +
          escapeHtml(m.href) +
          '" data-fav-snippet="' +
          escapeHtml(m.snippet) +
          '" data-fav-kind="' +
          safeKind +
          '">' +
          '<article class="favorite-card">' +
          '<p class="favorite-card__kind">' +
          safeKind +
          '</p>' +
          '<h3 class="favorite-card__title"><a class="favorite-card__link" href="' +
          escapeHtml(m.href) +
          '"' +
          linkAttrs +
          '>' +
          safeTitle +
          '</a></h3>' +
          '<p class="favorite-card__snippet">' +
          safeSnippet +
          '</p>' +
          '<button class="favorite-card__fav" type="button" data-favorite-toggle="' +
          escapeHtml(id) +
          '" aria-pressed="true" aria-label="Убрать из избранного: ' +
          safeTitle +
          '">★</button>' +
          '</article></li>'
        );
      })
      .join('');

    syncFavoriteButtons(doc);
  }

  render();
  window.addEventListener('kc-ozd-favorites-change', function () {
    render();
  });
}
