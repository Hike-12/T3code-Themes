const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require('playwright');
const path = require('node:path');

async function run(browser) {
  const theme = JSON.parse(await readFile(path.join(__dirname, '../public/downloads/blockworks.json'), 'utf8'));
  assert.equal(theme.canvas, '#121316');
  assert.ok(theme.css.length < 100000);
  assert.doesNotMatch(theme.css, /--mc-portal|t3-minecraft-roam/);

  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html class="dark"><style>
    body { margin: 16px; }
    [data-chat-canvas] { max-width: 440px; }
    [data-chat-composer-main-surface] { margin-top: 32px; min-height: 64px; }
    ${theme.css}
    </style><aside data-slot="sidebar">
      <button data-sidebar-row="shelf:working">Working</button>
      <button data-sidebar-row="shelf:settled">Settled</button>
      <div data-thread-item hidden><button data-sidebar-row="thread:2">Another thread<span class="bg-sky-500"></span></button></div>
    </aside>
    <main data-chat-canvas>
      <header data-chat-header><button aria-label="Open in VS Code"><svg><path /></svg></button>
        <button aria-label="Add project script"><svg><path /></svg></button></header>
      <div data-workspace-area="conversation"><div data-timeline-row-kind="work"></div></div>
      <div data-workspace-area="composer"><form data-chat-composer-form>
        <div data-chat-composer-main-surface><label>Ask anything <input></label>
          <button type="button" aria-label="Attach files"><svg><path /></svg></button>
          <button type="button" id="stop" hidden aria-label="Stop generation"><svg></svg></button>
          <button type="button" aria-label="Choose branch"><svg class="lucide-git-branch"><path /></svg></button>
          <span data-chat-provider-model-picker aria-label="Claude Opus"></span>
        </div></form></div>
      <button id="diff"><span class="text-diff-addition-foreground">+84</span> <span class="text-diff-deletion-foreground">-168</span></button>
    </main>`);
  const dock = page.locator('[data-chat-composer-main-surface]');
  const buddy = () => dock.evaluate(el => {
    const sprite = getComputedStyle(el, '::after');
    return { size: sprite.width, dockRadius: getComputedStyle(el).borderRadius, pose: sprite.backgroundPositionX,
      image: sprite.backgroundImage, motion: sprite.animationName, bottom: sprite.bottom,
      badge: getComputedStyle(el, '::before').content, pointerEvents: sprite.pointerEvents };
  });

  // Match a real composer which inserts and removes the Stop action.
  const stopMarkup = await page.locator('#stop').evaluate(el => {
    el.hidden = false;
    const markup = el.outerHTML;
    el.remove();
    return markup;
  });
  assert.equal((await buddy()).size, '24px');
  assert.equal((await buddy()).dockRadius, '2px');
  assert.equal((await buddy()).motion, 'minecraft-idle');
  assert.equal((await buddy()).pointerEvents, 'none');
  assert.equal(await dock.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(25, 27, 32)');
  assert.equal(await dock.evaluate(el => getComputedStyle(el, '::after').backgroundImage ===
    getComputedStyle(document.documentElement).getPropertyValue('--mc-claude').trim()), true);
  assert.equal(await page.locator('[data-workspace-area="conversation"]').evaluate(el =>
    getComputedStyle(el).backgroundImage), 'none');
  assert.equal(await page.getByRole('button', { name: 'Working', exact: true }).evaluate(el =>
    getComputedStyle(el).fontFamily.includes('Minecraft UI')), true);
  assert.equal(await page.evaluate(async () => {
    await document.fonts.load('10px "Minecraft UI"', 'Working 37s');
    return [...document.fonts].some(font => font.family.includes('Minecraft UI') && font.status === 'loaded');
  }), true);
  for (const name of ['Attach files', 'Choose branch', 'Open in VS Code', 'Add project script']) {
    assert.match(await page.getByRole('button', { name }).locator('svg').evaluate(el =>
      getComputedStyle(el).backgroundImage), /data:image\/png;base64/);
  }

  await dock.evaluate((el, markup) => el.insertAdjacentHTML('beforeend', markup), stopMarkup);
  assert.equal((await buddy()).pose, '100%');
  assert.equal((await buddy()).motion, 'minecraft-working');
  assert.equal((await buddy()).badge, '"◆"');
  assert.equal(await page.locator('#stop').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(217, 43, 43)');
  const row = page.locator('[data-timeline-row-kind]');
  await row.evaluate(el => { el.innerHTML = '<div data-v2-item-type="reasoning"><span class="live-tool-shine">Thinking</span></div>'; });
  assert.equal((await buddy()).pose, '50%');
  await dock.evaluate(el => { el.parentElement.insertAdjacentHTML('afterbegin', '<div data-chat-composer-top-drawer>Review request</div>'); });
  assert.equal((await buddy()).badge, '"!"');
  await page.locator('[data-chat-composer-top-drawer]').evaluate(el => el.remove());
  await page.locator('#stop').evaluate(el => el.remove());
  await row.evaluate(el => { el.innerHTML = '<div data-v2-item-type="error">Failed</div>'; });
  assert.equal((await buddy()).motion, 'minecraft-hurt');
  assert.equal((await buddy()).badge, '"×"');
  await row.evaluate(el => { el.insertAdjacentHTML('afterend', '<div data-timeline-row-kind="user">Try again</div>'); });
  assert.equal((await buddy()).motion, 'minecraft-idle');
  assert.equal(await dock.evaluate(el => {
    const idle = el.getAnimations({ subtree: true }).find(animation => animation.animationName === 'minecraft-idle');
    idle.pause();
    idle.currentTime = 3800;
    const pose = getComputedStyle(el, '::after').backgroundPositionX;
    idle.cancel();
    return pose;
  }), '50%');
  await dock.evaluate(el => { el.insertAdjacentHTML('beforebegin', '<div data-thread-now-line role="alert"><span><svg class="text-warning-foreground"></svg></span>Agent not responding to Stop</div>'); });
  assert.equal((await buddy()).motion, 'minecraft-hurt');
  await page.locator('[data-thread-now-line]').evaluate(el => el.remove());
  await page.locator('[data-thread-item]').evaluate(el => { el.hidden = false; });
  assert.equal((await buddy()).badge, '"z"');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await buddy()).motion, 'none');

  for (const width of [320, 640, 1440]) {
    await page.setViewportSize({ width, height: 600 });
    assert.ok(await page.locator('#diff').isVisible());
    await page.locator('#diff').click({ trial: true });
    assert.ok(await page.getByRole('textbox', { name: 'Ask anything' }).isVisible());
  }
  await page.close();
  console.log('Minecraft composer, status, palette, icons, typography, and responsive controls passed.');
}

module.exports = run;
if (require.main === module) (async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  try { await run(browser); } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
