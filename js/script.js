import { initNav } from './modules/nav.js';
import { initModals } from './modules/modal.js';
import { initSlider } from './modules/slider.js';
import { initSiteSearch } from './modules/search.js';
import { initFavoritesPage } from './modules/favorites-page.js';
import { initFavorites } from './modules/favorites.js';
import { initContactForm } from './modules/form.js';
import { initAuthForms } from './modules/auth-forms.js';
import { initAuthNav } from './modules/auth-nav.js';

function setCurrentYear(doc) {
  var y = new Date().getFullYear();
  doc.querySelectorAll('[data-current-year]').forEach(function (el) {
    el.textContent = String(y);
  });
}

try {
  setCurrentYear(document);
  initNav(document);
  initModals(document);
  initSlider(document);
  initSiteSearch(document);
  initFavoritesPage(document);
  initFavorites(document);
  initContactForm(document);
  initAuthForms(document);
  initAuthNav(document);
} catch (e) {
  /* fail-safe: static site remains usable */
}
