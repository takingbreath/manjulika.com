/* manjulika.com: the invite form. Number, then a 4-digit code by SMS, then "on the list". No other scripts needed. */
(function () {
  var form = document.getElementById('invite-form');
  if (!form) return;
  form.classList.add('form-ready'); // hides the mail line that shows when this script never runs
  // Locally, the dev server passes /waitlist/* to the desk, so the page needs no extra origin.
  var local = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  var api = local ? '' : 'https://api.manjulika.com';
  var CODE_LIFE = 5 * 60 * 1000;
  var steps = {
    phone: form.querySelector('.step-phone'),
    code: form.querySelector('.step-code'),
    done: form.querySelector('.step-done'),
    fallback: form.querySelector('.step-fallback')
  };
  var phoneInput = document.getElementById('wa-number');
  var codeInput = document.getElementById('wa-code');
  var resendBtn = form.querySelector('[data-resend]');
  var waitEl = form.querySelector('[data-wait]');
  var fallbackText = form.querySelector('[data-fallback-text]');
  var fallbackDefault = fallbackText ? fallbackText.textContent : '';
  var phone = '';
  var sentAt = 0; // when the last code for `phone` went out
  var inFlight = false;
  var cooldown = null;
  var resume = 'phone'; // the step that "Go back" returns to
  var failedAt = 0; // when the desk last failed to send an SMS to `phone`
  var codeShownAt = 0;
  var COOLDOWN_TEXT = 'Wait a minute before asking for a new code.';
  var titleEl = document.querySelector('[data-title]');
  var titleText = titleEl ? titleEl.textContent : '';
  var doneTitle = form.querySelector('[data-done-title]');
  var doneTitleText = doneTitle.textContent;

  // The page remembers you. This tab keeps the number and its code time, so a visit to the home page
  // does not cost a new SMS. This browser keeps only a masked number after you join, so the page shows
  // your place on the list instead of the form.
  var KEY = 'manjulika-invite';
  var JOIN_LIFE = 180 * 24 * 3600 * 1000;
  function store(kind) { try { var s = window[kind]; s.getItem(KEY); return s; } catch (e) { return null; } }
  var tabStore = store('sessionStorage');
  var keepStore = store('localStorage');
  function read(s) { try { return s ? JSON.parse(s.getItem(KEY) || 'null') : null; } catch (e) { return null; } }
  function write(s, value) {
    try { if (s) { if (value) s.setItem(KEY, JSON.stringify(value)); else s.removeItem(KEY); } } catch (e) { /* storage full or blocked */ }
  }
  var resendAt = 0;
  function saveTab() { write(tabStore, { phone: phone, sentAt: sentAt, resendAt: resendAt }); }

  function normalise(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    else if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return /^[6-9]\d{9}$/.test(d) ? d : '';
  }
  function masked(d) { return '+91 ' + d.slice(0, 2) + 'xxx xx' + d.slice(7); }
  function nowMs() { return Date.now(); }

  // quiet: put the step back after a page load, without moving focus.
  function show(name, quiet) {
    if (name === 'code' && !steps.code.classList.contains('is-on')) codeShownAt = nowMs();
    Object.keys(steps).forEach(function (k) { steps[k].classList.toggle('is-on', k === name); });
    if (quiet) return;
    var target = steps[name].querySelector('input') || steps[name].querySelector('[tabindex="-1"]');
    if (target) target.focus();
  }
  // On the list: the page headline turns into the promise.
  function showDone(maskedNumber, already, quiet) {
    clearInterval(cooldown);
    doneTitle.textContent = already ? 'You are already on the list.' : doneTitleText;
    var num = form.querySelector('[data-done-number]');
    if (num) num.textContent = maskedNumber || 'you';
    if (titleEl) titleEl.textContent = 'Consider it done.';
    document.body.classList.add('is-joined');
    show('done', quiet);
  }
  // err: 'input' marks the field as wrong; 'wait' is a limit, not a typing mistake.
  function note(step, text, err) {
    var el = step.querySelector('[data-note]');
    var input = step.querySelector('input');
    if (el) {
      el.textContent = text || '';
      el.classList.toggle('err', !!err);
    }
    if (input) {
      if (err === 'input') input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }
  // Busy buttons stay focusable, so keyboard focus never drops to the page.
  function busy(step, on) {
    step.querySelectorAll('button[type="submit"]').forEach(function (b) {
      if (on) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
    });
  }
  function startCooldown(seconds) {
    clearInterval(cooldown);
    var left = Math.max(1, Math.round(seconds || 60));
    resendAt = nowMs() + left * 1000;
    saveTab();
    resendBtn.disabled = true;
    waitEl.textContent = 'in ' + left + ' s';
    cooldown = setInterval(function () {
      left -= 1;
      if (left <= 0) { clearInterval(cooldown); resendBtn.disabled = false; waitEl.textContent = ''; }
      else waitEl.textContent = 'in ' + left + ' s';
    }, 1000);
  }
  function fallback(text, from) {
    resume = from;
    if (fallbackText) fallbackText.textContent = text || fallbackDefault;
    show('fallback');
  }
  function post(path, body) {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timedOut = false;
    // Longer than the desk's own 10 s SMS timeout, so a slow send still gets its answer.
    var timer = setTimeout(function () { timedOut = true; if (ctrl) ctrl.abort(); }, 20000);
    return fetch(api + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, body: j || {} }; });
    }, function (e) {
      clearTimeout(timer);
      var err = new Error('network');
      err.timeout = timedOut;
      throw err;
    });
  }
  function errorText(res, fallbackMsg) {
    return (res.body && typeof res.body.error === 'string' && res.body.error !== 'forbidden') ? res.body.error : fallbackMsg;
  }
  function codeSent(fresh) {
    form.querySelector('[data-masked]').textContent = masked(phone);
    if (fresh) codeInput.value = '';
  }

  function requestCode(step) {
    if (inFlight) return;
    inFlight = true;
    busy(step, true);
    note(step, 'Sending the code…');
    var resend = step === steps.code;
    post('/waitlist/request', { phone: phone }).then(function (res) {
      inFlight = false;
      busy(step, false);
      var retry = +(res.body && res.body.retry_after) || 0;
      var reason = res.body && res.body.reason;
      var cooling = res.status === 429 && (reason === 'cooldown' || (!reason && res.body.error === COOLDOWN_TEXT));
      if (res.ok) {
        sentAt = nowMs();
        failedAt = 0;
        note(steps.phone, '');
        codeSent(!resend);
        note(steps.code, resend ? 'I sent a new code.' : '');
        startCooldown(res.body.resend_after);
        show('code');
      } else if (cooling && failedAt && nowMs() - failedAt < 90000) {
        // The last send failed, so there is no code to use. Only the wait is left.
        note(step, 'The last SMS did not go out. Try again in a minute.', 'wait');
        (step.querySelector('input') || step).focus();
      } else if (cooling) {
        // A code went to this number less than a minute ago. It still works.
        sentAt = sentAt || nowMs();
        codeSent(!resend);
        startCooldown(retry);
        note(steps.code, 'I already sent a code. Use that one, or ask for a new one in a minute.');
        show('code');
      } else if (res.status === 429) {
        note(step, errorText(res, 'Too many tries. Try again later.'), 'wait');
        (step.querySelector('input') || step).focus();
      } else if (res.status >= 500) {
        if (res.status === 502) failedAt = nowMs();
        fallback(errorText(res, fallbackDefault), resend ? 'code' : 'phone');
      } else {
        note(step, errorText(res, 'That did not work. Try again.'), 'input');
        var input = step.querySelector('input');
        if (input) { input.focus(); input.select(); }
      }
    }).catch(function (e) {
      inFlight = false;
      busy(step, false);
      if (e && e.timeout) {
        // The desk was slow. The SMS may still come, so keep the code field open.
        sentAt = nowMs();
        codeSent(!resend);
        startCooldown(60);
        note(steps.code, 'The invite desk is slow today. If the SMS comes, enter the code here.');
        show('code');
      } else {
        fallback('', resend ? 'code' : 'phone');
      }
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (inFlight) return;
    if (steps.phone.classList.contains('is-on')) {
      var d = normalise(phoneInput.value);
      if (!d) {
        note(steps.phone, 'Enter the 10-digit mobile number, for example 98765 43210.', 'input');
        phoneInput.focus();
        return;
      }
      if (d === phone && sentAt && nowMs() - sentAt < CODE_LIFE) {
        // Same number, and its code is still alive: no new SMS needed.
        note(steps.phone, '');
        note(steps.code, 'Use the code I already sent.');
        saveTab();
        show('code');
        return;
      }
      phone = d;
      sentAt = 0;
      requestCode(steps.phone);
    } else if (steps.code.classList.contains('is-on')) {
      var code = codeInput.value.replace(/\D/g, '');
      // A second Enter right after the code step opened is not an attempt.
      if (!code && nowMs() - codeShownAt < 700) { codeInput.focus(); return; }
      if (code.length !== 4) { note(steps.code, 'The code is 4 digits.', 'input'); codeInput.focus(); return; }
      inFlight = true;
      busy(steps.code, true);
      note(steps.code, 'Checking…');
      post('/waitlist/verify', { phone: phone, code: code }).then(function (res) {
        inFlight = false;
        busy(steps.code, false);
        if (res.ok) {
          write(tabStore, null);
          write(keepStore, { masked: masked(phone), at: nowMs() });
          showDone(masked(phone), !!res.body.already);
        } else if (res.status === 429) {
          note(steps.code, errorText(res, 'Too many tries. Try again later.'), 'wait');
          codeInput.focus();
        } else if (res.status >= 500) {
          fallback(errorText(res, fallbackDefault), 'code');
        } else {
          note(steps.code, errorText(res, 'Wrong or expired code. Try again, or ask for a new one.'), 'input');
          codeInput.focus();
          codeInput.select();
        }
      }).catch(function () {
        inFlight = false;
        busy(steps.code, false);
        fallback('', 'code');
      });
    }
  });

  // Back on the page: show the list place, or the open code, or the number typed before.
  var kept = read(keepStore);
  var tab = read(tabStore);
  var tabPhone = tab ? normalise(tab.phone) : '';
  if (kept && kept.masked && nowMs() - (+kept.at || 0) < JOIN_LIFE) {
    showDone(String(kept.masked), false, true);
  } else if (tabPhone && +tab.sentAt && nowMs() - tab.sentAt < CODE_LIFE) {
    phone = tabPhone;
    sentAt = +tab.sentAt;
    codeSent(false);
    var wait = Math.ceil(((+tab.resendAt || 0) - nowMs()) / 1000);
    if (wait > 0) { startCooldown(wait); resendAt = +tab.resendAt; saveTab(); } else resendBtn.disabled = false;
    show('code', true);
  } else if (tabPhone) {
    phoneInput.value = tabPhone;
  }

  // On the join page the open field takes the cursor at once, on devices with a pointer (no phone keyboard pop-up).
  var open = form.querySelector('.step.is-on input');
  if (open && form.hasAttribute('data-autofocus') && window.matchMedia('(pointer: fine)').matches && !location.hash) {
    open.focus({ preventScroll: true });
  }

  resendBtn.addEventListener('click', function () { if (!resendBtn.disabled) requestCode(steps.code); });
  form.querySelector('[data-change]').addEventListener('click', function () {
    write(tabStore, null);
    note(steps.code, '');
    phoneInput.value = phone;
    show('phone');
    phoneInput.select();
  });
  var another = form.querySelector('[data-another]');
  if (another) {
    another.addEventListener('click', function () {
      write(keepStore, null);
      write(tabStore, null);
      phone = '';
      sentAt = 0;
      phoneInput.value = '';
      note(steps.phone, '');
      if (titleEl) titleEl.textContent = titleText;
      document.body.classList.remove('is-joined');
      show('phone');
    });
  }
  var retryBtn = form.querySelector('[data-retry]');
  if (retryBtn) {
    retryBtn.addEventListener('click', function () {
      note(steps[resume], '');
      show(resume);
      var input = steps[resume].querySelector('input');
      if (input) input.select();
    });
  }
})();
