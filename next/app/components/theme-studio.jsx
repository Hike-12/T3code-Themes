'use client';

import Link from 'next/link';
import { ArrowDown, ArrowLeft, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { minecraftMobs, pondProviders, themes } from '../themes';
import { ThemePreview, useTheme } from './theme-preview';
import { DownloadAction, RangeField, SwitchField } from './ui';
import '../studio.css';

const agentLimit = 3;
const backgrounds = [['dark', 'Dark base'], ['light', 'Light base']];

function configureTheme(base, values, slug) {
  if (slug === 'blockworks') {
    const overrides = [];
    if (Object.hasOwn(minecraftMobs, values.mob)) {
      for (const property of ['sprite', 'base-size', 'route', 'time', 'gait', 'provider-filter', 'buddy']) {
        overrides.push(`--mc-picked-${property}: var(--mc-${values.mob}-${property});`);
      }
    }
    if (values.still) overrides.push('--theme-motion-state: paused;');
    return overrides.length ? { ...base, css: base.css + `\n:root { ${overrides.join(' ')} }\n` } : base;
  }
  if (slug === 'nightfall-christmas') {
    const defaults = themes[slug].defaults;
    if (!values.still && Object.keys(defaults).every(key => values[key] === defaults[key])) return base;
    const duration = 40 - values['snow-speed'] * .5;
    return {
      ...base, canvas: values.dark,
      colors: { ...base.colors, canvas: values.dark },
      variants: { ...base.variants, light: { ...base.variants.light, canvas: values.light } },
      css: base.css + `\n:root {
        --nightfall-snow-intensity: ${values['snow-intensity'] / 45};
        --nightfall-snow-density: ${Math.max(.2, values['snow-intensity'] / 45)};
        --nightfall-snow-duration: ${duration}s;
        --nightfall-light-brightness: ${values['light-brightness'] / 100};
        --nightfall-snowmen: ${values.snowmen ? 1 : 0};
        --theme-motion-state: ${values.still ? 'paused' : 'running'};
      }
      :root.dark, :root:not(.dark) { --nightfall-ledge: var(${values.accumulation ? '--nightfall-snowy' : '--nightfall-bare'}); }\n`,
    };
  }
  if (themes[slug].motionLabel) {
    return values.still
      ? { ...base, css: base.css + '\n:root { --theme-motion-state: paused; }\n' }
      : base;
  }

  const dark = values.dark;
  const light = values.light;
  let css;

  if (slug === 'koi-pond') {
    const speeds = pondProviders.map(provider => {
      const name = provider.toLowerCase();
      return `--koi-${name}-time: ${values[name + '-time']}s;`;
    });
    css = `:root {
  --koi-water-dark: ${dark};
  --koi-water-light: ${light};
  ${speeds.join(' ')}
}`;
    if (values.still) {
      css += '\n[data-workspace-area="conversation"]::before, [data-workspace-area="conversation"]::after, [data-assistant-citation-viewport]::before, [data-assistant-citation-viewport]::after { animation: none !important; }';
    }
  } else {
    css = `:root {
  --texture-dark: ${dark};
  --texture-light: ${light};
  --texture-grain: ${values['grain-strength'] / 100};
}`;
  }

  return {
    ...base,
    canvas: dark,
    variants: { ...base.variants, light: { ...base.variants.light, canvas: light } },
    css: base.css + '\n' + css + '\n',
  };
}

function ColorField({ name, label, value, draft, onSwatch, onHex, onCommit }) {
  const invalid = draft != null && !/^#?[\da-f]{6}$/i.test(draft);

  return (
    <div className="color-setting" data-color-appearance={name}>
      <label htmlFor={name + '-swatch'}>{label}</label>
      <input id={name + '-swatch'} name={name} type="color" value={value} onChange={event => onSwatch(name, event.target.value)} />
      <input
        type="text"
        aria-label={label + ' hex'}
        aria-describedby={name + '-error'}
        aria-invalid={invalid}
        spellCheck={false}
        autoComplete="off"
        maxLength={7}
        value={draft ?? value.toUpperCase()}
        onChange={event => onHex(name, event.target.value)}
        onBlur={() => { if (!invalid) onCommit(name); }}
      />
      <p className="hex-error" id={name + '-error'} aria-live="polite">{invalid ? 'Enter 6 hex digits, like #E8EDE9.' : ''}</p>
    </div>
  );
}

function ProviderDot({ provider }) {
  return <span className="provider-dot" data-provider={provider} aria-hidden="true" />;
}

function MobPicker({ mob, onChange }) {
  return (
    <fieldset className="mob-picker">
      <legend>Main thread mob</legend>
      <div className="mob-inventory">
        {[['auto', 'Match model'], ...Object.entries(minecraftMobs)].map(([id, name]) => (
          <label key={id}>
            <input type="radio" name="minecraft-mob" value={id} checked={mob === id} onChange={() => onChange(id)} />
            <span className="mob-slot">
              {id !== 'auto' && <img src={`/assets/blockworks/${id}.webp`} width="40" height="40" alt="" />}
              {name}
            </span>
          </label>
        ))}
      </div>
      <p className="settings-hint">Subagents use the mob assigned to their model.</p>
    </fieldset>
  );
}

function SubagentTest({ parent, setParent, agents, running, spawn, finish, disabled }) {
  return (
    <section className="school-controls" aria-labelledby="school-title">
      <header className="school-heading">
        <h2 id="school-title">Test subagents</h2>
        <span className="school-count" role="status">{running} of {agentLimit} running</span>
      </header>
      <p className="school-description">Add up to three subagents to the main thread preview.</p>
      <fieldset className="school-fields" disabled={disabled}>
        <label className="parent-control">Main thread model
          <select value={parent} onChange={event => setParent(event.target.value)}>
            {pondProviders.map(provider => <option key={provider}>{provider}</option>)}
          </select>
        </label>
        <div className="add-agent-control" role="group" aria-labelledby="add-agent-label">
          <span id="add-agent-label">Add a subagent</span>
          <div className="add-agents">
            {pondProviders.map(provider => (
              <button className="open-theme" type="button" key={provider} onClick={() => spawn(provider)} disabled={running >= agentLimit} aria-label={'Add ' + provider + ' subagent'}>
                <ProviderDot provider={provider} /> {provider}
              </button>
            ))}
          </div>
        </div>
      </fieldset>
      {running > 0 && (
        <ul className="agent-list" aria-label="Running subagents">
          {agents.filter(agent => agent.running).map(agent => (
            <li key={agent.id}>
              <button className="open-theme finish-agent" type="button" onClick={() => finish(agent.id)} aria-label={'Finish ' + agent.provider + ' subagent'} title={'Finish ' + agent.provider + ' subagent'}>
                <ProviderDot provider={agent.provider} /> {agent.provider}
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InstallInstructions({ name }) {
  return (
    <section id="install" className="studio-note" aria-labelledby="install-title">
      <h2 id="install-title">Install {name}</h2>
      <ol>
        <li>Download your theme JSON.</li>
        <li>In T3 Code, open <strong>Settings → Appearance</strong> and choose <strong>Import a file</strong>.</li>
        <li>Open the JSON and select <strong>{name}</strong> in the theme picker.</li>
      </ol>
    </section>
  );
}

export function ThemeStudio({ slug }) {
  const theme = themes[slug];
  const isPond = slug === 'koi-pond';
  const isMinecraft = slug === 'blockworks';
  const hasAgents = isPond || slug === 'blockworks' || slug === 'nightfall-christmas';
  const defaultParent = theme.previewProvider || 'OpenAI';
  const { config, error } = useTheme(slug);
  const [values, setValues] = useState(theme.defaults);
  const [drafts, setDrafts] = useState({});
  const [appearance, setAppearance] = useState('dark');
  const [parent, setParent] = useState(defaultParent);
  const [agents, setAgents] = useState([]);
  const [activity, setActivity] = useState('Idle');
  const running = agents.filter(agent => agent.running).length;
  const configured = config && configureTheme(config, values, slug);
  const invalid = Object.values(drafts).some(draft => draft != null && !/^#?[\da-f]{6}$/i.test(draft));
  const canReset = invalid || values.still || agents.length > 0 || parent !== defaultParent
    || activity !== 'Idle'
    || Object.entries(theme.defaults).some(([name, value]) => values[name] !== value);

  function updateValue(name, value) {
    setValues(current => ({ ...current, [name]: value }));
  }

  function clearDraft(name) {
    setDrafts(current => ({ ...current, [name]: null }));
  }

  function updateBackground(name, value) {
    updateValue(name, value);
    if (isPond) setAppearance(name);
  }

  function updateSwatch(name, value) {
    clearDraft(name);
    updateBackground(name, value);
  }

  function updateHex(name, draft) {
    setDrafts(current => ({ ...current, [name]: draft }));
    if (/^#?[\da-f]{6}$/i.test(draft)) {
      updateBackground(name, '#' + draft.replace(/^#/, '').toLowerCase());
    }
  }

  function spawn(provider) {
    setAgents(current => {
      const active = current.filter(agent => agent.running).length;
      if (active >= agentLimit) return current;
      const next = { provider, running: true, id: Math.max(0, ...current.map(agent => agent.id)) + 1 };
      if (!active) return [next];
      const finishedSlot = current.findIndex(agent => !agent.running);
      return finishedSlot === -1 ? [...current, next] : current.map((agent, slot) => slot === finishedSlot ? next : agent);
    });
  }

  function finish(id) {
    setAgents(current => current.map(agent => agent.id === id ? { ...agent, running: false } : agent));
  }

  function reset(event) {
    event.preventDefault();
    setValues(theme.defaults);
    setDrafts({});
    setParent(defaultParent);
    setAgents([]);
    setActivity('Idle');
  }

  function download(event) {
    event.preventDefault();
    if (!configured || invalid) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(configured, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = slug + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="wrap studio" id="main" data-studio={slug}>
      <header className="studio-intro">
        <div>
          {!isPond && <Link href="/#themes" className="text-link back-link"><ArrowLeft size={16} aria-hidden="true" /> Collection</Link>}
          <h1>{theme.name}</h1>
          <p>{theme.studioDescription}</p>
        </div>
        <a className={(isPond ? 'text-link' : 'open-theme') + ' install-link'} href="#install">Install <ArrowDown size={16} aria-hidden="true" /></a>
      </header>

      <div className="studio-layout">
        <section className="studio-stage" aria-label={theme.name + ' preview'}>
          <ThemePreview slug={slug} config={configured} error={error} appearance={appearance} onAppearanceChange={setAppearance} studio parent={parent} agents={agents} activity={activity} />
          {hasAgents && <SubagentTest parent={parent} setParent={setParent} agents={agents} running={running} spawn={spawn} finish={finish} disabled={!configured} />}
        </section>

        <div className="studio-sidebar">
          <section className="studio-settings" aria-labelledby="settings-title">
            <h2 id="settings-title">{isMinecraft ? 'Workbench' : 'Customize'}</h2>
            {error ? (
              <p className="studio-fallback">Customization is unavailable. <a className="open-theme" href={theme.download} download>Download original theme</a></p>
            ) : (
              <form id="theme-settings" onSubmit={download} onReset={reset}>
                <fieldset className="settings-controls" disabled={!configured}>
                  {isMinecraft && <>
                    <MobPicker mob={values.mob} onChange={mob => updateValue('mob', mob)} />
                    <label className="parent-control mob-activity">Preview activity
                      <select value={activity} onChange={event => setActivity(event.target.value)}>
                        {['Idle', 'Reasoning', 'Coding'].map(state => <option key={state}>{state}</option>)}
                      </select>
                    </label>
                  </>}
                  {!theme.motionLabel && <fieldset>
                    <legend>Background</legend>
                    {backgrounds.map(([name, label]) => (
                      <ColorField key={name} name={name} label={label} value={values[name]} draft={drafts[name]} onSwatch={updateSwatch} onHex={updateHex} onCommit={clearDraft} />
                    ))}
                    {!isPond && (
                      <RangeField name="grain-strength" label="Grain strength" value={values['grain-strength']} onChange={updateValue} disabled={!configured} />
                    )}
                  </fieldset>}
                  {slug === 'nightfall-christmas' && <>
                    <fieldset><legend>Background</legend>
                      {backgrounds.map(([name,label]) => <ColorField key={name} name={name} label={label} value={values[name]} draft={drafts[name]} onSwatch={updateSwatch} onHex={updateHex} onCommit={clearDraft} />)}
                    </fieldset>
                    <fieldset><legend>Snowfall</legend>
                      <RangeField name="snow-intensity" label="Snowfall intensity" value={values['snow-intensity']} onChange={updateValue} />
                      <RangeField name="snow-speed" label="Snowfall speed" min={0} max={70} value={values['snow-speed']} onChange={updateValue} />
                      <SwitchField label="Snow on the chat box" checked={values.accumulation} onChange={v => updateValue('accumulation',v)} />
                    </fieldset>
                    <fieldset><legend>Decorations</legend>
                      <RangeField name="light-brightness" label="Light glow" value={values['light-brightness']} onChange={updateValue} />
                      <SwitchField label="Show snowmen" checked={values.snowmen} onChange={v => updateValue('snowmen',v)} />
                    </fieldset>
                  </>}
                  {theme.motionLabel && (
                    <SwitchField label={theme.motionLabel} checked={Boolean(values.still)} onChange={checked => updateValue('still', checked)} disabled={!configured} />
                  )}
                  {isPond && (
                    <fieldset>
                      <legend>Fish movement</legend>
                      <p className="settings-hint">Longer laps slow the fish down.</p>
                      {pondProviders.map(provider => {
                        const name = provider.toLowerCase() + '-time';
                        const label = <><ProviderDot provider={provider} /> {provider} lap time</>;
                        return <RangeField key={name} name={name} label={label} min={10} max={120} unit=" s" value={values[name]} onChange={updateValue} disabled={!configured || Boolean(values.still)} />;
                      })}
                      <SwitchField label="Keep fish still" checked={Boolean(values.still)} onChange={checked => updateValue('still', checked)} disabled={!configured} />
                    </fieldset>
                  )}
                  <div className="studio-actions">
                    <button className="open-theme" type="reset" disabled={(hasAgents || theme.motionLabel) && !canReset}><RotateCcw size={15} aria-hidden="true" /> Reset</button>
                    <DownloadAction disabled={invalid} />
                  </div>
                </fieldset>
              </form>
            )}
          </section>
          {hasAgents && <InstallInstructions name={theme.name} />}
        </div>
      </div>
      {!hasAgents && <InstallInstructions name={theme.name} />}
    </main>
  );
}
