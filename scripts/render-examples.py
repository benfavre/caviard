"""Render every valid source's first page, plus representative exports, with Poppler."""
from pathlib import Path
import json,subprocess
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'output/pdf';PREV=BASE/'previews';PREV.mkdir(exist_ok=True)
records=[r for r in json.loads((BASE/'examples/manifest.json').read_text()) if r['expect']=='valid']
def render(record):
    stem=Path(record['file']).stem
    subprocess.run(['pdftoppm','-f','1','-singlefile','-scale-to','500','-png',str(BASE/'examples'/record['file']),str(PREV/stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    return stem
with ThreadPoolExecutor(max_workers=4) as executor: list(executor.map(render,records))
# Separate sheets keep labels readable rather than squeezing the whole corpus into one image.
representatives=[r for r in records if r.get('variant')==1]
for index in range(0,len(representatives),12):
    chunk=representatives[index:index+12];sheet=Image.new('RGB',(1200,3*450),'#e8edf2');draw=ImageDraw.Draw(sheet)
    for i,record in enumerate(chunk):
        img=Image.open(PREV/(Path(record['file']).stem+'.png'));img.thumbnail((270,400))
        x=(i%4)*300+15;y=(i//4)*450+25;sheet.paste(img,(x+(270-img.width)//2,y));draw.text((x,y+405),record['file'],fill='black')
    sheet.save(PREV/f'contact-sheet-{index//12+1}.png')
for record in representatives[:12]:
    target=BASE/'redacted'/record['file']
    if target.exists(): subprocess.run(['pdftoppm','-f','1','-singlefile','-scale-to','500','-png',str(target),str(PREV/('redacted-'+Path(record['file']).stem))],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
print(f'Rendered {len(records)} source previews with Poppler and representative redacted outputs.')
