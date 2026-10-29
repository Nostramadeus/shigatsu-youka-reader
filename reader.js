/* Shigatsu Youka private reader: unlock gating in the browser. No sound, no timers. */
(function () {
  var KEY = 'sy-read', RKEY = 'sy-reveal';
  function load() { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); } }
  function save(set) { try { localStorage.setItem(KEY, JSON.stringify(Array.from(set))); } catch (e) {} }
  var read = load();
  var reveal = false;
  try { reveal = localStorage.getItem(RKEY) === '1'; } catch (e) {}

  function unlocked(li) {
    return reveal || unlockedByProgress(li);
  }
  /* the same rule from the read set alone, ignoring "reveal everything" */
  function unlockedByProgress(li) {
    if (li.dataset.initial) return true;
    var req = li.dataset.require;
    if (req) return req.split(',').every(function (x) { return read.has(+x); });
    var u = li.dataset.unlockers;
    if (u) return u.split(',').some(function (x) { return read.has(+x); });
    var p = li.dataset.prev;
    return p ? read.has(+p) : false;
  }

  window.SY = { read: read, reveal: reveal, unlocked: unlocked, save: save };

  /* ---- index ---- */
  var arcs = document.querySelectorAll('.arc');
  if (arcs.length) {
    var total = 0, open = 0;
    arcs.forEach(function (arc) {
      var shown = 0, locked = 0;
      arc.querySelectorAll('li').forEach(function (li) {
        total++;
        var ok = unlocked(li);
        li.hidden = !ok;
        li.classList.toggle('read', read.has(+li.dataset.id));
        var tk = li.querySelector('.tick');
        if (tk) tk.onclick = function () {
          var x = +li.dataset.id;
          if (read.has(x)) read.delete(x); else read.add(x);
          save(read); location.reload();
        };
        if (ok) { shown++; open++; } else { locked++; }
      });
      arc.hidden = shown === 0;
      var lc = arc.querySelector('.lockcount');
      if (lc) lc.textContent = locked ? '(' + locked + ' more locked)' : '';
      var ab = arc.querySelector('.arcall');
      if (ab) ab.onclick = function () {
        var ids = Array.from(arc.querySelectorAll('li')).map(function (li) { return +li.dataset.id; });
        if (!confirm('Mark all ' + ids.length + ' scenes of this arc as read? Scenes that follow this arc will appear.')) return;
        ids.forEach(function (x) { read.add(x); }); save(read); location.reload();
      };
    });
    /* next-step hint: unlocked scenes not read yet, in story-chart order (chart row, then navigator position) */
    var nb = document.getElementById('nextbody');
    if (nb) {
      var todo = Array.from(document.querySelectorAll('.arc li')).filter(function (li) { return !li.hidden && !read.has(+li.dataset.id); });
      todo.sort(function (a, b) { return +a.dataset.ord - +b.dataset.ord; });
      if (todo.length) {
        var h = '<p>Unlocked and not read yet. Reading these is how the story moves on:</p><ul>';
        todo.slice(0, 8).forEach(function (li) {
          var a = li.querySelector('a');
          h += '<li><a href="' + a.getAttribute('href') + '">' + a.innerHTML + '</a> <small>' + li.closest('.arc').dataset.arc.replace(/ \[.*$/, '') + '</small></li>';
        });
        h += '</ul>' + (todo.length > 8 ? '<p>+ ' + (todo.length - 8) + ' more below.</p>' : '');
        nb.innerHTML = h;
      } else if (total - open > 0) {
        nb.innerHTML = '<p>Every unlocked scene is read. ' + (total - open) + ' scenes are still locked. In the game they open from the encyclopedia, a reference page, or a counter rather than from a scene; the reader cannot model that. Use "Reveal everything" below to see them.</p>';
      } else {
        nb.innerHTML = '<p>Every scene is read.</p>';
      }
    }
    var others = document.querySelector('.others');
    if (others) others.hidden = !reveal;
    var prog = document.getElementById('progress');
    if (prog) prog.textContent = read.size + ' read · ' + open + ' of ' + total + ' scenes visible' + (reveal ? ' · everything revealed' : '');
    var rb = document.getElementById('reveal');
    if (rb) {
      rb.textContent = reveal ? 'Hide locked scenes again' : 'Reveal everything';
      rb.onclick = function () {
        if (!reveal && !confirm('Show every scene, arc and table row, including ones you have not reached? This spoils the structure of the game.')) return;
        try { localStorage.setItem(RKEY, reveal ? '0' : '1'); } catch (e) {}
        location.reload();
      };
    }
    /* export / import: the whole state is the read set + the reveal flag */
    var ex = document.getElementById('export');
    if (ex) ex.onclick = function () {
      var blob = new Blob([JSON.stringify({ app: 'shigatsu-reader', version: 1, read: Array.from(read), reveal: reveal }, null, 1)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'shigatsu-reader-progress.json';
      document.body.appendChild(a); a.click(); a.remove();
    };
    var im = document.getElementById('import'), imf = document.getElementById('importfile');
    if (im && imf) {
      im.onclick = function () { imf.value = ''; imf.click(); };
      imf.onchange = function () {
        var f = imf.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () {
          var d;
          try { d = JSON.parse(r.result); } catch (e) { alert('Not a progress file.'); return; }
          if (!d || d.app !== 'shigatsu-reader' || !Array.isArray(d.read)) { alert('Not a progress file.'); return; }
          if (!confirm('Replace your current progress with this file (' + d.read.length + ' scenes read)?')) return;
          save(new Set(d.read.map(Number).filter(function (x) { return x > 0; })));
          try { localStorage.setItem(RKEY, d.reveal ? '1' : '0'); } catch (e) {}
          location.reload();
        };
        r.readAsText(f);
      };
    }
    var rs = document.getElementById('reset');
    if (rs) rs.onclick = function () {
      if (!confirm('Forget every scene marked as read?')) return;
      save(new Set()); location.reload();
    };
  }

  /* ---- scene page ---- */
  var lockNote = document.querySelector('.locknote');
  if (lockNote) lockNote.hidden = read.has(+lockNote.dataset.id) || unlockedByProgress(lockNote);
  document.querySelectorAll('.revealonly').forEach(function (el) { el.hidden = !reveal; });
  var end = document.querySelector('.end');
  if (end) {
    var id = +end.dataset.scene;
    function mark() { read.add(id); save(read); end.classList.add('done'); }
    if (read.has(id)) end.classList.add('done');
    var b = end.querySelector('.mark');
    if (b) b.onclick = mark;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) mark(); }, { threshold: 0.9 }).observe(end);
    }
  }

  /* ---- gated table rows / blocks ---- */
  document.querySelectorAll('[data-unlock]').forEach(function (el) {
    var u = el.dataset.unlock;
    if (!u || reveal) return;
    el.hidden = !read.has(+u);
  });
})();
