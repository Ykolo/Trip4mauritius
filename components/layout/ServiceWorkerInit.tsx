"use client";

import { useEffect } from "react";

// Le service worker n'est enregistré QU'EN PRODUCTION.
//
// `public/sw.js` applique un « cache-first » sur `/_next/static/*`, en s'appuyant
// sur le fait que ces fichiers portent un hachage de contenu — un nom haché ne
// peut pas devenir périmé. C'est vrai du build de production. **Ce n'est pas
// vrai en développement** : Turbopack sert des chemins stables
// (`/_next/static/chunks/_0ei7c.e._.js?id=…`), que le cache fige alors
// indéfiniment.
//
// Conséquence observée : après modification d'un composant client, le serveur
// rend le nouveau HTML pendant que le navigateur exécute l'ancien bundle. React
// échoue à l'hydratation, et la modification reste invisible — y compris après
// `rm -rf .next`, après un redémarrage du serveur et dans un onglet neuf, parce
// que le cache visé n'est aucun de ceux-là. On finit par corriger du code qui
// était déjà juste.
//
// Rien n'est perdu au passage : le mode hors ligne n'a aucun intérêt en local,
// et c'est bien la version de production que les tests PWA doivent viser.
export function ServiceWorkerInit() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // Un service worker déjà posé par un `next dev` antérieur survivrait à ce
      // garde-fou : il faut le retirer, pas seulement s'abstenir d'en poser un.
      // Sans ça, la machine de quiconque a lancé le projet avant ce correctif
      // resterait piégée.
      void navigator.serviceWorker
        ?.getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((r) => r.unregister())),
        )
        .then(() => caches?.keys())
        .then((names) =>
          Promise.all((names ?? []).map((name) => caches.delete(name))),
        )
        .catch(() => {
          // Purge de confort : si elle échoue, le développeur a toujours
          // l'onglet « Application » de son navigateur.
        });
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
    }
  }, []);

  return null;
}
