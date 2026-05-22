import { validateEmail, validatePhoneOptional, validatePersonName, validateRequiredText } from './validation.js';
import { sanitizeText } from './sanitize.js';

/**
 * @param {Document} doc
 */
export function initContactForm(doc) {
  var form = doc.querySelector('[data-contact-form]');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  var statusEl = form.querySelector('[data-form-status]');

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
    if (statusEl) {
      statusEl.textContent = '';
    }
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    clearErrors();

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
      try {
        var safeName = await sanitizeText(name);
        var safeEmail = await sanitizeText(email);
        var safePhone = await sanitizeText(phone);
        var safeMessage = await sanitizeText(message);

        var apiBaseEl = doc.querySelector('meta[name="api-base"]');
        var apiBase =
          apiBaseEl instanceof HTMLMetaElement && apiBaseEl.content
            ? apiBaseEl.content.replace(/\/$/, '')
            : '';

        var url = (apiBase || '') + '/api/contact';
        var res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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

        if (res.ok && data && data.ok) {
          if (statusEl) {
            statusEl.textContent = 'Заявка отправлена. Номер в базе: ' + (data.id != null ? String(data.id) : '—');
          }
          form.reset();
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
      }
    })();
  });
}
