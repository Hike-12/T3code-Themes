"""Build Minecraft's self-contained theme. Run with uv run --with numpy --with pillow."""
from base64 import b64encode
from io import BytesIO
from pathlib import Path
import importlib.util
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('minecraft_renderer', Path(__file__).with_name('render-minecraft.py'))
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)

def embed(image, quality=76):
    out = BytesIO()
    image.save(out, 'WEBP', quality=quality, method=6, alpha_quality=100)
    return 'url("data:image/webp;base64,' + b64encode(out.getvalue()).decode() + '")'

providers = {'openai':'iron_golem','claude':'copper_golem','gemini':'allay','opencode':'enderman'}
sprites = {key: renderer.sprite(value) for key, value in providers.items()}
assets = {key: embed(sprite) for key, sprite in sprites.items()}

def mini_mob(key):
    # Three 16px frames use the same silhouette and change the eyes and pose.
    colors = {
        'openai': ('#d6cec0', '#a39b89', '#738856', '#643e36'),
        'claude': ('#d58c62', '#9e593e', '#f0ae76', '#492b26'),
        'gemini': ('#73dbeb', '#3398bd', '#bff2f1', '#285780'),
        'opencode': ('#4b404f', '#302936', '#69516c', '#f0a3fb'),
    }
    body, shade, detail, eyes = colors[key]
    sheet = Image.new('RGBA', (48, 16))
    for stage in range(3):
        frame = Image.new('RGBA', (16, 16))
        draw = ImageDraw.Draw(frame)
        if key == 'gemini':
            draw.rectangle((0, 6 if stage != 2 else 4, 15, 8), fill=detail)
            draw.rectangle((6, 8, 9, 13), fill=shade)
            draw.rectangle((4, 3, 11, 10), fill=body)
        else:
            draw.rectangle((4, 9, 11, 12), fill=shade)
            draw.rectangle((3, 7, 4, 12 - (stage == 2)), fill=shade)
            draw.rectangle((11, 7, 12, 12 + (stage == 2)), fill=shade)
            draw.rectangle((5, 12, 6, 14), fill=shade)
            draw.rectangle((9, 12, 10, 14 - (stage == 2)), fill=shade)
            draw.rectangle((4, 2, 11, 9), fill=body)
            if key == 'opencode':
                draw.rectangle((3, 2, 12, 8), fill=body)
            elif key == 'claude':
                draw.rectangle((7, 0, 8, 2), fill=detail)
                draw.rectangle((7, 7, 8, 10), fill=detail)
            else:
                draw.rectangle((4, 3, 5, 4), fill=detail)
                draw.rectangle((7, 6, 8, 9), fill=shade)
        eye_y = 6 + (stage == 1)
        for x in (5, 9):
            draw.rectangle((x, eye_y - (stage == 2), x + 1, eye_y), fill=eyes)
        sheet.paste(frame, (stage * 16, 0))
    out = BytesIO()
    sheet.save(out, 'PNG', optimize=True)
    return 'url("data:image/png;base64,' + b64encode(out.getvalue()).decode() + '")'

assets.update({f'{key}-mini': mini_mob(key) for key in providers})
portraits = ROOT / 'public/assets/blockworks'
portraits.mkdir(exist_ok=True)
for key, sprite in sprites.items():
    frame = sprite.crop((0, 0, sprite.height, sprite.height))
    frame = frame.crop(frame.getbbox())
    frame.save(portraits / f'{key}.webp', lossless=True)
# Only a few native-size purple flecks; used during disappearance and arrival.
mist = Image.new('RGBA',(128*renderer.FRAMES,128))
for f in range(renderer.FRAMES):
    p = ImageDraw.Draw(mist)
    for i,(x,y) in enumerate([(35,26),(78,18),(94,53),(30,70),(75,93),(49,49),(88,78),(53,101)]):
        x += (f*3+i)%9-4;y -= (f+i)%12
        p.rectangle((f*128+x,y,f*128+x+2,y+2),fill=(190,78,230,190))
        p.ellipse((f*128+x-3,y-3,f*128+x+5,y+5),fill=(146,48,195,25))
assets['mist']=embed(mist)
assets['portal']=embed(renderer.portal(),78)

chat = '[data-workspace-area="conversation"]:not([data-side-chat-pane] *)'
canvas = '[data-chat-canvas]'
viewport = ' > [data-assistant-citation-viewport]'
composer = '[data-workspace-area="composer"]'
main_composer = '[data-chat-composer-main-surface]'
buddy = f'{main_composer}[data-mc-activity], [data-chat-composer-form] {main_composer}'
now_line = '[data-thread-now-line]'
thinking = ':has([data-v2-item-type="reasoning"]:not([data-side-chat-pane] *) .live-tool-shine, [data-v2-item-type="reasoning"]:not([data-side-chat-pane] *) .lucide-brain.text-foreground)'
main_chat_only = ':not([data-side-chat-pane] *)'
generating = f':has(> {composer} button:is([aria-label="Stop generation"], [aria-label="Stopping"]))'
picker = '[data-chat-provider-model-picker]:not([data-side-chat-pane] *)'
active = ':has(.messages-timeline-scroll [data-timeline-row-kind])'
group = '[data-subagent-group]:not([data-side-chat-pane] *)'
row = '[data-v2-item-type="subagent"]:not([data-side-chat-pane] *)'
standalone = row + ':not([data-subagent-group] *)'
working = ':is([aria-description="Running"], [aria-description="Queued"], [aria-description="Waiting"])'
markers = {
    'claude':'[data-provider-kind="claude"], [class*="text-[#d97757]"], [style*="#d97757" i]',
    'gemini':'[data-provider-kind="gemini"], [class*="text-[#5b87bf]"], [style*="#5b87bf" i], img[src*="gemini" i], svg[viewBox="0 0 128 128"] image[href^="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAQAElEQVR4nOx9CbhsVXXmWvucqst7AmpQwDmoDUgQpTtGmcRIBEHhAwxEMRpCjEOa2NoK7/"]',
    'opencode':'[data-provider-kind="opencode"], svg[viewBox="0 0 32 40"] path[d^="M24 8H8V32H24V8Z"]',
}
slots=[(chat,'before'),(chat,'after'),(chat+viewport,'before'),(chat+viewport,'after')]
all_slots=',\n'.join(h+'::'+p for h,p in slots)
css='/* Minecraft. Offline vanilla model renders; cropped sword portal. No runtime scripts or remote assets. */\n:root {\n'
css+='\n'.join(f'--mc-{key}: {value};' for key,value in assets.items())+'\n}\n'
css+=f'''
:root.dark {{ --mc-ground: #101010; --mc-rim: drop-shadow(1px 0 0 #877b9188) drop-shadow(-1px 0 0 #877b9166); }}
:root:not(.dark) {{ --mc-ground: #e5e5e5; --mc-rim: none; }}
{chat} {{
  position: relative; isolation: isolate; container-type: size;
  background: var(--mc-portal) right calc(-1 * clamp(38px, 6cqw, 90px)) bottom 6px / auto clamp(190px, 55cqh, 620px) no-repeat var(--mc-ground) !important;
}}
{chat}{viewport} {{ position: relative; }}
{all_slots} {{
  position: absolute; left: 0; top: 0; z-index: 1; pointer-events: none;
  --mc-base-size: clamp(68px, 15cqh, 148px); --mc-actor-size: var(--mc-base-size);
  --mc-size: var(--mc-actor-size);
  --mc-sprite: var(--mc-openai); --mc-route: t3-minecraft-roam;
  --mc-time: 76s; --mc-gait: 2.4s;
  --mc-gutter: max(12px, calc((100cqw - min(var(--mc-content-width, 880px), 84cqw)) / 2));
  --mc-a: 10px; --mc-b: calc(100cqw - var(--mc-size) - clamp(50px, 10cqw, 180px));
  --mc-y: calc(100cqh - var(--mc-size) - 12px); --mc-rise: 4cqh;
  width: var(--mc-size); height: var(--mc-size); image-rendering: pixelated;
  --mc-actor-sprite: var(--mc-sprite);
  background: var(--mc-actor-sprite) no-repeat 0 0 / 800% 100%;
  filter: var(--mc-provider-filter, none);
  transform: translate(var(--mc-a), var(--mc-y));
  animation: var(--mc-route) var(--mc-time) linear infinite,
             t3-minecraft-feet var(--mc-gait) steps(8, end) infinite;
  animation-delay: var(--mc-delay, 0s), 0s;
  animation-play-state: var(--theme-motion-state, running);
}}
{chat}::before {{ content: ""; --mc-lane: 31cqh; }}
{chat}::after {{ --mc-lane: 55cqh; --mc-delay: -21s; }}
{chat}{viewport}::before {{ --mc-lane: 7cqh; --mc-delay: -48s; }}
{chat}{viewport}::after {{ --mc-lane: 79cqh; --mc-delay: -61s; }}
'''
# Select each slot independently. A finished row disappears; its provider cannot
# leak from another row or from a secondary chat pane.
def select_slot(host, match, pseudo):
    # :has() cannot be nested; put the fallback guard on the outer host.
    guard = ':not(:has([data-subagent-group] [data-v2-item-type="subagent"]))' if '[aria-expanded="false"]' in match else ''
    return f'{host}{guard}:has({match})::{pseudo}'

selectors={key:[] for key in providers}
for i,(host,pseudo) in enumerate(slots):
    target=host+'::'+pseudo
    if i==0:
        for name,marker in markers.items():
            label=':is([aria-label*="gemini" i], [aria-label*="antigravity" i])' if name=='gemini' else f'[aria-label*="{name}" i]'
            for match in [picker+label,picker+f' :is({marker})']:
                selectors[name] += [f'{host}:has({match})::{pseudo}',f'{canvas}:has(> {composer} {match}) > {target}']
    else:
        collapsed=':not('+', '.join(f'[aria-description^="{j} working"]' for j in range(1,i))+')' if i>1 else ''
        expanded=f'{group} > [aria-expanded] ~ [data-slot="collapsible-panel"] {row}:nth-child({i} of [data-v2-item-type="subagent"])'
        compact=f'{group} > [aria-expanded="false"]{collapsed}'
        visible=[expanded+working, compact+' .text-info']
        if i==1:visible.append(standalone+working)
        css+=',\n'.join(select_slot(host, match, pseudo) for match in visible)+' { content: ""; }\n'
        for name,marker in markers.items():
            matches=[expanded+working+f' :is({marker})',compact+f' > [aria-hidden="true"] > span:nth-child({i}) :is({marker})']
            if i==1:matches.append(standalone+working+f' :is({marker})')
            selectors[name] += [select_slot(host, match, pseudo) for match in matches]

defaults = {
    'base-size': 'clamp(68px, 15cqh, 148px)',
    'route': 't3-minecraft-roam', 'time': '76s', 'gait': '2.4s', 'provider-filter': 'none',
}
settings = {
    'openai': {},
    'claude': {'base-size': 'clamp(42px, 8.5cqh, 86px)', 'gait': '1.7s', 'time': '83s'},
    'gemini': {'base-size': 'min(clamp(24px, 7.5cqh, 66px), var(--mc-flight-width, 6cqw))',
               'route': 't3-minecraft-fly', 'time': '46s', 'gait': '.8s'},
    'opencode': {'base-size': 'clamp(82px, 18cqh, 176px)', 'route': 't3-minecraft-enderman',
                 'time': '120s', 'gait': '2s', 'provider-filter': 'var(--mc-rim)'},
}
for name, overrides in settings.items():
    preset = {**defaults, **overrides, 'sprite': f'var(--mc-{name})', 'buddy': f'var(--mc-{name}-mini)'}
    css += ':root { ' + ' '.join(f'--mc-{name}-{key}: {value};' for key, value in preset.items()) + ' }\n'
    if selectors[name]:
        properties = ' '.join(f'--mc-{key}: var(--mc-{name}-{key});' for key in preset if key != 'buddy')
        css += ',\n'.join(selectors[name]) + ' { ' + properties + ' }\n'
        label = ':is([aria-label*="gemini" i], [aria-label*="antigravity" i])' if name == 'gemini' else f'[aria-label*="{name}" i]'
        css += (f'{canvas}:has(> {composer} {picker}{label}),\n'
                f'{canvas}:has(> {composer} {picker} :is({markers[name]})) '
                f'{{ --mc-status-buddy: var(--mc-{name}-mini); }}\n')

css+=f'''
{chat}::before {{
  --mc-actor-size: var(--mc-picked-base-size, var(--mc-base-size));
  --mc-actor-sprite: var(--mc-picked-sprite, var(--mc-sprite));
  animation-name: var(--mc-picked-route, var(--mc-route)), t3-minecraft-feet;
  animation-duration: var(--mc-picked-time, var(--mc-time)), var(--mc-picked-gait, var(--mc-gait));
  filter: var(--mc-picked-provider-filter, var(--mc-provider-filter, none));
}}
'''
# A real conversation has a fixed-width content column. All ground routes use
# the free gutter, with separate vertical lanes. Never put a mob behind text.
css+=',\n'.join(h.replace(chat,chat+active,1)+'::'+p for h,p in slots)+''' {
  --mc-size: min(var(--mc-actor-size), 17cqh, calc(var(--mc-gutter) - 14px));
  --mc-b: max(10px, calc(var(--mc-gutter) - var(--mc-size) - 8px));
  --mc-y: min(var(--mc-lane), calc(100cqh - var(--mc-size) - 12px));
  --mc-rise: min(3cqh, 30px);
}
'''
css+='''
@keyframes t3-minecraft-feet { to { background-position-x: 114.285714%; } }
@keyframes t3-minecraft-roam {
  0% { transform: translate(var(--mc-a), var(--mc-y)); }
  49.99% { transform: translate(var(--mc-b), calc(var(--mc-y) - var(--mc-rise))); }
  50% { transform: translate(var(--mc-b), calc(var(--mc-y) - var(--mc-rise))) scaleX(-1); }
  99.99% { transform: translate(var(--mc-a), var(--mc-y)) scaleX(-1); }
  100% { transform: translate(var(--mc-a), var(--mc-y)); }
}
@keyframes t3-minecraft-enderman {
  0% { background-image: var(--mc-actor-sprite); transform: translate(var(--mc-a), var(--mc-y)); }
  32% { background-image: var(--mc-actor-sprite); transform: translate(var(--mc-b), calc(var(--mc-y) - 3cqh)); }
  32.1%, 32.35% { animation-timing-function: steps(1, end); transform: translate(var(--mc-b), calc(var(--mc-y) - 3cqh)); background-image: var(--mc-mist); }
  32.36%, 32.6% { transform: translate(var(--mc-a), var(--mc-y)); background-image: var(--mc-mist); }
  32.61% { transform: translate(var(--mc-a), var(--mc-y)); background-image: var(--mc-actor-sprite); }
  65% { background-image: var(--mc-actor-sprite); transform: translate(var(--mc-b), calc(var(--mc-y) - 6cqh)); }
  65.1%, 65.35% { animation-timing-function: steps(1, end); transform: translate(var(--mc-b), calc(var(--mc-y) - 6cqh)); background-image: var(--mc-mist); }
  65.36%, 65.6% { transform: translate(var(--mc-a), var(--mc-y)); background-image: var(--mc-mist); }
  65.61% { transform: translate(var(--mc-a), var(--mc-y)); background-image: var(--mc-actor-sprite); }
  95.6% { background-image: var(--mc-actor-sprite); transform: translate(var(--mc-b), var(--mc-y)); }
  95.7%, 95.95% { animation-timing-function: steps(1, end); transform: translate(var(--mc-b), var(--mc-y)); background-image: var(--mc-mist); }
  95.96%, 96.2% { transform: translate(calc(100cqw - var(--mc-size) - 8px), calc(100cqh - var(--mc-size) - 18px)); background-image: var(--mc-mist); }
  96.21%, 97.7% { transform: translate(calc(100cqw - var(--mc-size) - 8px), calc(100cqh - var(--mc-size) - 18px)); background-image: var(--mc-actor-sprite); }
  97.8%, 98.05% { animation-timing-function: steps(1, end); transform: translate(calc(100cqw - var(--mc-size) - 8px), calc(100cqh - var(--mc-size) - 18px)); background-image: var(--mc-mist); }
  98.06%, 98.3% { transform: translate(var(--mc-a), var(--mc-y)); background-image: var(--mc-mist); }
  98.31%, 100% { transform: translate(var(--mc-a), var(--mc-y)); background-image: var(--mc-actor-sprite); }
}
'''
# Perimeter flight: vertical runs stay at the extreme edges; crossings pass
# above the composer. In active chats, the top strip is reserved.
flight=[(0,0,83),(10,0,55),(23,0,0),(34,42,0),(45,98,0),(53,98,30),(59,98,72),(67,98,88),(78,98,0),(88,0,0),(100,0,83)]
css+='@keyframes t3-minecraft-fly {\n'+'\n'.join(f'{t}% {{ transform: translate(min({x}cqw, calc(100cqw - var(--mc-size) - 4px)), min({y}cqh, calc(100cqh - var(--mc-size) - 8px))); }}' for t,x,y in flight)+'\n}\n'
css+=f'''
/* Give perimeter crossings their own strip above the message rows. */
{chat}{active}{viewport} {{ box-sizing: border-box; padding-top: 82px; }}
{canvas} :is({main_composer}, [data-chat-composer-top-drawer]){main_chat_only},
[data-composer-drawer-layer] :is([data-composer-command-drawer], [data-composer-stash-drawer]) {{
  background-color: var(--mc-dock);
  border: 1px solid var(--mc-dock-edge);
  border-radius: 4px;
  box-shadow: inset 0 1px var(--mc-dock-lip), inset 0 -2px var(--mc-dock-edge);
}}
{canvas} {main_composer}{main_chat_only}:focus-within {{ border-color: var(--ring, var(--accent)); }}
:root.dark {{
  --mc-dock: #262320; --mc-dock-edge: #4b4139; --mc-dock-lip: #625749;
}}
:root:not(.dark) {{
  --mc-dock: #fbfdff; --mc-dock-edge: #a6b8c7; --mc-dock-lip: #fff;
}}
/* The main mob stays attached to the prompt. Subagents keep their own routes. */
{canvas}:has({buddy}) > {chat}::before {{ content: none; }}
{canvas} :is({buddy}){main_chat_only} {{ position: relative; }}
{canvas} :is({buddy}){main_chat_only} [data-chat-composer-body] {{
  min-height: 36px;
  padding-inline-end: 40px;
}}
{canvas} :is({buddy}){main_chat_only}::after {{
  content: "";
  position: absolute;
  inset-inline-end: 8px;
  top: 8px;
  width: 32px;
  height: 32px;
  pointer-events: none;
  image-rendering: pixelated;
  background: var(--mc-picked-buddy, var(--mc-status-buddy, var(--mc-openai-mini))) no-repeat 0 0 / 300% 100%;
  animation-play-state: var(--theme-motion-state, running);
}}
{canvas} :is({buddy})[data-mc-activity="Coding"]{main_chat_only}::after,
{canvas}{generating} :is({buddy}){main_chat_only}::after,
{canvas}:has({now_line}{main_chat_only}) :is({buddy}){main_chat_only}::after {{
  background-position-x: 100%;
  animation: t3-minecraft-tap .48s steps(1, end) infinite;
  animation-play-state: var(--theme-motion-state, running);
}}
{canvas} :is({buddy})[data-mc-activity="Reasoning"]{main_chat_only}::after,
{canvas}{generating}{thinking} :is({buddy}){main_chat_only}::after {{
  background-position-x: 50%;
  animation: t3-minecraft-ponder 1.6s steps(1, end) infinite;
  animation-play-state: var(--theme-motion-state, running);
}}
@keyframes t3-minecraft-ponder {{ 50% {{ transform: translateY(2px); }} }}
@keyframes t3-minecraft-tap {{ 50% {{ transform: translateY(-2px); }} }}
@media (prefers-reduced-motion: reduce) {{
  {all_slots},
  {canvas} :is({buddy})::after {{ animation: none !important; }}
}}
'''
reference=json.loads((ROOT/'public/downloads/nightfall-christmas.json').read_text())
dark=reference['colors'].copy();light=reference['variants']['light'].copy();light['canvas']='#e5e5e5'
theme={'version':1,'id':'blockworks','name':'Minecraft','appearance':'dark','canvas':'#101010','accent':dark['accent'],'colors':dark,'variants':{'light':light},'css':css}
assert len(css)<100000, len(css)
(ROOT/'public/downloads/blockworks.json').write_text(json.dumps(theme,indent=2)+'\n')
print(f'Minecraft CSS: {len(css):,} characters')
