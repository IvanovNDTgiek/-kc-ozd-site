/**
 * @param {Function} fn
 * @param {number} waitMs
 * @returns {Function}
 */
export function debounce(fn, waitMs) {
  var t = null;
  return function debounced() {
    var ctx = this;
    var args = arguments;
    if (t) {
      clearTimeout(t);
    }
    t = setTimeout(function () {
      t = null;
      fn.apply(ctx, args);
    }, waitMs);
  };
}

/**
 * @param {Function} fn
 * @param {number} limitMs
 * @returns {Function}
 */
export function throttle(fn, limitMs) {
  var last = 0;
  var trailingTimer = null;
  return function throttled() {
    var ctx = this;
    var args = arguments;
    var now = Date.now();
    var remaining = limitMs - (now - last);
    if (remaining <= 0) {
      if (trailingTimer) {
        clearTimeout(trailingTimer);
        trailingTimer = null;
      }
      last = now;
      fn.apply(ctx, args);
    } else if (!trailingTimer) {
      trailingTimer = setTimeout(function () {
        trailingTimer = null;
        last = Date.now();
        fn.apply(ctx, args);
      }, remaining);
    }
  };
}
