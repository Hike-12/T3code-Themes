// Start Next.js locally, then run npm run test:browser.
// Set CHROME_PATH to use an existing Chromium installation.
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const site = process.env.SITE_URL || 'http://localhost:3000';

function readPond(frame, includeHidden = false) {
  return frame.locator('.demo').evaluate((pond, includeHidden) => {
    const canvas = pond.querySelector('[data-assistant-citation-viewport]');
    const slots = [[pond, '::before'], [pond, '::after'], [canvas, '::before'], [canvas, '::after']];
    return slots.flatMap(([host, pseudo]) => {
      const style = getComputedStyle(host, pseudo);
      return style.content === 'none' || (!includeHidden && Number(style.opacity) === 0) ? [] : [{
        color: style.getPropertyValue('--koi-light').trim(),
        motion: style.animationName,
        track: style.getPropertyValue('--koi-track').trim(),
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

async function grainContrast(page, pond) {
  const screenshot = await pond.screenshot({ scale: 'css' });
  return page.evaluate(async source => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const bitmap = await createImageBitmap(await (await fetch(source)).blob());
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 12, 12, 64, 64, 0, 0, 64, 64);
    bitmap.close();
    const pixels = context.getImageData(0, 0, 64, 64).data;
    const samples = [...pixels].filter((_, index) => index % 4 === 0);
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    return Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length);
  }, 'data:image/png;base64,' + screenshot.toString('base64'));
}

async function setSlider(slider, value) {
  const min = Number(await slider.getAttribute('aria-valuemin'));
  await slider.press('Home');
  for (let remaining = value - min; remaining > 0;) {
    const step = remaining >= 10 ? 10 : 1;
    await slider.press(step === 10 ? 'PageUp' : 'ArrowRight');
    remaining -= step;
  }
  assert.equal(await slider.getAttribute('aria-valuenow'), String(value));
}

async function testStudio(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(site);
  for (const slug of ['koi-pond', 'dark-texture']) {
    const response = await page.request.get(new URL('/' + slug + '.html', site).href, { maxRedirects: 0 });
    assert.equal(response.status(), 308);
    assert.equal(response.headers().location, '/' + slug);
    assert.equal(await page.getByRole('navigation').locator('a[href="/' + slug + '"]').count(), 0);
    const link = page.locator('a[download][href="/downloads/' + slug + '.json"]');
    const downloading = page.waitForEvent('download');
    await link.click();
    const file = await downloading;
    assert.equal(file.suggestedFilename(), slug + '.json');
    const config = JSON.parse(await readFile(await file.path(), 'utf8'));
    assert.equal(config.id, slug);
    if (slug === 'dark-texture') {
      assert.match(config.css, /data:image\/webp;base64,/);
      assert.ok(config.css.length < 100000);
    } else {
      assert.doesNotMatch(config.css, /--koi-reflection/);
    }
  }
  await page.getByRole('link', { name: 'Customize pond' }).click();
  await page.waitForURL('**/koi-pond');
  const frame = page.frameLocator('.studio-viewport iframe');
  const add = provider => page.getByRole('button', { name: 'Add ' + provider + ' subagent' });
  const finish = provider => page.getByRole('button', { name: 'Finish ' + provider + ' subagent' });
  const spawn = add('Claude');
  await spawn.waitFor();
  await page.getByRole('button', { name: 'Download JSON' }).waitFor();
  const reset = page.getByRole('button', { name: 'Reset' });
  assert.ok(await reset.isDisabled());
  assert.equal(await page.getByRole('slider', { name: 'Reflection strength' }).count(), 0);
  assert.equal(await frame.locator('.demo').evaluate(pond => getComputedStyle(pond).backgroundImage), 'none');
  assert.equal(await frame.locator('.demo').evaluate(pond => getComputedStyle(pond).backgroundColor), 'rgb(16, 16, 16)');
  assert.ok(await frame.locator('.demo').evaluate(pond => {
    const canvas = pond.querySelector('[data-assistant-citation-viewport]').getBoundingClientRect();
    const viewport = pond.getBoundingClientRect();
    return ['x', 'y', 'width', 'height'].every(key => canvas[key] === viewport[key]);
  }));
  await spawn.click();
  assert.deepEqual((await readPond(frame)).map(fish => fish.motion), ['t3-koi-openai', 't3-koi-claude']);
  await add('Gemini').click();
  await add('OpenAI').click();
  assert.ok(await page.getByText('3 of 3 running').isVisible());
  assert.equal(await spawn.isDisabled(), true);
  assert.deepEqual((await readPond(frame)).map(fish => fish.motion), [
    't3-koi-openai', 't3-koi-claude', 't3-koi-gemini', 't3-koi-openai',
  ]);
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  assert.equal(await frame.locator('.demo').evaluate(pond => getComputedStyle(pond).backgroundImage), 'none');
  assert.equal(await frame.locator('.demo').evaluate(pond => getComputedStyle(pond).backgroundColor), 'rgb(229, 229, 229)');
  assert.deepEqual((await readPond(frame)).slice(0, 3).map(fish => fish.color), [
    '#f2f2f2', '#e3d8c1', '#a9d7ff',
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
  await frame.locator('[data-side-chat-pane]').evaluate(pane => pane.remove());
  const fade = () => frame.locator('.demo').evaluate(async pond => {
    await Promise.all(pond.getAnimations({ subtree: true })
      .filter(animation => animation instanceof CSSTransition)
      .map(animation => animation.finished));
  });

  await finish('Gemini').click();
  const [, first, second, third] = await readPond(frame, true);
  assert.ok(second.opacity > 0 && second.playback === 'paused');
  assert.ok([first, third].every(fish => fish.playback === 'running'));
  await fade();
  assert.deepEqual((await readPond(frame)).map(fish => fish.motion), [
    't3-koi-openai', 't3-koi-claude', 't3-koi-openai',
  ]);
  assert.equal((await readPond(frame, true))[2].exitTurn, '34deg');

  // A collapsed native group reports the number working, with no per-row status.
  await frame.locator('.demo [data-subagent-group] > button').first()
    .evaluate(button => button.setAttribute('aria-expanded', 'false'));
  await fade();
  assert.equal((await readPond(frame)).length, 3);
  await finish('OpenAI').click();
  await fade();
  assert.equal((await readPond(frame)).length, 2);
  await finish('Claude').first().click();
  await fade();
  assert.equal((await readPond(frame)).length, 1);

  await page.getByLabel('Main thread model').selectOption('Claude');
  const claudeLapTime = page.getByRole('slider', { name: 'Claude lap time' });
  await setSlider(claudeLapTime, 91);
  const lightHex = page.getByRole('textbox', { name: 'Light base hex' });
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await lightHex.fill('DDE4DC');
  assert.ok(await page.getByRole('radio', { name: 'Light', exact: true }).isChecked());
  assert.equal(await page.locator('input[name="light"]').inputValue(), '#dde4dc');
  await lightHex.fill('#bad');
  assert.equal(await lightHex.getAttribute('aria-invalid'), 'true');
  assert.ok(await page.getByText('Enter 6 hex digits').isVisible());
  assert.ok(await page.getByRole('button', { name: 'Download JSON' }).isDisabled());
  assert.equal(await frame.locator('.demo').evaluate(pond => getComputedStyle(pond).backgroundColor), 'rgb(221, 228, 220)');
  await lightHex.fill('DDE4DC');
  await lightHex.blur();
  assert.equal(await lightHex.inputValue(), '#DDE4DC');
  assert.equal((await readPond(frame))[0].duration, '91s');
  await page.getByRole('switch', { name: 'Keep fish still' }).click();
  assert.equal((await readPond(frame))[0].motion, 'none');
  assert.ok(await claudeLapTime.isDisabled());

  const pond = await exportedTheme(page);
  assert.equal(pond.id, 'koi-pond');
  assert.equal(pond.variants.light.canvas, '#dde4dc');
  assert.match(pond.css, /--koi-claude-time: 91s/);
  assert.doesNotMatch(pond.css, /--koi-reflection/);
  // A finished slot can be reused and Reset clears a running simulation.
  for (let count = 0; count < 3; count++) await spawn.click();
  assert.ok(await spawn.isDisabled());
  await finish('Claude').first().click();
  assert.ok(await spawn.isEnabled());
  await spawn.click();
  assert.ok(await spawn.isDisabled());
  await reset.click();
  assert.ok(await reset.isDisabled());
  assert.equal(await page.getByRole('slider', { name: 'Claude lap time' }).getAttribute('aria-valuenow'), '72');
  assert.equal((await readPond(frame))[0].duration, '27s');
  assert.equal(await page.getByLabel('Main thread model').inputValue(), 'OpenAI');
  assert.equal(await frame.locator('.demo .studio-group').count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await readPond(frame))[0].motion, 'none');
  await spawn.click();
  assert.equal((await readPond(frame)).length, 2);
  await finish('Claude').first().click();
  assert.equal((await readPond(frame)).length, 1);

  const mainModel = page.getByLabel('Main thread model');
  await mainModel.selectOption('OpenCode');
  assert.deepEqual((await readPond(frame)).map(fish => [fish.track, fish.color]), [
    ['t3-koi-opencode', '#eed6df'],
  ]);
  await mainModel.selectOption('OpenAI');
  await add('OpenCode').click();
  assert.deepEqual((await readPond(frame)).map(fish => fish.track), ['t3-koi-openai', 't3-koi-opencode']);
  await finish('OpenCode').click();
  assert.equal((await readPond(frame)).length, 1);
  await setSlider(page.getByRole('slider', { name: 'OpenCode lap time' }), 62);
  assert.match((await exportedTheme(page)).css, /--koi-opencode-time: 62s/);

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }

  await page.getByRole('navigation').getByRole('link', { name: 'Collection' }).click();
  await page.getByRole('link', { name: 'Customize texture' }).click();
  await page.waitForURL('**/dark-texture');
  await page.getByRole('radio', { name: 'Light', exact: true }).check();
  const texturePond = frame.locator('.demo');
  const grain = page.getByRole('slider', { name: 'Grain strength' });
  await texturePond.evaluate(async pond => {
    const image = new Image();
    image.src = getComputedStyle(pond, '::before').backgroundImage.slice(5, -2);
    await image.decode();
  });
  const defaultContrast = await grainContrast(page, texturePond);
  assert.ok(defaultContrast >= 3, `Default light grain should be visible, received contrast ${defaultContrast}`);
  await setSlider(grain, 0);
  assert.equal(await grainContrast(page, texturePond), 0);
  await setSlider(grain, 100);
  assert.ok(await grainContrast(page, texturePond) > defaultContrast);

  await page.locator('input[name="light"]').fill('#dadfe8');
  assert.equal(await texturePond.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(218, 223, 232)');
  await setSlider(grain, 29);
  assert.equal(await texturePond.evaluate(el => getComputedStyle(el, '::before').opacity), '0.29');
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  assert.equal(await texturePond.evaluate(el => getComputedStyle(el, '::before').opacity), '0.29');
  assert.ok(await grainContrast(page, texturePond) > 0);
  const texture = await exportedTheme(page);
  assert.equal(texture.id, 'dark-texture');
  assert.equal(texture.variants.light.canvas, '#dadfe8');
  assert.match(texture.css, /--texture-grain: 0\.29/);
  await page.getByRole('link', { name: 'Install' }).click();
  assert.ok(await page.getByRole('heading', { name: 'Install Dark texture' }).isVisible());
  assert.ok(await page.getByText('Import a file', { exact: true }).isVisible());
  assert.equal(await page.locator('input[name="light"]').inputValue(), '#dadfe8');
  assert.deepEqual(errors, []);

  await page.route('**/downloads/koi-pond.json', route => route.abort());
  await page.goto(new URL('/koi-pond', site).href);
  const fallback = page.getByRole('link', { name: 'Download original theme' });
  await fallback.waitFor();
  assert.equal(await fallback.getAttribute('href'), '/downloads/koi-pond.json');
  assert.ok(await page.getByRole('button', { name: 'Download JSON' }).isHidden());
  await page.close();
}

async function testStandaloneGemini(browser) {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto(new URL('/koi-pond', site).href);
  const frame = page.frameLocator('.studio-viewport iframe');
  await frame.locator('.demo').waitFor();

  // T3 Code renders a single delegated task outside the grouped timeline row.
  await frame.locator('.demo').evaluate(pond => {
    const row = document.createElement('button');
    row.dataset.v2ItemType = 'subagent';
    row.setAttribute('aria-description', 'Running');
    row.innerHTML = `<span aria-hidden="true">
      <svg viewBox="0 0 128 128"><image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAQAElEQVR4nOx9CbhsVXXmWvucqst7AmpQwDmoDUgQpTtGmcRIBEHhAwxEMRpCjEOa2NoK7/"/></svg>
      <span class="bg-info"></span>
    </span>`;
    const viewport = pond.querySelector('[data-assistant-citation-viewport]');
    viewport.append(row);

    const side = document.createElement('aside');
    side.dataset.sideChatPane = 'child-thread';
    side.innerHTML = `<div data-workspace-area="conversation">
      <div data-assistant-citation-viewport>
        <span data-chat-provider-model-picker aria-label="Gemini Pro"></span>
      </div>
    </div>`;
    pond.append(side);
  });
  assert.deepEqual((await readPond(frame)).map(fish => [fish.track, fish.color]), [
    ['t3-koi-openai', '#f2f2f2'],
    ['t3-koi-gemini', '#a9d7ff'],
  ]);
  assert.deepEqual(await frame.locator('aside [data-workspace-area="conversation"]').evaluate(pond => {
    const viewport = pond.querySelector('[data-assistant-citation-viewport]');
    return [pond, viewport].flatMap(host => ['::before', '::after'].map(pseudo => getComputedStyle(host, pseudo).content));
  }), ['none', 'none', 'none', 'none']);
  await frame.locator('.demo [data-v2-item-type="subagent"]').first().evaluate(row => {
    row.setAttribute('aria-description', 'Finished');
    row.querySelector('.bg-info').className = 'bg-success';
  });
  assert.deepEqual((await readPond(frame)).map(fish => fish.track), ['t3-koi-openai']);

  // OpenCode's native logo identifies the provider even when its model name is Claude.
  await frame.locator('[data-chat-provider-model-picker]').first().evaluate(picker => {
    picker.setAttribute('aria-label', 'Claude Sonnet');
    picker.innerHTML = '<svg viewBox="0 0 32 40"><path d="M24 8H8V32H24V8ZM32 40H0V0H32V40Z"/></svg>';
  });
  assert.deepEqual((await readPond(frame)).map(fish => fish.track), ['t3-koi-opencode']);

  await page.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  try {
    await testStudio(browser);
    await testStandaloneGemini(browser);
    console.log('Theme studio browser checks passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
