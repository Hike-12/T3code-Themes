"""Build the Nightfall Christmas T3 Code theme with snowfall and warm fairy lights on the composer box."""
from base64 import b64decode, b64encode
from io import BytesIO
import json
from pathlib import Path
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DOWNLOAD = ROOT / 'public/downloads/nightfall-christmas.json'
INSTALLED = Path.home() / '.t3/userdata/themes/nightfall-christmas.json'

RENDER_HTML = r"""<!doctype html><html><body><script>
function rng(seed) { let n=seed; return ()=>((n=(1664525*n+1013904223)>>>0)/4294967296); }
const W=1044,H=90;
function renderMode(dark, accumulation=true) {
 const base=document.createElement('canvas'),glow=document.createElement('canvas');
 base.width=glow.width=W;base.height=glow.height=H;
 const c=base.getContext('2d'),g=glow.getContext('2d');
 // Thin, softly shaded snow settling directly on the rim, tapered at the corners.
 const edge=x=>Math.min(1,Math.max(0,(x-10)/100),Math.max(0,(W-10-x)/100));
 const top=x=>37-(9+3*Math.sin((x-162)*Math.PI/120)+2*Math.cos((x-162)*Math.PI/60))*edge(x);
 c.beginPath();c.moveTo(10,42);for(let x=10;x<W-10;x++)c.lineTo(x,42+(top(x)-42)*edge(x));for(let x=W-10;x>=10;x--)c.lineTo(x,42+2*edge(x));c.closePath();
 const snow=c.createLinearGradient(0,23,0,44);snow.addColorStop(0,dark?'#f5fbff':'#ffffff');snow.addColorStop(.6,'#e8f1f4');snow.addColorStop(1,'#aebfc6');c.fillStyle=snow;if(accumulation)c.fill();
 // Reference window: dark green scalloped cable with round red, green and gold bulbs.
 const colors=['#c9454b','#d9b65d','#399b62','#d9b65d','#399b62','#c9454b','#d9b65d','#399b62'];
 const wire=x=>42+12*Math.sin((x-162)*Math.PI/90)**2;
 c.beginPath();for(let x=20;x<W-20;x++)x===20?c.moveTo(x,wire(x)):c.lineTo(x,wire(x));c.strokeStyle='#345243';c.lineWidth=2;c.stroke();
 for(let i=0,x=72;x<W-25;x+=90,i++) {const y=wire(x),color=colors[i%colors.length];
 c.fillStyle='#314d3e';c.fillRect(x-2,y-1,4,5);
 c.fillStyle=color;c.beginPath();c.arc(x,y+7,5.5,0,Math.PI*2);c.fill();
 c.fillStyle='rgba(255,255,235,.35)';c.beginPath();c.arc(x-1.6,y+5,1.5,0,Math.PI*2);c.fill();
 const h=g.createRadialGradient(x,y+7,0,x,y+7,13);h.addColorStop(0,color+'55');h.addColorStop(1,color+'00');g.fillStyle=h;g.fillRect(x-13,y-6,26,26);
 }
 return {base:base.toDataURL(),glow:glow.toDataURL()};
}
window.__renderNightfall=()=>({dark:renderMode(true),light:renderMode(false),bare:renderMode(true,false)});
</script></body></html>"""


def png_b64_to_webp_url(data_url):
    raw = data_url.split(',', 1)[1]
    img = Image.open(BytesIO(b64decode(raw)))
    # Supersampled 3x (1044x90) -> 2x Retina (696x60) for crisp anti-aliasing & compact WebP size
    img = img.resize((696, 60), Image.Resampling.LANCZOS)
    out = BytesIO()
    img.save(out, 'WEBP', quality=85, alpha_quality=95, method=6)
    return 'url("data:image/webp;base64,' + b64encode(out.getvalue()).decode() + '")'


def render_assets():
    with tempfile.TemporaryDirectory() as tmp:
        html_path = Path(tmp) / 'render.html'
        html_path.write_text(RENDER_HTML)
        script = f"""
const {{ chromium }} = require({json.dumps(str(ROOT / 'node_modules/playwright'))});
(async () => {{
  const browser = await chromium.launch({{ executablePath: '/opt/google/chrome/chrome' }});
  try {{
    const page = await browser.newPage();
    await page.goto({json.dumps(html_path.as_uri())});
    const out = await page.evaluate(() => window.__renderNightfall());
    process.stdout.write(JSON.stringify(out));
  }} finally {{
    await browser.close();
  }}
}})();
"""
        raw = subprocess.check_output(['node', '-e', script], cwd=ROOT)
    data = json.loads(raw)
    return {
        mode: {
            'base': png_b64_to_webp_url(data[mode]['base']),
            'glow': png_b64_to_webp_url(data[mode]['glow']),
        }
        for mode in ('dark', 'light', 'bare')
    }


def palette(dark):
    if dark:
        canvas, ink, muted = '#171615', '#f6efe4', '#c2b6a8'
        chrome, surface, raised, overlay = '#1b1917', '#1f1d1b', '#262320', '#2f2b27'
        sidebar, message, border, code = '#141311', '#2c2824', '#4b4139', '#11100f'
        accent, accent_ink, focus = '#f1bd75', '#21170a', '#f5cb8d'
        action, action_ink = '#8b323f', '#fff6ed'
        error, warning, update = '#f49b9b', '#f1bd75', '#96c39d'
    else:
        canvas, ink, muted = '#dde6ee', '#1f2933', '#4d5f6f'
        chrome, surface, raised, overlay = '#e7edf3', '#f2f6f9', '#fbfdff', '#e3ebf2'
        sidebar, message, border, code = '#e9eff5', '#e7eff5', '#a6b8c7', '#edf2f7'
        accent, accent_ink, focus = '#2d6a4f', '#ffffff', '#2d6a4f'
        action, action_ink = '#8b2c3b', '#fff9f5'
        error, warning, update = '#9a2d3a', '#8a5514', '#2d6a4f'
    return {
        'canvas': canvas, 'text': ink, 'textMuted': muted, 'chrome': chrome,
        'toolbar': chrome, 'toolbarForeground': ink, 'toolbarBorder': border,
        'toolbarControl': raised, 'toolbarControlForeground': ink, 'toolbarControlHover': overlay,
        'sidebar': sidebar, 'sidebarForeground': ink, 'sidebarMutedForeground': muted,
        'sidebarRowActive': overlay, 'sidebarRowSelected': overlay, 'sidebarRowHover': raised,
        'sidebarBorder': border, 'sidebarControlSurface': raised,
        'surface': surface, 'surfaceRaised': raised, 'surfaceOverlay': overlay,
        'messageSurface': message, 'messageForeground': ink,
        'accent': accent, 'accentForeground': accent_ink,
        'accentSurface': overlay, 'accentSurfaceForeground': ink,
        'focus': focus, 'border': border,
        'codeBackground': code, 'codeForeground': ink,
        'input': raised, 'muted': overlay, 'mutedForeground': muted,
        'secondary': raised, 'secondaryForeground': ink, 'secondaryLabel': muted,
        'placeholder': muted, 'iconMuted': muted,
        'messageAction': action, 'messageActionForeground': action_ink, 'messageActionHover': action,
        'error': error, 'errorForeground': accent_ink, 'errorSurface': overlay,
        'warning': warning, 'warningForeground': accent_ink, 'warningSurface': overlay,
        'update': update, 'updateForeground': accent_ink, 'updateSurface': overlay,
        'terminalBackground': code, 'terminalForeground': ink,
        'terminalCursor': accent, 'terminalSelection': overlay,
    }


def snowman_css():
    from urllib.parse import quote
    def image(mark, light):
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="64" height="88" viewBox="0 0 64 88"><defs><radialGradient id="s" cx=".32" cy=".23" r=".85"><stop stop-color="#ffffff"/><stop offset=".68" stop-color="#ffffff"/><stop offset="1" stop-color="#e5edf1"/></radialGradient></defs><ellipse cx="32" cy="83" rx="25" ry="3" fill="#8296a0" opacity=".2"/><path d="M17 51L5 40m42 11l12-13" stroke="#786452" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="32" cy="65" rx="20" ry="18" fill="url(#s)"/><circle cx="32" cy="43" r="15" fill="url(#s)"/><circle cx="32" cy="24" r="12" fill="url(#s)"/><path d="M20 18v-9q12-6 24 0v9" fill="{mark}"/><path d="M17 18h30" stroke="{mark}" stroke-width="5" stroke-linecap="round"/><path d="M22 35q10 5 21 0v7q-10 5-21 0z" fill="{mark}"/><path d="M39 41v13l6 3V40" fill="{mark}"/><g fill="#302a2a"><circle cx="28" cy="24" r="1.3"/><circle cx="36" cy="24" r="1.3"/><circle cx="32" cy="53" r="1.5"/><circle cx="32" cy="63" r="1.5"/><circle cx="32" cy="73" r="1.5"/></g><path d="M32 27l8 2-8 1" fill="#d68849"/><path d="M28 31q4 3 8 0" fill="none" stroke="#585253" stroke-width="1"/></svg>'''
        return 'url("data:image/svg+xml,' + quote(svg) + '")'
    providers = {
        'openai': ('#302a2a', '#e3e5e6', '[data-provider-kind="openai"]'),
        'claude': ('#b45e43', '#e3d8c1', ':is([data-provider-kind="claude"],[class*="text-[#d97757]"],[style*="#d97757" i])'),
        'gemini': ('#3269c8', '#a9d7ff', ':is([data-provider-kind="gemini"],[class*="text-[#5b87bf]"],[style*="#5b87bf" i],img[src*="gemini" i],svg[viewBox="0 0 128 128"] image)'),
        'opencode': ('#94566c', '#eed6df', ':is([data-provider-kind="opencode"],svg[viewBox="0 0 32 40"])'),
    }
    host='[data-workspace-area="conversation"]:not([data-side-chat-pane] *)'
    group='[data-subagent-group]:not([data-side-chat-pane] *) > [aria-expanded] > [aria-hidden="true"] > span'
    target=host+' > [data-assistant-citation-viewport]'
    css=host+' { --nightfall-agent-count: 0; '+''.join(f'--nightfall-{name}: {image(mark,light)};' for name,(mark,light,icon) in providers.items())+' }\n'
    for i in range(1,9):
        badge=f'{group}:nth-child({i})'
        css+=f'{host}:has({badge}) {{ --nightfall-agent-count: {i}; --nightfall-agent-{i}: var(--nightfall-openai); }}\n'
        for provider,(mark,light,icon) in providers.items():
            css+=f'{host}:has({badge} {icon}) {{ --nightfall-agent-{i}: var(--nightfall-{provider}); }}\n'
    for i in range(1,9):
        css+=f'{host}:has([data-subagent-group] > [aria-expanded="true"] ~ [data-slot="collapsible-panel"] [data-v2-item-type="subagent"]:nth-child({i})[aria-description="Completed"]) {{ --nightfall-agent-{i}: none !important; }}\n'
    css+=host+' { --nightfall-main: var(--nightfall-openai); }\n'
    for provider,(mark,light,icon) in providers.items():
        css+=f'[data-chat-canvas]:has(> [data-workspace-area="composer"] [data-chat-provider-model-picker][aria-label*="{provider}" i]) > {host}, {host}:has([data-chat-provider-model-picker][aria-label*="{provider}" i]) {{ --nightfall-main: var(--nightfall-{provider}); }}\n'
    css+=f'[data-chat-canvas]:has(> [data-workspace-area="composer"] [data-chat-provider-model-picker][aria-label*="antigravity" i]) > {host} {{ --nightfall-main: var(--nightfall-gemini); }}\n'
    css+=target+' { position: relative; min-height: 100%; }\n' 
    standalone='[data-v2-item-type="subagent"]:not([data-subagent-group] *, [data-side-chat-pane] *):is([aria-description="Running"], [aria-description="Queued"], [aria-description="Waiting"])'
    css+=f'{host}:has({standalone}) {{ --nightfall-agent-1: var(--nightfall-openai); }}\n'
    for provider,(mark,light,icon) in providers.items():
        css+=f'{host}:has({standalone} {icon}) {{ --nightfall-agent-1: var(--nightfall-{provider}); }}\n'
        css+=f'[data-chat-canvas]:has(> [data-workspace-area="composer"] [data-chat-provider-model-picker] {icon}) > {host}, {host}:has([data-chat-provider-model-picker] {icon}) {{ --nightfall-main: var(--nightfall-{provider}); }}\n'
    positions=['5% bottom','95% bottom','14% bottom','85% bottom','23% bottom','76% bottom','32% bottom','67% bottom','41% bottom']
    css+=target+'::after { content: ""; position: absolute; inset: auto 0 12px; height: 116px; pointer-events: none !important; z-index: 1; opacity: var(--nightfall-snowmen, 1); background-repeat: no-repeat; background-image: var(--nightfall-main),'+','.join(f'var(--nightfall-agent-{i},none)' for i in range(1,9))+'; background-size: clamp(28px,7vw,48px) auto,clamp(26px,6vw,42px) auto,clamp(27px,6.5vw,46px) auto,clamp(25px,6vw,40px) auto,clamp(26px,6vw,44px) auto,clamp(26px,6vw,42px) auto,clamp(27px,6.5vw,46px) auto,clamp(25px,6vw,40px) auto,clamp(26px,6vw,44px) auto; background-position: '+','.join(p.replace('bottom', f'calc(100% - {offset}px)') for p,offset in zip(positions,[4,18,29,2,12,34,1,19,32]))+'; }\n'
    return css


def main():
    assets = render_assets()
    composer = '[data-chat-composer-main-surface]:not([data-side-chat-pane] *)'
    css = f'''/* Nightfall Christmas: a light snow rim and warm fairy lights on the composer box. */
:root {{ --nightfall-bare: {assets['bare']['base']}; }}
:root.dark {{
  --nightfall-snowy: {assets['dark']['base']};
  --nightfall-ledge: var(--nightfall-snowy);
  --nightfall-lights: {assets['dark']['glow']};
}}
:root:not(.dark) {{
  --nightfall-snowy: {assets['light']['base']};
  --nightfall-ledge: var(--nightfall-snowy);
  --nightfall-lights: {assets['light']['glow']};
}}

{composer} {{
  position: relative !important;
}}
{composer}::before,
{composer}::after {{
  content: "" !important;
  display: block !important;
  position: absolute !important;
  top: -14px !important;
  left: 12px !important;
  right: 12px !important;
  bottom: auto !important;
  width: auto !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border-style: solid !important;
  border-color: transparent !important;
  border-width: 30px 54px 0 54px !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  pointer-events: none !important;
  border-image-slice: 60 108 0 108 !important;
  border-image-width: 30px 54px 0 54px !important;
  border-image-repeat: round !important;
}}
{composer}::before {{
  z-index: 25 !important;
  border-image-source: var(--nightfall-ledge) !important;
}}
{composer}::after {{
  z-index: 26 !important;
  border-image-source: var(--nightfall-lights) !important;
  filter: opacity(var(--nightfall-light-brightness, 1));
  animation: t3-nightfall-glow 3.6s ease-in-out infinite;
  animation-play-state: var(--theme-motion-state, running);
}}

/* Snow stays inside the conversation bounds and never intercepts input. */
[data-workspace-area="conversation"] {{
 position: relative;
 isolation: isolate;
 --nightfall-flake: rgba(235,244,250,.48);
}}
:root:not(.dark) [data-workspace-area="conversation"] {{ --nightfall-flake: rgba(105,133,155,.42); }}
[data-workspace-area="conversation"]::before,
[data-workspace-area="conversation"]::after {{
 content: "";
 position: absolute;
 inset: 0;
 pointer-events: none !important;
 z-index: 0;
 background-image:
 radial-gradient(circle at 19px 37px, var(--nightfall-flake) 0 1px, transparent 1.7px),
 radial-gradient(circle at 173px 119px, var(--nightfall-flake) 0 1.5px, transparent 2.2px),
 radial-gradient(circle at 91px 241px, var(--nightfall-flake) 0 .8px, transparent 1.5px),
 radial-gradient(circle at 287px 337px, var(--nightfall-flake) 0 1.2px, transparent 2px);
 opacity: var(--nightfall-snow-intensity, 1);
 background-size: calc(347px / var(--nightfall-snow-density, 1)) 420px;
 animation: t3-nightfall-snow var(--nightfall-snow-duration, 22s) linear infinite;
 animation-play-state: var(--theme-motion-state, running);
}}
[data-workspace-area="conversation"]::after {{
 background-size: calc(503px / var(--nightfall-snow-density, 1)) 600px;
 opacity: calc(var(--nightfall-snow-intensity, 1) * .55);
 animation: t3-nightfall-snow-far calc(var(--nightfall-snow-duration, 22s) * 1.68) linear infinite;
 animation-delay: -19s;
 animation-play-state: var(--theme-motion-state, running);
}}
@keyframes t3-nightfall-snow {{ from {{ background-position: 0 -420px; }} to {{ background-position: 0 0; }} }}
@keyframes t3-nightfall-snow-far {{ from {{ background-position: 70px -600px; }} to {{ background-position: 70px 0; }} }}
@media (prefers-reduced-motion: reduce) {{
 [data-workspace-area="conversation"]::before,
 [data-workspace-area="conversation"]::after {{ animation: none !important; }}
}}

@keyframes t3-nightfall-glow {{
  0%, 100% {{ opacity: 1; }}
  50% {{ opacity: .66; }}
}}
@media (prefers-reduced-motion: reduce) {{
  {composer}::after {{ animation: none !important; opacity: 1 !important; }}
}}
'''
    css += snowman_css()
    dark, light = palette(True), palette(False)
    theme = {
        'version': 1,
        'id': 'nightfall-christmas',
        'name': 'Nightfall Christmas',
        'appearance': 'dark',
        'canvas': dark['canvas'],
        'accent': dark['accent'],
        'colors': dark,
        'variants': {'light': light},
        'css': css,
    }
    assert len(css) < 96_000, f'CSS too long: {len(css)}'
    encoded = json.dumps(theme, indent=2) + '\n'
    DOWNLOAD.write_text(encoded)
    if INSTALLED.parent.exists():
        INSTALLED.write_text(encoded)
    print(f'Wrote {DOWNLOAD} (css={len(css)} chars)')


if __name__ == '__main__':
    main()
