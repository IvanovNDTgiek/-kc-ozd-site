var STORAGE_KEY = 'kc_ozd_favorites_v1';
var META_KEY = 'kc_ozd_favorites_meta_v1';

/**
 * @returns {string[]}
 */
export function readIds() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(function (x) {
      return typeof x === 'string' && x.length < 200;
    });
  } catch (e) {
    return [];
  }
}

/**
 * @returns {Record<string, { title: string, href: string, excerpt: string, kind: string }>}
 */
export function readFavoriteMeta() {
  try {
    var raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return {};
    }
    var o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch (e) {
    return {};
  }
}

/**
 * @param {Record<string, { title: string, href: string, excerpt: string, kind: string }>} obj
 */
function writeFavoriteMetaAll(obj) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(obj));
  } catch (e) {
    /* quota */
  }
}

/**
 * @param {string} id
 * @param {{ title: string, href: string, excerpt?: string, kind?: string }} entry
 */
function saveFavoriteMeta(id, entry) {
  var o = readFavoriteMeta();
  o[id] = {
    title: String(entry.title || '').slice(0, 400),
    href: String(entry.href || '').slice(0, 2000),
    excerpt: String(entry.excerpt || '').slice(0, 600),
    kind: String(entry.kind || 'Новость').slice(0, 120),
  };
  writeFavoriteMetaAll(o);
}

/**
 * @param {string} id
 */
function removeFavoriteMeta(id) {
  var o = readFavoriteMeta();
  if (o[id]) {
    delete o[id];
    writeFavoriteMetaAll(o);
  }
}

/**
 * @param {string[]} ids
 */
function writeIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    /* quota or private mode */
  }
}

function notifyFavoritesChanged() {
  try {
    window.dispatchEvent(new CustomEvent('kc-ozd-favorites-change'));
  } catch (e) {
    /* noop */
  }
}

/**
 * @param {Document} doc
 */
export function syncFavoriteButtons(doc) {
  var set = new Set(readIds());
  doc.querySelectorAll('[data-favorite-toggle]').forEach(function (btn) {
    var id = btn.getAttribute('data-favorite-toggle');
    if (!id) {
      return;
    }
    btn.setAttribute('aria-pressed', set.has(id) ? 'true' : 'false');
  });
}

/**
 * @param {Document} doc
 */
export function initFavorites(doc) {
  syncFavoriteButtons(doc);

  doc.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) {
      return;
    }
    var btn = t.closest('[data-favorite-toggle]');
    if (!(btn instanceof Element) || !doc.documentElement.contains(btn)) {
      return;
    }
    var id = btn.getAttribute('data-favorite-toggle');
    if (!id) {
      return;
    }
    var list = readIds();
    var idx = list.indexOf(id);
    var willAdd = idx === -1;
    if (willAdd) {
      list.push(id);
    } else {
      list.splice(idx, 1);
    }
    writeIds(list);

    if (willAdd) {
      var box = btn.closest('[data-favorite-item]');
      if (box) {
        var title = box.getAttribute('data-fav-title');
        var href = box.getAttribute('data-fav-url');
        var snippet = box.getAttribute('data-fav-snippet') || '';
        var kind = box.getAttribute('data-fav-kind') || 'Новость';
        if (title && href) {
          saveFavoriteMeta(id, { title: title, href: href, excerpt: snippet, kind: kind });
        }
      }
    } else {
      removeFavoriteMeta(id);
    }

    syncFavoriteButtons(doc);
    notifyFavoritesChanged();
  });
}
