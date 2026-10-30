# Microsoft Store — fiche française en préparation

Brouillon pour le compte éditeur BEO PLUS, au 30 octobre 2026. La description,
la description courte et une fonctionnalité sont enregistrées dans Partner
Center ; la fiche reste incomplète sans captures d’écran. L’accès
BEO PLUS est confirmé et le nom a été réservé depuis le compte natif de Bruno :
produit `9PLQZNJTGPCW`, soumission `1152921505702276768` en brouillon. Les caractéristiques
ci-dessous proviennent du code et du README de cette branche ; la validation
du paquet installé reste à réaliser.

## Champs de la fiche

**Nom réservé :** Inklura PDF

**Langue :** français (France)

**Catégorie proposée :** Productivité

**Description courte :** Caviardez vos PDF sur votre ordinateur avant de les partager.

**Description :**

Inklura PDF vous aide à retirer les informations sensibles d’un document avant
de le transmettre. Importez vos PDF, tracez les zones à masquer, relisez les
pages et exportez une nouvelle copie. Votre original reste intact.

Le caviardage et l’analyse des documents s’exécutent sur votre ordinateur.
L’assistant facultatif peut proposer des noms, coordonnées et autres éléments
à masquer. Vous gardez la main sur chaque proposition : il peut manquer des
informations et une relecture de toutes les pages reste indispensable.

- Caviardage manuel de PDF numériques ou scannés.
- Recherche de texte et traitement de plusieurs documents ou dossiers.
- Assistant local et reconnaissance de texte en français et en anglais.
- Profils réutilisables, annulation et suivi de la relecture.
- Projets locaux et récupération facultative de votre travail.
- Export d’une nouvelle copie reconstruite en images, sans reprendre le texte,
  les annotations, les pièces jointes ni les métadonnées documentaires d’origine.

Le texte du PDF exporté n’est plus sélectionnable ni recherchable. Les projets
et la récupération conservent localement les PDF originaux non caviardés jusqu’à
leur suppression dans l’application.

Un compte Inklura et une connexion Internet sont nécessaires pour exporter.
Le compte comprend 20 PDF d’essai, une seule fois. Au-delà, des packs et des
abonnements payants sont proposés ; un crédit correspond à un PDF enregistré.
Les documents ne sont pas transmis au service de facturation. Consultez les
offres et leurs conditions sur https://pdf.inklura.fr/tarifs.

Le mode manuel ne nécessite pas les modèles de l’assistant. Leur téléchargement
facultatif représente environ 1,18 Go ; l’analyse fonctionne ensuite localement.
8 Go de mémoire vive sont recommandés pour l’assistant. Cette édition reçoit
ses mises à jour par le Microsoft Store, selon vos paramètres de mise à jour.

**Mots-clés proposés :** PDF ; caviardage ; confidentialité ; OCR ; documents

**Site produit :** https://pdf.inklura.fr/

**Contact intégré à l’application :** contact@inklura.fr

**Support web à vérifier :** le site produit renvoie vers ACTIV communication.
Vérifier la destination exacte et son adéquation au support de cette application
dans Partner Center.

**Politique de confidentialité :** URL dédiée encore à vérifier/fournir. La
section marketing sur le traitement local ne remplace pas une politique couvrant
aussi le compte, les crédits, le paiement, la conservation et les droits des
utilisateurs. Ne pas inventer une URL ni soumettre ce champ vide.

## Notes destinées à la certification

À adapter au paquet final et à fournir dans les champs privés de certification :

> Inklura PDF is an Electron desktop productivity application. The runFullTrust
> capability is needed for its desktop process, native file dialogs, PDF and
> folder imports, local OCR/model execution, and saving user-selected exports
> and local projects. Documents are processed locally. Network access is used
> for account authentication, export credits, billing and optional model
> downloads. This Store edition does not use the direct-download self-updater.
>
> Import a synthetic PDF, draw a redaction rectangle, review the page, sign in
> to the supplied review account and export a new PDF. The result contains
> rasterized redacted pages; the original file is unchanged. Exports require
> Internet access and account credits. Import and analysis do not consume credits.
> The optional model download is not required for manual redaction.

Fournir un compte de revue dédié avec des crédits suffisants, utilisable par
Microsoft sans intervention humaine ni paiement réel. Vérifier tout le parcours
de connexion avant d’inscrire les identifiants uniquement dans les notes privées
de certification ; ne jamais les conserver dans ce dépôt.

## Éléments nécessaires avant envoi

- Validation du paquet correspondant à l’identité réelle BEO PLUS dans le portail.
- Installation Windows et Windows App Certification Kit, puis test d’une mise
  à jour Store en conservant projets, modèles et crédits.
- Captures réelles du paquet final avec des PDF synthétiques : édition manuelle,
  suggestions de l’assistant et relecture avant export. La capture historique
  de la version 1.2.0 ne constitue pas une capture de ce paquet.
- Politique de confidentialité publique et lien de support vérifiés.
- Questionnaire d’âge, droits sur les contenus et territoires dans le portail.
  Vérifier que les territoires retenus correspondent au périmètre commercial.
- Compte de certification testé, informations de connexion et crédits.
- Tarifs et conditions actuels vérifiés dans le service déployé : le site public
  affiche maintenant une facturation annuelle pour les abonnements, alors que
  les documents commerciaux de cette branche décrivent une facturation mensuelle.
  Ne pas recopier ces anciens montants ou cadences dans le Store.

Référence produit consultée : [site Inklura PDF](https://pdf.inklura.fr/),
30 octobre 2026. Les déclarations de fonctionnement doivent être confirmées par
les tests du paquet installé avant de publier la fiche.
