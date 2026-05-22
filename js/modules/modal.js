/**
 * @param {Document} doc
 */
export function initModals(doc) {
  var modals = Array.from(doc.querySelectorAll('[data-modal]'));
  if (!modals.length) {
    return;
  }

  /** @type {HTMLElement | null} */
  var lastFocus = null;

  /**
   * @param {HTMLElement} modal
   */
  function openModal(modal) {
    lastFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    modal.hidden = false;
    var closeBtn = modal.querySelector('[data-modal-close]');
    if (closeBtn instanceof HTMLElement) {
      closeBtn.focus();
    }
    doc.body.style.overflow = 'hidden';
  }

  /**
   * @param {HTMLElement} modal
   */
  function closeModal(modal) {
    modal.hidden = true;
    doc.body.style.overflow = '';
    if (lastFocus) {
      lastFocus.focus();
    }
  }

  doc.querySelectorAll('[data-modal-open]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-modal-open');
      if (!id) {
        return;
      }
      var modal = doc.getElementById(id);
      if (modal instanceof HTMLElement) {
        openModal(modal);
      }
    });
  });

  modals.forEach(function (modal) {
    modal.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t instanceof HTMLElement && t.hasAttribute('data-modal-close')) {
        closeModal(modal);
      }
    });
  });

  doc.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') {
      return;
    }
    modals.forEach(function (modal) {
      if (!modal.hidden) {
        closeModal(modal);
      }
    });
  });
}
