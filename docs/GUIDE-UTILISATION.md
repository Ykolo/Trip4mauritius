# Guide d'utilisation — Trip4mauritius

Comment se servir du site, rôle par rôle. Pour l'architecture et les choix techniques, voir [ARCHITECTURE.md](ARCHITECTURE.md) et [BACKEND-PLAN.md](BACKEND-PLAN.md).

---

## Les trois rôles

| Rôle | Ce qu'il fait | Comment on l'obtient |
|---|---|---|
| **Touriste** | Cherche des activités, réserve, annule | À l'inscription — **tout le monde s'inscrit touriste** |
| **Opérateur** | Publie des activités, gère ses créneaux, voit ses passagers | Demande d'accès, **validée par un admin** |
| **Admin** | Modère les activités, valide et révoque les opérateurs | **Uniquement par le seed** — aucun écran ne fabrique d'admin |

Le formulaire d'inscription ne propose aucun choix de rôle, et c'est délibéré : pouvoir s'inscrire directement admin serait une faille.

---

## ⚠️ Avant de commencer : le problème des comptes

**Les comptes créés par le seed n'ont aucun identifiant.** Le seed écrit des lignes `User` mais jamais la ligne `Account` qui porte le mot de passe. Concrètement :

| Compte | Rôle | Connexion |
|---|---|---|
| `admin@mauriexplore.mu` | admin | ❌ impossible |
| `contact@blue-safari.mu` et les 3 autres | operator | ❌ impossible |
| `tourist@example.com` | tourist | ❌ impossible |

**Conséquence : l'espace d'administration n'est atteignable par personne**, et les 4 opérateurs du seed ne peuvent pas gérer leurs activités — alors que celles-ci sont bien publiées et réservables.

### Ce qui marche aujourd'hui

- **Touriste** : inscrivez-vous normalement sur `/register`. Ça fonctionne, la vérification d'email étant désactivée (voir *Limites* plus bas).
- **Opérateur** : inscrivez-vous, puis faites la demande d'accès (§ *Devenir opérateur*). Il faut ensuite un admin pour valider.
- **Admin** : il faut promouvoir un compte **directement en base**, aucun écran ne le permet :

  ```sql
  -- Sur la branche Neon visée, après s'être inscrit avec cette adresse
  UPDATE "user" SET role = 'admin' WHERE email = 'votre@adresse.test';
  ```

  Puis **se déconnecter et se reconnecter** : le rôle voyage dans la session, qui est mise en cache 5 minutes.

> **À corriger** : le seed devrait créer un mot de passe pour au moins le compte admin, sinon la chaîne de modération n'est pas utilisable de bout en bout.

---

## Parcours touriste

### Trouver une activité

`/activities` liste le catalogue. Les filtres (région, catégorie, prix, durée, langue) **vivent dans l'URL** : une recherche filtrée se partage et se met en favori telle quelle.

Seules les activités **publiées** apparaissent — les brouillons, les activités refusées et les archivées sont invisibles.

### Réserver

1. Ouvrez une fiche d'activité, **choisissez un créneau** dans la liste des départs.
2. Ajustez le nombre de participants. Le sélecteur est plafonné par le plus contraignant des deux : la capacité de l'activité **et** les places restantes sur ce départ précis.
3. **Ajouter au panier.**
4. Au panier, **Passer à la réservation**. Une connexion est exigée à ce stade : une réservation appartient à un compte, c'est ce qui vous permet de la retrouver.
5. Renseignez un **téléphone** — l'opérateur s'en servira en cas de météo défavorable ou de changement d'horaire. Nom et email viennent de votre compte et ne sont pas modifiables ici.
6. Confirmez. Vous obtenez une référence de la forme **`MX-2026-000123`**.

### Ce qu'il faut savoir

- **Le panier vit dans votre navigateur.** Il ne vous suit pas d'un appareil à l'autre, et il n'immobilise aucune place : tant que la réservation n'est pas confirmée, quelqu'un d'autre peut prendre le créneau.
- **Les prix affichés sont indicatifs.** Le montant réel est recalculé par le serveur à partir du prix en base au moment de la réservation.
- **Une seule réservation active par créneau et par compte.** Réserver deux fois le même départ est refusé.
- **Tous les horaires sont ceux de Maurice** (UTC+4, sans changement d'heure), jamais ceux de votre fuseau. Un départ à 09:00 s'affiche 09:00, que vous soyez à Port-Louis ou à Paris.

### Suivre et annuler

`/bookings` — ou l'onglet *Mes réservations* de `/account` — liste vos réservations avec leur statut, la référence, l'acompte et le solde.

Le bouton **Annuler la réservation** n'apparaît que si l'annulation est réellement possible (réservation active **et** départ non encore passé). L'annulation **remet immédiatement les places en vente**.

### Le paiement 20 / 80

Chaque réservation est découpée en deux :

- **20 % d'acompte**, dû à la réservation ;
- **80 % de solde**, réglé sur place auprès de l'opérateur le jour du départ.

Exemple : 100 € par personne × 2 participants ⇒ **200 € au total**, dont **40 € d'acompte** et **160 € sur place**.

> Le paiement en ligne n'est pas branché. La réservation est ferme et les places vous sont attribuées, mais **l'acompte n'est pas prélevé** — il se règle avec l'opérateur. L'écran de commande le dit explicitement.

---

## Parcours opérateur

### Devenir opérateur

1. Créez un compte touriste, puis allez sur `/operator/dashboard`.
2. Un formulaire vous demande votre **nom commercial** — celui que verront les touristes sur vos fiches.
3. Envoyez la demande. Elle apparaît chez les admins.
4. Après validation, **déconnectez-vous et reconnectez-vous** : sans cela votre nouveau rôle ne prend pas effet avant l'expiration du cache de session.

### Publier une activité

`/operator/planning` → **Nouvelle activité**, en trois étapes :

1. **Informations** — titre, catégorie, région, et la **description en français** (obligatoire). Les traductions anglaise, allemande, espagnole et russe sont facultatives : laissées vides, le texte français est affiché à leur place. Mieux vaut un français assumé qu'une fausse traduction.
2. **Détails** — prix par personne, durée, capacité, langues parlées, ce qui est inclus et ce qui ne l'est pas. Le découpage acompte / solde est prévisualisé sous le prix.
3. **Photos** — **des URLs**, pas des fichiers : un chemin interne (`/images/…`) ou une adresse `https://`. L'envoi de fichiers n'est pas encore disponible.

L'activité est créée **en brouillon**. Elle n'est visible de personne d'autre que vous.

### Programmer les départs

Sur la ligne de l'activité, dépliez le panneau (chevron) pour gérer les créneaux : date, heure et nombre de places.

- **Les horaires se saisissent en heure de Maurice**, celle de votre planning. La conversion est faite côté serveur — vous n'avez pas à vous soucier de votre fuseau si vous êtes en déplacement.
- Réimporter un planning qui recouvre partiellement l'existant est sans danger : les doublons sont ignorés.
- **Un créneau déjà réservé ne peut pas être supprimé.** Le bouton est désactivé, avec l'explication au survol.

### Mettre en ligne

**Soumettre** envoie l'activité à la modération. Deux conditions :

- au moins **un créneau à venir** — publier une fiche irréservable n'a pas de sens ;
- l'activité doit être en brouillon ou avoir été refusée.

Un admin publie ou refuse. Une activité **refusée peut être corrigée et resoumise**.

> **Modifier une activité déjà en ligne la renvoie en modération.** Sans cette règle, on ferait valider un texte anodin puis on le remplacerait une fois publié.

### Suivre l'activité

- **`/operator/dashboard`** — chiffre d'affaires, nombre de réservations, taux de remplissage sur les départs à venir, et la liste des prochains départs réservés.
- **`/operator/bookings`** — vos passagers : nom, **téléphone**, référence, nombre de places et **solde à encaisser sur place**. Le numéro affiché est celui donné pour *ce* départ, pas celui du profil du client.
- **`/operator/wallet`** — relevé en lecture seule (voir *Limites*).
- **`/operator/settings`** — nom commercial, logo, et état de votre vérification.

### Retirer une activité

**Archiver**, jamais supprimer. L'activité disparaît du catalogue, **les réservations déjà prises restent intactes et doivent être honorées**.

---

## Parcours admin

Accès par `/admin`, ou depuis `/account` (le raccourci n'apparaît qu'aux admins).

### Vue d'ensemble

Ce qui attend une décision — activités à modérer, demandes d'opérateur — et l'état de la place de marché. Les onglets portent une **pastille** avec le nombre en attente, pour qu'une demande ne dorme pas faute d'avoir pensé à ouvrir l'écran.

### Modérer les activités

`/admin/moderation`, quatre files : **À modérer**, **En ligne**, **Refusées**, **Archivées**. Les plus anciennes soumissions d'abord — une file qui sert les dernières arrivées laisserait indéfiniment de côté les opérateurs les moins chanceux.

- **Lire le contenu soumis** déplie la description, les inclus et les photos. À faire avant de décider.
- **Publier** met l'activité au catalogue. Refusé si elle n'a aucun créneau à venir.
- **Refuser** renvoie l'activité à son opérateur, qui peut la corriger. Depuis la file *En ligne*, le même bouton sert de **dépublication d'urgence**.

Les brouillons n'apparaissent dans aucune file : tant qu'un opérateur n'a pas soumis, son travail lui appartient.

### Valider et révoquer les opérateurs

`/admin/operators` sépare les **demandes en attente** des **opérateurs actifs**, avec l'identité réelle derrière chaque nom commercial — c'est sur elle que porte la décision.

- **Valider** accorde le badge vérifié **et** le rôle opérateur. C'est le seul chemin vers ce rôle.
- **Révoquer** retire le badge, repasse le compte en touriste, et **archive toutes ses activités en ligne**. Laisser les fiches en place viderait la révocation de son sens. Les réservations déjà prises restent honorées.

Un compte administrateur ne peut pas être révoqué depuis cet écran.

### Activer et désactiver des fonctionnalités

`/admin/features` permet d'éteindre ou de rallumer une fonctionnalité **sans redéployer le site**. Chaque interrupteur indique ce qu'il change concrètement, qui l'a basculé en dernier et quand.

Trois fonctionnalités sont pilotables aujourd'hui :

| Interrupteur | Ce qu'il change |
|---|---|
| **Inscription autonome des opérateurs** | Éteint, le formulaire « Devenir opérateur » disparaît et la demande est refusée côté serveur. Les profils opérateur ne peuvent plus être créés que par vous |
| **Sélecteur de devise** | Éteint, le menu de devise du pied de page disparaît. ⚠️ Il ne convertit rien aujourd'hui : tous les montants restent en euros. Le laisser allumé promet un choix que le site n'honore pas |
| **Contact WhatsApp** | Éteint, les points d'entrée WhatsApp disparaissent |

Trois choses à savoir :

- **La bascule met jusqu'à une minute** à se propager à toutes les instances du site. C'est le prix d'un cache qui évite une requête base à chaque affichage de page.
- **« Rendre la main »** n'est pas la même chose qu'éteindre : ça efface votre décision et laisse reparler la configuration de l'environnement, puis la valeur par défaut du code.
- **Éteindre une fonctionnalité la ferme réellement**, pas seulement à l'écran. Quelqu'un qui appellerait l'API directement se fait refuser aussi.

---

## Limites connues

Ce qui n'est pas encore en place. Ce sont des choix assumés à ce stade, pas des oublis — voir la section *Dettes* de `CLAUDE.md`.

| Limite | Ce que ça implique au quotidien |
|---|---|
| **Aucun email n'est envoyé** | Pas de confirmation de réservation, pas de réinitialisation de mot de passe (le lien « Forgot password? » mène à une page inexistante), et l'adresse email n'est pas vérifiée à l'inscription — on peut s'inscrire avec l'adresse d'autrui |
| **Aucun paiement en ligne** | L'acompte de 20 % est comptable, pas prélevé. Rien ne coûte à celui qui réserve |
| **Aucun reversement aux opérateurs** | `/operator/wallet` est un relevé. Maurice ne figure pas dans les pays supportés par Stripe : le circuit reste à définir |
| **Pas d'envoi de fichiers** | Photos d'activité et logos se saisissent en URL |
| **Le panier ne suit pas l'utilisateur** | Il vit dans le navigateur : changer d'appareil le vide |
| **Comptes du seed inutilisables** | Voir l'avertissement en tête de ce guide |
| **Pas d'avis clients** | Les notes affichées viennent du seed et ne sont alimentées par rien |

---

## Aide-mémoire des adresses

| Adresse | Qui | Quoi |
|---|---|---|
| `/` · `/activities` · `/activities/[slug]` | tout le monde | Catalogue public, indexable |
| `/cart` | tout le monde | Panier (navigateur) |
| `/checkout` | connecté | Tunnel de réservation |
| `/bookings` · `/account` | connecté | Réservations et profil |
| `/operator/*` | opérateur validé | Activités, créneaux, passagers, relevé |
| `/admin/*` | admin | Modération, opérateurs, interrupteurs de fonctionnalité |
