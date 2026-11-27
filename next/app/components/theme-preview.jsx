'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, GitBranch, Paperclip } from 'lucide-react';
import { createPortal } from 'react-dom';
import { themes } from '../themes';
import { AppearanceControl } from './ui';

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

const models = { OpenAI: '6.1 Sol High', Claude: 'Opus 5.5 High', Gemini: 'Gemini Pro', OpenCode: 'OpenCode' };
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
          {agents.map((agent, slot) => (
            <span key={slot}><span className={icons[agent.provider]} data-provider-kind={agent.provider.toLowerCase()} /></span>
          ))}
        </span>
        <span><span>{summary}</span><span className={running ? 'text-info' : undefined} /></span>
      </button>
      <div data-slot="collapsible-panel" hidden>
        {agents.map((agent, slot) => (
          <div key={slot} data-v2-item-type="subagent" aria-description={agent.running ? 'Running' : 'Completed'}>
            <span aria-hidden="true">
              <span className={icons[agent.provider]} data-provider-kind={agent.provider.toLowerCase()} />
              <span className={agent.running ? 'bg-info' : 'bg-success'} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewConversation({ slug, parent, agents, conversation }) {
  return (
    <div className="preview-workspace" data-chat-canvas="" data-preview-scene={slug} data-preview-conversation={conversation || undefined}>
      <div className="demo" data-workspace-area="conversation">
        <div className="chat-canvas" data-assistant-citation-viewport="">
          {agents.length > 0 && <School agents={agents} />}
          {conversation && <div className="messages-timeline-scroll preview-messages" aria-label="Sample conversation">
            <div data-timeline-row-kind="user"><p data-user-message-bubble="">Keep the chat clear and let the world move around it.</p></div>
            <div data-timeline-row-kind="assistant"><p>The golems stay to the left while the allay flies around the edges.</p></div>
          </div>}
        </div>
      </div>
      <div className="preview-composer" data-workspace-area="composer">
        <div className="new-thread">
          {!conversation && <h1>New thread</h1>}
          <div className="composer" data-chat-composer-main-surface="">
            <span>Ask anything…</span>
            <div className="composer-tools" aria-hidden="true">
              <Paperclip size={14} />
              <span data-chat-provider-model-picker="" aria-label={`${parent} ${models[parent]}`}>{models[parent]}</span>
              <span className="submit" data-chat-composer-compact-send=""><ArrowUp size={14} /></span>
            </div>
          </div>
          <div className="checkout"><GitBranch size={12} aria-hidden="true" /> main</div>
        </div>
      </div>
    </div>
  );
}

export function ThemePreview({ slug, config, error, appearance, onAppearanceChange, studio = false, parent = 'OpenAI', agents = emptyAgents }) {
  const theme = themes[slug];
  const [frame, setFrame] = useState(null);
  const [conversation, setConversation] = useState(false);
  const preview = useRef(null);
  const iframe = useRef(null);
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
    if ((!theme.motionLabel && slug !== 'koi-pond') || !frame) return;

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
  }, [frame, slug, theme.motionLabel]);

  return (
    <div className="preview" data-theme={slug} data-preview-appearance={appearance} aria-busy={!ready && !error} ref={preview}>
      <div className="preview-toolbar">
        <span className="window-title">Live preview</span>
        {studio && slug === 'blockworks' && <label className="preview-state">Scene <select aria-label="Preview conversation state" value={conversation ? 'conversation' : 'new'} onChange={event => setConversation(event.target.value === 'conversation')}>
          <option value="new">New thread</option><option value="conversation">Conversation</option>
        </select></label>}
        <AppearanceControl label={theme.name + ' preview appearance'} appearance={appearance} onChange={onAppearanceChange} disabled={!ready} />
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
          :root { ${colorDeclarations({ canvas: config.canvas, accent: config.accent, ...config.colors, ...config.variants?.light })} }
          :root.dark { ${colorDeclarations({ canvas: config.canvas, accent: config.accent, ...config.colors, ...config.variants?.dark })} }
          ${config.css}
        `}</style>,
        frame.head,
      )}
      {ready && createPortal(<PreviewConversation slug={slug} parent={parent} agents={agents} conversation={conversation} />, frame.body)}
    </div>
  );
}

export function GalleryPreview({ slug, initialAppearance }) {
  const { config, error } = useTheme(slug);
  const [appearance, setAppearance] = useState(initialAppearance || themes[slug].appearance || 'dark');
  return <ThemePreview slug={slug} config={config} error={error} appearance={appearance} onAppearanceChange={setAppearance} parent={themes[slug].previewProvider} />;
}
