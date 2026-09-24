"""Independent PDF object audit using pypdf plus Poppler text extraction."""
from pathlib import Path
import json, subprocess, time
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'output/pdf'
records=json.loads((BASE/'examples/manifest.json').read_text())
report=[]
for fixture in records:
    if fixture['expect']!='valid': continue
    started=time.perf_counter()
    source=PdfReader(BASE/'examples'/fixture['file'])
    target=BASE/'redacted'/fixture['file']
    if not target.exists(): raise AssertionError(f'Missing export: {target}')
    output=PdfReader(target)
    assert len(output.pages)==fixture['pages'],fixture['file']
    root=output.trailer['/Root']
    for key in ['/AcroForm','/Names','/OpenAction','/AA','/OCProperties','/Metadata','/Outlines']:
        assert key not in root,(fixture['file'],key)
    assert not output.attachments,fixture['file']
    assert not output.get_fields(),fixture['file']
    assert output.metadata is None,(fixture['file'],'document metadata remains')
    assert '/Info' not in output.trailer,(fixture['file'],'Info dictionary remains')
    assert '/ID' not in output.trailer,(fixture['file'],'document identifier remains')
    for p,page in enumerate(output.pages):
        assert not page.extract_text(),(fixture['file'],p,'text remains')
        assert not page.get('/Annots'),(fixture['file'],p,'annotations remain')
        assert '/Metadata' not in page,(fixture['file'],p,'page metadata remains')
        resources=page['/Resources']
        assert not resources.get('/Font'),(fixture['file'],p,'fonts remain')
        images=resources['/XObject']
        assert len(images)==1,(fixture['file'],p,'extra objects')
        image=next(iter(images.values())).get_object()
        assert image['/Subtype']=='/Image'
        assert '/Metadata' not in image,(fixture['file'],p,'image metadata remains')
        assert '/SMask' not in image and '/Mask' not in image
        assert image['/Width']<=8192 and image['/Height']<=8192
        assert image['/Width']*image['/Height']<=24000000,(fixture['file'],'canvas cap exceeded')
        operations=page.get_contents().operations
        assert all(op in [b'q',b'Q',b'cm',b'Do'] for _,op in operations),(fixture['file'],operations)
        assert sum(op==b'Do' for _,op in operations)==1
    # Third implementation verifies there is no extractable text in the saved PDF.
    text=subprocess.run(['pdftotext',str(target),'-'],check=True,capture_output=True).stdout
    assert not text.strip(),(fixture['file'],'Poppler found text')
    if fixture['family']=='forms': assert source.get_fields(), 'Form fixture must actually contain fields'
    if fixture['family']=='attachments': assert source.attachments, 'Attachment fixture must actually contain attachments'
    if fixture['family']=='annotations': assert source.pages[0].get('/Annots'), 'Annotation fixture must contain annotations'
    if fixture['family']=='scanned': assert not source.pages[0].extract_text().strip(), 'Scan must be image only'
    if fixture['family']=='scanned-ocr': assert 'HIDDEN_OCR' in source.pages[0].extract_text(), 'OCR fixture must contain hidden text'
    report.append({'file':fixture['file'],'pages':len(output.pages),'passed':True,'seconds':round(time.perf_counter()-started,3)})
summary={'parser':'pypdf + Poppler pdftotext','documents':len(report),'pages':sum(r['pages'] for r in report),'allPassed':True,'checks':report}
(ROOT/'output/test-report').mkdir(exist_ok=True,parents=True)
(ROOT/'output/test-report/independent-audit.json').write_text(json.dumps(summary,indent=2))
print(f'Independent audit passed: {summary["documents"]} PDFs, {summary["pages"]} pages; no source text, metadata, forms, attachments, annotations, or extra image layers retained.')
