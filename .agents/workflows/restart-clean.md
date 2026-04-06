---
description: Redémarrage propre du serveur Next.js (purge cache + restart)
---

## Procédure de redémarrage propre

Quand le serveur Next.js a des problèmes de cache ou d'hydratation, suivre ces étapes **dans l'ordre** :

// turbo-all

1. **Arrêter le serveur** : Faire `Ctrl+C` dans le terminal du serveur actif, ou tuer le processus.

2. **Purger le cache** :
```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
```

3. **Relancer le serveur** :
```powershell
npm run dev
```

4. **Dans le navigateur** : Faire un Hard Refresh avec `Ctrl+Shift+R` (pas juste F5).

## Règle importante
- **Ne JAMAIS lancer `npm run dev` si un autre serveur tourne déjà** sur le même projet.
- **Ne JAMAIS supprimer `.next` pendant que le serveur tourne**.
- Toujours arrêter d'abord, purger ensuite, relancer enfin.
