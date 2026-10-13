/* Join page: she looks down at the form, glances up at you, then back down. While you type, she watches the form. */
(function () {
  var peek = document.getElementById('join-peek');
  if (!peek || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var form = document.getElementById('invite-form');
  var typing = false, timer = null;
  var look = function (where) { peek.setAttribute('data-look', where); };
  var glance = function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!typing && !document.hidden) {
        look('you');
        timer = setTimeout(function () { look('down'); glance(); }, 1300 + Math.random() * 700);
      } else {
        glance();
      }
    }, 2600 + Math.random() * 3200);
  };
  // The first glance comes soon, as if she just noticed you.
  timer = setTimeout(function () { look('you'); timer = setTimeout(function () { look('down'); glance(); }, 1500); }, 900);
  if (form) {
    // Typing holds her eyes on the form; 2.5 s after the last key she may glance up again.
    var idle = null;
    form.addEventListener('input', function () {
      typing = true;
      look('down');
      clearTimeout(idle);
      idle = setTimeout(function () { if (!form.querySelector('.step-done.is-on')) typing = false; }, 2500);
    });
    // On the list, she looks up at you and stays. With another number, she goes back to the form.
    var held = false;
    var check = function () {
      var done = !!form.querySelector('.step-done.is-on');
      if (done && !held) { held = true; clearTimeout(timer); typing = true; look('you'); }
      else if (!done && held) { held = false; typing = false; look('down'); glance(); }
    };
    new MutationObserver(check).observe(form, { subtree: true, attributes: true, attributeFilter: ['class'] });
    check();
  }
})();
