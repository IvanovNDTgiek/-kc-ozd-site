var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {string} value
 * @returns {boolean}
 */
export function validateEmail(value) {
  var v = String(value || '').trim();
  if (!v) {
    return false;
  }
  return EMAIL_RE.test(v);
}

/**
 * Optional phone: empty is valid; otherwise +7 and digits or international.
 * @param {string} value
 * @returns {boolean}
 */
export function validatePhoneOptional(value) {
  var v = String(value || '').trim();
  if (!v) {
    return true;
  }
  var digits = v.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * @param {string} value
 * @param {number} maxLen
 * @returns {boolean}
 */
export function validateRequiredText(value, maxLen) {
  var v = String(value || '').trim();
  if (!v) {
    return false;
  }
  if (typeof maxLen === 'number' && v.length > maxLen) {
    return false;
  }
  return true;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function validatePersonName(name) {
  return validateRequiredText(name, 120);
}

/**
 * Имя пользователя (регистрация): только буквы (любой алфавит Unicode), длина 2–80.
 * @param {string} value
 * @returns {boolean}
 */
export function validateDisplayName(value) {
  var v = String(value || '').trim();
  if (v.length < 2 || v.length > 80) {
    return false;
  }
  return /^\p{L}+$/u.test(v);
}

/**
 * Пароль: 8–128 символов, минимум одна буква (латиница или кириллица) и одна цифра.
 * @param {string} value
 * @returns {boolean}
 */
export function validatePassword(value) {
  var v = String(value || '');
  if (v.length < 8 || v.length > 128) {
    return false;
  }
  if (!/[a-zA-Zа-яА-ЯёЁ]/.test(v)) {
    return false;
  }
  if (!/\d/.test(v)) {
    return false;
  }
  return true;
}
