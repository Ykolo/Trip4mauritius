import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { ActivityStatus, PrismaClient, UserRole } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'

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
  region: string
  duration: string
  priceHt: number
  imageUrl: string
  rating: number
  lang: string[]
  maxParticipants: number
}

const ACTIVITIES: SeedActivity[] = [
  { slug: 'catamaran-cruise-ile-aux-cerfs', title: 'Catamaran Cruise to Ile aux Cerfs', category: 'Water Sports', region: 'East', duration: 'Full day', priceHt: 89, imageUrl: '/images/regions/east.jpg', rating: 4.8, lang: ['EN', 'FR', 'DE'], maxParticipants: 20 },
  { slug: 'le-morne-hiking-tour', title: 'Le Morne Mountain Hiking Tour', category: 'Nature', region: 'West', duration: 'Half day', priceHt: 65, imageUrl: '/images/regions/west.jpg', rating: 4.9, lang: ['EN', 'FR'], maxParticipants: 12 },
  { slug: 'grand-baie-sunset-cruise', title: 'Grand Baie Sunset Cruise', category: 'Cruises', region: 'North', duration: '< 2h', priceHt: 55, imageUrl: '/images/regions/north.jpg', rating: 4.7, lang: ['EN', 'FR', 'DE', 'ES'], maxParticipants: 30 },
  { slug: 'black-river-gorges-trek', title: 'Black River Gorges Trekking', category: 'Nature', region: 'Centre', duration: 'Full day', priceHt: 75, imageUrl: '/images/regions/centre.jpg', rating: 4.6, lang: ['EN', 'FR'], maxParticipants: 10 },
  { slug: 'gris-gris-coastal-tour', title: 'Gris Gris Coastal Discovery', category: 'Tours', region: 'South', duration: 'Half day', priceHt: 45, imageUrl: '/images/regions/south.jpg', rating: 4.5, lang: ['EN', 'FR'], maxParticipants: 16 },
  { slug: 'dolphin-swimming-adventure', title: 'Dolphin Swimming Adventure', category: 'Water Sports', region: 'West', duration: 'Half day', priceHt: 95, imageUrl: '/images/regions/west.jpg', rating: 4.9, lang: ['EN', 'FR', 'DE'], maxParticipants: 12 },
  { slug: 'port-louis-cultural-tour', title: 'Port Louis Cultural Walking Tour', category: 'Culture', region: 'North', duration: '< 2h', priceHt: 35, imageUrl: '/images/regions/north.jpg', rating: 4.4, lang: ['EN', 'FR', 'ES'], maxParticipants: 18 },
  { slug: 'mauritius-food-tour', title: 'Street Food Culinary Experience', category: 'Food & Drink', region: 'North', duration: 'Half day', priceHt: 60, imageUrl: '/images/regions/north.jpg', rating: 4.8, lang: ['EN', 'FR'], maxParticipants: 14 },
  { slug: 'quad-biking-south', title: 'Quad Biking South Coast', category: 'Adventure', region: 'South', duration: '< 2h', priceHt: 85, imageUrl: '/images/regions/south.jpg', rating: 4.6, lang: ['EN', 'FR', 'DE'], maxParticipants: 8 },
  { slug: 'spa-wellness-retreat', title: 'Luxury Spa & Wellness Day', category: 'Wellness', region: 'East', duration: 'Full day', priceHt: 150, imageUrl: '/images/regions/east.jpg', rating: 4.9, lang: ['EN', 'FR', 'DE', 'RU'], maxParticipants: 6 },
  { slug: 'underwater-sea-walk', title: 'Underwater Sea Walk Experience', category: 'Water Sports', region: 'North', duration: '< 2h', priceHt: 75, imageUrl: '/images/regions/north.jpg', rating: 4.7, lang: ['EN', 'FR'], maxParticipants: 10 },
  { slug: 'chamarel-seven-colored-earth', title: 'Chamarel Seven Colored Earth Tour', category: 'Nature', region: 'South', duration: 'Half day', priceHt: 50, imageUrl: '/images/regions/south.jpg', rating: 4.5, lang: ['EN', 'FR', 'DE', 'ES'], maxParticipants: 20 },
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

/** Doit rester aligné sur `minPasswordLength` dans lib/auth.ts. */
const MIN_PASSWORD_LENGTH = 12

function resolveSeedPassword(): { password: string; generated: boolean } {
  const provided = process.env.SEED_PASSWORD?.trim()

  if (provided) {
    if (provided.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `SEED_PASSWORD fait ${provided.length} caractères ; l'application en exige ${MIN_PASSWORD_LENGTH}. ` +
          'Le seed écrirait un mot de passe que le formulaire de connexion refuserait.',
      )
    }
    return { password: provided, generated: false }
  }

  // Pas de mot de passe par défaut en dur : il finirait committé, puis en
  // production. On en tire un au hasard et on l'affiche une fois.
  return { password: randomBytes(12).toString('base64url'), generated: true }
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

async function main() {
  console.log('→ Seed MauriExplore')

  const { password: seedPassword, generated } = resolveSeedPassword()

  // Admin : créé uniquement ici, jamais par l'application. Aucun endpoint ne
  // doit pouvoir fabriquer un compte admin.
  const admin = await db.user.upsert({
    where: { email: 'admin@mauriexplore.mu' },
    update: { role: UserRole.admin },
    create: {
      email: 'admin@mauriexplore.mu',
      name: 'Admin MauriExplore',
      emailVerified: true,
      role: UserRole.admin,
      locale: 'fr',
    },
  })
  await setPassword(admin.id, seedPassword)
  console.log(`  admin: ${admin.email}`)

  // Un touriste de test, pour pouvoir exercer le tunnel de réservation.
  const tourist = await db.user.upsert({
    where: { email: 'tourist@example.com' },
    update: {},
    create: {
      email: 'tourist@example.com',
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
    const hours = a.duration === 'Full day' || a.duration === 'Plusieurs jours' ? [9] : [9, 14]
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

  console.log(`  activités: ${ACTIVITIES.length}`)
  console.log(`  créneaux: ${slotCount}`)
  console.log('✓ Seed terminé')

  console.log('')
  console.log('  Connexion — admin@mauriexplore.mu, les 4 opérateurs et tourist@example.com')
  if (generated) {
    console.log(`  Mot de passe TIRÉ AU HASARD : ${seedPassword}`)
    console.log('  Il ne sera plus affiché. Poser SEED_PASSWORD pour en choisir un.')
  } else {
    console.log('  Mot de passe : celui de SEED_PASSWORD.')
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
