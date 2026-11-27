'use client';

import Link from 'next/link';
import { ArrowDown, ArrowLeft, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { pondProviders, themes } from '../themes';
import { ThemePreview, useTheme } from './theme-preview';
import { DownloadAction, RangeField, SwitchField } from './ui';
import '../studio.css';

const agentLimit = 3;
const backgrounds = [['dark', 'Dark base'], ['light', 'Light base']];

function configureTheme(base, values, isPond) {
  const dark = values.dark;
  const light = values.light;
  let css;

  if (isPond) {
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

function ColorField({ name, label, value, draft, onSwatch, onHex }) {
  const invalid = draft != null && !/^#?[\da-f]{6}$/i.test(draft);
  const appearance = name.endsWith('dark') ? 'dark' : 'light';

  return (
    <div className="color-setting" data-color-appearance={appearance}>
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
        onBlur={() => { if (!invalid) onSwatch(name, value); }}
      />
      <p className="hex-error" id={name + '-error'} aria-live="polite">{invalid ? 'Enter 6 hex digits, like #E8EDE9.' : ''}</p>
    </div>
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
                <span className="provider-dot" data-provider={provider} aria-hidden="true" /> {provider}
              </button>
            ))}
          </div>
        </div>
      </fieldset>
      {running > 0 && (
        <ul className="agent-list" aria-label="Running subagents">
          {agents.filter(agent => agent.running).map(agent => (
            <li key={agent.id}>
              <span className="agent-provider"><span className="provider-dot" data-provider={agent.provider} aria-hidden="true" />{agent.provider}</span>
              <button className="open-theme finish-agent" type="button" onClick={() => finish(agent.id)} aria-label={'Finish ' + agent.provider + ' subagent'}>Finish</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ThemeStudio({ slug }) {
  const theme = themes[slug];
  const isPond = slug === 'koi-pond';
  const { config, error } = useTheme(slug);
  const [values, setValues] = useState(theme.defaults);
  const [drafts, setDrafts] = useState({});
  const [parent, setParent] = useState('OpenAI');
  const [agents, setAgents] = useState([]);
  const running = agents.filter(agent => agent.running).length;
  const configured = config && configureTheme(config, values, isPond);
  const invalid = Object.values(drafts).some(draft => draft != null && !/^#?[\da-f]{6}$/i.test(draft));

  function updateValue(name, value) {
    setValues(current => ({ ...current, [name]: value }));
  }

  function updateSwatch(name, value) {
    setDrafts(current => ({ ...current, [name]: null }));
    updateValue(name, value);
  }

  function updateHex(name, draft) {
    setDrafts(current => ({ ...current, [name]: draft }));
    if (/^#?[\da-f]{6}$/i.test(draft)) {
      updateValue(name, '#' + draft.replace(/^#/, '').toLowerCase());
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
    setParent('OpenAI');
    setAgents([]);
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
        <a className="open-theme install-link" href="#install">Install <ArrowDown size={16} aria-hidden="true" /></a>
      </header>

      <div className="studio-layout">
        <section className="studio-stage" aria-label={theme.name + ' preview'}>
          <ThemePreview slug={slug} config={configured} error={error} studio parent={parent} agents={agents} />
          {isPond && <SubagentTest parent={parent} setParent={setParent} agents={agents} running={running} spawn={spawn} finish={finish} disabled={!configured} />}
        </section>

        <section className="studio-settings" aria-labelledby="settings-title">
          <h2 id="settings-title">Customize</h2>
          {error ? (
            <p className="studio-fallback">Customization is unavailable. <a className="open-theme" href={theme.download} download>Download original theme</a></p>
          ) : (
            <form id="theme-settings" onSubmit={download} onReset={reset}>
              <fieldset className="settings-controls" disabled={!configured}>
                <fieldset>
                  <legend>Background</legend>
                  {backgrounds.map(([name, label]) => (
                    <ColorField key={name} name={name} label={label} value={values[name]} draft={drafts[name]} onSwatch={updateSwatch} onHex={updateHex} />
                  ))}
                  {!isPond && (
                    <RangeField name="grain-strength" label="Grain strength" value={values['grain-strength']} onChange={updateValue} disabled={!configured} />
                  )}
                </fieldset>
                {isPond && (
                  <fieldset>
                    <legend>Fish movement</legend>
                    {pondProviders.map(provider => {
                      const name = provider.toLowerCase() + '-time';
                      return <RangeField key={name} name={name} label={provider + ' lap time'} min={10} max={120} unit=" s" value={values[name]} onChange={updateValue} disabled={!configured} />;
                    })}
                    <SwitchField label="Keep fish still" checked={Boolean(values.still)} onChange={checked => updateValue('still', checked)} disabled={!configured} />
                  </fieldset>
                )}
                <div className="studio-actions">
                  <button className="open-theme" type="reset"><RotateCcw size={15} aria-hidden="true" /> Reset</button>
                  <DownloadAction disabled={invalid} />
                </div>
              </fieldset>
            </form>
          )}
        </section>
      </div>
      <section id="install" className="studio-note" aria-labelledby="install-title">
        <h2 id="install-title">Install {theme.name}</h2>
        <ol>
          <li>Download your customized JSON.</li>
          <li>In T3 Code, open <strong>Settings → Appearance</strong> and choose <strong>Import a file</strong>.</li>
          <li>Open the JSON and select <strong>{theme.name}</strong> in the theme picker.</li>
        </ol>
      </section>
    </main>
  );
}
