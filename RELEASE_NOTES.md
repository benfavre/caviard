# Inklura PDF 1.4.0 — projets, recherche et relecture

[Télécharger pour Windows, macOS et Linux](https://pdf.inklura.fr/)

## Reprendre un dossier

- Enregistrez un projet nommé sur votre appareil, puis rouvrez ses PDF, ses zones de caviardage, son historique d’annulation et ses pages relues.
- Activez, si vous le souhaitez, la récupération automatique pour la session. Une copie est enregistrée après une pause de 1,2 seconde ; le prochain lancement propose de la restaurer ou de la supprimer.
- Les sauvegardes sont atomiques : une interruption conserve la dernière copie complète. Les octets des PDF sont stockés une seule fois par document ouvert et partagés entre les projets qui les utilisent.
- Supprimez un projet ou la récupération depuis l’application. Les copies de PDF inutilisées sont retirées du stockage local.

Les projets contiennent les **originaux non caviardés** et restent sur cet appareil. Aucun mot de passe de PDF ni identifiant de compte n’y est enregistré. Ils ne constituent pas des sauvegardes portables : effacer les données de l’application ou du navigateur les supprime. Attendez la confirmation de sauvegarde avant de fermer ; les modifications postérieures à la dernière copie ne sont pas récupérables.

## Naviguer et rechercher

- Une colonne de documents conserve les sous-dossiers, propose une recherche par nom et indique les états « À traiter », « Modifié », « Relu » et « Exporté ».
- Recherchez un texte exact dans le document courant ou tous les PDF ouverts, sans distinction de casse. Prévisualisez chaque résultat, ajustez la sélection et ajoutez les zones. L’application peut être annulée dans chaque document.
- Les profils réutilisables conservent vos catégories, expressions à masquer et exceptions. Les politiques prédéfinies peuvent servir de point de départ ; les profils restent locaux et peuvent être supprimés.
- Le texte exact et les catégories reconnues par règles fonctionnent sans modèle linguistique. La détection des personnes, lieux et organisations ainsi que l’OCR nécessitent les modèles locaux installés.

Sans OCR, les images et scans ne sont pas analysés. Une zone de recherche peut couvrir toute une ligne de texte ; vérifiez les résultats et les exceptions avant de les ajouter.

## Vérifier avant d’exporter

- Marquez une page comme relue. Toute modification de ses zones invalide cet état ; une annulation qui restaure exactement les zones relues rétablit l’indication.
- Le récapitulatif d’export permet de choisir les documents, de revenir aux pages non relues et de voir le nombre de crédits correspondant aux fichiers sélectionnés.
- L’export de pages non marquées comme relues demande une confirmation explicite. Les documents sans zone sont signalés, car leur contenu visible restera lisible.
- Les crédits suivent les enregistrements réussis. Fermer le récapitulatif ou annuler le choix de destination ne consomme rien.

## PDF protégés et mises à jour

- Entrez le mot de passe d’un PDF directement à l’ouverture, réessayez en cas d’erreur ou ignorez le fichier pour poursuivre l’import. Un projet protégé redemande le mot de passe lors de la reprise.
- Sur les Mac sans mises à jour intégrées, un lien conduit au téléchargement Apple Silicon ou Intel approprié. L’historique des versions est accessible depuis l’application.
- La chaîne de publication vérifie les signatures configurées. Les mises à jour automatiques Mac sont activées uniquement pour les builds signés et notariés. La signature nécessite les certificats de l’éditeur ; sa préparation ne transforme pas les installateurs existants en versions signées.

Les exports restent reconstruits à partir d’images caviardées, sans texte sélectionnable ni métadonnées documentaires. Les PDF, l’OCR et l’assistant restent locaux ; le compte, les crédits et les achats nécessitent Internet.
