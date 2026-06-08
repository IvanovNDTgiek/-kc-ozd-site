/**
 * @param {Document} doc
 */
export function initProfilePage(doc) {
  if (doc.body.dataset.page !== 'profile') {
    return;
  }

  var root = doc.querySelector('[data-profile-root]');
  if (!root) {
    return;
  }

  var statusEl = doc.querySelector('[data-profile-status]');
  var userBox = doc.querySelector('[data-profile-user]');
  var userDetailsEl = doc.querySelector('[data-profile-user-details]');
  var listEl = doc.querySelector('[data-profile-submissions]');
  var emptyEl = doc.querySelector('[data-profile-empty]');

  function apiBase() {
    var el = doc.querySelector('meta[name="api-base"]');
    var c = el && el.getAttribute('content');
    if (c && String(c).trim()) {
      return String(c).trim().replace(/\/$/, '');
    }
    return '';
  }

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return String(iso || '');
    }
  }

  function escapeText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  setStatus('Загрузка…');

  fetch(apiBase() + '/api/profile', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
    .then(function (r) {
      return r.json().catch(function () {
        return {};
      }).then(function (j) {
        return { status: r.status, json: j };
      });
    })
    .then(function (x) {
      if (x.status === 401) {
        setStatus('Войдите в аккаунт, чтобы открыть профиль.');
        window.setTimeout(function () {
          window.location.href = 'login.html';
        }, 1200);
        return;
      }
      if (!x.json || !x.json.ok || !x.json.user) {
        setStatus((x.json && x.json.message) || 'Не удалось загрузить профиль.');
        return;
      }

      var user = x.json.user;
      var submissions = Array.isArray(x.json.submissions) ? x.json.submissions : [];

      setStatus('');
      if (userBox) {
        userBox.hidden = false;
      }
      if (userDetailsEl) {
        userDetailsEl.innerHTML =
          '<dl class="profile-card__list">' +
          '<div class="profile-card__row"><dt>Имя</dt><dd>' +
          escapeText(user.display_name) +
          '</dd></div>' +
          '<div class="profile-card__row"><dt>E-mail</dt><dd>' +
          escapeText(user.email) +
          '</dd></div>' +
          '<div class="profile-card__row"><dt>Регистрация</dt><dd>' +
          escapeText(formatDate(user.created_at)) +
          '</dd></div>' +
          '</dl>';
      }

      if (!listEl) {
        return;
      }

      if (!submissions.length) {
        listEl.hidden = true;
        if (emptyEl) {
          emptyEl.hidden = false;
        }
        return;
      }

      if (emptyEl) {
        emptyEl.hidden = true;
      }
      listEl.hidden = false;
      listEl.innerHTML = '';

      submissions.forEach(function (row) {
        var li = doc.createElement('li');
        li.className = 'profile-submission';
        li.innerHTML =
          '<article class="profile-submission__card">' +
          '<header class="profile-submission__head">' +
          '<span class="profile-submission__id">Заявка #' +
          escapeText(row.id) +
          '</span>' +
          '<time class="profile-submission__date" datetime="' +
          escapeText(row.created_at) +
          '">' +
          escapeText(formatDate(row.created_at)) +
          '</time>' +
          '</header>' +
          '<p class="profile-submission__meta"><strong>Имя:</strong> ' +
          escapeText(row.name) +
          ' · <strong>E-mail:</strong> ' +
          escapeText(row.email) +
          (row.phone ? ' · <strong>Тел.:</strong> ' + escapeText(row.phone) : '') +
          '</p>' +
          '<p class="profile-submission__message">' +
          escapeText(row.message) +
          '</p>' +
          '</article>';
        listEl.appendChild(li);
      });
    })
    .catch(function () {
      setStatus('Сеть или сервер недоступны. Откройте сайт через npm run server.');
    });
}
