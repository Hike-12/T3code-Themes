"""Offline orthographic renderer for the vendored vanilla Bedrock models.

No runtime WebGL or network requests: frames and the portal are embedded in CSS.
"""
from pathlib import Path
import json
from math import sin, cos, pi
import numpy as np
from PIL import Image, ImageDraw

ASSETS = Path(__file__).parent / 'assets/minecraft'
FRAMES = 8
SIZE = 96


def rotation(angles):
    x, y, z = np.radians(angles)
    rx = np.array([[1, 0, 0], [0, cos(x), -sin(x)], [0, sin(x), cos(x)]])
    ry = np.array([[cos(y), 0, sin(y)], [0, 1, 0], [-sin(y), 0, cos(y)]])
    rz = np.array([[cos(z), -sin(z), 0], [sin(z), cos(z), 0], [0, 0, 1]])
    return rz @ ry @ rx


def pose(kind, phase):
    s = sin(phase)
    if kind == 'iron_golem':
        return {'body': [0, 0, s * 1.5], 'head': [0, 0, -s],
                'arm0': [-s * 12, 0, 0], 'arm1': [s * 12, 0, 0],
                'leg0': [s * 28, 0, 0], 'leg1': [-s * 28, 0, 0]}
    if kind == 'copper_golem':
        # Native opposing limb movement and head compensation. No whole-sprite roll.
        return {'body': [5, cos(phase) * 8, -s * 4],
                'head': [-5, -cos(phase) * 8, s * 4],
                'right_arm': [s * 38, 0, 0], 'left_arm': [-s * 38, 0, 0],
                'right_leg': [-s * 32, 0, 0], 'left_leg': [s * 32, 0, 0]}
    if kind == 'allay':
        return {'root': [15, 0, 0], 'head': [-15, 0, 0],
                'left_wing': [0, -65 + s * 35, 0], 'right_wing': [0, 65 - s * 35, 0],
                'left_arm': [-18 + s * 5, 0, -8], 'right_arm': [-18 - s * 5, 0, 8]}
    return {'leftArm': [s * 18, 0, 0], 'rightArm': [-s * 18, 0, 0],
            'leftLeg': [-s * 18, 0, 0], 'rightLeg': [s * 18, 0, 0]}


def model_faces(kind, phase):
    data = json.loads((ASSETS / (kind + '.geo.json')).read_text())
    geo = data['minecraft:geometry'][0] if 'minecraft:geometry' in data else next(v for k, v in data.items() if k.startswith('geometry.'))
    bones = {b['name']: b for b in geo['bones']}
    texture = Image.open(ASSETS / (kind + ('.tga' if kind == 'enderman' else '.png'))).convert('RGBA')
    if kind == 'enderman':
        # Bedrock TGA packs emissivity into low alpha values (the purple eyes).
        texture.putalpha(texture.getchannel('A').point(lambda a: 255 if a else 0))
    poses = pose(kind, phase)
    faces = []
    for name, bone in bones.items():
        if bone.get('neverRender'):
            continue
        for cube in bone.get('cubes', []):
            x, y, z = cube['origin']; w, h, d = cube['size']
            inf = cube.get('inflate', 0)
            verts = np.array([[x + i * w, y + j * h, z + k * d] for k in (0, 1) for j in (0, 1) for i in (0, 1)], dtype=float)
            verts += np.array([[(-1 if i == 0 else 1) * inf, (-1 if j == 0 else 1) * inf, (-1 if k == 0 else 1) * inf] for k in (0, 1) for j in (0, 1) for i in (0, 1)])
            if kind == 'enderman':
                # Legacy humanoid base pose is supplied by the native controller.
                if name == 'head': verts[:, 1] += 14
                if name in ('leftArm', 'rightArm'): verts[:, 0] += 4 if name == 'leftArm' else -4
            current = bone
            while current:
                pivot = np.array(current.get('pivot', [0, 0, 0]), dtype=float)
                if kind == 'enderman' and current['name'] == 'head': pivot[1] += 14
                angles = poses.get(current['name'], current.get('rotation', [0, 0, 0]))
                verts = (verts - pivot) @ rotation(angles).T + pivot
                current = bones.get(current.get('parent'))
            u, v = cube['uv']
            # Vertex order follows UV top-left, top-right, bottom-right, bottom-left.
            net = [([2, 3, 1, 0], (u + d, v + d, w, h), .98),
                   ([3, 7, 5, 1], (u + d + w, v + d, d, h), .76),
                   ([6, 7, 3, 2], (u + d, v, w, d), 1.0),
                   ([7, 6, 4, 5], (u + 2*d + w, v + d, w, h), .78),
                   ([6, 2, 0, 4], (u, v + d, d, h), .8),
                   ([0, 1, 5, 4], (u + d + w, v, w, d), .65)]
            for ids, uv, shade in net:
                pts = verts[ids]
                normal = np.cross(pts[1] - pts[0], pts[3] - pts[0])
                if np.dot(normal, [.45, .35, -.78]) <= 0 and w*d*h != 0:
                    continue
                if uv[2] <= 0 or uv[3] <= 0: continue
                patch = texture.crop((round(uv[0]), round(uv[1]), round(uv[0]+uv[2]), round(uv[1]+uv[3])))
                if bone.get('mirror'): patch = patch.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                faces.append((float(np.mean(pts @ np.array([.45, .35, -.78]))), pts, patch, shade))
    return faces


def project(points):
    return points @ np.array([[.866, .18], [0, -.93], [.5, -.31]])


def paint(faces, size, bounds=None):
    projected = [project(f[1]) for f in faces]
    all_pts = np.concatenate(projected)
    lo, hi = bounds if bounds else (all_pts.min(axis=0), all_pts.max(axis=0))
    scale = min((size[0]-8)/(hi[0]-lo[0]), (size[1]-8)/(hi[1]-lo[1]))
    offset = np.array([(size[0]-(hi[0]-lo[0])*scale)/2, size[1]-4-(hi[1]-lo[1])*scale])
    image = Image.new('RGBA', size)
    for _, pts, patch, shade in sorted(faces, key=lambda f: f[0]):
        pts = (project(pts) - lo) * scale + offset
        # Affine texture mapping preserves the vanilla pixel grid on each face.
        basis = np.column_stack((pts[1]-pts[0], pts[3]-pts[0]))
        if abs(np.linalg.det(basis)) < .001: continue
        inv = np.diag(patch.size) @ np.linalg.inv(basis)
        trans = -inv @ pts[0]
        rgb = np.asarray(patch).copy()
        rgb[:,:,:3] = np.clip(rgb[:,:,:3].astype(float)*shade, 0, 255).astype('uint8')
        layer = Image.fromarray(rgb).transform(size, Image.Transform.AFFINE, (inv[0,0],inv[0,1],trans[0],inv[1,0],inv[1,1],trans[1]), Image.Resampling.NEAREST)
        image.alpha_composite(layer)
    return image


def sprite(kind):
    frames = [model_faces(kind, i*2*pi/FRAMES) for i in range(FRAMES)]
    coords = np.concatenate([project(f[1]) for fs in frames for f in fs])
    bounds = coords.min(axis=0), coords.max(axis=0)
    sheet = Image.new('RGBA', (SIZE*FRAMES, SIZE))
    for i, faces in enumerate(frames): sheet.alpha_composite(paint(faces, (SIZE,SIZE),bounds), (i*SIZE,0))
    return sheet


def portal():
    """Sword portal composed of textured blackstone, crimson planks and snow."""
    faces = []
    textures = {name: Image.open(ASSETS/(name+'.png')).convert('RGBA') for name in ['blackstone','crimson_planks','portal','snow','stone']}
    def block(x,y,z,w,h,d,kind):
        verts = np.array([[x+i*w,y+j*h,z+k*d] for k in (0,1) for j in (0,1) for i in (0,1)],dtype=float)
        for ids, shade in [([2,3,1,0],.98),([3,7,5,1],.72),([6,7,3,2],1)]:
            pts=verts[ids]; tex=textures[kind]
            if kind=='portal': tex=tex.crop((0,0,16,16))
            faces.append((float(np.mean(pts @ np.array([.45,.35,-.78]))),pts,tex,shade))
    # Shallow stepped snow ledge, without a floor extending into the chat.
    for x,y,z,w,h,d in [(-5,-1,-1,10,1,5),(-4,0,0,8,.6,4),(-3,0,-2,6,.4,3)]:block(x,y,z,w,h,d,'snow')
    # Two portal openings separated by a thick blackstone band.
    for y in range(1,15):
        block(-1.5,y,0,3,1,.28,'portal')
        for x in [-2.5,1.5]:block(x,y,-.1,1,1,.8,'blackstone' if y%4==0 else 'crimson_planks')
    for y in [1,9,15]:
        for x in range(-3,3):block(x,y,-.4,1,.8,1.4,'blackstone')
    # Broad, layered crossguard and upturned tips.
    for x,y in [(-5,15),(-4,14.5),(-3,14.2),(-2,14.8),(-1,15),(0,15),(1,14.8),(2,14.2),(3,14.5),(4,15)]:
        block(x,y,-.5,1,1,1.5,'blackstone');block(x,y+.8,-.35,1,.35,1.2,'blackstone')
    for x in [-5,4]:block(x,16,-.4,1,1,1.3,'blackstone')
    block(-1,15.7,-.7,2,1.3,1.8,'crimson_planks')
    # Grip, collars, and stepped pommel.
    for y in range(17,22):block(-.5,y,0,1,1,.8,'crimson_planks')
    for y in [17,21.5]:block(-1,y,-.25,2,.5,1.3,'blackstone')
    block(-1.5,22,-.4,3,.8,1.6,'blackstone');block(-1,22.8,-.2,2,.7,1.2,'blackstone');block(-.5,23.5,0,1,.5,.8,'blackstone')
    return paint(faces,(160,374))
