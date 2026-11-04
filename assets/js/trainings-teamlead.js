(function () {
  var ROTATE_MS = 5000;
  var RESUME_AFTER_MANUAL_MS = 10000;
  function initGallery(slider) {
    var strip = slider.querySelector('.live-slides');
    if (!strip) return;
    var slides = Array.prototype.slice.call(strip.querySelectorAll('.live-slide'));
    var dots = Array.prototype.slice.call(slider.querySelectorAll('.live-dots .live-dot'));
    var prev = slider.querySelector('.live-slide-nav.prev');
    var next = slider.querySelector('.live-slide-nav.next');
    var latestIndex = -1, pausedUntil = 0, hovering = false, inView = false, scrollingRaf = 0;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!slides.length) return;
    function current() {
      var width = strip.clientWidth || 1;
      return Math.max(0, Math.min(slides.length - 1, Math.round(strip.scrollLeft / width)));
    }
    function setActive(index) {
      index = Math.max(0, Math.min(slides.length - 1, index));
      if (index === latestIndex) return;
      latestIndex = index;
      dots.forEach(function (dot, i) { dot.classList.toggle('active', i === index); });
    }
    function sync() { scrollingRaf = 0; setActive(current()); }
    function scheduleSync() { if (!scrollingRaf) scrollingRaf = requestAnimationFrame(sync); }
    function goTo(index, manual) {
      index = (index + slides.length) % slides.length;
      if (manual) pausedUntil = Date.now() + RESUME_AFTER_MANUAL_MS;
      setActive(index);
      try {strip.scrollTo({left:index * strip.clientWidth, behavior:reduceMotion ? 'auto' : 'smooth'});}
      catch (e) {strip.scrollLeft = index * strip.clientWidth;}
    }
    if (prev) prev.addEventListener('click', function (e) {e.preventDefault(); goTo(current() - 1, true);});
    if (next) next.addEventListener('click', function (e) {e.preventDefault(); goTo(current() + 1, true);});
    strip.addEventListener('scroll', scheduleSync, {passive:true});
    strip.addEventListener('touchstart', function () {pausedUntil = Date.now() + RESUME_AFTER_MANUAL_MS;}, {passive:true});
    strip.addEventListener('pointerdown', function () {pausedUntil = Date.now() + RESUME_AFTER_MANUAL_MS;}, {passive:true});
    strip.addEventListener('touchend', function () {setTimeout(sync,120);setTimeout(sync,450);}, {passive:true});
    slider.addEventListener('mouseenter', function () {hovering = true;});
    slider.addEventListener('mouseleave', function () {hovering = false;});
    slider.addEventListener('focusin', function () {hovering = true;});
    slider.addEventListener('focusout', function () {hovering = false;});
    window.addEventListener('resize', scheduleSync, {passive:true});
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {inView = entries[0] && entries[0].isIntersecting;}, {threshold:0.3});
      observer.observe(slider);
    } else inView = true;
    if (!reduceMotion) setInterval(function () {
      if (document.hidden || !inView || hovering || Date.now() < pausedUntil) return;
      goTo(current() + 1, false);
    }, ROTATE_MS);
    setActive(current());
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-slider="speaking"]'), initGallery);
})();
