/**
 * @param {string} s
 * @param {number} maxLen
 * @returns {string}
 */
export function stripAndTruncate(s, maxLen) {
  var t = String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim();
  if (t.length > maxLen) {
    return t.slice(0, maxLen);
  }
  return t;
}
