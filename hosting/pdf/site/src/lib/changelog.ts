// Public stable releases, newest first. Keep unpublished drafts out of this list.
// Dates and changes come from the corresponding GitHub release notes.
export const releases = [
  {
  "version": "1.4.0",
  "date": "2026-09-24",
  "dateLabel": "24 septembre 2026",
  "title": "Reprenez vos dossiers, vérifiez chaque export",
  "summary": "Des projets locaux pour reprendre votre travail, une recherche dans tous vos PDF, des profils réutilisables et une relecture avant l’enregistrement.",
  "groups": [
    {
      "title": "Reprendre un dossier",
      "items": [
        "Enregistrez un projet nommé sur votre appareil, puis rouvrez ses PDF, ses zones de caviardage, son historique d’annulation et ses pages relues.",
        "Activez, si vous le souhaitez, la récupération automatique pour la session. Une copie est enregistrée après une pause de 1,2 seconde ; le prochain lancement propose de la restaurer ou de la supprimer.",
        "Les sauvegardes sont atomiques : une interruption conserve la dernière copie complète. Les octets des PDF sont stockés une seule fois par document ouvert et partagés entre les projets qui les utilisent.",
        "Supprimez un projet ou la récupération depuis l’application. Les copies de PDF inutilisées sont retirées du stockage local.",
        "Les projets contiennent les originaux non caviardés et restent sur cet appareil. Aucun mot de passe de PDF ni identifiant de compte n’y est enregistré. Ils ne constituent pas des sauvegardes portables : effacer les données de l’application ou du navigateur les supprime. Attendez la confirmation de sauvegarde avant de fermer ; les modifications postérieures à la dernière copie ne sont pas récupérables."
      ]
    },
    {
      "title": "Naviguer et rechercher",
      "items": [
        "Une colonne de documents conserve les sous-dossiers, propose une recherche par nom et indique les états « À traiter », « Modifié », « Relu » et « Exporté ».",
        "Recherchez un texte exact dans le document courant ou tous les PDF ouverts, sans distinction de casse. Prévisualisez chaque résultat, ajustez la sélection et ajoutez les zones. L’application peut être annulée dans chaque document.",
        "Les profils réutilisables conservent vos catégories, expressions à masquer et exceptions. Les politiques prédéfinies peuvent servir de point de départ ; les profils restent locaux et peuvent être supprimés.",
        "Le texte exact et les catégories reconnues par règles fonctionnent sans modèle linguistique. La détection des personnes, lieux et organisations ainsi que l’OCR nécessitent les modèles locaux installés.",
        "Sans OCR, les images et scans ne sont pas analysés. Une zone de recherche peut couvrir toute une ligne de texte ; vérifiez les résultats et les exceptions avant de les ajouter."
      ]
    },
    {
      "title": "Vérifier avant d’exporter",
      "items": [
        "Marquez une page comme relue. Toute modification de ses zones invalide cet état ; une annulation qui restaure exactement les zones relues rétablit l’indication.",
        "Le récapitulatif d’export permet de choisir les documents, de revenir aux pages non relues et de voir le nombre de crédits correspondant aux fichiers sélectionnés.",
        "L’export de pages non marquées comme relues demande une confirmation explicite. Les documents sans zone sont signalés, car leur contenu visible restera lisible.",
        "Les crédits suivent les enregistrements réussis. Fermer le récapitulatif ou annuler le choix de destination ne consomme rien."
      ]
    },
    {
      "title": "PDF protégés et mises à jour",
      "items": [
        "Entrez le mot de passe d’un PDF directement à l’ouverture, réessayez en cas d’erreur ou ignorez le fichier pour poursuivre l’import. Un projet protégé redemande le mot de passe lors de la reprise.",
        "Sur les Mac sans mises à jour intégrées, un lien conduit au téléchargement Apple Silicon ou Intel approprié. L’historique des versions est accessible depuis l’application.",
        "La chaîne de publication vérifie les signatures configurées. Les mises à jour automatiques Mac sont activées uniquement pour les builds signés et notariés. La signature nécessite les certificats de l’éditeur ; sa préparation ne transforme pas les installateurs existants en versions signées.",
        "Les exports restent reconstruits à partir d’images caviardées, sans texte sélectionnable ni métadonnées documentaires. Les PDF, l’OCR et l’assistant restent locaux ; le compte, les crédits et les achats nécessitent Internet."
      ]
    }
  ]
},
  {
    version: "1.3.0", date: "2026-09-24", dateLabel: "24 septembre 2026",
    title: "Vos dossiers, du bureau à l’export",
    summary: "Importez des dossiers entiers, ouvrez vos PDF depuis votre système et enregistrez plusieurs documents en conservant leur organisation.",
    groups: [
      { title: "Dossiers et documents", items: [
        "Import d’un dossier et de ses sous-dossiers depuis le sélecteur ou par glisser-déposer. Seuls les PDF sont retenus ; les fichiers masqués et les liens du système de fichiers sont ignorés.",
        "Les chemins relatifs permettent de distinguer les documents qui portent le même nom. Importer à nouveau un PDF déjà ouvert conserve ses modifications, sans créer de doublon.",
        "L’espace de travail accepte jusqu’à 250 PDF et 512 Mo de fichiers source.",
      ] },
      { title: "Intégration à votre ordinateur", items: [
        "Windows : clic droit sur un PDF pour le caviarder, sur un dossier ou son arrière-plan pour importer son contenu. Inklura PDF apparaît aussi dans « Ouvrir avec », sans remplacer votre lecteur PDF par défaut. Sous Windows 11, les actions classiques peuvent se trouver dans « Afficher plus d’options ».",
        "macOS : ouverture des PDF depuis « Ouvrir avec » dans le Finder. Les dossiers s’importent depuis l’application ou par glisser-déposer.",
        "Linux : ajout et retrait de l’intégration « Ouvrir avec » depuis le menu Fichier. Placez l’AppImage à son emplacement définitif avant de l’enregistrer. Les actions sur les dossiers dépendent du gestionnaire de fichiers.",
        "Les nouvelles sélections du système rejoignent la fenêtre déjà ouverte. Elles attendent la fin d’une analyse ou d’un export en cours, sans remplacer les documents sur lesquels vous travaillez.",
      ] },
      { title: "Export de plusieurs PDF", items: [
        "Choisissez une seule destination : l’application crée un nouveau dossier d’export et conserve les sous-dossiers. Les noms identiques sont séparés, les originaux et les exports précédents restent intacts.",
        "Si un enregistrement échoue, les copies déjà enregistrées restent disponibles et les modifications des documents restants sont conservées.",
        "Chaque PDF enregistré suit le décompte habituel des crédits. Annuler le choix de destination ne consomme aucun crédit.",
      ] },
      { title: "Performances et fiabilité", items: [
        "L’encodage des images pendant l’export est asynchrone et évite une copie intermédiaire en base64. Les zones à masquer sont regroupées par page pour limiter les recherches répétées.",
        "Les ressources de reconnaissance de texte sont libérées après utilisation et les requêtes de l’assistant en attente peuvent être annulées.",
        "Vérifications renforcées sur l’import de dossiers, les doublons, les exports partiels et l’ouverture depuis le système. Les applications empaquetées sont testées sur Windows, macOS et Linux ; l’installation et la désinstallation des menus Windows sont également vérifiées.",
      ] },
    ],
  },
  {
    version: "1.2.2", date: "2026-09-24", dateLabel: "24 septembre 2026",
    title: "Des exports sans métadonnées documentaires",
    summary: "Les nouveaux PDF exportés ne contiennent plus les informations de création ajoutées par la bibliothèque PDF.",
    groups: [
      { title: "Confidentialité des exports", items: [
        "Suppression du créateur, du producteur et des dates de création et de modification. Aucun dictionnaire Info, flux XMP ou identifiant de document PDF n’est ajouté à la copie.",
        "Les pages restent reconstruites à partir d’images déjà caviardées. Le texte d’origine, les annotations, les formulaires, les pièces jointes, les calques et les métadonnées du document source ne sont pas recopiés.",
        "Tests renforcés avec et sans zone de caviardage, sur toutes les pages du corpus et dans un audit indépendant avec pypdf et Poppler.",
      ] },
      { title: "Pour vos fichiers existants", items: [
        "Cette correction s’applique aux nouveaux exports. Pour un fichier produit avec une ancienne version, repartez de l’original, vérifiez vos zones et exportez une nouvelle copie avec une version à jour. Les fichiers déjà enregistrés ne sont pas modifiés automatiquement.",
        "Le nom du fichier et les dates du système de fichiers restent distincts des métadonnées intégrées au PDF. La copie est composée d’images : son texte n’est plus sélectionnable ni recherchable sans OCR.",
      ] },
      { title: "Sur le site", items: [
        "Ajout d’une démonstration interactive, d’une vidéo sous-titrée et d’explications détaillées sur le caviardage et le retrait des métadonnées.",
      ] },
    ],
  },
  {
    version: "1.2.1", date: "2026-09-24", dateLabel: "24 septembre 2026",
    title: "Connexion et crédits fiabilisés",
    summary: "Une connexion plus claire et une meilleure reprise des paiements et des exports après une interruption.",
    groups: [
      { title: "Connexion au compte", items: [
        "La connexion s’effectue dans votre navigateur, sur la page commune Inklura. Le compte, le code et les accès demandés sont vérifiés ; le temps restant est affiché et les codes expirés sont bloqués.",
        "Lorsque les crédits sont épuisés, votre document reste ouvert et les offres restent accessibles pour en ajouter.",
      ] },
      { title: "Paiements et enregistrements", items: [
        "Le solde se met à jour après l’ouverture du paiement et au retour dans l’application. Les crédits sont ajoutés après confirmation de Stripe.",
        "Un paiement inachevé peut être repris. Si sa page a expiré, une nouvelle tentative est possible ; les messages d’erreur sont plus précis.",
        "Les exports reprennent après reconnexion ou interruption, avec un seul crédit par fichier enregistré. Un enregistrement échoué ou annulé ne consomme aucun crédit.",
        "Prise en charge des codes promotionnels Stripe, y compris les commandes entièrement remisées, sans double attribution des crédits.",
      ] },
    ],
  },
  {
    version: "1.2.0", date: "2026-09-23", dateLabel: "23 septembre 2026",
    title: "Un compte Inklura pour vos exports",
    summary: "Lancement de la version avec compte, essai gratuit et achats en France métropolitaine.",
    groups: [
      { title: "Espace de travail", items: [
        "L’interface de bureau occupe toute la fenêtre : le document s’adapte à l’espace disponible, l’assistant dispose d’un défilement indépendant et l’export reste accessible.",
        "Les offres et les crédits sont présentés dans une fenêtre dédiée.",
      ] },
      { title: "Essai et offres", items: [
        "20 PDF d’essai par compte Inklura, une seule fois. Un crédit est consommé par export enregistré ; l’import, l’analyse et l’annulation ne consomment rien.",
        "Packs de 100, 500 ou 1 000 PDF valables 12 mois, et abonnements de 20, 100 ou 500 PDF par mois et par compte.",
        "Achats via Stripe ACTIV communication en France métropolitaine, avec prix HT et TTC, TVA de 20 % et adresse française obligatoire.",
        "Reprise des crédits après interruption et accès aux factures depuis le portail de facturation.",
      ] },
      { title: "Traitement local", items: [
        "Les PDF, l’OCR et l’assistant restent sur votre ordinateur. Internet est nécessaire pour la connexion au compte et les crédits ; une nouvelle connexion est requise après fermeture de l’application.",
        "Cette version stable remplace la préversion avec compte et l’ancienne version d’évaluation.",
      ] },
    ],
  },
];
