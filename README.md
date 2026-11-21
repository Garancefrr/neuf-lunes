# Neuf Lunes

Application web pour femme enceinte : on photographie la liste des ingrédients d'un aliment, la carte d'un restaurant ou la liste d'ingrédients d'un produit de beauté. L'application dit ce qui est sans souci, avec prudence ou à éviter, et propose des alternatives. Pour les aliments et les cosmétiques, une photo du code-barres suffit : les ingrédients sont recherchés dans les bases publiques Open Food Facts et Open Beauty Facts. Règles : Santé publique France (2025) pour l'alimentation, ANSM pour les cosmétiques.

## Contenu

| Fichier | Rôle |
|---|---|
| `public/index.html` | La page de l'application (téléphone) |
| `api/analyse.js` | Le petit serveur : vérifie le code d'accès, envoie les photos à Claude, renvoie le verdict. La clé API reste ici. |
| `api/_consigne.js` | Les règles (aliments, cosmétiques, alternatives) envoyées à Claude |

## Mise en ligne sur Vercel

1. Sur vercel.com : **Add New** puis **Project**, et importer ce dépôt GitHub. Aucun réglage de compilation n'est nécessaire.
2. Avant de cliquer sur **Deploy**, ouvrir **Environment Variables** et ajouter :

| Nom | Valeur |
|---|---|
| `ANTHROPIC_API_KEY` | La clé créée sur console.anthropic.com (rubrique API Keys) |
| `CODE_ACCES` | Un code au choix, à donner aux personnes qui utilisent l'appli |

3. Cliquer sur **Deploy**. L'adresse obtenue (par exemple `neuf-lunes.vercel.app`) est celle à envoyer.

Pour changer le code d'accès plus tard : modifier `CODE_ACCES` dans Vercel (Settings, Environment Variables), puis relancer un déploiement.

## Coût

Chaque analyse est facturée par Anthropic sur la clé API, à l'usage. Il est conseillé de fixer une limite de dépense mensuelle dans console.anthropic.com (Settings, Limits).

## Avertissement

L'application aide à repérer les risques. Elle ne remplace pas l'avis d'une sage-femme ou d'un médecin.
