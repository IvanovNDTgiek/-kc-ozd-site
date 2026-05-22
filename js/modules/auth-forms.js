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
 */
function setFieldError(form, field, message) {
  var el = form.querySelector('[data-field-error="' + field + '"]');
  if (el) {
    el.textContent = message;
  }
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
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, json: j };
          });
        })
        .then(function (x) {
          if (x.ok && x.json && x.json.ok) {
            if (statusEl) {
              statusEl.textContent = 'Регистрация выполнена. Перенаправление…';
            }
            window.location.href = 'index.html';
            return;
          }
          var j = x.json || {};
          if (j.error) {
            setFieldError(reg, String(j.error), typeof j.message === 'string' ? j.message : '');
          }
          if (statusEl && !j.error) {
            statusEl.textContent =
              typeof j.message === 'string' ? j.message : 'Не удалось зарегистрироваться.';
          }
        })
        .catch(function () {
          if (statusEl) {
            statusEl.textContent = 'Сервер недоступен. Запустите npm run server.';
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
      fetch(apiBase(doc) + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.trim(), password: password }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, json: j };
          });
        })
        .then(function (x) {
          if (x.ok && x.json && x.json.ok) {
            if (statusEl) {
              statusEl.textContent = 'Вход выполнен. Перенаправление…';
            }
            window.location.href = 'index.html';
            return;
          }
          var j = x.json || {};
          if (statusEl) {
            statusEl.textContent =
              typeof j.message === 'string' ? j.message : 'Неверный e-mail или пароль.';
          }
        })
        .catch(function () {
          if (statusEl) {
            statusEl.textContent = 'Сервер недоступен. Запустите npm run server.';
          }
        });
    });
  }
}
