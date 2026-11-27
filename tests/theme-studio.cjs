// Run with the site served locally and Playwright installed.
// SITE_URL=http://127.0.0.1:8763 node tests/theme-studio.cjs
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const site = process.env.SITE_URL || 'http://127.0.0.1:8763';

function readPond(frame, includeHidden = false) {
  return frame.locator('.demo').evaluate((pond, includeHidden) => {
    const canvas = pond.querySelector('[data-assistant-citation-viewport]');
    const slots = [[pond, '::before'], [pond, '::after'], [canvas, '::before'], [canvas, '::after']];
    return slots.flatMap(([host, pseudo]) => {
      const style = getComputedStyle(host, pseudo);
      return style.content === 'none' || (!includeHidden && Number(style.opacity) === 0) ? [] : [{
        color: style.getPropertyValue('--koi-light').trim(),
        motion: style.animationName,
        duration: style.animationDuration,
        opacity: Number(style.opacity),
        playback: style.animationPlayState,
        exitTurn: style.getPropertyValue('--koi-exit-turn').trim(),
      }];
    });
  }, includeHidden);
}

async function exportedTheme(page) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const file = await downloading;
  return JSON.parse(await readFile(await file.path(), 'utf8'));
}

async function testStudio(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(site);
  await page.getByRole('link', { name: 'Customize pond' }).click();
  await page.waitForURL('**/koi-pond.html');
  const frame = page.frameLocator('.studio-viewport iframe');
  const spawn = page.getByRole('button', { name: 'Spawn fish' });
  const finish = page.getByRole('button', { name: 'Finish next fish' });
  await spawn.waitFor();
  await page.getByRole('button', { name: 'Download JSON' }).waitFor();
  await spawn.click();
  assert.deepEqual((await readPond(frame)).map(fish => fish.motion), ['t3-koi-openai', 't3-koi-claude']);
  const agent = page.getByLabel('Subagent model');
  await agent.selectOption('Gemini');
  await spawn.click();
  await agent.selectOption('OpenAI');
  await spawn.click();
  assert.equal(await spawn.isDisabled(), true);
  assert.deepEqual((await readPond(frame)).map(fish => fish.motion), [
    't3-koi-openai', 't3-koi-claude', 't3-koi-gemini', 't3-koi-openai',
  ]);
  await page.getByRole('radio', { name: 'Light' }).check();
  assert.deepEqual((await readPond(frame)).slice(0, 3).map(fish => fish.color), [
    '#e8eae1', '#ffab62', '#a9d7ff',
  ]);

  // Opening a child pane does not move the fish or give it a duplicate school.
  await frame.locator('.demo').evaluate(pond => {
    const side = document.createElement('div');
    side.dataset.sideChatPane = 'child-thread';
    const copy = pond.cloneNode(true);
    copy.className = 'side-demo';
    side.append(copy);
    pond.append(side);
  });
  assert.equal((await readPond(frame)).length, 4);
  assert.equal(await frame.locator('.side-demo').evaluate(pond => getComputedStyle(pond, '::before').content), 'none');
  const fade = () => frame.locator('.demo').evaluate(async pond => {
    await Promise.all(pond.getAnimations({ subtree: true })
      .filter(animation => animation instanceof CSSTransition)
      .map(animation => animation.finished));
  });

  await finish.click();
  const [, first, second, third] = await readPond(frame, true);
  assert.ok(first.opacity > 0 && first.playback === 'paused');
  assert.ok([second, third].every(fish => fish.playback === 'running'));
  await fade();
  assert.deepEqual((await readPond(frame)).map(fish => fish.motion), [
    't3-koi-openai', 't3-koi-gemini', 't3-koi-openai',
  ]);
  assert.equal((await readPond(frame, true))[1].exitTurn, '34deg');

  // A collapsed native group reports the number working, with no per-row status.
  await frame.locator('.demo [data-subagent-group] > button').first()
    .evaluate(button => button.setAttribute('aria-expanded', 'false'));
  await fade();
  assert.equal((await readPond(frame)).length, 3);
  await finish.click();
  await fade();
  assert.equal((await readPond(frame)).length, 2);
  await finish.click();
  await fade();
  assert.equal((await readPond(frame)).length, 1);

  await page.getByLabel('Parent model').selectOption('Claude');
  await page.locator('input[name="claude-time"]').fill('91');
  await page.getByRole('textbox', { name: 'Light base hex' }).fill('#DDE4DC');
  assert.equal(await page.locator('input[name="light"]').inputValue(), '#dde4dc');
  await page.locator('input[name="reflection-light"]').fill('#ffd5ac');
  await page.locator('input[name="reflection-strength"]').fill('67');
  assert.equal((await readPond(frame))[0].duration, '91s');
  await page.getByLabel('Keep fish still').check();
  assert.equal((await readPond(frame))[0].motion, 'none');

  const pond = await exportedTheme(page);
  assert.equal(pond.id, 'koi-pond');
  assert.equal(pond.variants.light.canvas, '#dde4dc');
  assert.match(pond.css, /--koi-claude-time: 91s/);
  assert.match(pond.css, /--koi-reflection-light: #ffd5ac/);
  assert.match(pond.css, /--koi-reflection-strength: 0.67/);
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.waitForFunction(() => document.querySelector('[name="claude-time"] + output').value === '72 s' );
  assert.equal((await readPond(frame))[0].duration, '72s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await readPond(frame))[0].motion, 'none');
  await spawn.click();
  assert.equal((await readPond(frame)).length, 2);
  await finish.click();
  assert.equal((await readPond(frame)).length, 1);

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }

  await page.getByRole('link', { name: 'Collection' }).click();
  await page.getByRole('link', { name: 'Customize texture' }).click();
  await page.waitForURL('**/dark-texture.html');
  await page.getByRole('radio', { name: 'Light' }).check();
  await page.locator('input[name="light"]').fill('#dadfe8');
  assert.equal(await frame.locator('.demo').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(218, 223, 232)');
  await page.locator('input[name="grain-strength"]').fill('29');
  assert.equal(await frame.locator('.demo').evaluate(el => getComputedStyle(el, '::before').opacity), '0.29');
  const texture = await exportedTheme(page);
  assert.equal(texture.id, 'dark-texture');
  assert.equal(texture.variants.light.canvas, '#dadfe8');
  assert.deepEqual(errors, []);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    await testStudio(browser);
    console.log('Theme studio browser checks passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
