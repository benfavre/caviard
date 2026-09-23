# Service de comptes et crédits Inklura PDF

Première intégration, testée localement, **non déployée et achats désactivés**. Les tarifs sont proposés dans [COMMERCIAL.md](../COMMERCIAL.md) et attendent validation. Aucun secret ne doit être ajouté au dépôt ou à Electron.

## Architecture

Electron ouvre le navigateur système pour la connexion par code d’appareil RFC 8628 auprès du fournisseur Inklura existant (`https://auth.1clic.pro`). Un client OAuth public dédié reste à enregistrer : scopes `openid profile email offline_access`, grants `urn:ietf:params:oauth:grant-type:device_code` et `refresh_token`. Aucun secret client dans l’application. Ne pas réutiliser un client confidentiel du site SEO.

Le processus principal conserve les jetons uniquement en mémoire. Le rendu React reçoit le solde et le code de connexion, jamais les jetons. Une nouvelle connexion est nécessaire après fermeture de l’application. Le service vérifie signature JWT, émetteur, audience dédiée, expiration, sujet et scope `openid`. L’identité du compte est le couple issuer/sub ; elle ne dépend pas d’un e-mail fourni par le client.

SQLite conserve comptes, crédits, réservations, exports, commandes et reçus de webhooks. Un compte reçoit 20 crédits d’essai une seule fois. Les crédits PDF ne sont pas un portefeuille monétaire Inklura partagé : aucune conversion automatique d’un solde en euros n’est implémentée.

Le traitement des documents reste local. L’API reçoit des identifiants aléatoires d’opération, jamais les fichiers, leurs noms ou leurs empreintes. Le journal de reprise local contient chemins et empreintes, avec permissions privées. Un export réserve un crédit, enregistre le fichier, puis confirme le débit. Annulation avant enregistrement : aucun débit. Erreur d’écriture : libération. Coupure après sauvegarde : maintien de la réservation puis confirmation idempotente à la prochaine synchronisation.

Les réservations ne sont pas libérées automatiquement avec le temps : une application interrompue peut déjà avoir enregistré son PDF. Une désinstallation ou la perte du journal peut donc demander une intervention sur le compte. Ce choix évite de rendre gratuitement un export déjà enregistré. L’application ne garantit pas la comptabilité contre la modification de son code, la suppression des données locales ou une panne matérielle qui perd des écritures disque.

## Lancer en développement

Node >= 22.13 (SQLite natif encore marqué expérimental sur Node 22).

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

1. Créer un client OAuth public dédié et vérifier une vraie connexion de bout en bout. Le fournisseur existant annonce les endpoints `/oauth2/device` et `/oauth2/token` dans sa découverte OIDC. La compatibilité est testée avec doubles de protocole, pas encore avec un compte réel sur ce nouveau client.
2. Installer le service avec un utilisateur dédié, Node, répertoire de données privé persistant, redémarrage supervisé et reverse proxy TLS. Configurer sauvegardes et tester leur restauration. Pour SQLite WAL, utiliser l’API de sauvegarde SQLite ou arrêter proprement le service avant de copier la base ; ne pas copier uniquement le `.sqlite` pendant les écritures.
3. En environnement Stripe **test**, créer les six prix en EUR : trois achats uniques, trois récurrences mensuelles sans tarification à l’usage. Les montants HT, la configuration fiscale et les conditions de vente doivent correspondre à la grille validée. Configurer les six variables `INKLURA_PDF_PRICE_*` côté serveur. L’application ne choisit ni montant ni identifiant de prix Stripe.
4. Configurer le webhook pour `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `invoice.paid`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`. Renseigner le secret du webhook. Les événements en double ne créditent qu’une fois. Le SDK est fixé par `package-lock.json` (API `2026-08-26.dahlia`). La facture est créditée uniquement avec `status: paid`, conformément au [schéma Stripe actuel](https://docs.stripe.com/api/invoices/object) ; le champ historique `paid` n’est plus utilisé.
5. Configurer Stripe Tax et le portail client : mise à jour des moyens de paiement et résiliation en fin de période. Ne pas permettre changements de palier/prorata, coupons ou essais Stripe dans ce premier parcours. Tester paiement réussi/refusé/différé, abandon puis reprise, renouvellement, résiliation, remboursement et événement rejoué avec Stripe test. Les tests automatisés utilisent de vraies signatures Stripe mais des appels REST simulés ; aucun vrai checkout Stripe n’a encore été exécuté.
6. Remboursement ou litige : le service bloque les nouveaux exports du compte pour vérification humaine. Avant la vente, prévoir une procédure opérateur pour retirer ou restaurer les crédits concernés et débloquer le compte. Aucun portail d’administration, automatisme de remboursement partiel ou mutualisation d’équipe n’est livré dans cette première étape.
7. Après validation des tarifs, les achats live nécessitent **les deux** variables `INKLURA_PDF_PAYMENTS_ENABLED=true` et `INKLURA_PDF_ALLOW_LIVE_PAYMENTS=true`, les clés live et leurs six prix. Ne jamais mettre les clés dans le client. Tester le service et son alerte de disponibilité avant de publier un installateur dépendant de lui.
8. Construire la future version avec `INKLURA_PDF_ACCOUNT_API=https://outils.inklura.fr/api/inklura-pdf`. Sans cette variable de build, le compte est désactivé et le comportement d’évaluation existant reste inchangé. Ne pas publier de version commerciale sans elle. Les installateurs 1.1.0 déjà publiés ne sont pas modifiés par cette intégration.

Les packs durent 12 mois calendaires. Les quotas mensuels correspondent à la période de facture payée et ne sont pas reportés. Une réservation créée avant expiration peut se terminer après expiration. Les crédits qui expirent le plus tôt sont consommés en premier. Un abonnement actif ou en cours de paiement empêche une deuxième souscription ; le même paiement peut être repris après un redémarrage.

## Vérifications

```bash
npm --prefix server test
npm run test:desktop:unit
npx playwright test tests/e2e/account.spec.mjs
xvfb-run -a npm run test:desktop
```

Tests du service : identité signée, isolation des comptes, 20 exports, refus au 21e, concurrence entre connexions SQLite, expiration, idempotence, authenticité des webhooks, prix et compte Stripe, abonnement et remboursement. Tests Electron unitaires : reprise après panne, écriture échouée, confidentialité des jetons et absence de données PDF dans les requêtes. Tests navigateur : affichage, connexion, achats fermés et travail conservé à quota épuisé.
