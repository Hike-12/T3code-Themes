const previewContent = `<div class="demo" data-workspace-area="conversation">
      <div class="chat-canvas" data-assistant-citation-viewport>
        <div class="new-thread">
          <h1>What should we build in <strong>Theme workshop</strong>?</h1>
          <p class="workspace-hint">or start without a project</p>
          <div class="composer" data-chat-composer-main-surface>
            <span>Ask anything. @ files, $ skills, / commands</span>
            <div class="composer-tools" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m9 15 7-7a2 2 0 0 1 3 3l-9 9a5 5 0 0 1-7-7L13 3a3.5 3.5 0 1 1 5 5L8 18"/></svg>
              <span data-chat-provider-model-picker aria-label="GPT-6 Astra">GPT-6 Astra</span>
              <svg class="submit" viewBox="0 0 24 24"><path d="M12 18V6m-5 5 5-5 5 5"/></svg>
            </div>
          </div>
          <div class="checkout"><span>Current checkout</span><span>⑂ main</span></div>
        </div>
      </div>
    </div>`;
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
      </head><body>${previewContent}</body></html>`;
    await loaded;

    const doc = iframe.contentDocument;
    const css = doc.createElement('style');
    function applyTheme(themeConfig) {
      css.textContent = `
        :root { --theme-background-image: url("${textureAsset}"); ${colorDeclarations(themeConfig.variants.light)} }
        :root.dark { ${colorDeclarations({ canvas: themeConfig.canvas, ...themeConfig.colors })} }
        ${themeConfig.css}
      `;
    }
    applyTheme(config);
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
    preview.dispatchEvent(new CustomEvent('theme-ready', {
      detail: { config, applyTheme, document: doc },
    }));
  } catch (error) {
    status.textContent = 'Live preview unavailable. The theme is still available to download.';
    console.error(`Could not load the ${theme} preview.`, error);
  } finally {
    preview.setAttribute('aria-busy', 'false');
  }
}

document.querySelectorAll('.preview').forEach(loadPreview);

const copyButton = document.querySelector('.copy-command');
if (copyButton && navigator.clipboard?.writeText) {
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

document.querySelectorAll('.preview-viewport:not(.studio-viewport)').forEach(viewport => {
  new ResizeObserver(() => {
    viewport.querySelector('iframe').style.transform = `scale(${viewport.clientWidth / 960})`;
  }).observe(viewport);
});
