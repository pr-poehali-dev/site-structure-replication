(function () {
  if (window.parent === window) return;
  var last = 0;
  var timer = null;
  var REPLACED = { IMG: 1, SVG: 1, CANVAS: 1, VIDEO: 1, IFRAME: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1 };

  function visible(el) {
    if (!el) return false;
    if (el.offsetParent === null) return false;
    var st = window.getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none';
  }

  function measure() {
    var root = document.getElementById('main-wrap') || document.body;
    var shift = window.pageYOffset || 0;
    var max = 0;
    var range = document.createRange();
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    var n;
    while ((n = walker.nextNode())) {
      var bottom = 0;
      if (n.nodeType === 3) {
        if (!n.nodeValue || !n.nodeValue.trim()) continue;
        if (!visible(n.parentElement)) continue;
        range.selectNodeContents(n);
        var rects = range.getClientRects();
        for (var i = 0; i < rects.length; i++) {
          if (rects[i].height > 0 && rects[i].bottom > bottom) bottom = rects[i].bottom;
        }
      } else if (REPLACED[n.tagName.toUpperCase()]) {
        if (!visible(n)) continue;
        var r = n.getBoundingClientRect();
        if (r.height > 0) bottom = r.bottom;
      }
      if (bottom + shift > max) max = bottom + shift;
    }
    var h = Math.ceil(max) + 24;
    if (max > 0 && Math.abs(h - last) > 3) {
      last = h;
      window.parent.postMessage({ type: 'lila-embed-height', height: h }, '*');
    }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(function () { timer = null; measure(); }, 150);
  }

  window.addEventListener('load', measure);
  window.addEventListener('resize', schedule);
  if (window.MutationObserver) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  setInterval(measure, 1500);
  measure();
})();
