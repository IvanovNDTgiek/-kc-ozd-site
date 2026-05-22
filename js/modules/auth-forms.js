import { validateDisplayName, validateEmail, validatePassword } from './validation.js';

function apiBase(doc) {
  var el = doc.querySelector('meta[name="api-base"]');
  var c = el && el.getAttribute('content');
  if (c && String(c).trim()) {
    return String(c).trim().replace(/\/$/, '');
  }
  return '';
}

/**
 * @param {HTMLFormElement} form
 * @param {string} field
 * @param {string} message
 * @returns {boolean} true if shown under a field
 */
function setFieldError(form, field, message) {
  var el = form.querySelector('[data-field-error="' + field + '"]');
  if (el) {
    el.textContent = message;
    return true;
  }
  return false;
}

/**
 * @param {HTMLFormElement} form
 * @param {{ error?: string; message?: string }} payload
 */
function showApiError(form, payload) {
  var msg = typeof payload.message === 'string' ? payload.message : 'Не удалось выполнить запрос.';
  var statusEl = form.querySelector('[data-form-status]');
  if (payload.error && setFieldError(form, String(payload.error), msg)) {
    if (statusEl) {
      statusEl.textContent = '';
    }
    return;
  }
  if (statusEl) {
    statusEl.textContent = msg;
  }
}

/**
 * @param {import('http').Response} r
 * @returns {Promise<{ ok: boolean; json: object | null }>}
 */
function parseJsonResponse(r) {
  return r.text().then(function (text) {
    if (!text) {
      return { ok: r.ok, json: null };
    }
    try {
      return { ok: r.ok, json: JSON.parse(text) };
    } catch (e) {
      return { ok: false, json: { ok: false, message: 'Некорректный ответ сервера.' } };
    }
  });
}

/**
 * @param {HTMLFormElement} form
 * @param {string[]} fields
 */
function clearErrors(form, fields) {
  fields.forEach(function (f) {
    setFieldError(form, f, '');
  });
  var st = form.querySelector('[data-form-status]');
  if (st) {
    st.textContent = '';
  }
}

/**
 * @param {Document} doc
 */
export function initAuthForms(doc) {
  var reg = doc.querySelector('[data-register-form]');
  if (reg instanceof HTMLFormElement) {
    reg.addEventListener('submit', function (ev) {
      ev.preventDefault();
      clearErrors(reg, ['display_name', 'email', 'password', 'password_confirm']);

      var dn = reg.elements.namedItem('display_name');
      var em = reg.elements.namedItem('email');
      var pw = reg.elements.namedItem('password');
      var pc = reg.elements.namedItem('password_confirm');

      var displayName = dn instanceof HTMLInputElement ? dn.value : '';
      var email = em instanceof HTMLInputElement ? em.value : '';
      var password = pw instanceof HTMLInputElement ? pw.value : '';
      var passwordConfirm = pc instanceof HTMLInputElement ? pc.value : '';

      var ok = true;
      if (!validateDisplayName(displayName)) {
        setFieldError(
          reg,
          'display_name',
          'Имя: только буквы (без пробелов, цифр и знаков), от 2 до 80 символов.',
        );
        ok = false;
      }
      if (!validateEmail(email)) {
        setFieldError(reg, 'email', 'Введите корректный e-mail.');
        ok = false;
      }
      if (!validatePassword(password)) {
        setFieldError(
          reg,
          'password',
          'Пароль: 8–128 символов, нужна хотя бы одна буква и одна цифра.',
        );
        ok = false;
      }
      if (password !== passwordConfirm) {
        setFieldError(reg, 'password_confirm', 'Пароли должны совпадать.');
        ok = false;
      }
      if (!ok) {
        return;
      }

      var statusEl = reg.querySelector('[data-form-status]');
      var submitBtn = reg.querySelector('button[type="submit"]');
      if (statusEl) {
        statusEl.textContent = 'Отправка…';
      }
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
      }

      fetch(apiBase(doc) + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          display_name: displayName.trim(),
          email: email.trim(),
          password: password,
          password_confirm: passwordConfirm,
        }),
      })
        .then(parseJsonResponse)
        .then(function (x) {
          if (x.ok && x.json && x.json.ok) {
            if (statusEl) {
              statusEl.textContent = 'Регистрация выполнена. Перенаправление…';
            }
            window.location.href = 'index.html';
            return;
          }
          showApiError(reg, x.json || {});
        })
        .catch(function () {
          if (statusEl) {
            statusEl.textContent = 'Сервер недоступен. Проверьте, что сайт запущен и БД доступна.';
          }
        })
        .finally(function () {
          if (submitBtn instanceof HTMLButtonElement) {
            submitBtn.disabled = false;
          }
        });
    });
  }

  var login = doc.querySelector('[data-login-form]');
  if (login instanceof HTMLFormElement) {
    login.addEventListener('submit', function (ev) {
      ev.preventDefault();
      clearErrors(login, ['email', 'password']);

      var em = login.elements.namedItem('email');
      var pw = login.elements.namedItem('password');
      var email = em instanceof HTMLInputElement ? em.value : '';
      var password = pw instanceof HTMLInputElement ? pw.value : '';

      var ok = true;
      if (!validateEmail(email)) {
        setFieldError(login, 'email', 'Введите корректный e-mail.');
        ok = false;
      }
      if (!password) {
        setFieldError(login, 'password', 'Введите пароль.');
        ok = false;
      }
      if (!ok) {
        return;
      }

      var statusEl = login.querySelector('[data-form-status]');
      var submitBtn = login.querySelector('button[type="submit"]');
      if (statusEl) {
        statusEl.textContent = 'Отправка…';
      }
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
      }

      fetch(apiBase(doc) + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.trim(), password: password }),
      })
        .then(parseJsonResponse)
        .then(function (x) {
          if (x.ok && x.json && x.json.ok) {
            if (statusEl) {
              statusEl.textContent = 'Вход выполнен. Перенаправление…';
            }
            window.location.href = 'index.html';
            return;
          }
          showApiError(login, x.json || { message: 'Неверный e-mail или пароль.' });
        })
        .catch(function () {
          if (statusEl) {
            statusEl.textContent = 'Сервер недоступен. Проверьте, что сайт запущен и БД доступна.';
          }
        })
        .finally(function () {
          if (submitBtn instanceof HTMLButtonElement) {
            submitBtn.disabled = false;
          }
        });
    });
  }
}
