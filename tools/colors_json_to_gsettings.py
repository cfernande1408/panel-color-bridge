#!/usr/bin/env python3
"""Converts an old colors.json into GSettings values.

Prints one "key value" line per setting, with the value in GVariant
text format, ready for `gsettings set`. Used once by install.sh.
"""
import json
import sys


def gvariant_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def convert(data):
    out = []
    if 'opacity' in data:
        try:
            op = float(data['opacity'])
            if 0 <= op <= 1:
                out.append(('opacity', repr(op)))
        except (TypeError, ValueError):
            pass
    if 'default' in data:
        out.append(('default-color', gvariant_str(str(data['default'] or ''))))
    apps = {k: v for k, v in data.items()
            if k not in ('opacity', 'default') and isinstance(v, str)}
    pairs = ', '.join(f'{gvariant_str(k)}: {gvariant_str(v)}'
                      for k, v in apps.items())
    out.append(('app-colors', '@a{ss} {' + pairs + '}'))
    return out


if __name__ == '__main__':
    with open(sys.argv[1]) as f:
        for key, value in convert(json.load(f)):
            print(key, value)
