#!/usr/bin/env python3
"""Point the existing Tools catalog at the independent PDF website."""
from pathlib import Path
import sys
site=Path(sys.argv[1]);home=site/'src/app/page.tsx';source=home.read_text()
old='href={`/${t.id}`}';new='href={t.id === "inklura-pdf" ? "https://pdf.inklura.fr/" : `/${t.id}`} '
if new not in source:
    assert source.count(old)==1, 'Tools catalog changed; review integration'
    source=source.replace(old,new)
    home.write_text(source)
print('Tools catalog points to pdf.inklura.fr')
legacy=site/'src/app/inklura-pdf/page.tsx'
legacy.write_text(Path(__file__).with_name('deploy').joinpath('legacy-page.tsx').read_text())
