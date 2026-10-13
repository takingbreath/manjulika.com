/* manjulika.com, build 6: native scroll. Motion lives inside the content and starts when it comes into view. */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;
  var html = document.documentElement;
  var hasIO = 'IntersectionObserver' in window;
  var topH = 64;
  html.classList.add('app');
  // The invite form moved to its own page; old links with #invite still land there.
  if (location.hash === '#invite') { location.replace('join/'); return; }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function arr(list) { return Array.prototype.slice.call(list); }

  // Smooth in-page jumps only after the page has loaded, so a link with #name lands at once.
  if (document.readyState === 'complete') html.classList.add('smooth');
  else window.addEventListener('load', function () { html.classList.add('smooth'); });

  /* Header: a hairline once the page moves. */
  var bar = document.getElementById('top-bar');
  var onScroll = function () { if (bar) bar.classList.toggle('is-scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Sections rise as they arrive. */
  var reveals = document.querySelectorAll('.reveal');
  if (!hasIO || reduce) {
    each(reveals, function (el) { el.classList.add('in'); });
  } else {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    each(reveals, function (el) { ro.observe(el); });
  }

  /* Images other than the hero wait for the hero, so they never compete with it, and then load about
     one screen before their section arrives. A visitor who never scrolls downloads only the first screen.
     An image inside something hidden (her picture beside How I work, on a phone) is not fetched. */
  function shown(img) { return img.offsetParent !== null || getComputedStyle(img).position === 'fixed'; }
  function loadLate(root) {
    each((root || document).querySelectorAll('img[data-src]'), function (img) {
      if (!shown(img)) return;
      // One attribute only: setting srcset and then src makes the browser fetch the picture twice.
      if (img.dataset.srcset) img.srcset = img.dataset.srcset; else img.src = img.dataset.src;
      img.removeAttribute('data-src');
      img.removeAttribute('data-srcset');
    });
  }
  var mascot = document.getElementById('hero-mascot');
  var heroImg = mascot ? mascot.querySelector('.body') : null;
  function afterHero(fn) {
    var done = false;
    var go = function () { if (!done) { done = true; fn(); } };
    if (!heroImg || (heroImg.complete && heroImg.naturalWidth)) { go(); return; }
    heroImg.addEventListener('load', go);
    heroImg.addEventListener('error', go);
    setTimeout(go, 12000);
  }
  // A phone that turns to a wide screen shows the How picture, so fetch it then.
  var wide = window.matchMedia('(min-width: 901px)');
  var onWide = function () { if (wide.matches) loadLate(document.querySelector('.how-stage')); };
  if (wide.addEventListener) wide.addEventListener('change', onWide);
  afterHero(function () {
    if (mascot) loadLate(mascot); // the blink lids
    if (hasIO) {
      var lo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { loadLate(e.target); lo.unobserve(e.target); } });
      }, { rootMargin: '100% 0px' });
      // The film needs its first two chats; it fetches each next chat as it plays.
      each(document.querySelectorAll('.does .scene:nth-child(-n+2), .first, .how'), function (el) { lo.observe(el); });
    } else {
      loadLate();
    }
  });

  /* The join page and its two pictures: fetched when a visitor reaches for a Try button, or after a few
     quiet seconds on the page, so "Try Manjulika" opens at once. Not on data saver or a slow connection. */
  var conn = navigator.connection || {};
  var prefetched = false;
  function prefetchJoin() {
    if (prefetched || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')) return;
    prefetched = true;
    // The same file the join page will pick: it shows her at min(300px, 64vw).
    var size = Math.min(300, window.innerWidth * 0.64) * (window.devicePixelRatio || 1) > 480 ? '640' : '480';
    ['assets/mascot/peek-over-down-' + size + '.webp', 'assets/mascot/peek-over-you-' + size + '.webp'].forEach(function (href) {
      var l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = href;
      document.head.appendChild(l);
    });
  }
  each(document.querySelectorAll('a[href="join/"]'), function (a) {
    ['pointerenter', 'touchstart', 'focus'].forEach(function (ev) { a.addEventListener(ev, prefetchJoin, { passive: true, once: true }); });
  });
  window.addEventListener('load', function () { setTimeout(prefetchJoin, 4000); });

  /* Hero: lean toward the cursor, blink, and rest the hem filter when she is off screen. */
  var hero = document.querySelector('.hero');
  if (hero && mascot && !reduce && fine) {
    hero.addEventListener('mousemove', function (e) {
      var r = hero.getBoundingClientRect();
      mascot.style.setProperty('--lx', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
      mascot.style.setProperty('--ly', (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
    });
    hero.addEventListener('mouseleave', function () {
      mascot.style.setProperty('--lx', '0');
      mascot.style.setProperty('--ly', '0');
    });
  }
  var heroVisible = true;
  if (hero && hasIO) {
    var defs = document.querySelector('svg.defs');
    var setHero = function () {
      var on = heroVisible && !document.hidden;
      html.classList.toggle('hero-off', !on);
      if (defs && defs.pauseAnimations) { if (on) defs.unpauseAnimations(); else defs.pauseAnimations(); }
    };
    new IntersectionObserver(function (entries) { heroVisible = entries[0].isIntersecting; setHero(); }).observe(hero);
    document.addEventListener('visibilitychange', setHero);
  }
  if (mascot && !reduce) {
    // Open, half, closed, half, open in about 200 ms; random gaps; now and then a double blink.
    var frames = [['half', 50], ['closed', 90], ['half', 55], ['', 0]];
    var blinkOnce = function (done) {
      var i = 0;
      (function next() {
        var f = frames[i++];
        if (f[0]) mascot.setAttribute('data-lid', f[0]); else mascot.removeAttribute('data-lid');
        if (i < frames.length) setTimeout(next, f[1]); else if (done) done();
      })();
    };
    var schedule = function () {
      setTimeout(function () {
        if (document.hidden || !heroVisible) { schedule(); return; }
        blinkOnce(function () {
          if (Math.random() < 0.18) setTimeout(function () { blinkOnce(schedule); }, 140);
          else schedule();
        });
      }, 2200 + Math.random() * 3800);
    };
    afterHero(function () {
      var lids = arr(mascot.querySelectorAll('.lid'));
      Promise.all(lids.map(function (img) {
        return img.decode ? img.decode() : Promise.resolve();
      })).then(function () { setTimeout(function () { blinkOnce(schedule); }, 1200); }, function () {});
    });
  }

  // Is most of this element on screen, below the sticky header?
  function mostlyVisible(e, share) {
    var room = window.innerHeight - topH;
    return e.isIntersecting && e.intersectionRect.height >= Math.min(e.boundingClientRect.height, room) * share;
  }
  var steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

  /* Chats: WhatsApp pace. Your messages arrive after a short pause; before each of her replies,
     she is "typing" for a moment that grows a little with the length of the reply. */
  function bubbles(scene) {
    return arr(scene.querySelectorAll('.wa > li')).filter(function (li) { return !li.classList.contains('typing'); });
  }
  function stopChat(scene) {
    if (scene._timers) scene._timers.forEach(clearTimeout);
    scene._timers = [];
    var t = scene.querySelector('.wa .typing');
    if (t) t.remove();
  }
  function showAll(scene) {
    stopChat(scene);
    bubbles(scene).forEach(function (li) { li.classList.add('shown'); });
  }
  function textOf(li) {
    var copy = li.cloneNode(true);
    each(copy.querySelectorAll('time, .sr-only'), function (n) { n.remove(); });
    return copy.textContent.trim();
  }
  // Returns the time (ms) at which the last bubble shows.
  function playChat(scene) {
    stopChat(scene);
    var list = scene.querySelector('.wa');
    var items = bubbles(scene);
    items.forEach(function (li) { li.classList.remove('shown'); });
    var at = function (ms, fn) { scene._timers.push(setTimeout(fn, ms)); };
    var t = 450;
    items.forEach(function (li, i) {
      if (li.classList.contains('her')) {
        var typing = Math.min(1250, 650 + textOf(li).length * 7);
        var start = i === 0 ? t : t + 300;
        at(start, function () {
          var old = list.querySelector('.typing');
          if (old) old.remove();
          var dots = document.createElement('li');
          dots.className = 'typing';
          dots.setAttribute('aria-hidden', 'true');
          dots.innerHTML = '<i></i><i></i><i></i>';
          dots.style.top = li.offsetTop + 'px';
          list.appendChild(dots);
        });
        t = start + typing;
        at(t, function () { var d = list.querySelector('.typing'); if (d) d.remove(); li.classList.add('shown'); });
      } else {
        t = i === 0 ? t : t + (li.classList.contains('day') ? 650 : 900);
        at(t, function () { li.classList.add('shown'); });
      }
    });
    return t;
  }
  function readTime(scene) {
    var words = 0;
    bubbles(scene).forEach(function (li) { words += textOf(li).split(/\s+/).length; });
    return Math.min(8000, Math.max(3500, words * 170));
  }

  /* The film: five chats that play like a short video when it is on screen. It pauses off screen,
     in a hidden tab, while keyboard focus is inside it, or with the pause button. */
  var film = document.getElementById('film');
  if (film) {
    var scenes = arr(film.querySelectorAll('.scene'));
    var tabs = arr(film.querySelectorAll('.film-tab'));
    var card = film.querySelector('.film-card');
    var playBtn = film.querySelector('[data-play]');
    var cur = 0, started = false, visible = false, focusPaused = false, userPaused = false;
    var elapsed = 0, dur = 8000, last = 0, raf = 0;
    film.classList.add('is-live');
    if (playBtn && !reduce) playBtn.hidden = false;

    var fill = function (i, f) {
      var b = tabs[i] && tabs[i].querySelector('b');
      if (b) b.style.transform = 'scaleX(' + Math.max(0, Math.min(1, f)) + ')';
    };
    var show = function (i) {
      cur = (i + scenes.length) % scenes.length;
      scenes.forEach(function (s, k) {
        var on = k === cur;
        s.classList.toggle('is-on', on);
        s.inert = !on;
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (!on) stopChat(s);
      });
      tabs.forEach(function (t, k) {
        t.classList.toggle('is-on', k === cur);
        t.classList.toggle('is-past', k < cur);
        if (k === cur) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
        fill(k, k < cur ? 1 : 0);
      });
      loadLate(scenes[cur]);
      loadLate(scenes[(cur + 1) % scenes.length]);
      elapsed = 0;
      last = 0;
      var scene = scenes[cur];
      if (reduce) { showAll(scene); fill(cur, 1); return; }
      dur = playChat(scene) + readTime(scene);
    };
    var running = function () { return started && visible && !focusPaused && !userPaused && !reduce && !document.hidden; };
    var sync = function () { film.classList.toggle('is-paused', userPaused || focusPaused); };
    var tick = function (now) {
      raf = 0;
      if (!running()) { last = 0; return; }
      if (last) elapsed += now - last;
      last = now;
      fill(cur, elapsed / dur);
      if (elapsed >= dur) show(cur + 1);
      raf = requestAnimationFrame(tick);
    };
    var kick = function () { sync(); if (running() && !raf) { last = 0; raf = requestAnimationFrame(tick); } };

    // Before it is seen, the first chat waits; the other chats are out of reach.
    if (reduce) { showAll(scenes[0]); fill(0, 1); }
    scenes.forEach(function (s, k) { if (k) { s.inert = true; s.setAttribute('aria-hidden', 'true'); } });

    if (hasIO && card) {
      new IntersectionObserver(function (entries) {
        visible = mostlyVisible(entries[0], 0.75);
        if (visible && !started) { started = true; show(0); }
        kick();
      }, { threshold: steps }).observe(card);
    } else {
      visible = true; started = true; show(0); kick();
    }
    document.addEventListener('visibilitychange', kick);
    // Keyboard users read at their own pace: focus inside the film holds it (the APG carousel rule).
    film.addEventListener('focusin', function (e) {
      if (e.target.matches && e.target.matches(':focus-visible')) { focusPaused = true; kick(); }
    });
    film.addEventListener('focusout', function (e) {
      if (!film.contains(e.relatedTarget)) { focusPaused = false; kick(); }
    });
    tabs.forEach(function (t, k) {
      t.addEventListener('click', function () { started = true; show(k); kick(); });
    });
    if (playBtn) {
      playBtn.addEventListener('click', function () {
        userPaused = !userPaused;
        playBtn.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
        if (!started) { started = true; show(0); }
        kick();
      });
    }
    // A sideways swipe on the card moves to the next or the previous chat; up and down stay the page's.
    if (card) {
      var sx = 0, sy = 0;
      card.addEventListener('touchstart', function (e) { var p = e.touches[0]; sx = p.clientX; sy = p.clientY; }, { passive: true });
      card.addEventListener('touchend', function (e) {
        var p = e.changedTouches[0], dx = p.clientX - sx, dy = p.clientY - sy;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { started = true; show(cur + (dx < 0 ? 1 : -1)); kick(); }
      }, { passive: true });
    }
  }

  /* Sometimes I text first: once the stack is on screen, the messages arrive one by one, newest on top. */
  var first = document.querySelector('.first');
  var notesList = first && first.querySelector('.notes');
  if (notesList && hasIO && !reduce) {
    first.classList.add('is-live');
    var notes = arr(notesList.querySelectorAll('.note')).reverse();
    var fo = new IntersectionObserver(function (entries) {
      if (!mostlyVisible(entries[0], 0.6)) return;
      fo.disconnect();
      notes.forEach(function (n, k) { setTimeout(function () { n.classList.add('in'); }, 250 + k * 650); });
    }, { threshold: steps });
    fo.observe(notesList);
  }

  /* The app drift rests while its band is off screen. */
  var apps = document.querySelector('.apps');
  if (apps && hasIO) {
    new IntersectionObserver(function (entries) { apps.classList.toggle('is-off', !entries[0].isIntersecting); }).observe(apps);
  }

  /* How I work: native disclosures, one open at a time; her picture follows the open one.
     The row you tap stays under your finger while the one above closes. */
  var acc = document.getElementById('acc');
  if (acc) {
    var items = arr(acc.querySelectorAll('.acc-item'));
    var poses = arr(document.querySelectorAll('.how-pose'));
    var held = null;
    var syncPose = function () {
      var i = items.findIndex(function (it) { return it.open; });
      if (i < 0) return;
      poses.forEach(function (p, k) { p.classList.toggle('is-on', k === i); });
      loadLate(document.querySelector('.how-stage'));
    };
    items.forEach(function (it) {
      var sum = it.querySelector('summary');
      sum.addEventListener('click', function () { held = { el: sum, top: sum.getBoundingClientRect().top }; });
      it.addEventListener('toggle', function () {
        if (it.open) items.forEach(function (o) { if (o !== it && o.open) o.open = false; }); // for browsers without name=""
        syncPose();
        if (it.open) loadLate(it); // the small picture inside the panel, on phones
        if (held) {
          var h = held;
          held = null;
          requestAnimationFrame(function () {
            var d = h.el.getBoundingClientRect().top - h.top;
            if (Math.abs(d) > 1) window.scrollBy({ top: d, behavior: 'instant' });
          });
        }
      });
    });
    syncPose();
  }
})();
