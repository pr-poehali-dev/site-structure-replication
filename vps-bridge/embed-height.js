(function () {
  if (window.parent === window) return;
  var st0 = document.createElement('style');
  st0.textContent = '#top,#topnav,.site-title-nav,.fullscreen-mask,.pull-quote,blockquote.pull-quote,#friend_box{display:none!important}body,#main-wrap{margin-top:0!important;padding-top:0!important}.swiss{grid-template-rows:auto auto!important;height:auto!important}.swiss__main,.swiss__main .box,.swiss__side,.swiss__table,.swiss__standing{height:auto!important;max-height:none!important;min-height:0!important}.swiss__main .box{overflow:visible!important}';
  (document.head || document.documentElement).appendChild(st0);
  var last = 0;
  var timer = null;
  var REPLACED = { IMG: 1, SVG: 1, CANVAS: 1, VIDEO: 1, IFRAME: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1 };

  function visible(el) {
    if (!el) return false;
    if (el.offsetParent === null) return false;
    var st = window.getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none';
  }

  function unclip() {
    var root = document.getElementById('main-wrap') || document.body;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.scrollHeight <= el.clientHeight + 2) continue;
      var cs = window.getComputedStyle(el);
      var oy = cs.overflowY;
      if (oy !== 'hidden' && oy !== 'auto' && oy !== 'scroll') continue;
      if (cs.display === 'inline') continue;
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('min-height', '0', 'important');
    }
  }

  function pinned(el, cache) {
    var chain = [];
    var cur = el;
    var res = false;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (cache.has(cur)) { res = cache.get(cur); break; }
      chain.push(cur);
      var pos = window.getComputedStyle(cur).position;
      if (pos === 'fixed' || pos === 'sticky') { res = true; break; }
      cur = cur.parentElement;
    }
    for (var i = 0; i < chain.length; i++) cache.set(chain[i], res);
    return res;
  }

  function measure() {
    unclip();
    var cache = new Map();
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
        if (pinned(n.parentElement, cache)) continue;
        range.selectNodeContents(n);
        var rects = range.getClientRects();
        for (var i = 0; i < rects.length; i++) {
          if (rects[i].height > 0 && rects[i].bottom > bottom) bottom = rects[i].bottom;
        }
      } else if (REPLACED[n.tagName.toUpperCase()]) {
        if (!visible(n)) continue;
        if (pinned(n, cache)) continue;
        var r = n.getBoundingClientRect();
        if (r.height > 0) bottom = r.bottom;
      }
      if (bottom + shift > max) max = bottom + shift;
    }
    var sw = document.querySelector('.swiss');
    if (sw && sw.offsetParent !== null) {
      var sb = sw.getBoundingClientRect().bottom + shift;
      if (sb > 0 && (max === 0 || sb < max)) max = sb;
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