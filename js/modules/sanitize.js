var purifierPromise = null;

function loadDOMPurify() {
  if (purifierPromise) {
    return purifierPromise;
  }
  purifierPromise = import('https://cdn.jsdelivr.net/npm/dompurify@3.1.6/+esm').then(function (m) {
    return m.default || m;
  });
  return purifierPromise;
}

/**
 * @param {string} dirty
 * @returns {Promise<string>}
 */
export async function sanitizeHtml(dirty) {
  try {
    var DOMPurify = await loadDOMPurify();
    return DOMPurify.sanitize(String(dirty || ''), {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
      ALLOWED_ATTR: [],
    });
  } catch (e) {
    return '';
  }
}

/**
 * @param {string} dirty
 * @returns {Promise<string>}
 */
export async function sanitizeText(dirty) {
  try {
    var DOMPurify = await loadDOMPurify();
    return DOMPurify.sanitize(String(dirty || ''), { ALLOWED_TAGS: [] });
  } catch (e) {
    return '';
  }
}
