"""Public company presentation from the Kbis supplied by the dossier owner."""
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
root=Path(__file__).resolve().parents[2]
out=root/'output/pdf/beo-plus-presentation-anssi-20261030.pdf'
pdfmetrics.registerFont(TTFont('DVS','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DVSB','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyFR',fontName='DVS',fontSize=10,leading=15,spaceAfter=10))
styles.add(ParagraphStyle(name='TitleFR',fontName='DVSB',fontSize=24,leading=29,spaceAfter=12,textColor=colors.HexColor('#17374D')))
styles.add(ParagraphStyle(name='HeadingFR',fontName='DVSB',fontSize=13,leading=18,spaceBefore=12,spaceAfter=8,textColor=colors.HexColor('#17374D')))
def p(text,style='BodyFR'): return Paragraph(text,styles[style])
rows=[['Dénomination','BEO PLUS'],['Forme juridique','Société à responsabilité limitée à associé unique'],['Immatriculation','790 016 885 R.C.S. Rennes - 18 décembre 2012'],['Capital social','5 000 euros'],['Siège social','18 rue Jim Sévellec, 35740 Pacé, France'],['Activité principale déclarée au RCS','Conseils pour les affaires et autres conseils de gestion']]
t=Table([[p(a),p(b)] for a,b in rows],colWidths=[150,355])
t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(0,-1),colors.HexColor('#E6EEF3')),('LINEBELOW',(0,0),(-1,-1),0.4,colors.HexColor('#CCD7DF')),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
story=[p('BEO PLUS','TitleFR'),p('Présentation générale de la société'),p('Pièce préparée pour le dossier ANSSI n° 35079529 - 30 octobre 2026'),p('Identification de la société','HeadingFR'),t,p('Activité','HeadingFR'),p('BEO PLUS est une société française établie à Pacé. Son activité principale inscrite au registre du commerce et des sociétés est le conseil pour les affaires et autres conseils de gestion.'),p('Rôle dans le dossier Inklura PDF','HeadingFR'),p('BEO PLUS est le bénéficiaire de la déclaration relative à Inklura PDF. Le titulaire du dossier a renseigné BEO PLUS comme fabricant du logiciel. Le compte de distribution Apple utilisé pour cette application est celui de BEO PLUS.'),p('Inklura PDF est une application de traitement local et de caviardage de documents PDF. L’édition Mac concernée est la version 1.4.0, build 1.4.56, identifiée par com.benfavre.caviard. Ses fonctions et mécanismes cryptographiques sont décrits dans les brochures commerciale et technique révision 2 jointes au dossier.'),p('Sources et portée','HeadingFR'),p('Les renseignements d’identification et l’activité principale ci-dessus sont repris de l’extrait Kbis joint par le titulaire, à jour au 2 octobre 2026. Le rôle dans le dossier correspond aux informations renseignées par le titulaire et à la préparation de la distribution Apple.'),p('Cette présentation accompagne le Kbis ; elle ne le remplace pas. Elle ne constitue ni une attestation signée d’exactitude du dossier, ni un récépissé de déclaration, ni une autorisation administrative.')]
def footer(c,d):
 c.setFont('DVS',7); c.drawString(45,25,'BEO PLUS | Présentation pour relecture du titulaire | 30 octobre 2026'); c.drawRightString(A4[0]-45,25,str(d.page))
SimpleDocTemplate(str(out),pagesize=A4,leftMargin=45,rightMargin=45,topMargin=36,bottomMargin=42,title='BEO PLUS - Présentation générale pour le dossier ANSSI',author='Préparation pour BEO PLUS').build(story,onFirstPage=footer,onLaterPages=footer)
print(out)
