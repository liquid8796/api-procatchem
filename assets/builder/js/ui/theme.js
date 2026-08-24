/**
 * Light / dark switching.
 *
 * Three states rather than two, because "follow the system" is the right
 * default and there is no way back to it from a plain on/off toggle. The
 * choice is written to the root element as `data-theme`; the stylesheet does
 * the rest by redefining its colour tokens.
 */

const STORAGE_KEY = 'procatchem-script-builder-theme-v1';

/** In cycle order, so pressing the button walks around the ring. */
const THEMES = Object.freeze([
  { id: 'system', label: 'Theme: system', icon: '◐' },
  { id: 'light', label: 'Theme: light', icon: '☀' },
  { id: 'dark', label: 'Theme: dark', icon: '☾' },
]);

/**
 * Wire a button to the theme cycle and apply whatever was chosen last.
 *
 * @param {HTMLElement} button
 */
export function installThemeToggle(button) {
  let index = Math.max(0, THEMES.findIndex((theme) => theme.id === readStored()));

  const apply = () => {
    const theme = THEMES[index];
    if (theme.id === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = theme.id;

    button.textContent = '';
    button.append(
      Object.assign(document.createElement('span'), {
        textContent: theme.icon,
        ariaHidden: 'true',
        className: 'theme-icon',
      }),
      document.createTextNode(theme.label),
    );
    button.title = 'Switch between the system theme, light, and dark';
    store(theme.id);
  };

  button.addEventListener('click', () => {
    index = (index + 1) % THEMES.length;
    apply();
  });
  apply();
}

/** @returns {string} the stored choice, or 'system' */
function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? 'system';
  } catch {
    // Private browsing: the choice simply does not persist.
    return 'system';
  }
}

/** @param {string} id */
function store(id) {
  try {
    if (id === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Remembering the choice is a convenience, never a requirement.
  }
}
