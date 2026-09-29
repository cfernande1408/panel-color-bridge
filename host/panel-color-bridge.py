#!/usr/bin/env python3
"""Host de native messaging: recibe el color desde Firefox y lo deja en
$XDG_RUNTIME_DIR/panel-color-bridge/color para la extensión de GNOME."""
import json
import os
import re
import struct
import sys

COLOR_RE = re.compile(
    r'^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\))$')

base = os.path.join(os.environ.get('XDG_RUNTIME_DIR', '/tmp'), 'panel-color-bridge')
os.makedirs(base, mode=0o700, exist_ok=True)
path = os.path.join(base, 'color')


def write(value):
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        f.write(value)
    os.replace(tmp, path)


def read_message():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    size = struct.unpack('<I', raw)[0]
    return json.loads(sys.stdin.buffer.read(size))


while True:
    msg = read_message()
    if msg is None:
        break
    color = str(msg.get('color') or '').strip()
    write(color if COLOR_RE.match(color) else '')

write('')  # Firefox cerrado: la barra vuelve a su color normal
