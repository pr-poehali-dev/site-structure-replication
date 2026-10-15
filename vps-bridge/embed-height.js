(function () {
  if (window.parent === window) return;
  var last = 0;
  function measure() {
    var wrap = document.getElementById('main-wrap') || document.body;
    var shift = window.pageYOffset || 0;
    var max = 0;
    var kids = wrap.children;
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      var st = window.getComputedStyle(c);
      if (st.display === 'none' || st.position === 'fixed') continue;
      var b = c.getBoundingClientRect().bottom + shift;
      if (b > max) max = b;
    }
    var h = Math.ceil(max);
    if (h && Math.abs(h - last) > 2) {
      last = h;
      window.parent.postMessage({ type: 'lila-embed-height', height: h }, '*');
    }
  }
  window.addEventListener('load', measure);
  window.addEventListener('resize', measure);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(measure);
    var w = document.getElementById('main-wrap');
    if (w) {
      for (var i = 0; i < w.children.length; i++) ro.observe(w.children[i]);
    }
  }
  if (window.MutationObserver) {
    new MutationObserver(measure).observe(document.body, { childList: true, subtree: true });
  }
  setInterval(measure, 1000);
  measure();
})();
