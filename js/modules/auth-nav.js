/**
 * @param {Document} doc
 */
export function initAuthNav(doc) {
  var guest = doc.querySelector('[data-auth-guest]');
  var userBox = doc.querySelector('[data-auth-user]');
  var nameEl = doc.querySelector('[data-auth-name]');
  var logoutBtn = doc.querySelector('[data-auth-logout]');

  if (!guest || !userBox) {
    return;
  }

  function apiBase() {
    var el = doc.querySelector('meta[name="api-base"]');
    var c = el && el.getAttribute('content');
    if (c && String(c).trim()) {
      return String(c).trim().replace(/\/$/, '');
    }
    return '';
  }

  function showGuest() {
    guest.hidden = false;
    userBox.hidden = true;
  }

  function showUser(name) {
    guest.hidden = true;
    userBox.hidden = false;
    if (nameEl) {
      nameEl.textContent = name;
    }
  }

  fetch(apiBase() + '/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) {
      return r.json().catch(function () {
        return {};
      });
    })
    .then(function (j) {
      if (j && j.ok && j.user && j.user.display_name) {
        showUser(String(j.user.display_name));
      } else {
        showGuest();
      }
    })
    .catch(function () {
      showGuest();
    });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      fetch(apiBase() + '/api/auth/logout', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      })
        .catch(function () {})
        .finally(function () {
          window.location.reload();
        });
    });
  }
}
