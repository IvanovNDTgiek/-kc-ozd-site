/**
 * @type {Record<string, { href: string; title: string; kind: string; snippet: string }>}
 */
export var FAVORITES_CATALOG = {
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

/**
 * @param {string} id
 * @returns {{ title: string; href: string; excerpt: string; kind: string } | null}
 */
export function catalogFavoriteMeta(id) {
  var entry = FAVORITES_CATALOG[id];
  if (!entry) {
    return null;
  }
  return {
    title: entry.title,
    href: entry.href,
    excerpt: entry.snippet,
    kind: entry.kind,
  };
}
