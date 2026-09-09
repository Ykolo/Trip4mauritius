# Guide d'utilisation — Trip4mauritius

Comment se servir du site, rôle par rôle. Pour l'architecture et les choix techniques, voir [ARCHITECTURE.md](ARCHITECTURE.md) et [BACKEND-PLAN.md](BACKEND-PLAN.md).

---

## Les quatre rôles

| Rôle | Ce qu'il fait | Comment on l'obtient |
|---|---|---|
| **Touriste** | Cherche des activités, réserve, annule | À l'inscription — **tout le monde s'inscrit touriste** |
| **Opérateur** | Publie des activités, gère ses créneaux, voit ses passagers | **Créé par l'admin Trip4mauritius** — il n'y a pas d'auto-inscription |
| **Admin** | Tient le catalogue, les réservations, les opérateurs, les guides | **Uniquement par le seed** — aucun écran ne fabrique d'admin |
| **Super admin** | Kled, le prestataire : manœuvre les interrupteurs de fonctionnalité | **Uniquement par le seed** |

Le formulaire d'inscription ne propose aucun choix de rôle, et c'est délibéré : pouvoir s'inscrire directement admin serait une faille.

---

## Avant de commencer : les comptes du seed

Le seed crée des comptes **connectables**, tous avec le même mot de passe :

| Compte | Rôle | Sert à |
|---|---|---|
| `admin@mauriexplore.mu` | admin | Catalogue, réservations, opérateurs, catégories, guides |
| `kled@kledpro.tech` | superadmin | Les interrupteurs, hors de portée de l'admin client |
| `contact@blue-safari.mu` et les 3 autres | operator | Gérer les activités déjà publiées |
| `tourist@example.com` | tourist | Exercer le tunnel de réservation |

Le mot de passe des six comptes est **`AdminTrip4Mauritius`**. Il est écrit en clair dans `prisma/seed.ts` pour que le jeu de démonstration soit utilisable sans configuration préalable, et le seed récapitule les comptes en fin d'exécution.

⚠️ **Le dépôt est public, ce mot de passe l'est donc aussi.** Il ne convient qu'à des données de démonstration. Sur toute base accessible à de vrais utilisateurs — la production en premier lieu — posez `SEED_PASSWORD` (12 caractères minimum) : elle reprend la main sur la valeur par défaut.

Relancer le seed réécrit ces mots de passe ; il ne touche à aucun autre compte.

> **Le rôle voyage dans la session, mise en cache 5 minutes.** Après toute promotion (la création d'un opérateur, par exemple), il faut **se déconnecter et se reconnecter** pour que le nouveau rôle prenne effet.

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

**On ne se déclare pas opérateur soi-même.** C'est Trip4mauritius qui ouvre le compte, depuis `/admin/operators` : la plateforme choisit qui vend chez elle.

1. Contactez l'équipe pour être référencé.
2. Elle crée votre compte à partir de votre email. Vous ne recevez **aucun mot de passe** : utilisez « mot de passe oublié » sur l'écran de connexion pour en choisir un.
3. Une fois connecté, `/operator/dashboard` vous est ouvert.

> Si vous voyez « Espace réservé aux opérateurs partenaires », c'est que votre compte n'a pas encore été créé comme opérateur.

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

**Mettre en ligne** publie l'activité **directement** : il n'y a pas de file de modération, Trip4mauritius tient son catalogue. Une seule condition subsiste, et elle est de fond :

- au moins **un créneau à venir** — une fiche indexée que personne ne peut réserver ne rend service à personne.

> **Corriger une activité en ligne ne la retire PAS du catalogue.** L'édition renvoyait autrefois la fiche en modération ; sans file d'attente, cette règle la faisait disparaître sans que rien ne l'y ramène — on se sabordait en corrigeant sa propre faute de frappe. Le contrôle se fait après coup : Trip4mauritius voit tout le catalogue et peut dépublier depuis `/admin/activities`.

### Suivre l'activité

- **`/operator/dashboard`** — chiffre d'affaires, nombre de réservations, taux de remplissage sur les départs à venir, et la liste des prochains départs réservés.
- **`/operator/bookings`** — vos passagers : nom, **téléphone**, référence, nombre de places et **solde à encaisser sur place**. Le numéro affiché est celui donné pour *ce* départ, pas celui du profil du client.
- **`/operator/wallet`** — relevé en lecture seule (voir *Limites*).
- **`/operator/settings`** — nom commercial et logo.

### Retirer une activité

**Archiver**, jamais supprimer. L'activité disparaît du catalogue, **les réservations déjà prises restent intactes et doivent être honorées**.

---

## Parcours admin

Accès par `/admin`, ou depuis `/account` (le raccourci n'apparaît qu'aux admins).

### Vue d'ensemble

L'état de la place de marché. Il n'y a **rien qui attende une décision** : la file de modération et les demandes d'accès opérateur ont disparu au lot 13 — Trip4mauritius tient son catalogue et crée ses opérateurs lui-même.

### Saisir et corriger le catalogue

`/admin/activities` est l'écran où **vous** remplissez le catalogue, pour n'importe quel opérateur. C'est ce dont la plateforme a besoin au lancement, quand aucun prestataire n'est encore autonome.

- **Nouvelle activité** — choisissez d'abord **pour quel opérateur** : une fiche appartient toujours à quelqu'un, et c'est lui qui verra ses départs et ses passagers. Les opérateurs non encore vérifiés sont proposés, signalés comme tels.
- La fiche est créée **en brouillon**. Dépliez-la (chevron) pour lui ajouter des créneaux : **sans départ à venir, la mise en ligne est refusée** — une page indexée que personne ne peut réserver ne rend service à personne. Une **location à la journée** fait exception : elle n'a aucun créneau par construction, et se met en ligne directement.
- **Modifier** une fiche déjà en ligne la corrige **sans la sortir du catalogue** — et l'espace opérateur suit désormais la même règle.
- Le **statut** se change sur la ligne, par les trois segments **Brouillon · En ligne · Archivée**. L'état courant est celui qui est plein ; cliquez un autre segment pour l'y amener.
  - **Brouillon** — la fiche sort du catalogue public mais reste en travail.
  - **En ligne** — elle est visible et réservable.
  - **Archivée** — elle sort du catalogue en conservant les réservations passées. Une activité ne se supprime **jamais**. L'archivage demande confirmation, et reste réversible : les trois segments restent cliquables.
- Le **sélecteur d'opérateur** et la recherche (titre, adresse, opérateur) servent à reprendre un catalogue prestataire par prestataire. Le filtre par statut suit les mêmes trois états.

### Suivre les réservations

`/admin/bookings` liste **toutes** les réservations de la plateforme. Chaque ligne porte les coordonnées du **client** et de l'**opérateur**, cliquables : c'est ce qui permet de les mettre en relation à la main, sans ouvrir la base.

- La recherche accepte indifféremment une **référence** (`MX-2026-000123`), un **nom** ou un **email**.
- L'écran s'ouvre sur les départs **à venir**, les plus proches d'abord — les seuls sur lesquels il reste quelque chose à faire.

### Créer les opérateurs

`/admin/operators` liste les prestataires et permet d'en **créer**. C'est le seul chemin vers le rôle opérateur : un touriste ne peut plus se déclarer prestataire lui-même.

Renseignez le nom commercial, le contact et l'email. Deux cas :

- **adresse inconnue** → le compte est créé **sans mot de passe**. Son titulaire doit passer par « mot de passe oublié » pour en choisir un — nous n'en fabriquons pas, il faudrait vous le faire transmettre en clair ;
- **adresse déjà connue** → le compte est promu, ses données ne sont pas réécrites.

Un compte administrateur n'est jamais rétrogradé par cette porte.

> Il n'y a **pas d'écran de gestion de comptes** au lot 1, et aucun écran ne sait fabriquer un administrateur : le premier vient du seed.

### Rédiger les guides

`/admin/guides` réunit les **articles** et leur **classification** — gastronomie, sécurité, stationnement… Créez d'abord une catégorie, puis l'article : titre, chapô, corps en Markdown, images en URL.

- Le **chapô** est l'accroche affichée dans les listes. Il est séparé du corps parce qu'en extraire les premières lignes produirait une phrase coupée.
- L'article part en **brouillon** ; cochez *Publier* pour le mettre en ligne. Un brouillon n'est jamais visible publiquement.
- **L'adresse ne bouge pas** quand vous corrigez un titre : elle vit dans les liens partagés.
- Une catégorie se **désactive**, elle ne se supprime pas — les articles qu'elle classe doivent survivre.

- **Valider** accorde le badge vérifié **et** le rôle opérateur. C'est le seul chemin vers ce rôle.
- **Révoquer** retire le badge, repasse le compte en touriste, et **archive toutes ses activités en ligne**. Laisser les fiches en place viderait la révocation de son sens. Les réservations déjà prises restent honorées.

Un compte administrateur ne peut pas être révoqué depuis cet écran.

### Gérer les catégories

`/admin/categories` est le catalogue des catégories : ce que les touristes voient dans les filtres et sur l'accueil, et ce parmi quoi les opérateurs choisissent en publiant.

- **Créer** — donnez un libellé (et un emoji, une image). L'adresse est dérivée du libellé et **ne changera plus jamais** ensuite : elle vit dans les liens de recherche que les touristes partagent et que Google a indexés.
- **Renommer** — libre, à tout moment. Seul l'affichage change ; les liens existants continuent de fonctionner.
- **Ordonner** — les flèches. C'est cet ordre qu'on retrouve sur l'accueil et dans les filtres.
- **Masquer** — retire la catégorie des filtres et du formulaire opérateur. Les activités déjà classées dedans **restent en ligne** : les déréférencer parce que vous rangez votre liste serait une sanction sans rapport.

Une catégorie ne se **supprime** pas. Les activités qui la référencent en dépendent, et la base refuse. C'est à ça que sert « masquer ».

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
| **Pas d'avis clients** | Les notes affichées viennent du seed et ne sont alimentées par rien |

---

## Aide-mémoire des adresses

| Adresse | Qui | Quoi |
|---|---|---|
| `/` · `/activities` · `/activities/[slug]` | tout le monde | Catalogue public, indexable |
| `/cart` | tout le monde | Panier (navigateur) |
| `/checkout` | connecté | Tunnel de réservation |
| `/bookings` · `/account` | connecté | Réservations et profil |
| `/operator/*` | opérateur | Activités, créneaux, passagers, relevé |
| `/admin/*` | admin | Catalogue, réservations, opérateurs, catégories, guides |
| `/admin/features` | super admin (Kled) | Interrupteurs de fonctionnalité — hors de portée de l'admin client |
