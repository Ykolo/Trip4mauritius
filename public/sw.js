// Service worker PWA.
//
// Règle directrice : ce cache ne contient QUE des ressources publiques et
// immuables. La version précédente mettait en cache toutes les réponses `/api/`
// et toutes les pages HTML — donc les réservations d'un utilisateur, son
// numéro de téléphone et la liste de clients d'un opérateur. Sur un appareil
// partagé, ces données survivaient à la déconnexion et pouvaient être
// resservies hors ligne à la personne suivante.
//
// Bump de version : `activate` supprime tous les caches dont le nom diffère,
// ce qui purge `trip4mauritius-v1` chez les visiteurs existants.
const CACHE_NAME = "trip4mauritius-v2";

/** Ressources publiques nécessaires au premier rendu hors ligne. */
const PRECACHE = ["/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
        )
      )
  );
  self.clients.claim();
});

/**
 * Seules ces ressources sont cachables : les fichiers de build de Next, dont le
 * nom porte un hachage de contenu, et les médias statiques. Un nom haché ne
 * peut pas devenir périmé — c'est ce qui rend le « cache-first » sûr ici, et
 * uniquement ici.
 *
 * ⚠️ Cette garantie vaut pour le BUILD DE PRODUCTION uniquement. En
 * développement, Turbopack sert des chemins stables et non hachés
 * (`/_next/static/chunks/_0ei7c.e._.js?id=…`) : le « cache-first » y fige
 * l'ancien bundle, et toute modification d'un composant client disparaît
 * derrière une erreur d'hydratation. C'est pour cette raison que
 * `ServiceWorkerInit` n'enregistre ce fichier qu'en production — ne pas
 * l'enregistrer en dev « pour tester la PWA » sans lire ce paragraphe.
 */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(css|png|jpg|jpeg|svg|webp|avif|ico|woff|woff2)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Une requête non-GET modifie de l'état : la mettre en cache n'a aucun sens,
  // et l'intercepter risquerait de rejouer une réservation.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Domaines tiers : hors de notre responsabilité.
  if (url.origin !== self.location.origin) return;

  // `/api/` n'est PAS intercepté du tout — ni tRPC ni Better Auth. Ces réponses
  // dépendent de la session ; les stocker, c'est écrire les données d'un
  // utilisateur sur le disque d'un appareil possiblement partagé.
  if (url.pathname.startsWith("/api/")) return;

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            // Ne cacher qu'une réponse complète et valide : mettre en cache une
            // 404 ou une réponse partielle la figerait jusqu'au prochain bump.
            if (response.ok && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Tout le reste — c'est-à-dire les pages HTML — part au réseau et n'est
  // jamais stocké. `/account`, `/bookings`, `/operator/*` et `/admin/*` rendent
  // des données personnelles ; le gain hors ligne ne vaut pas de les laisser
  // sur le disque.
});
