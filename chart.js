/* Story chart. Uses the gating + read set exposed by reader.js (window.SY). Same localStorage keys. */
(function () {
  var D = JSON.parse(document.getElementById('data').textContent);
  var ROW = 30, NODE_W = 40, TIME_W = 230, TOP = 40, ARC_GAP = 40;
  var TITLES_KEY = 'sy-chart-titles';
  var titles = false;
  try { titles = localStorage.getItem(TITLES_KEY) === '1'; } catch (e) {}
  var cb = document.getElementById('titles');
  cb.checked = titles;
  cb.onchange = function () { try { localStorage.setItem(TITLES_KEY, cb.checked ? '1' : '0'); } catch (e) {} location.reload(); };
  document.body.classList.toggle('titles', titles);
  var COL = titles ? 230 : 83;

  var byId = {};
  D.nodes.forEach(function (n) { byId[n.id] = n; });

  // visibility: same rule as the index (reader.js), fed through a fake element with dataset
  function vis(n) {
    var el = document.createElement('div');
    el.dataset.id = n.id;
    if (n.unlockers) el.dataset.unlockers = n.unlockers;
    if (n.prev) el.dataset.prev = n.prev;
    if (n.require) el.dataset.require = n.require;
    if (n.initial) el.dataset.initial = n.initial;
    return SY.unlocked(el);
  }
  var shown = D.nodes.filter(vis);
  var shownIds = {};
  shown.forEach(function (n) { shownIds[n.id] = true; });

  // rows and arcs collapse to what is visible (no gaps that would give away locked scenes)
  var rowIdx = {}, nr = 0;
  shown.map(function (n) { return n.row; }).sort(function (a, b) { return a - b; }).forEach(function (r) {
    if (!(r in rowIdx)) rowIdx[r] = nr++;
  });
  var arcX = {}, x = TIME_W + 20;
  D.arcs.forEach(function (a) {
    var ns = shown.filter(function (n) { return n.a === a.name; });
    if (!ns.length) return;
    var cols = Math.max.apply(null, ns.map(function (n) { return n.c; }));
    arcX[a.name] = x;
    x += cols * COL + ARC_GAP;
  });
  var W = x, H = TOP + nr * ROW + 10;
  var chart = document.getElementById('chart');
  chart.style.width = W + 'px'; chart.style.height = H + 'px';
  var svg = document.getElementById('lines');
  svg.setAttribute('width', W); svg.setAttribute('height', H);

  // time column
  var tc = document.getElementById('timecol');
  var rowsDone = {};
  shown.forEach(function (n) {
    var r = rowIdx[n.row];
    if (rowsDone[r]) return;
    rowsDone[r] = true;
    var t = document.createElement('div');
    t.className = 't' + (r % 2 ? ' alt' : '');
    t.style.top = (TOP + r * ROW) + 'px';
    t.textContent = D.rows[n.row] || n.d || '';
    tc.appendChild(t);
  });

  // arc headers
  var nodesEl = document.getElementById('nodes');
  D.arcs.forEach(function (a) {
    if (!(a.name in arcX)) return;
    var h = document.createElement('div');
    h.className = 'arcname';
    h.style.left = arcX[a.name] + 'px';
    h.textContent = a.name.replace(/ \[.*$/, '');
    nodesEl.appendChild(h);
  });

  // nodes
  function pos(n) {
    var cx = arcX[n.a] + (n.c - 1) * COL;
    var cy = TOP + rowIdx[n.row] * ROW;
    return [cx, cy];
  }
  // two scenes at the same time and column: shift the later one right by half a node
  var taken = {};
  var card = document.getElementById('card'), cimg = document.getElementById('cardimg'), ctxt = document.getElementById('cardtxt'), cbar = document.getElementById('cardbar');
  var read = SY.read;
  shown.forEach(function (n) {
    var p = pos(n), k = p[0] + ',' + p[1];
    while (taken[k]) { p[0] += NODE_W / 2 + 2; k = p[0] + ',' + p[1]; }
    taken[k] = true;
    n._x = p[0]; n._y = p[1];
    var el = document.createElement('a');
    el.className = 'node' + (read.has(n.id) ? ' read' : '');
    el.href = 'scene/' + n.id + '.html';
    el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px';
    if (read.has(n.id)) el.style.backgroundImage = 'url(img/nav/thumb/' + n.id + '.png)';
    var l = document.createElement('span');
    l.className = 'lbl'; l.textContent = n.t;
    el.appendChild(l);
    el.onmouseenter = function () {
      cimg.src = n.pv ? '../img/nav/prev/' + n.id + '.jpg' : '../img/nav/thumb/' + n.id + '.png';
      ctxt.innerHTML = '<b>' + esc(n.t) + '</b><br>' + esc(n.d) + '<br><span style="color:#9aa0ad">' + esc(n.a) + (read.has(n.id) ? ' · read' : '') + '</span>';
      cbar.style.width = Math.min(100, n.n / 300) + '%';
      card.hidden = false;
    };
    el.onmouseleave = function () { card.hidden = true; };
    nodesEl.appendChild(el);
  });

  // connector lines: elbow from the parent's right side (middle height) to the child's column, then down to the child
  var d = '';
  shown.forEach(function (n) {
    (n.p || []).forEach(function (pid) {
      if (!shownIds[pid]) return;
      var pa = byId[pid];
      var cx = n._x + NODE_W / 2, cy = n._y;
      var px = pa._x, py = pa._y;
      if (Math.abs(px - n._x) < 1) {
        d += 'M' + cx + ' ' + (py + ROW) + 'V' + cy + ' ';
      } else {
        var sx = px + (cx > px ? NODE_W : 0), my = py + ROW / 2;
        d += 'M' + sx + ' ' + my + 'H' + cx + 'V' + cy + ' ';
      }
    });
  });
  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);

  document.getElementById('chartinfo').textContent = shown.length + ' of ' + D.nodes.length + ' scenes on the chart';
  /* next-step hint: yellow boxes = unlocked, not read; jump to the first one */
  var todo = shown.filter(function (n) { return !read.has(n.id); });
  var ni = document.getElementById('nextinfo');
  if (todo.length) {
    var first = todo.reduce(function (a, b) { return a._y <= b._y ? a : b; });
    ni.innerHTML = ' · <b>Next:</b> ' + todo.length + ' unlocked scene' + (todo.length > 1 ? 's' : '') + ' not read (yellow boxes).' +
      ' <a href="#" id="jumpnext">Jump to the first</a>';
    document.getElementById('jumpnext').onclick = function (e) {
      e.preventDefault();
      window.scrollTo({ left: Math.max(0, first._x - 400), top: Math.max(0, first._y - 200), behavior: 'smooth' });
    };
  } else {
    ni.textContent = ' · Every unlocked scene is read.';
  }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
})();
