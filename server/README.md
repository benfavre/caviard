# Service de comptes et crédits Inklura PDF

Service **déployé sur outils.inklura.fr ; achats désactivés**. Les tarifs sont validés dans [COMMERCIAL.md](../COMMERCIAL.md). La connexion réelle, les 20 crédits d’essai, la réservation/libération et le renouvellement de session ont été vérifiés le 23 septembre 2026. Aucun secret ne doit être ajouté au dépôt ou à Electron.

## Architecture

Electron ouvre le navigateur système pour la connexion par code d’appareil RFC 8628 auprès du fournisseur Inklura existant (`https://auth.1clic.pro`). Le client OAuth public dédié `inklura-pdf-desktop` est enregistré : scopes `openid profile email offline_access`, grants `urn:ietf:params:oauth:grant-type:device_code` et `refresh_token`. Aucun secret client dans l’application. Ne pas réutiliser un client confidentiel du site SEO.

Le processus principal conserve les jetons uniquement en mémoire. Le rendu React reçoit le solde et le code de connexion, jamais les jetons. Une nouvelle connexion est nécessaire après fermeture de l’application. Le service vérifie signature JWT, émetteur, audience dédiée, expiration, sujet et scope `openid`. L’identité du compte est le couple issuer/sub ; elle ne dépend pas d’un e-mail fourni par le client.

SQLite conserve comptes, crédits, réservations, exports, commandes et reçus de webhooks. Un compte reçoit 20 crédits d’essai une seule fois. Les crédits PDF ne sont pas un portefeuille monétaire Inklura partagé : aucune conversion automatique d’un solde en euros n’est implémentée.

Le traitement des documents reste local. L’API reçoit des identifiants aléatoires d’opération, jamais les fichiers, leurs noms ou leurs empreintes. Le journal de reprise local contient chemins et empreintes, avec permissions privées. Un export réserve un crédit, enregistre le fichier, puis confirme le débit. Annulation avant enregistrement : aucun débit. Erreur d’écriture : libération. Coupure après sauvegarde : maintien de la réservation puis confirmation idempotente à la prochaine synchronisation.

Les réservations ne sont pas libérées automatiquement avec le temps : une application interrompue peut déjà avoir enregistré son PDF. Une désinstallation ou la perte du journal peut donc demander une intervention sur le compte. Ce choix évite de rendre gratuitement un export déjà enregistré. L’application ne garantit pas la comptabilité contre la modification de son code, la suppression des données locales ou une panne matérielle qui perd des écritures disque.

## Lancer en développement

Node >= 22.16 (SQLite natif encore marqué expérimental sur Node 22).

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
| POST `/v1/checkout` | Paiement Stripe hébergé, corps `{planId, operation}` |
| POST `/v1/portal` | Portail de facturation du client authentifié |
| POST `/v1/stripe/webhook` | Corps brut signé Stripe |

L’API authentifiée exige un jeton d’accès Bearer et refuse les champs supplémentaires (montant, autre compte, nom de document, etc.). Un retour navigateur sur `/billing/success` ne crédite jamais le compte : seul le webhook signé et vérifié le fait.

## Stripe et mise en service

Le catalogue des six prix EUR HT, un portail de facturation dédié et le webhook sont créés sur le compte **ACTIV communication** enregistré dans Manage. Les paramètres globaux de Manage et ses autres produits Stripe ne sont pas modifiés. Le webhook utilise la version de payload `2022-08-01`, déjà disponible sur ce compte ancien ; les objets de paiement sont relus avec le SDK fixé par `package-lock.json` (API `2026-08-26.dahlia`). Le contrôle des factures repose sur `status: paid`.

Les achats restent désactivés pour deux vérifications restantes :

- Activ n’a aucune immatriculation configurée dans Stripe Tax ; ses inscriptions fiscales réelles (dont OSS éventuel) sont inconnues. Faire confirmer la situation par la comptabilité puis renseigner les inscriptions applicables. Créer une inscription dans [Stripe Tax](https://docs.stripe.com/api/tax/registrations) ne réalise pas l’inscription auprès de l’administration fiscale. Ne pas inventer une inscription ni ouvrir les ventes avec un calcul incomplet.
- Les clés de test enregistrées dans Manage appartiennent à un autre compte. Elles ne sont pas utilisées. Le transport public du webhook a été vérifié avec une signature réelle et un événement synthétique sans effet, et les scénarios de paiement sont simulés dans les tests. **Aucun paiement Checkout réel ou en sandbox Activ n’a été effectué.**

Pour une nouvelle installation :

1. Installer les dépendances verrouillées avec `npm ci --omit=dev --prefix server`, puis copier `server/` et `electron/commerce-catalog.mjs` dans un répertoire de staging. `deploy/install.sh` installe une release, un utilisateur système dédié, le service et le timer de sauvegarde. Node >=22.16 requis ; ici `/usr/local/bin/node`.
2. Configurer `/etc/inklura-pdf.env` (root, mode 600). Pour les clés anciennes sans préfixe, `INKLURA_PDF_STRIPE_MODE=live` ou `test` est obligatoire. Un préfixe moderne contradictoire fait échouer le démarrage. Une clé live nécessite toujours l’activation distincte `INKLURA_PDF_ALLOW_LIVE_PAYMENTS=true`.
3. `provision-stripe.mjs --output=/chemin/prive/stripe-setup.json` prépare le catalogue, le portail et le webhook de façon idempotente. Exige `INKLURA_PDF_EXPECTED_STRIPE_ACCOUNT`, vérifie le compte et son environnement avant toute création ; en production, ajouter `--live`. Conserver le fichier privé, qui contient le secret du webhook, et installer les six prix, le portail et le secret dans l’environnement du service.
4. `deploy/install-proxy.py` ajoute uniquement le préfixe `/api/inklura-pdf/`, sauvegarde le vhost et valide la syntaxe avant relecture de la configuration. L’upstream nommé est nécessaire : Bext intercepte autrement le proxy littéral loopback. Ne pas redémarrer nginx/Bext.
5. Vérifier connexion, export, expiration, reprise et paiements avant ouverture. Les événements reçus en double ne créditent qu’une fois ; les paiements des autres produits sont ignorés. Les PDF restent locaux.
6. Après configuration fiscale et validation du parcours de paiement, activer **les deux** variables `INKLURA_PDF_PAYMENTS_ENABLED=true` et `INKLURA_PDF_ALLOW_LIVE_PAYMENTS=true` pour la production. Remboursement ou litige bloque les exports pour revue humaine : prévoir la procédure opérateur de régularisation avant vente. Aucun portail d’administration, remboursement partiel automatique ou mutualisation d’équipe n’est livré.
7. Construire les installateurs avec `INKLURA_PDF_ACCOUNT_API=https://outils.inklura.fr/api/inklura-pdf`. La préversion 1.2.0-beta.1 active les comptes avec achats fermés. Les installateurs 1.1.0 existants restent des versions d’évaluation sans compte et ne reçoivent pas la préversion automatiquement.

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

Tests du service : identité signée, isolation des comptes, 20 exports, refus au 21e, concurrence entre connexions SQLite, expiration, idempotence, authenticité des webhooks, prix et compte Stripe, abonnement et remboursement. Tests Electron unitaires : reprise après panne, écriture échouée, confidentialité des jetons et absence de données PDF dans les requêtes. Tests navigateur : affichage, connexion, achats fermés et travail conservé à quota épuisé.
