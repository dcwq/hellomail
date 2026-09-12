#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""
Builds the skin's icon fonts from Material Symbols.

Elastic draws every icon through the font family "Icons" (Font Awesome 5)
and refers to glyphs by Font Awesome code points. Instead of remapping
hundreds of LESS variables, this script produces two small fonts in which
the Material Symbols glyphs sit at the Font Awesome code points, so every
Elastic rule (and the icon rules of bundled plugins) keeps working:

  hellomail/fonts/icons-regular.woff2   FILL 0, served as font-weight 400
  hellomail/fonts/icons-solid.woff2     served as font-weight 900: outlined
                                        (FILL 0) like Gmail, except the icons
                                        in FILLED_WHEN_SOLID, whose fill
                                        carries state (flagged star, status dot)

Inputs:
  build/roundcubemail-<ver>/skins/elastic/styles/fontawesome.less  (FA names -> code points)
  build/material-symbols/MaterialSymbolsOutlined.ttf + .codepoints (downloaded by the Makefile)
  tools/icons/map.json                                             (FA name -> Material name)

Usage: build/venv/bin/python tools/icons/build.py <elastic-styles-dir> <material-dir>
"""

import json
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._c_m_a_p import cmap_format_4
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
elastic_styles, material_dir = Path(sys.argv[1]), Path(sys.argv[2])

fa_less = (elastic_styles / 'fontawesome.less').read_text()
fa = {m.group(1): int(m.group(2), 16) for m in re.finditer(r'@fa-var-([a-z0-9-]+):\s*"\\([0-9a-f]{4})"', fa_less)}

ms = {}
for line in (material_dir / 'MaterialSymbolsOutlined.codepoints').read_text().splitlines():
    name, code = line.split()
    ms[name] = int(code, 16)

mapping = {k: v for k, v in json.loads((ROOT / 'tools/icons/map.json').read_text()).items() if not k.startswith('_')}

missing = [k for k in mapping if k not in fa] + [v for v in mapping.values() if v not in ms]
if missing:
    sys.exit('unknown icon names: ' + ', '.join(missing))

needed_ms = {ms[v] for v in mapping.values()}

# Font Awesome names whose "solid" variant stays filled in the 900 font
FILLED_WHEN_SOLID = {
    'star', 'flag', 'circle', 'check-circle', 'check-square', 'plus-square',
    'exclamation-circle', 'exclamation-triangle', 'info-circle', 'question-circle',
}


def instance(fill):
    font = TTFont(material_dir / 'MaterialSymbolsOutlined.ttf')
    font = instancer.instantiateVariableFont(font, {'FILL': fill, 'wght': 400, 'GRAD': 0, 'opsz': 24})

    options = subset.Options()
    options.layout_features = []          # code points only, no ligatures needed
    options.name_IDs = [1, 2]
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=needed_ms)
    subsetter.subset(font)
    return font


outlined, filled = instance(0), instance(1)

for name, font in (('regular', outlined), ('solid', instance(0))):
    glyph_of = font.getBestCmap()

    if name == 'solid':
        # swap in the filled outlines for the state-carrying icons
        filled_glyph_of = filled.getBestCmap()
        for fa_name in FILLED_WHEN_SOLID:
            if fa_name in mapping:
                g_out = glyph_of[ms[mapping[fa_name]]]
                g_fil = filled_glyph_of[ms[mapping[fa_name]]]
                font['glyf'][g_out] = filled['glyf'][g_fil]
                font['hmtx'][g_out] = filled['hmtx'][g_fil]
    table = cmap_format_4(4)
    table.platformID, table.platEncID, table.language = 3, 1, 0
    table.cmap = {fa[k]: glyph_of[ms[v]] for k, v in mapping.items()}
    font['cmap'].tables = [table]

    font.flavor = 'woff2'
    out = ROOT / 'hellomail/fonts' / f'icons-{name}.woff2'
    font.save(out)
    print(f'  {out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB, {len(table.cmap)} icons')
