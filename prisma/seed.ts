import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { ActivityStatus, PrismaClient, UserRole } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import type { Duration } from '../lib/durations'
import type { RegionValue } from '../lib/regions'

// Le seed reprend les données qui vivaient dans lib/hooks/useActivities.ts.
// À partir d'ici, la base fait autorité : le mock sera supprimé au lot 4.

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL est absente')

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

// --------------------------------------------------------------------------
// Maurice est à UTC+4 et n'observe aucun changement d'heure. Un créneau à 09:00
// heure locale est donc toujours 05:00 UTC. Construire la date autrement
// (new Date("...T09:00")) l'interpréterait dans le fuseau de la machine qui
// lance le seed — donc faux dès qu'on seede depuis l'Europe.
// --------------------------------------------------------------------------
const MAURITIUS_UTC_OFFSET_HOURS = 4

function mauritiusTime(daysFromNow: number, hour: number, minute = 0): Date {
  const base = new Date()
  base.setUTCDate(base.getUTCDate() + daysFromNow)
  return new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      hour - MAURITIUS_UTC_OFFSET_HOURS,
      minute,
      0,
      0,
    ),
  )
}

// --------------------------------------------------------------------------
// Opérateurs
// --------------------------------------------------------------------------

const OPERATORS = [
  {
    key: 'blue-safari',
    email: 'contact@blue-safari.mu',
    displayName: 'Blue Safari Mauritius',
    verified: true,
    categories: ['Water Sports', 'Cruises'],
  },
  {
    key: 'mu-adventures',
    email: 'contact@mauritius-adventures.mu',
    displayName: 'Mauritius Adventures',
    verified: true,
    categories: ['Adventure', 'Nature', 'Tours'],
  },
  {
    key: 'island-culture',
    email: 'contact@island-culture.mu',
    displayName: 'Island Culture & Taste',
    verified: true,
    categories: ['Culture', 'Food & Drink', 'Wellness'],
  },
  {
    key: 'mu-auto-rent',
    email: 'contact@mauriauto.mu',
    displayName: 'MauriAuto Rent',
    verified: false,
    categories: ['Véhicules'],
  },
] as const

// --------------------------------------------------------------------------
// Activités — reprises telles quelles du mock, enrichies des champs que le
// mock n'avait pas (capacité, médias, inclus/exclu).
// --------------------------------------------------------------------------

type SeedActivity = {
  slug: string
  title: string
  category: string
  // Listes fermées, comme à la saisie : le seed avait laissé entrer `Full day`
  // et `Half day` à côté de `Journée`, deux vocabulaires que le filtre de durée
  // ne pouvait pas réconcilier. Le typechecker refuse maintenant la rechute.
  region: RegionValue
  duration: Duration
  priceHt: number
  imageUrl: string
  rating: number
  lang: string[]
  maxParticipants: number
}

const ACTIVITIES: SeedActivity[] = [
  { slug: 'catamaran-cruise-ile-aux-cerfs', title: 'Catamaran Cruise to Ile aux Cerfs', category: 'Water Sports', region: 'East', duration: 'Journée', priceHt: 89, imageUrl: '/images/regions/east.jpg', rating: 4.8, lang: ['EN', 'FR', 'DE'], maxParticipants: 20 },
  { slug: 'le-morne-hiking-tour', title: 'Le Morne Mountain Hiking Tour', category: 'Nature', region: 'West', duration: 'Demi-journée', priceHt: 65, imageUrl: '/images/regions/west.jpg', rating: 4.9, lang: ['EN', 'FR'], maxParticipants: 12 },
  { slug: 'grand-baie-sunset-cruise', title: 'Grand Baie Sunset Cruise', category: 'Cruises', region: 'North', duration: '< 2h', priceHt: 55, imageUrl: '/images/regions/north.jpg', rating: 4.7, lang: ['EN', 'FR', 'DE', 'ES'], maxParticipants: 30 },
  { slug: 'black-river-gorges-trek', title: 'Black River Gorges Trekking', category: 'Nature', region: 'Centre', duration: 'Journée', priceHt: 75, imageUrl: '/images/regions/centre.jpg', rating: 4.6, lang: ['EN', 'FR'], maxParticipants: 10 },
  { slug: 'gris-gris-coastal-tour', title: 'Gris Gris Coastal Discovery', category: 'Tours', region: 'South', duration: 'Demi-journée', priceHt: 45, imageUrl: '/images/regions/south.jpg', rating: 4.5, lang: ['EN', 'FR'], maxParticipants: 16 },
  { slug: 'dolphin-swimming-adventure', title: 'Dolphin Swimming Adventure', category: 'Water Sports', region: 'West', duration: 'Demi-journée', priceHt: 95, imageUrl: '/images/regions/west.jpg', rating: 4.9, lang: ['EN', 'FR', 'DE'], maxParticipants: 12 },
  { slug: 'port-louis-cultural-tour', title: 'Port Louis Cultural Walking Tour', category: 'Culture', region: 'North', duration: '< 2h', priceHt: 35, imageUrl: '/images/regions/north.jpg', rating: 4.4, lang: ['EN', 'FR', 'ES'], maxParticipants: 18 },
  { slug: 'mauritius-food-tour', title: 'Street Food Culinary Experience', category: 'Food & Drink', region: 'North', duration: 'Demi-journée', priceHt: 60, imageUrl: '/images/regions/north.jpg', rating: 4.8, lang: ['EN', 'FR'], maxParticipants: 14 },
  { slug: 'quad-biking-south', title: 'Quad Biking South Coast', category: 'Adventure', region: 'South', duration: '< 2h', priceHt: 85, imageUrl: '/images/regions/south.jpg', rating: 4.6, lang: ['EN', 'FR', 'DE'], maxParticipants: 8 },
  { slug: 'spa-wellness-retreat', title: 'Luxury Spa & Wellness Day', category: 'Wellness', region: 'East', duration: 'Journée', priceHt: 150, imageUrl: '/images/regions/east.jpg', rating: 4.9, lang: ['EN', 'FR', 'DE', 'RU'], maxParticipants: 6 },
  { slug: 'underwater-sea-walk', title: 'Underwater Sea Walk Experience', category: 'Water Sports', region: 'North', duration: '< 2h', priceHt: 75, imageUrl: '/images/regions/north.jpg', rating: 4.7, lang: ['EN', 'FR'], maxParticipants: 10 },
  { slug: 'chamarel-seven-colored-earth', title: 'Chamarel Seven Colored Earth Tour', category: 'Nature', region: 'South', duration: 'Demi-journée', priceHt: 50, imageUrl: '/images/regions/south.jpg', rating: 4.5, lang: ['EN', 'FR', 'DE', 'ES'], maxParticipants: 20 },
  { slug: 'rent-mini-cooper-cabriolet', title: 'Location Mini Cooper S Cabriolet', category: 'Véhicules', region: 'North', duration: 'Journée', priceHt: 120, imageUrl: '/images/vehicles/mini_cooper_1775498487622.png', rating: 4.8, lang: ['EN', 'FR'], maxParticipants: 4 },
  { slug: 'rent-jeep-wrangler', title: 'Location Jeep Wrangler 4x4', category: 'Véhicules', region: 'South', duration: 'Plusieurs jours', priceHt: 150, imageUrl: '/images/vehicles/jeep_wrangler_1775498501364.png', rating: 4.9, lang: ['EN', 'FR', 'DE'], maxParticipants: 5 },
  { slug: 'rent-toyota-hilux', title: 'Toyota Hilux Double Cab', category: 'Véhicules', region: 'East', duration: 'Plusieurs jours', priceHt: 110, imageUrl: '/images/vehicles/jeep_wrangler_1775498501364.png', rating: 4.5, lang: ['EN', 'FR'], maxParticipants: 5 },
  { slug: 'rent-bmw-cabriolet', title: 'BMW Série 4 Cabriolet', category: 'Véhicules', region: 'North', duration: 'Plusieurs jours', priceHt: 220, imageUrl: '/images/vehicles/porsche_macan_1775498518147.png', rating: 5.0, lang: ['EN', 'FR', 'ES'], maxParticipants: 4 },
  { slug: 'rent-suzuki-jimny', title: 'Suzuki Jimny Safari (4x4)', category: 'Véhicules', region: 'West', duration: 'Journée', priceHt: 80, imageUrl: '/images/vehicles/jeep_wrangler_1775498501364.png', rating: 4.8, lang: ['EN', 'FR'], maxParticipants: 4 },
  { slug: 'rent-scooter-vespa', title: 'Scooter Vespa Primavera 125', category: 'Véhicules', region: 'North', duration: 'Journée', priceHt: 45, imageUrl: '/images/vehicles/vespa_scooter_1775498553914.png', rating: 4.6, lang: ['EN', 'FR', 'DE'], maxParticipants: 2 },
  { slug: 'rent-porsche-macan', title: 'Porsche Macan Premium SUV', category: 'Véhicules', region: 'Centre', duration: 'Plusieurs jours', priceHt: 290, imageUrl: '/images/vehicles/porsche_macan_1775498518147.png', rating: 4.9, lang: ['EN', 'FR'], maxParticipants: 5 },
  { slug: 'rent-hyundai-tucson', title: 'Hyundai Tucson Family SUV', category: 'Véhicules', region: 'South', duration: 'Plusieurs jours', priceHt: 95, imageUrl: '/images/vehicles/porsche_macan_1775498518147.png', rating: 4.4, lang: ['EN', 'FR'], maxParticipants: 5 },
  { slug: 'rent-kia-picanto', title: 'Kia Picanto Economy', category: 'Véhicules', region: 'East', duration: 'Journée', priceHt: 35, imageUrl: '/images/vehicles/mini_cooper_1775498487622.png', rating: 4.3, lang: ['EN', 'FR'], maxParticipants: 4 },
  { slug: 'rent-ford-mustang', title: 'Ford Mustang GT V8', category: 'Véhicules', region: 'North', duration: 'Journée', priceHt: 350, imageUrl: '/images/vehicles/ford_mustang_1775498536365.png', rating: 5.0, lang: ['EN', 'FR', 'DE'], maxParticipants: 4 },
]

// Les 5 clés fr|en|de|es|ru sont obligatoires : un objet partiel casserait
// l'affichage sans lever d'erreur. Textes gabarits — à remplacer par de vraies
// descriptions rédigées avant toute mise en ligne.
function buildDescription(a: SeedActivity): Record<string, string> {
  const isVehicle = a.category === 'Véhicules'
  return {
    fr: isVehicle
      ? `${a.title} disponible à la location dans la région ${a.region} de l'île Maurice. Véhicule entretenu et assuré, remise en main propre.`
      : `${a.title} — une expérience ${a.duration.toLowerCase()} dans la région ${a.region} de l'île Maurice, encadrée par un opérateur local vérifié.`,
    en: isVehicle
      ? `${a.title} available for rental in the ${a.region} region of Mauritius. Serviced and insured, handed over in person.`
      : `${a.title} — a ${a.duration.toLowerCase()} experience in the ${a.region} of Mauritius, run by a verified local operator.`,
    de: isVehicle
      ? `${a.title} zur Miete in der Region ${a.region} auf Mauritius. Gewartet und versichert, persönliche Übergabe.`
      : `${a.title} — ein Erlebnis in der Region ${a.region} auf Mauritius, geleitet von einem geprüften lokalen Anbieter.`,
    es: isVehicle
      ? `${a.title} disponible para alquilar en la región ${a.region} de Mauricio. Revisado y asegurado, entrega en mano.`
      : `${a.title} — una experiencia en la región ${a.region} de Mauricio, dirigida por un operador local verificado.`,
    ru: isVehicle
      ? `${a.title} — аренда в регионе ${a.region}, Маврикий. Обслуженный и застрахованный автомобиль, передача лично.`
      : `${a.title} — впечатление в регионе ${a.region} на Маврикии, с проверенным местным оператором.`,
  }
}

function buildIncluded(a: SeedActivity): string[] {
  if (a.category === 'Véhicules') return ['Assurance tous risques', 'Kilométrage illimité', 'Assistance 24/7']
  if (a.category === 'Water Sports' || a.category === 'Cruises') return ['Équipement fourni', 'Boissons à bord', 'Guide certifié']
  if (a.category === 'Food & Drink') return ['Dégustations', 'Guide francophone']
  return ['Guide local', 'Transport depuis le point de rendez-vous']
}

function buildExcluded(a: SeedActivity): string[] {
  if (a.category === 'Véhicules') return ['Carburant', 'Conducteur additionnel']
  return ['Pourboires', 'Dépenses personnelles', 'Transferts hôtel']
}

// --------------------------------------------------------------------------
// Identifiants
//
// Le seed écrivait des lignes `user` mais jamais la ligne `account` qui porte
// le mot de passe : les comptes créés ici — y compris l'unique admin —
// existaient sans qu'aucun d'eux ne puisse se connecter. L'espace de
// modération était donc inatteignable.
//
// Les trois valeurs ci-dessous ne sont pas devinées : elles sont relevées sur
// les lignes `account` que Better Auth 1.7 écrit lui-même à l'inscription. Une
// seule erreur (un `issuer` différent, un `accountId` qui ne vaut pas l'id de
// l'utilisateur) ne lève aucune exception — la connexion échoue simplement,
// comme si le mot de passe était faux.
// --------------------------------------------------------------------------

const CREDENTIAL_PROVIDER_ID = 'credential'
const CREDENTIAL_ISSUER = 'local:credential'

// Les adresses des deux comptes hors opérateurs. Constantes plutôt que
// littéraux : le récapitulatif affiché en fin de seed les relit, et deux
// littéraux séparés finiraient par diverger d'une lettre.
const ADMIN_EMAIL = 'admin@mauriexplore.mu'
const TOURIST_EMAIL = 'tourist@example.com'
/** Kled, le prestataire. Seul rôle habilité à manœuvrer les interrupteurs. */
const SUPERADMIN_EMAIL = 'kled@kledpro.tech'

/** Doit rester aligné sur `minPasswordLength` dans lib/auth.ts. */
const MIN_PASSWORD_LENGTH = 12

/**
 * Mot de passe de tous les comptes prédéfinis, en clair et versionné.
 *
 * C'est un choix assumé, pas un oubli. Le seed précédent tirait une valeur au
 * hasard et ne l'affichait qu'une fois : quiconque manquait cette ligne de
 * terminal se retrouvait avec un admin inaccessible et aucun moyen de revenir
 * en arrière.
 *
 * Le prix est réel et doit être connu : **le dépôt est public**, donc cette
 * valeur l'est aussi. Elle ne vaut que pour des données de démonstration. Toute
 * base ouverte à de vrais utilisateurs — la production en premier lieu — doit
 * poser `SEED_PASSWORD`, qui reprend la main ci-dessous.
 */
const DEFAULT_SEED_PASSWORD = 'AdminTrip4Mauritius'

function resolveSeedPassword(): { password: string; fromEnv: boolean } {
  const provided = process.env.SEED_PASSWORD?.trim()

  if (!provided) return { password: DEFAULT_SEED_PASSWORD, fromEnv: false }

  if (provided.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `SEED_PASSWORD fait ${provided.length} caractères ; l'application en exige ${MIN_PASSWORD_LENGTH}. ` +
        'Le seed écrirait un mot de passe que le formulaire de connexion refuserait.',
    )
  }

  return { password: provided, fromEnv: true }
}

async function setPassword(userId: string, password: string): Promise<void> {
  const hash = await hashPassword(password)

  await db.account.upsert({
    where: {
      providerId_accountId: {
        providerId: CREDENTIAL_PROVIDER_ID,
        accountId: userId,
      },
    },
    create: {
      userId,
      providerId: CREDENTIAL_PROVIDER_ID,
      issuer: CREDENTIAL_ISSUER,
      accountId: userId,
      password: hash,
    },
    update: { password: hash },
  })
}

function operatorKeyFor(category: string): string {
  const match = OPERATORS.find((o) => (o.categories as readonly string[]).includes(category))
  return (match ?? OPERATORS[1]).key
}

// ---------------------------------------------------------------------------
// Guides éditoriaux
// ---------------------------------------------------------------------------
//
// « Quand partir », « Choisir sa région » et « Informations pratiques » étaient
// trois tableaux de constantes DANS le composant `app/(public)/guide/page.tsx`.
// Le back-office annonçait les guides comme administrables ; ces trois-là ne
// l'étaient pas, et les modifier demandait un déploiement.
//
// Ce sont maintenant des articles ordinaires. Ils entrent par le seed pour que
// la page ne naisse pas vide, mais rien ne les distingue ensuite d'un article
// écrit depuis `/admin/guides` : ils s'éditent et se suppriment comme les
// autres.
//
// Les catégories de guides, elles, n'avaient jamais été semées du tout — ni par
// le lot 14 ni par sa migration. `/admin/guides/nouveau` proposait donc une
// liste de catégories vide, dans laquelle aucun article n'était créable.

const GUIDE_CATEGORIES = [
  { slug: 'quand-partir', label: 'Quand partir', position: 1 },
  { slug: 'regions', label: 'Régions', position: 2 },
  { slug: 'pratique', label: 'Informations pratiques', position: 3 },
] as const

type SeedGuide = {
  slug: string
  categorySlug: (typeof GUIDE_CATEGORIES)[number]['slug']
  title: string
  excerpt: string
  imageUrls: string[]
  content: string
}

// Les liens vers le catalogue portent la valeur STOCKÉE de la région
// (`?region=North`), jamais le libellé français : c'est ce que `publicWhere`
// compare. Un lien écrit `?region=Nord` afficherait une page vide.
const GUIDES: SeedGuide[] = [
  {
    slug: 'quand-partir-a-l-ile-maurice',
    categorySlug: 'quand-partir',
    title: 'Quand partir à l’île Maurice',
    excerpt:
      "Deux saisons, deux ambiances : l'hiver austral sec et frais de mai à novembre, l'été chaud et humide de décembre à avril. Ce qu'il faut savoir pour choisir sa période.",
    imageUrls: ['/images/regions/west.jpg'],
    content: `L'île Maurice se visite toute l'année, mais pas de la même façon selon la saison. Il n'y a pas de mauvaise période — seulement des périodes qui conviennent à des séjours différents.

## Mai à novembre — l'hiver austral

Saison sèche, 20 à 25 °C, peu de pluie. La meilleure période pour la randonnée et les excursions à la journée : la chaleur reste supportable même en plein effort, et les sentiers ne sont pas détrempés.

C'est aussi la **haute saison**. Les créneaux partent vite, en particulier sur les sorties en mer du matin. Réservez tôt.

- Randonnée et trekking dans leurs meilleures conditions
- Vent régulier sur la côte est, apprécié des kitesurfeurs
- Températures agréables pour visiter l'intérieur des terres

[Voir les activités de plein air](/activities?category=nature)

## Décembre à avril — l'été austral

Chaud et humide, 25 à 33 °C, averses courtes mais intenses — elles passent en général en moins d'une heure. L'eau du lagon est à sa température la plus agréable de l'année, ce qui en fait la période idéale pour tout ce qui se passe dans l'eau.

Le **risque cyclonique** court de janvier à mars. Il ne doit pas dissuader de venir, mais il impose de surveiller les alertes de la station météorologique et de prévoir des activités de repli.

- Température de l'eau maximale pour la plongée et le snorkeling
- Fruits de saison : litchis en décembre, mangues en janvier
- Tarifs plus doux hors des fêtes de fin d'année

[Voir les activités nautiques](/activities?category=sports-nautiques)

## En résumé

Si votre séjour tourne autour de la marche et des visites, visez l'hiver austral. S'il tourne autour du lagon, l'été austral vous servira mieux. Dans les deux cas, les activités de notre catalogue tournent à l'année.`,
  },
  {
    slug: 'choisir-sa-region',
    categorySlug: 'regions',
    title: 'Choisir sa région',
    excerpt:
      "Nord animé, Ouest photogénique, Sud sauvage, Est turquoise, Centre méconnu : les cinq régions de l'île n'offrent pas le même séjour. De quoi choisir où poser ses valises.",
    imageUrls: ['/images/regions/north.jpg'],
    content: `L'île fait 65 km du nord au sud : on peut loger n'importe où et rayonner. Mais la région où l'on dort décide de ce qu'on fait le matin sans prendre la voiture, et les cinq n'ont pas du tout le même caractère.

## Nord

La côte la plus animée : Grand Baie, ses restaurants et ses départs en mer. C'est là qu'on trouve le plus de croisières et de sports nautiques, et la vie continue après le coucher du soleil.

[Voir les activités du Nord](/activities?region=North)

## Ouest

Le Morne, Tamarin, les dauphins au petit matin. Couchers de soleil et lagons calmes, avec les plus belles randonnées de l'île à portée de voiture.

[Voir les activités de l'Ouest](/activities?region=West)

## Sud

La côte sauvage, moins fréquentée : falaises de Gris Gris, terres colorées de Chamarel, forêts des gorges. À privilégier pour la nature et les paysages.

[Voir les activités du Sud](/activities?region=South)

## Est

Les lagons turquoise et l'Île aux Cerfs. Plus venteux, donc apprécié des kitesurfeurs, et plus tranquille que le Nord.

[Voir les activités de l'Est](/activities?region=East)

## Centre

Les hauts plateaux, plus frais de quelques degrés. Curepipe, les lacs sacrés, les points de vue — l'intérieur qu'on oublie souvent en restant sur la côte.

[Voir les activités du Centre](/activities?region=Centre)`,
  },
  {
    slug: 'informations-pratiques',
    categorySlug: 'pratique',
    title: 'Informations pratiques',
    excerpt:
      "Décalage horaire, langues, monnaie, déplacements, santé : les repères à avoir en tête avant de préparer son séjour à l'île Maurice.",
    imageUrls: ['/images/regions/south.jpg'],
    content: `## Décalage horaire

UTC+4 toute l'année. L'île n'observe **aucun changement d'heure** : les horaires affichés sur ce site sont ceux de Maurice, pas ceux de votre navigateur. Un départ annoncé à 09:00 est un départ à 09:00 sur place.

## Langues

Le créole mauricien au quotidien, le français très largement compris, l'anglais pour l'administration. La plupart de nos activités sont proposées en français et en anglais, certaines en allemand, espagnol ou russe — le détail figure sur chaque fiche.

## Monnaie

La roupie mauricienne (MUR). Les prix de ce site sont affichés **en euros**. Les cartes bancaires sont acceptées presque partout ; gardez un peu d'espèces pour les marchés et les petits commerces.

## Se déplacer

Louer un véhicule reste le moyen le plus simple de circuler : les distances sont courtes mais les transports en commun lents. **On roule à gauche**, héritage britannique, et le permis international est recommandé.

[Voir les locations de véhicules](/activities?category=vehicules)

## Santé

Aucun vaccin obligatoire. Prévoyez une protection solaire élevée : l'ensoleillement est fort toute l'année, y compris par temps couvert. L'eau du robinet est traitée, mais l'eau en bouteille reste l'usage courant.`,
  },
]

async function main() {
  console.log('→ Seed MauriExplore')

  const { password: seedPassword, fromEnv } = resolveSeedPassword()

  // Admin : créé uniquement ici, jamais par l'application. Aucun endpoint ne
  // doit pouvoir fabriquer un compte admin.
  const admin = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: UserRole.admin },
    create: {
      email: ADMIN_EMAIL,
      name: 'Admin MauriExplore',
      emailVerified: true,
      role: UserRole.admin,
      locale: 'fr',
    },
  })
  await setPassword(admin.id, seedPassword)
  console.log(`  admin: ${admin.email}`)

  // Super admin Kled. Créé ici et NULLE PART ailleurs, exactement comme
  // l'admin : aucun endpoint ne fabrique de rôle au-dessus d'`operator`.
  const superadmin = await db.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: { role: UserRole.superadmin },
    create: {
      email: SUPERADMIN_EMAIL,
      name: 'Kled',
      emailVerified: true,
      role: UserRole.superadmin,
      locale: 'fr',
    },
  })
  await setPassword(superadmin.id, seedPassword)
  console.log(`  super admin: ${superadmin.email}`)

  // Un touriste de test, pour pouvoir exercer le tunnel de réservation.
  const tourist = await db.user.upsert({
    where: { email: TOURIST_EMAIL },
    update: {},
    create: {
      email: TOURIST_EMAIL,
      name: 'Touriste Test',
      emailVerified: true,
      role: UserRole.tourist,
      locale: 'fr',
    },
  })
  await setPassword(tourist.id, seedPassword)

  const operatorIdByKey = new Map<string, string>()
  for (const op of OPERATORS) {
    const user = await db.user.upsert({
      where: { email: op.email },
      update: { role: UserRole.operator },
      create: {
        email: op.email,
        name: op.displayName,
        emailVerified: true,
        role: UserRole.operator,
        locale: 'fr',
      },
    })

    await setPassword(user.id, seedPassword)

    const operator = await db.operator.upsert({
      where: { userId: user.id },
      update: { displayName: op.displayName, verified: op.verified },
      create: { userId: user.id, displayName: op.displayName, verified: op.verified },
    })

    operatorIdByKey.set(op.key, operator.id)
  }
  console.log(`  opérateurs: ${operatorIdByKey.size}`)

  // Les catégories viennent de la migration `add_categories`, qui a repris les
  // valeurs existantes. Le seed s'y rattache, il ne les réinvente pas : deux
  // listes de catégories divergeraient dès la première création depuis
  // /admin/categories.
  const categoryIdByLabel = new Map(
    (await db.category.findMany({ select: { id: true, label: true } })).map(
      (c) => [c.label, c.id],
    ),
  )

  let slotCount = 0
  for (const a of ACTIVITIES) {
    const operatorId = operatorIdByKey.get(operatorKeyFor(a.category))!
    const categoryId = categoryIdByLabel.get(a.category)

    if (!categoryId) {
      throw new Error(
        `Catégorie « ${a.category} » absente de la table categories. ` +
          'Lancer `npm run db:deploy` avant le seed.',
      )
    }

    const activity = await db.activity.upsert({
      where: { slug: a.slug },
      update: {},
      create: {
        operatorId,
        slug: a.slug,
        title: a.title,
        categoryId,
        region: a.region,
        duration: a.duration,
        priceHt: a.priceHt,
        maxParticipants: a.maxParticipants,
        languages: a.lang,
        imageUrls: [a.imageUrl],
        included: buildIncluded(a),
        excluded: buildExcluded(a),
        description: buildDescription(a),
        status: ActivityStatus.published,
        rating: a.rating,
        reviewCount: Math.round(a.rating * 27), // valeur d'affichage, aucun avis réel derrière
      },
    })

    // 14 jours de créneaux, à des horaires locaux mauriciens.
    // Une activité qui occupe la journée n'a qu'un départ ; les autres en ont deux.
    const hours = a.duration === 'Journée' || a.duration === 'Plusieurs jours' ? [9] : [9, 14]
    for (let day = 1; day <= 14; day++) {
      for (const hour of hours) {
        const startsAt = mauritiusTime(day, hour)
        await db.activitySlot.upsert({
          where: { activityId_startsAt: { activityId: activity.id, startsAt } },
          update: {},
          create: { activityId: activity.id, startsAt, maxSpots: a.maxParticipants },
        })
        slotCount++
      }
    }
  }

  // Catégories de guides puis articles. `update: {}` sur les deux, comme pour
  // le catalogue : relancer le seed ne doit pas écraser un texte retouché
  // depuis /admin/guides, ni ressusciter un article supprimé volontairement…
  // sauf qu'un article supprimé, lui, reviendra — l'upsert porte sur le slug.
  // C'est le comportement voulu pour du contenu de démarrage.
  const guideCategoryIdBySlug = new Map<string, string>()
  for (const c of GUIDE_CATEGORIES) {
    const created = await db.guideCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, label: c.label, position: c.position },
    })
    guideCategoryIdBySlug.set(c.slug, created.id)
  }

  for (const g of GUIDES) {
    const categoryId = guideCategoryIdBySlug.get(g.categorySlug)!
    await db.guide.upsert({
      where: { slug: g.slug },
      update: {},
      create: {
        slug: g.slug,
        categoryId,
        title: g.title,
        excerpt: g.excerpt,
        content: g.content,
        imageUrls: g.imageUrls,
        // Publiés d'emblée : ils remplacent des blocs qui étaient déjà en
        // ligne. Les laisser en brouillon viderait la page du guide.
        status: 'published',
      },
    })
  }

  console.log(`  activités: ${ACTIVITIES.length}`)
  console.log(`  créneaux: ${slotCount}`)
  console.log(`  catégories de guides: ${GUIDE_CATEGORIES.length}`)
  console.log(`  articles: ${GUIDES.length}`)
  console.log('✓ Seed terminé')

  // Récapitulatif des comptes prédéfinis. Construit à partir des mêmes
  // constantes que les écritures ci-dessus : il ne peut donc pas annoncer un
  // identifiant que le seed n'a pas réellement écrit.
  const accounts: Array<[role: string, email: string]> = [
    ['super admin (Kled)', SUPERADMIN_EMAIL],
    ['admin', ADMIN_EMAIL],
    ...OPERATORS.map((o) => [o.verified ? 'opérateur' : 'opérateur (non vérifié)', o.email] as [string, string]),
    ['touriste', TOURIST_EMAIL],
  ]

  console.log('')
  console.log(`  Comptes prédéfinis — mot de passe : ${seedPassword}`)
  for (const [role, email] of accounts) {
    console.log(`    ${role.padEnd(24)} ${email}`)
  }

  if (!fromEnv) {
    console.log('')
    console.log('  ⚠ Mot de passe par défaut, en clair dans prisma/seed.ts et sur un dépôt public.')
    console.log('    Poser SEED_PASSWORD pour toute base accessible à de vrais utilisateurs.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
