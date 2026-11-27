const preview = document.querySelector('.preview');
const form = document.querySelector('#theme-settings');
const download = form.querySelector('[type="submit"]');
const isPond = preview.dataset.theme === 'koi-pond';
const color = value => /^#[0-9a-f]{6}$/i.test(value) ? value : null;

function strength(settings, field) {
  return Math.max(0, Math.min(100, Number(settings.get(field)))) / 100;
}

function configureTheme(base) {
  const settings = new FormData(form);
  const dark = color(settings.get('dark')) ?? base.canvas;
  const light = color(settings.get('light')) ?? base.variants.light.canvas;
  let css;
  if (isPond) {
    const speeds = ['claude', 'openai', 'gemini'].map(provider => {
      const value = Number(settings.get(provider + '-time'));
      return `--koi-${provider}-time: ${Math.max(10, Math.min(120, value))}s;`;
    });
    const reflectionDark = color(settings.get('reflection-dark')) ?? '#a8bdb7';
    const reflectionLight = color(settings.get('reflection-light')) ?? '#ffffff';
    css = `:root {
  --koi-water-dark: ${dark};
  --koi-water-light: ${light};
  --koi-reflection-dark: ${reflectionDark};
  --koi-reflection-light: ${reflectionLight};
  --koi-reflection-strength: ${strength(settings, 'reflection-strength')};
  ${speeds.join(' ')}
}`;
    if (settings.has('still')) {
      css += '\n[data-workspace-area="conversation"]::before, [data-workspace-area="conversation"]::after, [data-assistant-citation-viewport]::before, [data-assistant-citation-viewport]::after { animation: none !important; }';
    }
  } else {
    const grain = strength(settings, 'grain-strength');
    const tint = `color-mix(in srgb, ${dark} ${Math.round((1 - grain) * 100)}%, transparent)`;
    css = `
:root.dark [data-workspace-area="conversation"] {
  background-color: ${dark} !important;
  background-image: linear-gradient(${tint}, ${tint}), var(--theme-background-image, none) !important;
  background-blend-mode: normal, luminosity;
}
:root:not(.dark) [data-workspace-area="conversation"] {
  background-color: ${light} !important;
}
:root:not(.dark) [data-workspace-area="conversation"]::before {
  mix-blend-mode: multiply;
  opacity: ${grain};
}`;
  }
  return {
    ...base,
    canvas: dark,
    variants: { ...base.variants, light: { ...base.variants.light, canvas: light } },
    css: base.css + '\n' + css + '\n',
  };
}

// Mirror the collapsed group in the T3 Code timeline. The theme reads these
// attributes and provider icon styles through exactly the same CSS in the app.
function setupSchool(doc) {
  const controls = document.querySelector('.school-controls');
  const parent = document.querySelector('#parent-provider');
  const agent = document.querySelector('#agent-provider');
  const spawn = document.querySelector('#spawn-agent');
  const finish = document.querySelector('#finish-agents');
  const status = document.querySelector('#school-status');
  const picker = doc.querySelector('[data-chat-provider-model-picker]');
  const canvas = doc.querySelector('[data-assistant-citation-viewport]');
  const school = doc.createElement('div');
  school.className = 'studio-group';
  school.dataset.subagentGroup = '';
  school.innerHTML = `<button type="button" tabindex="-1" aria-expanded="true" aria-description="0 working">
    <span aria-hidden="true"></span>
    <span><span class="agent-count"></span><span class="group-status"></span></span>
  </button>
  <div data-slot="collapsible-panel" hidden></div>`;
  const avatars = school.querySelector('[aria-hidden]');
  const groupButton = school.querySelector('button');
  const countLabel = school.querySelector('.agent-count');
  const statusMarker = school.querySelector('.group-status');
  const rows = school.querySelector('[data-slot="collapsible-panel"]');
  const modelLabels = { OpenAI: 'GPT-6 Astra', Claude: 'Claude Sonnet', Gemini: 'Gemini Pro' };
  const iconClasses = { Claude: 'text-[#d97757]', Gemini: 'text-[#5b87bf]' };
  let activeCount = 0;

  function updateGroup() {
    const total = avatars.childElementCount;
    const done = total - activeCount;
    const label = total === 1 ? '1 subagent' : `${total} subagents`;
    const summary = [activeCount && `${activeCount} working`, done && `${done} done`]
      .filter(Boolean).join(' · ');
    groupButton.setAttribute('aria-label', label);
    groupButton.setAttribute('aria-description', summary);
    statusMarker.classList.toggle('text-info', activeCount > 0);
    countLabel.textContent = summary;
    spawn.disabled = total >= 3 && activeCount > 0;
    finish.disabled = activeCount === 0;
    status.textContent = activeCount
      ? `${activeCount} ${activeCount === 1 ? 'subagent' : 'subagents'} swimming in the parent thread.`
      : 'Subagents finished. Only the parent fish is swimming.';
  }

  controls.disabled = false;
  parent.addEventListener('change', () => {
    picker.textContent = modelLabels[parent.value];
    picker.setAttribute('aria-label', picker.textContent);
  });
  spawn.addEventListener('click', () => {
    if (!activeCount) {
      avatars.replaceChildren();
      rows.replaceChildren();
    }
    const avatar = doc.createElement('span');
    const icon = doc.createElement('span');
    icon.className = iconClasses[agent.value] ?? '';
    avatar.append(icon);
    avatars.append(avatar);

    const row = doc.createElement('div');
    row.dataset.v2ItemType = 'subagent';
    row.setAttribute('aria-description', 'Running');
    row.innerHTML = '<span aria-hidden="true"><span class="bg-info"></span></span>';
    rows.append(row);
    activeCount++;
    canvas.append(school);
    updateGroup();
  });
  finish.addEventListener('click', () => {
    const row = rows.querySelector('[aria-description="Running"]');
    row.setAttribute('aria-description', 'Completed');
    row.querySelector('.bg-info').className = 'bg-success';
    activeCount--;
    updateGroup();
  });
}

preview.addEventListener('theme-ready', ({ detail }) => {
  const hexFields = form.querySelectorAll('[data-swatch]');

  function render() {
    for (const input of form.querySelectorAll('[type="range"]')) {
      input.nextElementSibling.value = input.value + (input.dataset.unit ?? ' s');
    }
    detail.applyTheme(configureTheme(detail.config));
  }

  for (const hex of hexFields) {
    const swatch = form.elements.namedItem(hex.dataset.swatch);
    hex.addEventListener('input', () => {
      const value = color(hex.value);
      if (value) swatch.value = value;
    });
    swatch.addEventListener('input', () => {
      hex.value = swatch.value.toUpperCase();
    });
  }
  form.addEventListener('input', render);
  form.addEventListener('reset', () => requestAnimationFrame(render));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const theme = configureTheme(detail.config);
    const url = URL.createObjectURL(new Blob([JSON.stringify(theme, null, 2) + '\n'], {
      type: 'application/json',
    }));
    const link = document.createElement('a');
    link.href = url;
    link.download = preview.dataset.theme + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
  if (isPond) setupSchool(detail.document);
  download.disabled = false;
});
