// Ставит тему до отрисовки, чтобы не было вспышки. Подключается как обычный блокирующий скрипт.
try {
  var t = localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = t;
} catch (e) { /* тема по умолчанию — тёмная */ }
