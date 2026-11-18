# Service de comptes et crédits Inklura PDF

Service **déployé sur outils.inklura.fr ; achats en France métropolitaine avec TVA 20 %**. Les tarifs sont validés dans [COMMERCIAL.md](../COMMERCIAL.md). La connexion réelle, les 20 crédits d’essai, la réservation/libération et le renouvellement de session ont été vérifiés le 23 septembre 2026. Aucun secret ne doit être ajouté au dépôt ou à Electron.

## Architecture

Electron ouvre le navigateur système pour la connexion par code d’appareil RFC 8628 auprès du fournisseur Inklura existant (`https://auth.1clic.pro`). Le client OAuth public dédié `inklura-pdf-desktop` est enregistré : scopes `openid profile email offline_access`, grants `urn:ietf:params:oauth:grant-type:device_code` et `refresh_token`. Aucun secret client dans l’application. Ne pas réutiliser un client confidentiel du site SEO.

Le processus principal conserve les jetons uniquement en mémoire. Le rendu React reçoit le solde et le code de connexion, jamais les jetons. Une nouvelle connexion est nécessaire après fermeture de l’application. Le service vérifie signature JWT, émetteur, audience dédiée, expiration, sujet et scope `openid`. L’identité du compte est le couple issuer/sub ; elle ne dépend pas d’un e-mail fourni par le client.

SQLite conserve comptes, crédits, réservations, exports, commandes et reçus de webhooks. Un compte reçoit 20 crédits d’essai une seule fois. Les crédits PDF ne sont pas un portefeuille monétaire Inklura partagé : aucune conversion automatique d’un solde en euros n’est implémentée.

Le traitement des documents reste local. L’API reçoit des identifiants aléatoires d’opération, jamais les fichiers, leurs noms ou leurs empreintes. Le journal de reprise local contient chemins et empreintes, avec permissions privées. Un export réserve un crédit, enregistre le fichier, puis confirme le débit. Annulation avant enregistrement : aucun débit. Erreur d’écriture : libération. Coupure après sauvegarde : maintien de la réservation puis confirmation idempotente à la prochaine synchronisation.

Les réservations ne sont pas libérées automatiquement avec le temps : une application interrompue peut déjà avoir enregistré son PDF. Une désinstallation ou la perte du journal peut donc demander une intervention sur le compte. Ce choix évite de rendre gratuitement un export déjà enregistré. L’application ne garantit pas la comptabilité contre la modification de son code, la suppression des données locales ou une panne matérielle qui perd des écritures disque.

## Lancer en développement

Node 22.16+ ou 23.8+ (SQLite natif encore marqué expérimental sur Node 22).

```bash
npm ci --prefix server
cp server/.env.example server/.env
cd server
node --env-file=.env main.mjs
```

Sans client OAuth, `/v1/config` annonce `enabled: false`. Sans Stripe et sans activation, les achats restent fermés. Aucun utilisateur fictif ni contournement d’authentification n’est disponible dans le service.

Pour l’application Electron, dans un autre terminal à la racine du dépôt :

```bash
INKLURA_PDF_ACCOUNT_API=http://127.0.0.1:4387 npm run desktop
```

Le serveur écoute uniquement sur `127.0.0.1:4387`. En production, `INKLURA_PDF_API_URL=https://outils.inklura.fr/api/inklura-pdf`. Le reverse proxy doit router ce préfixe vers le service, sans mettre les réponses en cache, avec limites de requêtes et sans enregistrer les en-têtes Authorization. Le port interne ne doit pas être exposé publiquement.

## API

| Méthode / route relative | Rôle |
|---|---|
| GET `/health` | État du processus |
| GET `/v1/config` | Configuration publique OAuth et offres disponibles |
| GET `/v1/account` | Solde du compte authentifié |
| POST `/v1/exports/reserve` | Réservation atomique, corps `{operation}` |
| POST `/v1/exports/commit` | Confirmation idempotente après sauvegarde |
| POST `/v1/exports/release` | Libération avant sauvegarde ; impossible après confirmation |
| POST `/v1/checkout` | Paiement Stripe hébergé, corps `{planId, operation, billing: {name, line1, postalCode, city, country}}` |
| POST `/v1/portal` | Portail de facturation du client authentifié |
| POST `/v1/stripe/webhook` | Corps brut signé Stripe |

L’API authentifiée exige un jeton d’accès Bearer et refuse les champs supplémentaires (montant, autre compte, nom de document, etc.). Un retour navigateur sur `/billing/success` ne crédite jamais le compte : seul le webhook signé et vérifié le fait.

## Stripe et mise en service

Le catalogue des six prix EUR HT, un portail de facturation dédié et le webhook sont créés sur le compte **ACTIV communication** enregistré dans Manage. Les paramètres globaux de Manage et ses autres produits Stripe ne sont pas modifiés. Le webhook utilise la version de payload `2022-08-01`, déjà disponible sur ce compte ancien ; les objets de paiement sont relus avec le SDK fixé par `package-lock.json` (API `2026-08-26.dahlia`). Le contrôle des factures repose sur `status: paid`.

La version 1.2.0 limite les achats aux adresses de facturation en France métropolitaine. Un taux Stripe manuel dédié de 20 %, non inclus dans le prix HT, est contrôlé avant chaque Checkout (`INKLURA_PDF_FRANCE_TAX_RATE`). Stripe Tax et les immatriculations internationales ne sont pas activés. Le service valide pays, code postal et adresse avant d’ouvrir Checkout. Il vérifie aussi l’adresse Stripe sur le paiement signé et chaque facture d’abonnement : pays non admissible = aucun crédit, compte bloqué pour revue, abonnement annulé et remboursement idempotent. Le portail dédié autorise uniquement la modification de l’e-mail, pas de l’adresse.

Les totaux des sessions Checkout live Volume 100 (34,80 € TTC) et Entreprise 20 (5,88 € TTC/mois) ont été vérifiés par API ; la première page a également été vérifiée visuellement. Ces sessions non payées ont été expirées et leur client temporaire supprimé. **Aucun débit réel n’a été effectué.** Les webhooks et remboursements sont couverts par les tests simulés ; les clés de test d’un autre compte ne sont pas utilisées.

Pour une nouvelle installation :

1. Installer les dépendances verrouillées avec `npm ci --omit=dev --prefix server`, puis copier `server/` et `electron/commerce-catalog.mjs` dans un répertoire de staging. `deploy/install.sh` installe une release, un utilisateur système dédié, le service et le timer de sauvegarde. Node 22.16+ ou 23.8+ requis ; ici `/usr/local/bin/node`.
2. Configurer `/etc/inklura-pdf.env` (root, mode 600). Pour les clés anciennes sans préfixe, `INKLURA_PDF_STRIPE_MODE=live` ou `test` est obligatoire. Un préfixe moderne contradictoire fait échouer le démarrage. Une clé live nécessite toujours l’activation distincte `INKLURA_PDF_ALLOW_LIVE_PAYMENTS=true`.
3. `provision-stripe.mjs --output=/chemin/prive/stripe-setup.json` prépare le catalogue, le portail et le webhook de façon idempotente. Exige `INKLURA_PDF_EXPECTED_STRIPE_ACCOUNT`, vérifie le compte et son environnement avant toute création ; en production, ajouter `--live --france`. Conserver le fichier privé, qui contient le secret du webhook, et installer les six prix, le portail, `INKLURA_PDF_FRANCE_TAX_RATE` et le secret dans l’environnement du service.
4. `deploy/install-proxy.py` ajoute uniquement le préfixe `/api/inklura-pdf/`, sauvegarde le vhost et valide la syntaxe avant relecture de la configuration. L’upstream nommé est nécessaire : Bext intercepte autrement le proxy littéral loopback. Ne pas redémarrer nginx/Bext.
5. Vérifier connexion, export, expiration, reprise et paiements avant ouverture. Les événements reçus en double ne créditent qu’une fois ; les paiements des autres produits sont ignorés. Les PDF restent locaux.
6. Après configuration fiscale et validation du parcours de paiement, activer **les deux** variables `INKLURA_PDF_PAYMENTS_ENABLED=true` et `INKLURA_PDF_ALLOW_LIVE_PAYMENTS=true` pour la production. Remboursement ou litige bloque les exports pour revue humaine : prévoir la procédure opérateur de régularisation avant vente. Aucun portail d’administration, remboursement partiel automatique ou mutualisation d’équipe n’est livré.
7. Construire les installateurs stables 1.2.0. L’API de production est configurée par défaut dans `package.json` ; `INKLURA_PDF_ACCOUNT_API` permet une surcharge de développement. Les anciennes copies installées de 1.1.0 restent utilisables ; elles reçoivent la mise à jour stable sous Windows/Linux, avec installation demandée par l’utilisateur. Les anciennes versions ne sont plus proposées au téléchargement.

## Exploitation déployée

- Service : `inklura-pdf.service`, loopback 4387 ; release sous `/opt/inklura-pdf/current`.
- Données : `/var/lib/inklura-pdf/inklura-pdf.sqlite`, répertoire privé ; aucun document PDF.
- Sauvegardes SQLite cohérentes : `inklura-pdf-backup.timer`, chaque jour vers 03:25 UTC, conservation 30 jours, contrôle d’intégrité. Sauvegardes locales uniquement : une copie hors serveur reste à prévoir.
- Restaurer : arrêter **uniquement** `inklura-pdf.service`, conserver la base et ses fichiers WAL/SHM, restaurer une sauvegarde vérifiée avec propriétaire `inklura-pdf`, supprimer les anciens WAL/SHM correspondants, redémarrer le service puis vérifier `/health` et un compte réel. Ne pas remplacer une base ouverte.
- La connexion Google réelle a révélé une association d’organisation obsolète sur le compte de vérification. Seule cette association a été alignée sur l’organisation canonique du même utilisateur, avec trace privée de l’ancienne valeur ; les rôles et contrôles d’identité n’ont pas été modifiés. Si d’autres comptes rencontrent `device code subject tenant mismatch`, vérifier cette cohérence dans le fournisseur d’identité.

Les packs durent 12 mois calendaires. Les quotas mensuels correspondent à la période de facture payée et ne sont pas reportés. Une réservation créée avant expiration peut se terminer après expiration. Les crédits qui expirent le plus tôt sont consommés en premier. Un abonnement actif ou en cours de paiement empêche une deuxième souscription ; le même paiement peut être repris après un redémarrage.

## Vérifications

```bash
npm --prefix server test
npm run test:desktop:unit
npx playwright test tests/e2e/account.spec.mjs
xvfb-run -a npm run test:desktop
```

Tests du service : identité signée, isolation des comptes, 20 exports, refus au 21e, concurrence entre connexions SQLite, expiration, idempotence, authenticité des webhooks, prix et compte Stripe, abonnement et remboursement. Tests Electron unitaires : reprise après panne, écriture échouée, confidentialité des jetons et absence de données PDF dans les requêtes. Tests navigateur : affichage, connexion, achats fermés/ouverts, formulaire français/TTC, travail conservé à quota épuisé et redimensionnement de l’espace de travail.

## Achats Mac App Store (préparation du 30 octobre 2026)

L’intégration est désactivée par défaut et n’a pas été déployée. Les packs
`com.benfavre.caviard.credits100`, `credits500` et `credits1000` n’expirent pas.
Les tarifs Apple sont affichés par StoreKit. Les offres Stripe restent inchangées.

- `POST /v1/apple/prepare {productId}` exige l’identité OAuth et retourne un UUID
  de compte Apple opaque, conservé dans `apple_accounts`. Electron transmet cet
  UUID comme `applicationUsername` à StoreKit.
- `POST /v1/apple/claim {transactionId}` relit la transaction auprès d’Apple et
  vérifie sa signature avec `@apple/app-store-server-library`, la racine Apple G3,
  les contrôles de révocation en ligne, l’app, le produit, le compte et le type.
  L’événement client seul n’accorde jamais de crédits. L’ajout au registre et le
  crédit sont dans la même transaction SQLite, avec une clé unique par
  environnement/transaction Apple.
- `POST /v1/apple/notifications {signedPayload}` reçoit les notifications V2
  signées. Il relit l’état actuel auprès d’Apple pour éviter qu’un ancien événement
  annule un remboursement plus récent. Les crédits remboursés inutilisés sont
  retirés ; s’ils ont été consommés/réservés, les nouveaux exports sont bloqués
  pour revue. La libération d’une réservation remboursée ne recrée aucun crédit.
  Les blocages existants ne sont pas levés par un remboursement annulé.

Pour activer : fournir `INKLURA_APPLE_IAP_KEY_FILE` (clé In-App Purchase `.p8`,
mode 600, serveur seulement), `INKLURA_APPLE_IAP_KEY_ID`,
`INKLURA_APPLE_ISSUER_ID`, puis `INKLURA_APPLE_PURCHASES_ENABLED=true`.
Configurer les notifications production et sandbox sur
`https://outils.inklura.fr/api/inklura-pdf/v1/apple/notifications` et vérifier une
notification TEST. Cette URL n’est pas encore configurée dans App Store Connect.
`INKLURA_APPLE_SANDBOX_ACCOUNTS` contient uniquement les UUID de comptes synthétiques
dédiés ; un client ne peut pas demander l’environnement sandbox. Ne jamais
transformer ces comptes en comptes clients ou partager les accès de certification
Microsoft avec Apple sans autorisation explicite.

La racine publique `certificates/AppleRootCA-G3.cer` vient de
https://www.apple.com/certificateauthority/AppleRootCA-G3.cer ; son empreinte SHA-256
est `63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179`.
Les notifications et transactions non signées sont refusées. Aucun contournement
local de signature n’est activable par variable d’environnement.

Avant le déploiement, reprendre les sauvegardes et contrôles existants, comparer
à nouveau la release en production, puis installer une release atomique en
conservant la base et les secrets existants. Les tables Apple sont additives.
Valider les achats/annulations, interruptions, doublons, mauvais compte,
remboursements et reprise après fermeture avec de vrais achats sandbox sur Mac.
Ne pas activer les achats clients tant que cette recette n’a pas réussi.
