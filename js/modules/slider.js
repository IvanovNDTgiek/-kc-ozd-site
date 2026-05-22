/**
 * @param {Document} doc
 */
export function initSlider(doc) {
  var root = doc.querySelector('[data-slider]');
  if (!root) {
    return;
  }
  var track = root.querySelector('[data-slider-track]');
  var slides = root.querySelectorAll('[data-slider-slide]');
  var prev = root.querySelector('[data-slider-prev]');
  var next = root.querySelector('[data-slider-next]');
  var dotsHost = root.querySelector('[data-slider-dots]');
  if (!track || !slides.length || !prev || !next || !dotsHost) {
    return;
  }

  var index = 0;
  var total = slides.length;

  function render() {
    track.style.transform = 'translateX(' + -index * 100 + '%)';
    dotsHost.querySelectorAll('.slider__dot').forEach(function (dot, i) {
      dot.classList.toggle('slider__dot--active', i === index);
    });
  }

  dotsHost.innerHTML = '';
  for (var i = 0; i < total; i++) {
    (function (j) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'slider__dot' + (j === 0 ? ' slider__dot--active' : '');
      b.setAttribute('aria-label', 'Слайд ' + (j + 1));
      b.addEventListener('click', function () {
        index = j;
        render();
      });
      dotsHost.appendChild(b);
    })(i);
  }

  prev.addEventListener('click', function () {
    index = (index - 1 + total) % total;
    render();
  });
  next.addEventListener('click', function () {
    index = (index + 1) % total;
    render();
  });

  root.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowLeft') {
      index = (index - 1 + total) % total;
      render();
    } else if (ev.key === 'ArrowRight') {
      index = (index + 1) % total;
      render();
    }
  });

  render();
}
