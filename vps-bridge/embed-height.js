(function () {
  if (window.parent === window) return;
  var last = 0;
  function measure() {
    var el = document.getElementById('main-wrap') || document.body;
    var h = Math.max(el.scrollHeight, el.getBoundingClientRect().height);
    h = Math.ceil(h);
    if (h && Math.abs(h - last) > 1) {
      last = h;
      window.parent.postMessage({ type: 'lila-embed-height', height: h }, '*');
    }
  }
  window.addEventListener('load', measure);
  window.addEventListener('resize', measure);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(measure);
    ro.observe(document.body);
    var w = document.getElementById('main-wrap');
    if (w) ro.observe(w);
  }
  if (window.MutationObserver) {
    new MutationObserver(measure).observe(document.body, { childList: true, subtree: true });
  }
  setInterval(measure, 1000);
  measure();
})();
