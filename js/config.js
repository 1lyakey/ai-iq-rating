// Настройки сайта. Это единственное место, которое нужно править владельцу.

export const API_URL = 'https://www.aiiq.org/api/v1/models';
export const REFRESH_MS = 10 * 60 * 1000;          // данные aiiq обновляются раз в сутки — опрашивать чаще смысла нет
export const NEW_DAYS = 45;                        // «новинка» = релиз не старше N дней
export const PAGE_SIZE = 40;

// ---- Реферальные коды -------------------------------------------------------
// Чтобы ссылки работали у ВСЕХ посетителей, впишите свой код сюда и закоммитьте:
//   openrouter: 'ваш_код'
// Остальные способы (только для вас): панель «Мои коды» на сайте или параметры ссылки
//   ?ref_openrouter=КОД&ref_together=КОД
export const REF_DEFAULTS = {
  openrouter: null,
  together: null,
  fireworks: null,
  deepinfra: null,
};

export const REF_PROVIDERS = [
  { key: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/', param: 'ref', desc: 'Один ключ — сотни моделей', where: 'openrouter.ai/settings/referrals' },
  { key: 'together', name: 'Together AI', url: 'https://www.together.ai/', param: 'ref', desc: 'Быстрый хостинг открытых моделей', where: 'together.ai → Settings → Referrals' },
  { key: 'fireworks', name: 'Fireworks AI', url: 'https://fireworks.ai/', param: 'ref', desc: 'Быстрый инференс открытых моделей', where: 'fireworks.ai → Account → Referrals' },
  { key: 'deepinfra', name: 'DeepInfra', url: 'https://deepinfra.com/', param: 'ref', desc: 'Дешёвые открытые модели', where: 'deepinfra.com → Referrals' },
];

export const FLAGS = {
  'United States': '🇺🇸', China: '🇨🇳', Japan: '🇯🇵', Singapore: '🇸🇬',
  'South Korea': '🇰🇷', France: '🇫🇷', Canada: '🇨🇦',
};

// Порядок и вес источников в консенсусе: живые = 1, устаревшие снимки = 0.5
export const SRC_ORDER = ['aiiq', 'arena', 'swe', 'hf', 'livebench', 'aider'];
export const SRC_WEIGHT = { live: 1, snapshot: 0.5 };
