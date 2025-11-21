import { defaultLocale, locales } from 'virtual:i18n';
import { createI18n, onLocaleChange } from '../../src/runtime';

const i18n = createI18n({
  locale: defaultLocale,
  messages: locales,
});

function updateUI() {
  const title = document.getElementById('title');
  const description = document.getElementById('description');

  if (title) {
    title.textContent = i18n.t('app.title');
  }
  if (description) {
    description.textContent = i18n.t('app.description');
  }
}

onLocaleChange(() => {
  updateUI();
});

const toggleButton = document.getElementById('toggle-locale');
if (toggleButton) {
  toggleButton.addEventListener('click', () => {
    const locales = i18n.availableLocales();
    const currentIndex = locales.indexOf(i18n.getLocale());
    const nextIndex = (currentIndex + 1) % locales.length;
    i18n.setLocale(locales[nextIndex]);
  });
}

updateUI();
