/* Runs before the body: lets the CSS hide what the scripts will reveal. */
document.documentElement.classList.add('js');
/* A tap on the invite form before its script has loaded must not try a plain submit: hold it. */
document.addEventListener('submit', function (e) {
  if (e.target && e.target.id === 'invite-form' && !e.target.classList.contains('form-ready')) e.preventDefault();
}, true);
