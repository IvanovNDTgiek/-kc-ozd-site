import { readIds, readFavoriteMeta, syncFavoriteButtons } from './favorites.js';

/**
 * @type {Record<string, { href: string, title: string, kind: string, snippet: string }>}
 */
var CATALOG = {
  'svc-long': {
    href: 'services.html#fav-svc-long',
    title: 'Перевозка длинномерных грузов',
    kind: 'Услуга',
    snippet: 'Тралы и низкорамники, согласование маршрута и сопровождение негабарита.',
  },
  'svc-bulk': {
    href: 'services.html#fav-svc-bulk',
    title: 'Перевозка инертных и сыпучих грузов',
    kind: 'Услуга',
    snippet: 'Самосвалы, массовые перевозки песка, щебня и сопутствующих материалов.',
  },
  'svc-pass': {
    href: 'services.html#fav-svc-pass',
    title: 'Пассажирские перевозки',
    kind: 'Услуга',
    snippet: 'Регулярные и разовые маршруты, подача бригад и корпоративные поездки.',
  },
  'svc-log': {
    href: 'services.html#fav-svc-log',
    title: 'Логистика и доставка',
    kind: 'Услуга',
    snippet: 'Маршрутизация, консолидация партий и контроль статуса доставки.',
  },
  'news-1': {
    href: 'blog.html#fav-news-1',
    title: 'Федеральные трассы 13 регионов готовят к весеннему паводку',
    kind: 'Новость',
    snippet: 'Комплекс мер по устойчивости дорожной сети в период паводковых вод.',
  },
  'news-2': {
    href: 'blog.html#fav-news-2',
    title: 'Реконструкция путепровода на А-120 в Ленобласти',
    kind: 'Новость',
    snippet: 'Завершение работ повысит пропускную способность и безопасность участка.',
  },
  'news-3': {
    href: 'blog.html#fav-news-3',
    title: 'Более 250 км трасс обновят в четырёх регионах Северо-Запада',
    kind: 'Новость',
    snippet: 'План модернизации покрытия и организации движения на ключевых направлениях.',
  },
};

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
    if (CATALOG[id]) {
      return CATALOG[id];
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
