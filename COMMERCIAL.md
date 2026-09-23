# Inklura PDF — proposition commerciale

Proposition du 23 septembre 2026, **à valider avant activation**. Aucun de ces prix n’est publié dans le catalogue d’achat, ni créé dans Stripe. La version publique 1.1.0 reste une version d’évaluation sans quota ; le compte et la facturation sont en cours d’intégration.

## Grille proposée, en euros HT

| Offre | Documents par compte | Prix proposé | Coût par PDF si tout est utilisé |
|---|---:|---:|---:|
| Essai | 20, une seule fois | Gratuit | — |
| Volume 100 | 100, valables 12 mois | 29 € | 0,290 € |
| Volume 500 | 500, valables 12 mois | 99 € | 0,198 € |
| Volume 1 000 | 1 000, valables 12 mois | 149 € | 0,149 € |
| Entreprise 20 | 20 / mois | 4,90 € / mois | 0,245 € |
| Entreprise 100 | 100 / mois | 14,90 € / mois | 0,149 € |
| Entreprise 500 | 500 / mois | 39,90 € / mois | 0,0798 € |

Les packs conviennent à un besoin ponctuel. L’abonnement réduit le coût par document pour un usage régulier. Le palier de 100 documents met l’offre professionnelle à un prix accessible ; le palier de 500 vise une utilisation fréquente de l’assistant local. Ces prix sont une hypothèse commerciale, pas un calcul de rentabilité : mesurer activation, consommation, assistance et résiliation avant de les figer à long terme.

## Règles

Quotas et unité approuvés par le porteur du projet : 20 PDF d’essai par compte Inklura, packs de 100/500/1 000 valables 12 mois, abonnements de 20/100/500 par mois et par compte, un crédit consommé à l’export réussi.

- Un PDF exporté = un crédit, quel que soit son nombre de pages. Un lot de cinq PDF enregistré intégralement = cinq crédits.
- Importer, analyser, dessiner et annuler l’enregistrement ne consomme rien. Un fichier qui échoue à l’enregistrement ne consomme rien.
- Un nouvel export du même fichier est un nouvel usage facturable. Une reprise technique du même enregistrement ne doit jamais compter deux fois.
- Les quotas appartiennent au compte, pas à l’ordinateur. Reconnexion ou réinstallation ne réinitialisent pas l’essai.
- Les PDF restent locaux. L’autorisation d’export et le solde nécessitent Internet dans la future version avec compte.

Modalités proposées à présenter avec les prix : pas de report mensuel, packs cumulables, utilisation des crédits expirant le plus tôt, abonnement mensuel résiliable pour la prochaine échéance, pas de quota mutualisé entre comptes. Le portail Stripe doit proposer résiliation et moyens de paiement ; ne pas activer les changements de formule au prorata avant leur implémentation.

## Repères concurrents

Tarifs consultés le 23 septembre 2026. Les devises, taxes, engagements et périmètres diffèrent : ce ne sont pas des offres équivalentes.

| Produit | Tarif affiché | Lecture pour Inklura |
|---|---|---|
| [Adobe Acrobat Pro](https://www.adobe.com/fr/acrobat/pricing.html) | 23,99 € TTC / mois avec engagement annuel et paiement mensuel ; 35,99 € TTC / mois sans engagement annuel | Suite PDF complète. Ne pas prétendre être systématiquement moins cher à gros volume. |
| [PDF Expert](https://pdfexpert.com/pricing) | 84,99 € / an ; 149,99 € en achat unique pour Mac uniquement | L’achat unique existe déjà ; le renouvellement et certaines nouvelles fonctions ont des conditions distinctes. La page consultée ne détaille pas ici le traitement fiscal. |
| [PDF-XChange Editor Plus](https://www.pdf-xchange.com/product/pdf-xchange-editor/pricing) | 71 € hors TVA, licence individuelle avec un an de maintenance inclus | Une licence de bureau peu chère constitue une alternative à la tarification par document. |
| [Redactable](https://www.redactable.com/pricing) | Essai de trois documents ; offres par volume et par mois | Confirme la pertinence commerciale d’une unité « document » pour le caviardage. La page contient des montants de départ divergents : ne pas reprendre un prix sans confirmation. |

Positionnement recommandé : caviardage spécialisé, assistant IA et OCR exécutés localement, simplicité du parcours et intégration au compte Inklura. Le prix ne doit pas laisser entendre qu’une revue humaine est devenue inutile.

## État et activation

Le dépôt contient le service de crédits, l’authentification du compte Inklura, le parcours Stripe et les tests de reprise. Aucun service de facturation n’est déployé et aucun achat réel n’est activé. Il reste à enregistrer le client OAuth dédié, déployer le service et ses sauvegardes, configurer Stripe en test et réaliser un paiement complet en environnement de test. Voir [le guide technique](server/README.md).

La publication d’une nouvelle version avec comptes nécessite ensuite la validation des tarifs et modalités, les identifiants Stripe correspondants, puis l’activation explicite. L’ancienne version 1.1.0 et le code public peuvent toujours fonctionner sans quota ; cette intégration ne constitue pas une protection contre la modification du logiciel.
