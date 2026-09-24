# Bien démarrer avec Inklura PDF

[Télécharger l’application](https://pdf.inklura.fr/#telecharger) · [Essayer avec des PDF fictifs](https://pdf.inklura.fr/#exemples)

Inklura PDF permet de caviarder des documents sur votre ordinateur. La version 1.3.0 nécessite un compte Inklura et offre 20 PDF d’essai par compte. Un crédit est consommé à l’export réussi ; l’import et l’analyse restent sans débit. Les packs et abonnements sont accessibles depuis « Offres et crédits », pour les adresses de facturation en France métropolitaine (TVA 20 %). L’assistant IA est facultatif : vous pouvez commencer immédiatement en dessinant les zones à masquer.

## Choisir le bon téléchargement

| Ordinateur | Fichier à choisir |
| --- | --- |
| PC Windows, processeur Intel ou AMD 64 bits | Installateur `.exe` |
| Mac avec une puce Apple (M1, M2, M3…) | `.dmg` Apple Silicon / arm64 |
| Mac avec un processeur Intel | `.dmg` Intel / x64 |
| PC Linux, processeur Intel ou AMD 64 bits | `.AppImage` |

Sur Mac, le menu Apple → **À propos de ce Mac** indique la puce ou le processeur. Les versions Linux et Windows proposées ciblent les processeurs Intel/AMD 64 bits ; il n’y a pas d’installateur natif ARM pour ces deux systèmes.

Sous Windows, ouvrez l’installateur. Sur Mac, ouvrez l’image disque et glissez Inklura PDF dans Applications. Sous Linux, autorisez l’exécution du fichier dans ses propriétés et conservez l’AppImage dans un dossier où vous avez le droit d’écrire, pour les mises à jour. Son lancement normal nécessite FUSE.

Les versions actuelles ne sont pas encore signées avec un certificat d’éditeur : Windows ou macOS peut afficher un avertissement ou empêcher l’ouverture. La page de téléchargement fournit les empreintes SHA-256 pour vérifier le fichier reçu.

## Caviarder votre premier document

1. Ouvrez Inklura PDF et importez votre PDF. Vous pouvez ajouter plusieurs fichiers et passer de l’un à l’autre.
2. Dessinez un rectangle sur chaque information à masquer. Utilisez le zoom et la navigation entre pages pour vérifier les détails.
3. Relisez **toutes les pages**, y compris celles qui ne comportent aucune zone. Vous pouvez supprimer une zone ou annuler une modification avec **Ctrl+Z** (Windows/Linux) ou **Cmd+Z** (Mac).
4. Cliquez sur **Exporter le PDF**, puis choisissez où enregistrer la nouvelle copie. Plusieurs documents donnent des exports séparés.
5. Ouvrez le résultat et vérifiez son contenu avant de le partager.

Votre original reste intact. Le PDF exporté est composé d’images : le texte PDF d’origine, les annotations, les formulaires, les pièces jointes et les métadonnées source ne sont pas conservés. Depuis la version 1.2.2, aucun dictionnaire Info, flux XMP, identifiant PDF, auteur, créateur/producteur ou date intégrée n’est ajouté à la copie. Les dates du système de fichiers et le nom du fichier restent distincts du contenu du PDF. Le texte du résultat n’est plus sélectionnable ni recherchable. Les informations qui n’ont pas été caviardées restent visibles.

## Nouveaux espaces de travail (version de développement)

Les fonctions suivantes seront disponibles dans la prochaine version ; le téléchargement public reste actuellement en 1.3.0.

**Projets et récupération.** Ouvrez ce volet, donnez un nom au projet et cliquez sur « Enregistrer le projet ». Les PDF originaux, les zones, l’historique d’annulation et les pages relues sont conservés sur cet appareil. Choisissez ensuite un projet enregistré et « Ouvrir le projet » pour reprendre. « Supprimer le projet » efface ses copies locales lorsqu’aucun autre projet ou récupération ne les utilise.

Vous pouvez cocher « Conserver une récupération automatique pendant cette session ». Une sauvegarde suit chaque pause de 1,2 seconde ; attendez le message de confirmation avant de fermer. Au prochain lancement, le volet propose de restaurer ou de supprimer la récupération. Décocher l’option efface la copie automatique. Les modifications postérieures à la dernière sauvegarde ne peuvent pas être récupérées.

Ces copies contiennent les **PDF d’origine non caviardés**. Elles ne sont pas transmises à un serveur. Leur suppression depuis l’application retire les données du stockage local ; elle ne constitue pas un effacement physique garanti du disque. Effacer les données du navigateur ou de l’application supprime également les projets. Ne les utilisez pas comme unique sauvegarde de vos originaux.

**Dossiers.** La colonne des documents conserve les sous-dossiers, permet une recherche par nom et affiche « À traiter », « Modifié », « Relu » ou « Exporté ». Cliquez sur un fichier pour l’afficher ; les zones des autres fichiers restent disponibles.

**Rechercher et profils.** Pour un texte exact, saisissez un nom ou une référence, choisissez le document courant ou tous les documents, puis lancez la recherche. La casse est ignorée. Sans OCR, les scans et les images ne sont pas analysés. Prévisualisez les résultats avec « Voir la zone », ajustez la sélection et ajoutez les résultats aux zones. L’ajout peut être annulé dans chaque document.

Dans « Profils réutilisables », choisissez les catégories, les expressions à masquer et les exceptions (une par ligne). Enregistrez un profil nommé pour le réutiliser sur cet appareil, ou supprimez-le. La détection des personnes, lieux et organisations ainsi que l’OCR demandent les modèles locaux ; le texte exact et les catégories détectées par règles fonctionnent sans ceux-ci.

**Relire et exporter.** Cochez « Page relue » après vérification. Toute modification des zones de cette page invalide cette indication. Le récapitulatif d’export permet de sélectionner les PDF, de revenir aux pages à relire et de voir le nombre de crédits nécessaires si tous les enregistrements réussissent. Confirmez explicitement si vous choisissez d’exporter des pages non marquées comme relues. Aucun crédit n’est réservé avant la confirmation et le choix de destination.

**PDF protégés.** Le mot de passe est demandé à l’ouverture. En cas d’erreur, réessayez ou ignorez le fichier pour poursuivre l’import. Les projets conservent les octets du PDF protégé, sans le mot de passe : celui-ci sera demandé à nouveau lors de la reprise.

## Activer l’assistant local

Dans **Assistant local**, cliquez sur **Installer les modèles**. Le téléchargement initial représente environ **1,18 Go** ; prévoyez l’espace disponible correspondant. Une fois les modèles installés, l’analyse fonctionne hors ligne. Les modèles restent installés après une mise à jour de l’application. Une mémoire vive de 8 Go est conseillée.

| Mode | Comment l’utiliser |
| --- | --- |
| **Suggestions** | Choisissez les catégories, lancez la recherche, relisez les résultats et ajoutez la sélection à l’aperçu. |
| **Politique automatique** | Choisissez une politique et sa portée, puis vérifiez les zones préparées. Son application peut être annulée en une étape. |
| **Instruction libre** | Décrivez les catégories à masquer, vérifiez le plan proposé, ajustez-le si nécessaire puis lancez l’analyse. |

Exemple : « Masque les noms, les adresses e-mail et les téléphones ». Les recherches ou exceptions portant sur un texte exact doivent utiliser des guillemets : `Masque les noms sauf « Inklura »`.

Les propositions bleues ne sont pas exportées : il faut les ajouter à l’aperçu pour créer les zones noires. L’assistant ne comprend pas toutes les relations métier d’un document ; il ne peut pas distinguer automatiquement un client d’un fournisseur à partir de son rôle.

L’OCR français/anglais permet d’analyser les scans et les PDF mêlant texte et images. Une image floue, une écriture manuscrite ou une mise en page inhabituelle peut réduire la qualité du résultat. Zéro suggestion ne signifie pas que le document est exempt d’informations sensibles. Certains résultats couvrent une ligne entière : ajustez vos zones manuellement si nécessaire.

## Questions fréquentes

**Mon PDF ne s’ouvre pas.** Un fichier protégé par mot de passe doit être déverrouillé avant son import. Vérifiez aussi qu’il s’ouvre dans un lecteur PDF et qu’il ne s’agit pas d’un fichier endommagé.

**L’analyse est lente.** La durée dépend du nombre de pages, de l’OCR et de votre ordinateur. Commencez par une seule page pour vérifier le résultat ; l’analyse peut être annulée. Vous pouvez toujours caviarder à la main.

**Le téléchargement des modèles a été interrompu.** Relancez l’installation. Les fichiers déjà terminés et vérifiés sont réutilisés ; le fichier incomplet est téléchargé à nouveau.

**Le texte du PDF exporté ne se sélectionne plus.** C’est le fonctionnement prévu de l’export en images. Il évite de conserver le texte PDF caché sous les zones noires.

**Comment mettre l’application à jour ?** Windows et Linux disposent des mises à jour intégrées. Exportez vos modifications avant de redémarrer pour installer la mise à jour. Sur macOS, téléchargez la nouvelle version depuis la [page Inklura PDF](https://pdf.inklura.fr/).

**Que reçoit un serveur ?** Aucun PDF, texte extrait ou instruction n’est envoyé. Les téléchargements de modèles et les vérifications de mises à jour utilisent Internet. Le traitement s’exécute sur votre appareil, sans télémétrie. La connexion au compte, le solde et la facturation utilisent aussi Internet, sans envoyer le contenu des documents. [Détails techniques](AI.md).

## Signaler un problème

[Ouvrir un signalement sur GitHub](https://github.com/benfavre/caviard/issues/new/choose). Indiquez votre système, la version d’Inklura PDF, les étapes et le résultat attendu. Reproduisez si possible avec l’un des 171 PDF fictifs proposés. Les signalements GitHub sont publics : ne joignez pas de document confidentiel.

Sponsored by [Webdesign29](https://www.webdesign29.net/), [Inklura](https://www.inklura.fr/) et [ACTIV communication](https://www.activ-communication.com/).
