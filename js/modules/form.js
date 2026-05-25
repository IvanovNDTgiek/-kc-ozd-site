import { validateEmail, validatePhoneOptional, validatePersonName, validateRequiredText } from './validation.js';
import { sanitizeText } from './sanitize.js';

/**
 * @param {Document} doc
 * @returns {string}
 */
function apiBase(doc) {
  var el = doc.querySelector('meta[name="api-base"]');
  var c = el && el.getAttribute('content');
  if (c && String(c).trim()) {
    return String(c).trim().replace(/\/$/, '');
  }
  return '';
}

/**
 * @param {Document} doc
 */
export function initContactForm(doc) {
  var form = doc.querySelector('[data-contact-form]');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  var statusEl = form.querySelector('[data-form-status]');
  var hintEl = doc.querySelector('[data-contact-auth-hint]');
  var submitBtn = form.querySelector('button[type="submit"]');
  var fields = form.querySelectorAll('input, textarea, select, button');

  var isAuthenticated = false;
  /** @type {{ display_name?: string; email?: string } | null} */
  var currentUser = null;

  /**
   * @param {string} field
   * @param {string} message
   */
  function setFieldError(field, message) {
    var el = form.querySelector('[data-field-error="' + field + '"]');
    if (el) {
      el.textContent = message;
    }
  }

  function clearErrors() {
    ['name', 'email', 'phone', 'message'].forEach(function (f) {
      setFieldError(f, '');
    });
    if (statusEl && isAuthenticated) {
      statusEl.textContent = '';
    }
  }

  /**
   * @param {boolean} locked
   */
  function setFormLocked(locked) {
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (el === submitBtn) {
        el.disabled = locked;
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        el.disabled = locked;
      }
    }
    if (hintEl) {
      hintEl.hidden = !locked;
    }
    if (locked && statusEl) {
      statusEl.textContent = '';
    }
  }

  /**
   * @param {{ display_name?: string; email?: string }} user
   */
  function applyAuthenticatedUser(user) {
    currentUser = user;
    isAuthenticated = true;
    setFormLocked(false);
    if (statusEl) {
      statusEl.textContent = '';
    }

    var nameInput = form.elements.namedItem('name');
    var emailInput = form.elements.namedItem('email');
    if (nameInput instanceof HTMLInputElement && user.display_name && !nameInput.value) {
      nameInput.value = user.display_name;
    }
    if (emailInput instanceof HTMLInputElement && user.email && !emailInput.value) {
      emailInput.value = user.email;
    }
  }

  function applyGuest() {
    isAuthenticated = false;
    currentUser = null;
    setFormLocked(true);
  }

  setFormLocked(true);

  fetch(apiBase(doc) + '/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) {
      return r.json().catch(function () {
        return {};
      });
    })
    .then(function (j) {
      if (j && j.ok && j.user) {
        applyAuthenticatedUser(j.user);
      } else {
        applyGuest();
      }
    })
    .catch(function () {
      applyGuest();
    });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    clearErrors();

    if (!isAuthenticated) {
      if (statusEl) {
        statusEl.textContent = 'Для отправки заявки войдите в аккаунт или зарегистрируйтесь.';
      }
      return;
    }

    var nameInput = form.elements.namedItem('name');
    var emailInput = form.elements.namedItem('email');
    var phoneInput = form.elements.namedItem('phone');
    var messageInput = form.elements.namedItem('message');

    var name = nameInput instanceof HTMLInputElement ? nameInput.value : '';
    var email = emailInput instanceof HTMLInputElement ? emailInput.value : '';
    var phone = phoneInput instanceof HTMLInputElement ? phoneInput.value : '';
    var message = messageInput instanceof HTMLTextAreaElement ? messageInput.value : '';

    var ok = true;
    if (!validatePersonName(name)) {
      setFieldError('name', 'Укажите имя (до 120 символов).');
      ok = false;
    }
    if (!validateEmail(email)) {
      setFieldError('email', 'Введите корректный e-mail.');
      ok = false;
    }
    if (!validatePhoneOptional(phone)) {
      setFieldError('phone', 'Телефон: 10–15 цифр или оставьте поле пустым.');
      ok = false;
    }
    if (!validateRequiredText(message, 4000)) {
      setFieldError('message', 'Введите сообщение (до 4000 символов).');
      ok = false;
    }
    if (!ok) {
      return;
    }

    (async function () {
      if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
      }
      try {
        var safeName = await sanitizeText(name);
        var safeEmail = await sanitizeText(email);
        var safePhone = await sanitizeText(phone);
        var safeMessage = await sanitizeText(message);

        var url = apiBase(doc) + '/api/contact';
        var res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            name: safeName,
            email: safeEmail,
            phone: safePhone,
            message: safeMessage,
          }),
        });

        var data = null;
        try {
          data = await res.json();
        } catch (parseErr) {
          data = null;
        }

        if (res.status === 401) {
          isAuthenticated = false;
          setFormLocked(true);
          if (statusEl) {
            statusEl.textContent =
              (data && data.message) || 'Сессия истекла. Войдите снова, чтобы отправить заявку.';
          }
          return;
        }

        if (res.ok && data && data.ok) {
          if (statusEl) {
            statusEl.textContent = 'Заявка отправлена. Номер в базе: ' + (data.id != null ? String(data.id) : '—');
          }
          form.reset();
          if (currentUser) {
            applyAuthenticatedUser(currentUser);
          }
          return;
        }

        if (data && data.error === 'auth' && typeof data.message === 'string') {
          isAuthenticated = false;
          setFormLocked(true);
          if (statusEl) {
            statusEl.textContent = data.message;
          }
          return;
        }

        if (data && data.error && typeof data.message === 'string') {
          setFieldError(String(data.error), data.message);
        }
        if (statusEl && (!data || !data.error)) {
          statusEl.textContent =
            res.status === 0 || res.status >= 500
              ? 'Сервер недоступен. Проверьте, что сайт развёрнут и meta api-base указывает на API.'
              : 'Не удалось отправить форму. Попробуйте позже.';
        }
      } catch (e) {
        if (statusEl) {
          statusEl.textContent = 'Сеть или сервер недоступны. Форма сохраняется только при работающем сервере и БД.';
        }
      } finally {
        if (submitBtn instanceof HTMLButtonElement && isAuthenticated) {
          submitBtn.disabled = false;
        }
      }
    })();
  });
}
