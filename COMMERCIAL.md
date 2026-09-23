# Inklura PDF — offres validées

Grille et modalités **validées le 23 septembre 2026**. La version stable 1.2.0 utilise le compte Inklura et le service de crédits. Achats réservés à la France métropolitaine, TVA 20 %. Les ventes internationales restent fermées.

## Grille validée, en euros HT

| Offre | Documents par compte | Prix HT | Coût par PDF si tout est utilisé |
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
- Les PDF restent locaux. L’autorisation d’export et le solde nécessitent Internet dans la version 1.2.0.

Modalités validées à présenter avec les prix : pas de report mensuel, packs cumulables, utilisation des crédits expirant le plus tôt, abonnement mensuel résiliable pour la prochaine échéance, pas de quota mutualisé entre comptes. Le portail Stripe doit proposer résiliation et moyens de paiement ; ne pas activer les changements de formule au prorata avant leur implémentation.

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

Le service de crédits, l’authentification Inklura et les achats Stripe sont déployés. Les six offres, le portail et le webhook appartiennent au compte ACTIV communication. L’adresse française est vérifiée avant Checkout et sur les événements signés ; une adresse non admissible ne donne aucun crédit et déclenche l’annulation de l’abonnement éventuel et le remboursement du paiement. Le portail ne permet pas de modifier le pays de facturation.

Les pages Checkout de production ont été ouvertes et les totaux vérifiés : 34,80 € TTC pour Volume 100, 5,88 € TTC/mois pour Entreprise 20. Les sessions non payées et le client de vérification ont ensuite été supprimés/expirés. Aucun débit réel n’a été effectué ; les scénarios de paiement, renouvellement et remboursement sont couverts par les tests automatisés. Les clés de test Webdesign29 ne sont pas utilisées. Voir [le guide technique](server/README.md).

Seule la version stable 1.2.0 est proposée au téléchargement. Les copies de 1.1.0 déjà installées et le code public peuvent toujours fonctionner sans quota ; cette intégration ne constitue pas une protection contre la modification du logiciel.
