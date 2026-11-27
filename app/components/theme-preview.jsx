'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { PanelsTopLeft } from 'lucide-react';
import { createPortal } from 'react-dom';
import { themes } from '../themes';

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

const models = { OpenAI: 'GPT-6 Astra', Claude: 'Claude Sonnet', Gemini: 'Gemini Pro' };
const icons = { Claude: 'text-[#d97757]', Gemini: 'text-[#5b87bf]' };
const emptyAgents = [];
const frameSource = '<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><title>Theme preview</title><link rel="stylesheet" href="/preview.css"></head><body id="preview-root"></body></html>';

function colorDeclarations(colors) {
  return Object.entries(colorTokens)
    .filter(([token]) => colors[token])
    .map(([token, property]) => `--${property}: ${colors[token]};`)
    .join(' ');
}

export function useTheme(slug) {
  const [result, setResult] = useState({ config: null, error: false });
  const source = themes[slug].download;

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) throw new Error(`Theme request returned ${response.status}`);
        const config = await response.json();
        setResult({ config, error: false });
      } catch {
        if (!controller.signal.aborted) setResult({ config: null, error: true });
      }
    }

    load();
    return () => controller.abort();
  }, [source]);

  return result;
}

function School({ agents }) {
  const running = agents.filter(agent => agent.running).length;
  const done = agents.length - running;
  const summary = [running && `${running} working`, done && `${done} done`].filter(Boolean).join(' · ');

  return (
    <div className="studio-group" data-subagent-group="">
      <button type="button" tabIndex={-1} aria-expanded="true" aria-description={summary} aria-label={`${agents.length} ${agents.length === 1 ? 'subagent' : 'subagents'}`}>
        <span aria-hidden="true">
          {agents.map((agent, slot) => <span key={slot}><span className={icons[agent.provider]} /></span>)}
        </span>
        <span><span>{summary}</span><span className={running ? 'text-info' : undefined} /></span>
      </button>
      <div data-slot="collapsible-panel" hidden>
        {agents.map((agent, slot) => (
          <div key={slot} data-v2-item-type="subagent" aria-description={agent.running ? 'Running' : 'Completed'}>
            <span aria-hidden="true"><span className={agent.running ? 'bg-info' : 'bg-success'} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewConversation({ parent, agents }) {
  return (
    <div className="demo" data-workspace-area="conversation">
      <div className="chat-canvas" data-assistant-citation-viewport="">
        <div className="new-thread">
          <h1>What should we build?</h1>
          <p className="workspace-hint">Theme workshop</p>
          <div className="composer" data-chat-composer-main-surface="">
            <span>Ask anything. @ files, $ skills, / commands</span>
            <div className="composer-tools" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m9 15 7-7a2 2 0 0 1 3 3l-9 9a5 5 0 0 1-7-7L13 3a3.5 3.5 0 0 1 5 5L8 18" /></svg>
              <span data-chat-provider-model-picker="" aria-label={models[parent]}>{models[parent]}</span>
              <svg className="submit" viewBox="0 0 24 24"><path d="M12 18V6m-5 5 5-5 5 5" /></svg>
            </div>
          </div>
          <div className="checkout"><span>Current checkout</span><span>⑂ main</span></div>
        </div>
        {agents.length > 0 && <School agents={agents} />}
      </div>
    </div>
  );
}

export function ThemePreview({ slug, config, error, studio = false, parent = 'OpenAI', agents = emptyAgents }) {
  const theme = themes[slug];
  const [appearance, setAppearance] = useState('dark');
  const [frame, setFrame] = useState(null);
  const preview = useRef(null);
  const iframe = useRef(null);
  const modeId = useId();
  const ready = Boolean(config && frame);

  function attachLoadedFrame() {
    const next = iframe.current?.contentDocument;
    if (next?.body?.id === 'preview-root' && next.readyState === 'complete') setFrame(next);
  }

  // The frame can finish loading before React hydrates the page.
  useEffect(attachLoadedFrame, []);

  useEffect(() => {
    if (frame) frame.documentElement.classList.toggle('dark', appearance === 'dark');
  }, [frame, appearance]);

  useEffect(() => {
    if (slug !== 'koi-pond' || !frame) return;

    let visible = !('IntersectionObserver' in window);
    const updatePlayback = () => frame.documentElement.toggleAttribute('data-paused', !visible || document.hidden);
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updatePlayback();
    }) : null;

    observer?.observe(preview.current);
    updatePlayback();
    document.addEventListener('visibilitychange', updatePlayback);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', updatePlayback);
    };
  }, [frame, slug]);

  return (
    <div className="preview" data-theme={slug} data-preview-appearance={appearance} aria-busy={!ready && !error} ref={preview}>
      <div className="preview-toolbar">
        <span className="window-title"><PanelsTopLeft size={15} aria-hidden="true" /> Live preview</span>
        <fieldset className="mode-control" disabled={!ready}>
          <legend className="sr-only">{theme.name} preview appearance</legend>
          {['dark', 'light'].map(mode => (
            <label key={mode}>
              <input type="radio" name={modeId} value={mode} checked={mode === appearance} onChange={() => setAppearance(mode)} />
              <span>{mode === 'dark' ? 'Dark' : 'Light'}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className={studio ? 'preview-viewport studio-viewport' : 'preview-viewport'}>
        <iframe
          title={`Live ${theme.name} preview`}
          sandbox="allow-same-origin"
          tabIndex={-1}
          srcDoc={frameSource}
          ref={iframe}
          onLoad={attachLoadedFrame}
        />
        {!ready && (
          <p className="preview-status" role="status">{error ? 'Preview unavailable. You can still download the original theme.' : 'Loading preview…'}</p>
        )}
        <noscript><p className="preview-status">Enable JavaScript to use the live preview.</p></noscript>
      </div>
      {ready && createPortal(
        <style>{`
          :root { ${colorDeclarations(config.variants.light)} }
          :root.dark { ${colorDeclarations({ canvas: config.canvas, ...config.colors })} }
          ${config.css}
        `}</style>,
        frame.head,
      )}
      {ready && createPortal(<PreviewConversation parent={parent} agents={agents} />, frame.body)}
    </div>
  );
}

export function GalleryPreview({ slug }) {
  const { config, error } = useTheme(slug);
  return <ThemePreview slug={slug} config={config} error={error} />;
}
