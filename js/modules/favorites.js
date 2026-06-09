import { catalogFavoriteMeta } from './favorites-catalog.js';

var STORAGE_KEY = 'kc_ozd_favorites_v1';
var META_KEY = 'kc_ozd_favorites_meta_v1';

/** @type {boolean | null} */
var useServer = null;

/** @type {string[]} */
var serverIds = [];

/** @type {Record<string, { title: string; href: string; excerpt: string; kind: string }>} */
var serverMeta = {};

/**
 * @param {Document} [doc]
 * @returns {string}
 */
function apiBase(doc) {
  var root = doc || document;
  var el = root.querySelector('meta[name="api-base"]');
  var c = el && el.getAttribute('content');
  if (c && String(c).trim()) {
    return String(c).trim().replace(/\/$/, '');
  }
  return '';
}

/**
 * @returns {string[]}
 */
function readLocalIds() {
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
 * @returns {Record<string, { title: string; href: string; excerpt: string; kind: string }>}
 */
function readLocalMeta() {
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
 * @param {Record<string, { title: string; href: string; excerpt: string; kind: string }>} obj
 */
function writeLocalMetaAll(obj) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(obj));
  } catch (e) {
    /* quota */
  }
}

/**
 * @param {string} id
 * @param {{ title: string; href: string; excerpt?: string; kind?: string }} entry
 */
function saveLocalMeta(id, entry) {
  var o = readLocalMeta();
  o[id] = {
    title: String(entry.title || '').slice(0, 400),
    href: String(entry.href || '').slice(0, 2000),
    excerpt: String(entry.excerpt || '').slice(0, 600),
    kind: String(entry.kind || 'Новость').slice(0, 120),
  };
  writeLocalMetaAll(o);
}

/**
 * @param {string} id
 */
function removeLocalMeta(id) {
  var o = readLocalMeta();
  if (o[id]) {
    delete o[id];
    writeLocalMetaAll(o);
  }
}

/**
 * @param {string[]} ids
 */
function writeLocalIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    /* quota or private mode */
  }
}

/**
 * @param {{ id: string; title: string; href: string; excerpt: string; kind: string }[]} items
 */
function applyServerItems(items) {
  serverIds = [];
  serverMeta = {};
  items.forEach(function (item) {
    if (!item || typeof item.id !== 'string' || !item.id) {
      return;
    }
    serverIds.push(item.id);
    serverMeta[item.id] = {
      title: String(item.title || ''),
      href: String(item.href || ''),
      excerpt: String(item.excerpt || ''),
      kind: String(item.kind || ''),
    };
  });
}

export function clearLocalFavoritesStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_KEY);
  } catch (e) {
    /* noop */
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
 * @returns {string[]}
 */
export function readIds() {
  if (useServer) {
    return serverIds.slice();
  }
  return readLocalIds();
}

/**
 * @returns {Record<string, { title: string; href: string; excerpt: string; kind: string }>}
 */
export function readFavoriteMeta() {
  if (useServer) {
    return Object.assign({}, serverMeta);
  }
  return readLocalMeta();
}

/**
 * @param {Document} [doc]
 * @returns {Promise<void>}
 */
export function loadFavoritesState(doc) {
  var base = apiBase(doc);
  return fetch(base + '/api/favorites', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
    .then(function (r) {
      if (r.status === 401) {
        useServer = false;
        return null;
      }
      if (!r.ok) {
        useServer = false;
        return null;
      }
      return r.json().catch(function () {
        return null;
      });
    })
    .then(function (json) {
      if (json && json.ok && Array.isArray(json.items)) {
        useServer = true;
        applyServerItems(json.items);
      } else if (useServer === null) {
        useServer = false;
      }
      notifyFavoritesChanged();
    })
    .catch(function () {
      if (useServer === null) {
        useServer = false;
      }
    });
}

/**
 * @param {Document} doc
 * @returns {Promise<void>}
 */
export function migrateLocalFavoritesAfterAuth(doc) {
  var ids = readLocalIds();
  if (!ids.length) {
    clearLocalFavoritesStorage();
    return loadFavoritesState(doc);
  }

  var meta = readLocalMeta();
  var items = ids
    .map(function (id) {
      var m = meta[id];
      if (!m || !m.title || !m.href) {
        return null;
      }
      return {
        id: id,
        title: m.title,
        href: m.href,
        excerpt: m.excerpt || '',
        kind: m.kind || 'Избранное',
      };
    })
    .filter(Boolean);

  clearLocalFavoritesStorage();

  if (!items.length) {
    return loadFavoritesState(doc);
  }

  return fetch(apiBase(doc) + '/api/favorites/sync', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ items: items }),
  })
    .then(function (r) {
      return r.json().catch(function () {
        return null;
      });
    })
    .then(function (json) {
      if (json && json.ok && Array.isArray(json.items)) {
        useServer = true;
        applyServerItems(json.items);
      }
    })
    .finally(function () {
      return loadFavoritesState(doc);
    });
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
 * @param {string} id
 * @param {boolean} willAdd
 * @param {{ title: string; href: string; excerpt: string; kind: string }} [meta]
 * @returns {Promise<boolean>}
 */
function persistFavoriteToggle(doc, id, willAdd, meta) {
  if (!useServer) {
    var list = readLocalIds();
    var idx = list.indexOf(id);
    if (willAdd) {
      if (idx === -1) {
        list.push(id);
      }
      writeLocalIds(list);
      if (meta) {
        saveLocalMeta(id, meta);
      }
    } else if (idx !== -1) {
      list.splice(idx, 1);
      writeLocalIds(list);
      removeLocalMeta(id);
    }
    return Promise.resolve(true);
  }

  return fetch(apiBase(doc) + '/api/favorites/toggle', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      item_id: id,
      title: meta ? meta.title : '',
      href: meta ? meta.href : '',
      excerpt: meta ? meta.excerpt : '',
      kind: meta ? meta.kind : '',
    }),
  })
    .then(function (r) {
      return r.json().catch(function () {
        return { ok: false };
      });
    })
    .then(function (json) {
      if (!json || !json.ok) {
        return false;
      }
      if (json.added) {
        if (!serverIds.includes(id)) {
          serverIds.push(id);
        }
        if (meta) {
          serverMeta[id] = meta;
        }
      } else {
        serverIds = serverIds.filter(function (x) {
          return x !== id;
        });
        delete serverMeta[id];
      }
      return true;
    })
    .catch(function () {
      return false;
    });
}

/**
 * @param {Document} doc
 * @returns {Promise<void>}
 */
export function initFavorites(doc) {
  return loadFavoritesState(doc).then(function () {
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
      var willAdd = list.indexOf(id) === -1;
      var meta = null;

      if (willAdd) {
        var box = btn.closest('[data-favorite-item]');
        if (box) {
          var title = box.getAttribute('data-fav-title');
          var href = box.getAttribute('data-fav-url');
          var snippet = box.getAttribute('data-fav-snippet') || '';
          var kind = box.getAttribute('data-fav-kind') || 'Новость';
          if (title && href) {
            meta = { title: title, href: href, excerpt: snippet, kind: kind };
          }
        }
        if (!meta) {
          meta = catalogFavoriteMeta(id);
        }
        if (useServer && !meta) {
          return;
        }
      }

      if (btn instanceof HTMLButtonElement) {
        btn.disabled = true;
      }

      persistFavoriteToggle(doc, id, willAdd, meta || undefined)
        .then(function (ok) {
          if (ok) {
            syncFavoriteButtons(doc);
            notifyFavoritesChanged();
          }
        })
        .finally(function () {
          if (btn instanceof HTMLButtonElement) {
            btn.disabled = false;
          }
        });
    });
  });
}
