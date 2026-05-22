(function () {
  var MEASUREMENT_ID = '';
  try {
    if (!MEASUREMENT_ID || MEASUREMENT_ID.indexOf('G-') !== 0) {
      return;
    }
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID);
  } catch (e) {
    /* analytics optional */
  }
})();
