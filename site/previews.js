const previewContent = document.querySelector('#preview-content');
const siteMode = document.querySelector('.site-mode');
const darkPreference = matchMedia('(prefers-color-scheme: dark)');

function applySiteMode(mode) {
  document.documentElement.dataset.appearance = mode;
  document.querySelector('meta[name="theme-color"]').content = mode === 'dark' ? '#141414' : '#fafafa';
  siteMode.setAttribute('aria-pressed', String(mode === 'dark'));
}

function storedSiteMode() {
  try {
    const saved = localStorage.getItem('t3-themes-site-mode');
    return saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    return null;
  }
}

function followSitePreference() {
  applySiteMode(storedSiteMode() ?? (darkPreference.matches ? 'dark' : 'light'));
}

followSitePreference();
siteMode.hidden = false;
darkPreference.addEventListener('change', followSitePreference);
siteMode.addEventListener('click', () => {
  const mode = document.documentElement.dataset.appearance === 'dark' ? 'light' : 'dark';
  applySiteMode(mode);
  try {
    localStorage.setItem('t3-themes-site-mode', mode);
  } catch {
    // The in-page toggle still works when storage is disabled.
  }
});
const previewStyles = new URL('./preview.css', import.meta.url).href;
const textureAsset = new URL('./assets/dark-texture.webp', import.meta.url).href;

const themeSources = {
  'koi-pond': './downloads/koi-pond.json',
  'dark-texture': './assets/dark-texture.json',
};

const colorTokens = {
  canvas: 'canvas',
  text: 'text',
  messageSurface: 'message',
  messageForeground: 'message-ink',
  toolbar: 'chrome',
  toolbarBorder: 'border',
  textMuted: 'muted',
  surfaceRaised: 'composer',
  accent: 'accent',
  accentForeground: 'accent-ink',
};

function colorDeclarations(colors) {
  return Object.entries(colorTokens)
    .filter(([token]) => colors[token])
    .map(([token, property]) => `--${property}: ${colors[token]};`)
    .join(' ');
}

async function loadPreview(preview) {
  preview.previewCleanup?.();
  const controller = new AbortController();
  let observer;
  preview.previewCleanup = () => { controller.abort(); observer?.disconnect(); };
  const { signal } = controller;
  const { theme } = preview.dataset;
  const iframe = preview.querySelector('iframe');
  const status = preview.querySelector('.preview-status');
  const modeControl = preview.closest('.theme').querySelector('.mode-control');

  try {
    const response = await fetch(themeSources[theme]);
    if (!response.ok) throw new Error(`Theme request returned ${response.status}`);
    const config = await response.json();

    const loaded = new Promise((resolve) => iframe.addEventListener('load', resolve, { once: true }));
    iframe.srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8">
      <title>Theme preview</title><link rel="stylesheet" href="${previewStyles}">
      </head><body>${previewContent.innerHTML}</body></html>`;
    await loaded;

    const doc = iframe.contentDocument;
    const css = doc.createElement('style');
    css.textContent = `
      :root { --theme-background-image: url("${textureAsset}"); ${colorDeclarations(config.variants.light)} }
      :root.dark { ${colorDeclarations({ canvas: config.canvas, ...config.colors })} }
      ${config.css}
    `;
    function updatePreviewMode() {
      doc.documentElement.classList.toggle('dark', modeControl.querySelector(':checked').value === 'dark');
    }
    updatePreviewMode();
    modeControl.addEventListener('change', updatePreviewMode, { signal });
    doc.head.append(css);
    if (theme === 'koi-pond') {
      let visible = !('IntersectionObserver' in window);
      const updatePlayback = () => {
        doc.documentElement.toggleAttribute('data-paused', !visible || document.hidden);
      };
      updatePlayback();
      document.addEventListener('visibilitychange', updatePlayback, { signal });
      if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          updatePlayback();
        });
        observer.observe(preview);
      }
    }
    status.hidden = true;
    modeControl.hidden = false;
  } catch (error) {
    status.textContent = 'Live preview unavailable. The theme is still available to download.';
    console.error(`Could not load the ${theme} preview.`, error);
  } finally {
    preview.setAttribute('aria-busy', 'false');
  }
}

document.querySelectorAll('.preview').forEach(loadPreview);

const copyButton = document.querySelector('.copy-command');
if (navigator.clipboard?.writeText) {
  const command = document.querySelector('#install-command');
  const copyStatus = document.querySelector('.copy-status');
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    copyStatus.textContent = '';
    try {
      await navigator.clipboard.writeText(command.textContent);
      copyStatus.textContent = 'Command copied.';
    } catch {
      copyStatus.textContent = 'Select the command to copy it manually.';
    }
  });
}

document.querySelectorAll('.preview-viewport').forEach(viewport => {
  new ResizeObserver(() => {
    viewport.querySelector('iframe').style.transform = `scale(${viewport.clientWidth / 960})`;
  }).observe(viewport);
});

const themeDialog = document.querySelector('.theme-dialog');
let openedTheme;
let themePlaceholder;
document.querySelectorAll('.open-theme').forEach(button => {
  button.hidden = false;
  button.addEventListener('click', () => {
    openedTheme = button.closest('.theme');
    themePlaceholder = document.createComment('theme position');
    openedTheme.before(themePlaceholder);
    themeDialog.querySelector('.dialog-content').append(openedTheme);
    loadPreview(openedTheme.querySelector('.preview'));
    themeDialog.showModal();
  });
});
function closeTheme() {
  themeDialog.close();
}
document.querySelector('.close-dialog').addEventListener('click', closeTheme);
themeDialog.addEventListener('close', () => {
  if (!openedTheme) return;
  themePlaceholder.replaceWith(openedTheme);
  loadPreview(openedTheme.querySelector('.preview'));
  openedTheme.querySelector('.open-theme').focus();
  openedTheme = null;
});
themeDialog.addEventListener('click', event => {
  if (event.target === themeDialog) closeTheme();
  if (event.target.closest('a[href^="#"]')) closeTheme();
});
