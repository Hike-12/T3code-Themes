"""Build the self-contained Minecraft theme with Pillow."""
from base64 import b64encode
from io import BytesIO
from pathlib import Path
import json
from PIL import Image, ImageColor, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(__file__).with_name('assets') / 'minecraft'

def data_url(data, media_type):
    return f'url("data:{media_type};base64,{b64encode(data).decode()}")'

def sprite_url(image):
    out = BytesIO()
    image.save(out, 'PNG', optimize=True)
    return data_url(out.getvalue(), 'image/png')

def mini_mob(key):
    # Three 16px frames use the same silhouette and change the eyes and pose.
    colors = {
        'openai': ('#d6cec0', '#a39b89', '#738856', '#643e36'),
        'claude': ('#d58c62', '#9e593e', '#f0ae76', '#492b26'),
        'gemini': ('#73dbeb', '#3398bd', '#bff2f1', '#285780'),
        'opencode': ('#584b61', '#392f40', '#756080', '#f0a3fb'),
        'creeper': ('#78ad59', '#49763c', '#a1cb72', '#24331d'),
        'fox': ('#d88e50', '#a25335', '#f6e4c6', '#392520'),
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
        elif key == 'creeper':
            draw.rectangle((5, 8, 10, 13), fill=shade)
            draw.rectangle((4, 12, 6, 14), fill=body)
            draw.rectangle((9, 12, 11, 14), fill=body)
            draw.rectangle((3, 2, 12, 10), fill=body)
            draw.rectangle((4, 3, 5, 4), fill=detail)
            draw.rectangle((7, 7, 8, 9), fill=eyes)
        elif key == 'fox':
            draw.rectangle((4, 2, 6, 6), fill=shade)
            draw.rectangle((9, 2, 11, 6), fill=shade)
            draw.rectangle((4, 5, 11, 11), fill=body)
            draw.rectangle((5, 9, 10, 12), fill=detail)
            draw.point((8, 10), fill=eyes)
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
        if stage == 2:
            draw.line((12, 14, 15, 9), fill='#b9845d')
            draw.line((13, 8, 15, 9), fill='#6acfe8')
        for x in (5, 9):
            draw.rectangle((x, eye_y - (stage == 2), x + 1, eye_y), fill=eyes)
        sheet.paste(frame, (stage * 16, 0))
    return sheet


mobs = ('openai', 'claude', 'gemini', 'opencode', 'creeper', 'fox')
assets = {mob: sprite_url(mini_mob(mob)) for mob in mobs}

# Each icon occupies a 16px box and replaces only the existing control glyph.
icons = {
    'craft': ('#754a32', '#c38c59', ['..dddddddddd..', '.dlllllllllld.', '.dlllddlldlld.', '.dlllddlldlld.',
                                  '.dddddddddddd.', '.dldllddllld.', '.dldllddllld.', '.dldllddllld.', '.dddddddddddd.']),
    'book': ('#753d90', '#dca5f0', ['..ddddddddd...', '..dlllllllld..', '..dlddddlld...', '..dlllllld....',
                                 '..ddllldd.....', '..dlllllld....', '..dddddddd....']),
    'repeater': ('#464d59', '#ee6464', ['...l......l...', '..lll....lll..', '...l......l...', '..dddddddddd..',
                                     '.dddddddddddd.', '.dddddddddddd.']),
    'paper': ('#928b80', '#f0e8d8', ['...dddddddd...', '...dlllllld...', '...dldddl ld...', '...dlllll ld...',
                                   '...dldddl ld...', '...dlllllld...', '...dddddddd...']),
    'emerald': ('#227752', '#70e5a9', ['.....dddd.....', '....dllll d....', '...dllllll d...', '...dllllll d...',
                                     '....dllll d....', '.....dddd.....']),
    'command': ('#966148', '#e3aa81', ['..dddddddddd..', '..dllllllll d..', '..dlddddlll d..', '..dldlldlll d..',
                                     '..dlddddlll d..', '..dllllllll d..', '..dddddddddd..']),
}
for key, (dark, light, rows) in icons.items():
    icon = Image.new('RGBA', (16, 16))
    palette = {'d': ImageColor.getcolor(dark, 'RGBA'), 'l': ImageColor.getcolor(light, 'RGBA')}
    for y, row in enumerate(rows, (16 - len(rows)) // 2):
        for x, pixel in enumerate(row.replace(' ', ''), 1):
            if pixel in palette:
                icon.putpixel((x, y), palette[pixel])
    assets[key] = sprite_url(icon)

css = '/* Silkscreen license\n' + (ASSETS / 'silkscreen-OFL.txt').read_text(encoding='utf-8') + '\n*/\n'
css += '@font-face { font-family: "Minecraft UI"; font-display: swap; src: '
css += data_url((ASSETS / 'silkscreen.woff2').read_bytes(), 'font/woff2') + " format('woff2'); }\n"
css += ':root {\n' + '\n'.join(f'--mc-{key}: {value};' for key, value in assets.items()) + '\n}\n'
css += (ASSETS / 'theme.css').read_text(encoding='utf-8')

dark = {
    'canvas': '#121316', 'text': '#e8eaee', 'textMuted': '#a4aab6',
    'chrome': '#191b20', 'toolbar': '#191b20', 'toolbarForeground': '#e8eaee',
    'toolbarBorder': '#252830', 'toolbarControl': '#202229', 'toolbarControlHover': '#292d35',
    'sidebar': '#191b20', 'sidebarForeground': '#e8eaee', 'sidebarMutedForeground': '#a4aab6',
    'sidebarRowActive': '#252830', 'sidebarRowSelected': '#252830', 'sidebarRowHover': '#202229',
    'sidebarBorder': '#252830', 'sidebarControlSurface': '#202229',
    'surface': '#191b20', 'surfaceRaised': '#191b20', 'surfaceOverlay': '#202229',
    'messageSurface': '#26211c', 'messageForeground': '#eee9e1',
    'border': '#252830', 'input': '#191b20', 'focus': '#38bdf8',
    'accent': '#38bdf8', 'accentForeground': '#10191f', 'accentSurface': '#1c2a32',
    'secondary': '#202229', 'secondaryForeground': '#e8eaee', 'muted': '#252830',
    'mutedForeground': '#a4aab6', 'secondaryLabel': '#a4aab6', 'placeholder': '#a4aab6',
    'iconMuted': '#a4aab6', 'codeBackground': '#15171b', 'codeForeground': '#e8eaee',
    'messageAction': '#d92b2b', 'messageActionHover': '#bf2525', 'messageActionForeground': '#fff',
    'terminalBackground': '#121316', 'terminalForeground': '#e8eaee',
}
light = {
    'canvas': '#e8e9ec', 'text': '#20232a', 'surfaceRaised': '#f8f9fb',
    'textMuted': '#505663', 'toolbar': '#f1f2f5', 'toolbarBorder': '#bac0cb',
    'messageSurface': '#e9dfd4', 'messageForeground': '#2f251d',
    'accent': '#116587', 'accentForeground': '#fff',
}
theme = {
    'version': 1, 'id': 'blockworks', 'name': 'Minecraft', 'appearance': 'dark',
    'canvas': dark['canvas'], 'accent': dark['accent'], 'colors': dark,
    'variants': {'light': light}, 'css': css,
}
assert len(css) < 100000, len(css)
(ROOT / 'public/downloads/blockworks.json').write_text(json.dumps(theme, indent=2) + '\n')
print(f'Minecraft CSS: {len(css):,} characters')
