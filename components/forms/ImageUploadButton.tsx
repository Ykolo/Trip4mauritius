'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { ImagePlus, Loader2 } from 'lucide-react'

// Dépôt de photo, partagé par l'éditeur d'article et le formulaire d'activité.
//
// Il n'y avait AUCUN envoi de fichier dans le projet : photos d'activité comme
// images d'article se saisissaient en URL, ce qui obligeait chaque opérateur à
// héberger ses images ailleurs avant de pouvoir publier.
//
// Le fichier part du navigateur DIRECTEMENT vers Vercel Blob — la route
// `/api/upload` n'émet qu'un jeton signé et ne voit jamais l'octet. C'est ce
// qui permet d'accepter une photo de plusieurs mégaoctets sans la faire
// transiter par la mémoire d'une fonction.
//
// Ce composant ne fait qu'UNE chose : rendre une URL. C'est l'appelant qui
// décide où elle atterrit — la saisie manuelle d'URL reste donc disponible à
// côté, pour les images déjà hébergées.

/** Doit rester aligné sur `ALLOWED_CONTENT_TYPES` dans app/api/upload/route.ts. */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'
const MAX_SIZE_BYTES = 8 * 1024 * 1024

/**
 * Traduit l'échec de `upload()` en une phrase qui désigne un geste.
 *
 * La bibliothèque ne transmet PAS ce que `/api/upload` a répondu : elle jette
 * « Vercel Blob: Failed to retrieve the client token » dès que la route rend
 * autre chose qu'un jeton, que ce soit un refus de rôle ou un stockage non
 * provisionné. Ce message-là ne s'adresse pas à l'opérateur qui essaie de
 * poser une photo sur son article — il ne lui dit ni ce qui manque, ni s'il y
 * peut quelque chose.
 *
 * On redemande donc la raison à la route, en clair, une fois l'échec constaté.
 * Si elle ne répond pas non plus, on garde le message d'origine : illisible
 * vaut mieux qu'inventé.
 */
async function explainFailure(e: unknown): Promise<string> {
  const original = e instanceof Error ? e.message : "L’envoi a échoué."
  try {
    const res = await fetch('/api/upload')
    const body = (await res.json()) as { ready?: boolean; error?: string }
    if (body.error) return body.error
  } catch {
    // Route injoignable : on ne sait rien de plus qu'au départ.
  }
  return original
}

export function ImageUploadButton({
  onUploaded,
  label = 'Envoyer une photo',
}: {
  onUploaded: (url: string) => void
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)

    // Vérifié ici EN PLUS du serveur, pas à sa place : refuser 20 Mo avant de
    // les téléverser évite de faire attendre pour rien.
    if (file.size > MAX_SIZE_BYTES) {
      setError('Photo trop lourde (8 Mo maximum). Redimensionnez-la avant l’envoi.')
      return
    }

    setBusy(true)
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      })
      onUploaded(blob.url)
    } catch (e) {
      // « Vous n'avez pas le droit » et « le stockage n'est pas configuré »
      // appellent des gestes opposés ; `upload()` les rend indiscernables.
      setError(await explainFailure(e))
    } finally {
      setBusy(false)
      // Remis à zéro pour que réenvoyer le MÊME fichier redéclenche `change`.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-surface text-ink font-semibold whitespace-nowrap disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ImagePlus className="w-4 h-4" />
        )}
        {busy ? 'Envoi…' : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
