"""Deterministic, synthetic-only PDF corpus. No external or personal documents."""
from pathlib import Path
import io, json, random, hashlib, zipfile
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import NameObject, NumberObject, RectangleObject
from pypdf.annotations import Text, Link

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/examples'
OUT.mkdir(parents=True, exist_ok=True)
FAMILIES = ['invoice', 'contract', 'medical', 'bank-statement', 'resume', 'table',
            'scanned', 'scanned-ocr', 'images', 'transparency', 'vector-art', 'tiny-text',
            'embedded-font', 'rotation-90', 'rotation-180', 'rotation-270', 'mixed-rotation',
            'cropbox', 'offset-mediabox', 'forms', 'annotations', 'attachments', 'metadata', 'landscape']
SIZES = [(420,594),(595,842),(360,480),(612,792),(500,500),(420,700)]
FONT = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
if not FONT.exists():
    raise SystemExit('Install fonts-dejavu-core to generate the embedded-font fixtures.')
pdfmetrics.registerFont(TTFont('CorpusSans', str(FONT)))
manifest = []

def make(family, variant=1, pages=None, size=None, name=None):
    rng = random.Random(f'{family}-{variant}')
    name = name or f'{family}-{variant:02}'
    w,h = size or SIZES[variant-1]
    if family == 'landscape': w,h = h,w
    count = pages if pages is not None else 1 + (variant-1)%3
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(w,h), invariant=1, pageCompression=variant%2)
    c.setTitle(f'SECRET_METADATA_{name}')
    c.setAuthor('SYNTHETIC CONFIDENTIAL AUTHOR')
    boxes = []
    for p in range(count):
        if family == 'mixed-sizes': w,h = SIZES[p % len(SIZES)]; c.setPageSize((w,h))
        if family == 'blank':
            boxes.append([w*.2,h*.2,w*.7,h*.5]); c.showPage(); continue
        margin = min(36,w*.1)
        top = h - min(115,h*.4)
        box = [margin-3, top-6, w-margin+3, top+23]
        if family == 'tiny-page': box=[1,1,w-1,h-1]
        boxes.append(box)
        if family in ['scanned','scanned-ocr']:
            image=Image.new('RGB',(int(w*2),int(h*2)),'white'); draw=ImageDraw.Draw(image)
            font=ImageFont.truetype(str(FONT),22)
            draw.text((margin*2,40),'SYNTHETIC SCANNED DOCUMENT',fill='#12304a',font=font)
            draw.text((margin*2,(h-top-18)*2),'SECRET ACCOUNT 123456',fill='black',font=font)
            for row in range(9): draw.line((margin*2,(h-top+55+row*18)*2,(w-margin)*2,(h-top+55+row*18)*2),fill='#cdd8e0',width=2)
            c.drawImage(ImageReader(image),0,0,w,h)
            if family == 'scanned-ocr':
                t=c.beginText(margin,top);t.setTextRenderMode(3);t.setFont('Helvetica',12);t.textOut('SECRET_ACCOUNT_HIDDEN_OCR_123456');c.drawText(t)
        elif family != 'tiny-page':
            c.setFillColorRGB(.08,.18,.27); c.setFont('Helvetica-Bold', min(18,w/25))
            c.drawString(margin,h-40,f'SYNTHETIC {family.upper()}')
            c.setFont('Helvetica',9);c.setFillColorRGB(.4,.45,.5)
            c.drawString(margin,h-58,f'Test document {variant:02} | Page {p+1} of {count} | No real personal data')
            c.setFillColorRGB(0,0,0);c.setFont('Helvetica',min(13,w/32))
            c.drawString(margin,top, f'SECRET ACCOUNT {100000+variant*100+p}')
            c.setFont('Helvetica',min(10,(w-margin*2)/30))
            if family in ['table','invoice','bank-statement']:
                rows=min(14,int((top-60)/22))
                for row in range(rows):
                    y=top-48-row*22
                    c.setFillColorRGB(.93,.96,.98) if row%2==0 else c.setFillColorRGB(1,1,1)
                    c.rect(margin,y-5,w-margin*2,20,fill=1,stroke=0)
                    c.setFillColorRGB(.2,.25,.3)
                    c.drawString(margin+6,y,f'Item {row+1:02} - Example service')
                    c.drawRightString(w-margin-6,y,f'{rng.randint(10,999)}.00 EUR')
            else:
                samples = {
                    'contract': ['SERVICE AGREEMENT - FICTIONAL PARTIES', '1. Scope: Example Studio provides design services.', '2. Term: Twelve months from the agreed start date.', '3. Fees: 250 EUR per completed project milestone.', '4. Confidentiality: Sample clause for testing only.', '5. Termination: Either party may give 30 days notice.', 'Signed: Alex Example / Morgan Sample'],
                    'medical': ['SYNTHETIC PATIENT RECORD - NOT CLINICAL DATA', 'Patient: Camille Example   Record: TEST-00042', 'Visit type: Fictional annual review', 'Allergies: Test entry; no actual patient information', 'Observations: Placeholder results for software QA', 'Lab A: 4.2 units     Lab B: 101 units', 'Plan: This document is only a redaction test.'],
                    'resume': ['JORDAN EXAMPLE - FICTIONAL CANDIDATE', 'Contact: jordan@example.invalid', 'PROFILE', 'Sample software engineer and technical writer.', 'EXPERIENCE', '2022-2025: Example Company, software developer', 'EDUCATION', 'Example University - Computer Science', 'SKILLS', 'Testing, JavaScript, Python, documentation'],
                }
                lines=samples.get(family,[f'Public content line {row+1:02}: sample text for visual comparison.' for row in range(10)])
                font_size=min(10,(w-margin*2)/30)
                lines=[part for line in lines for part in simpleSplit(line,'Helvetica',font_size,w-margin*2)]
                for row,line in enumerate(lines[:min(14,int((top-100)/22))]):
                    c.drawString(margin,top-52-row*22,line)
            if family == 'embedded-font':
                c.setFont('CorpusSans',min(11,w/38))
                for row,text in enumerate(['Français : été, cœur, naïve, garçon.','Ελληνικά: Δοκιμαστικό έγγραφο.','Русский: пример документа.','Symbols: € £ © Ω ∑ → ✓']):
                    c.drawString(margin,90+row*19,text)
            if family == 'tiny-text':
                for sz in [1,2,3,4,6,8]:
                    c.setFont('Helvetica',sz);c.drawString(margin,50+sz*6,f'Small text {sz} pt SECRET');
            if family in ['images','transparency']:
                im=Image.new('RGBA',(160,100),(0,0,0,0));d=ImageDraw.Draw(im)
                d.rectangle((0,0,79,99),fill=(230,70,50,255));d.ellipse((50,0,149,99),fill=(40,110,230,150))
                c.drawImage(ImageReader(im),w-150,60,110,70,mask='auto')
                if family=='transparency':
                    c.saveState();c.setFillAlpha(.3);c.setFillColorRGB(.1,.2,1);c.rect(margin,top-9,w-2*margin,32,fill=1,stroke=0);c.restoreState()
            if family=='vector-art':
                for i in range(20):
                    c.setStrokeColorRGB(rng.random(),rng.random(),rng.random());c.circle(w/2,100,5+i*2,stroke=1)
            if family=='forms':
                c.acroForm.textfield(name=f'private-{p}',value='SECRET FORM VALUE',x=margin,y=80,width=w-2*margin,height=22,forceBorder=True)
                c.acroForm.checkbox(name=f'checkbox-{p}',x=margin,y=48,checked=True)
            c.setFont('Helvetica',8);c.setFillColorRGB(.5,.5,.5);c.drawString(margin,20,'Generated test fixture - safe to share')
        # A colored control outside the redacted text: verifies that unaffected content survives.
        if family not in ['tiny-page','scanned','scanned-ocr']:
            c.setFillColorRGB(.1,.7,.25);c.rect(w-65,30,24,15,fill=1,stroke=0)
        c.showPage()
    c.save()
    writer=PdfWriter(clone_from=PdfReader(buffer))
    for i,page in enumerate(writer.pages):
        rotation = {'rotation-90':90,'rotation-180':180,'rotation-270':270}.get(family,0)
        if family=='mixed-rotation': rotation=(i+variant)%4*90
        if rotation: page.rotate(rotation)
        if family=='cropbox':
            pw,ph=float(page.mediabox.width),float(page.mediabox.height)
            page.cropbox=RectangleObject([18,18,pw-18,ph-18])
        if family=='offset-mediabox':
            page.add_transformation(Transformation().translate(25,40))
            page.mediabox=RectangleObject([25,40,float(page.mediabox.width)+25,float(page.mediabox.height)+40])
            boxes[i]=[boxes[i][0]+25,boxes[i][1]+40,boxes[i][2]+25,boxes[i][3]+40]
        if family=='annotations':
            writer.add_annotation(i,Text(rect=(40,40,65,65),text='SECRET ANNOTATION CONTENT'))
            writer.add_annotation(i,Link(rect=(70,40,180,60),url='https://example.invalid/SECRET-LINK'))
    if family=='attachments': writer.add_attachment('secret.txt',b'SECRET EMBEDDED ATTACHMENT')
    if family=='metadata':
        writer.add_metadata({'/Title':'SECRET TITLE','/Subject':'SECRET SUBJECT','/Keywords':'SECRET KEYWORDS'})
        writer.add_js("/* inert synthetic test script: SECRET JAVASCRIPT */")
    path=OUT/f'{name}.pdf'
    with path.open('wb') as f: writer.write(f)
    record={'file':path.name,'family':family,'variant':variant,'expect':'valid','pages':count,'boxes':boxes,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    if family=='many-zones': record['extraZones']=500
    manifest.append(record)

for family in FAMILIES:
    for variant in range(1,7): make(family,variant)
for family,pages,size in [('hundred-pages',100,(300,400)),('many-zones',1,(595,842)),('large-page',1,(5000,5000)),('tiny-page',1,(20,20)),('long-page',1,(250,5000)),('blank',1,(420,594)),('mixed-sizes',6,None)]:
    make(family,pages=pages,size=size,name=family)
for i,password in enumerate(['test123','pässword','long-password-0123456789'],1):
    writer=PdfWriter(clone_from=OUT/'invoice-01.pdf');writer.encrypt(password,algorithm='RC4-128')
    path=OUT/f'encrypted-{i:02}.pdf'
    with path.open('wb') as f: writer.write(f)
    manifest.append({'file':path.name,'family':'encrypted','expect':'password','password':password,'pages':1})
for name,data in [('empty',b''),('not-a-pdf',b'This is plain text, not a PDF.'),('header-only',b'%PDF-1.7\n'),('truncated', (OUT/'invoice-01.pdf').read_bytes()[:80]),('broken-xref',b'%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 999 0 R >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF')]:
    path=OUT/f'invalid-{name}.pdf';path.write_bytes(data)
    manifest.append({'file':path.name,'family':'invalid','expect':'invalid'})
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
(OUT/'README.md').write_text('# Synthetic PDF example corpus\n\n'+f'{len(manifest)} PDF files generated by scripts/generate-examples.py.\n\nAll names, numbers, records, and documents are fictional. Each family has six variants with different sizes, compression, and page counts. manifest.json records expected behavior and exact redaction coordinates in PDF space.\n\nEncrypted fixtures intentionally require the passwords in the manifest. Files prefixed invalid- are deliberately damaged and should be rejected. Stress examples include 100 pages, 500 redactions, a 5000-point square page, a 20-point page, a long receipt, a blank page, and mixed sizes.\n')
with zipfile.ZipFile(ROOT/'output/pdf/example-pdfs.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for item in sorted(OUT.iterdir()):
        if item.suffix in ['.pdf','.json','.md']: archive.write(item,item.name)
print(f'Generated {len(manifest)} PDFs: {sum(x["expect"]=="valid" for x in manifest)} valid, 3 password-protected, 5 invalid.')
