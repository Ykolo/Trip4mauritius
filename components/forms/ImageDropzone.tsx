'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { upload } from '@vercel/blob/client'
import { ImagePlus, Link2, Loader2, Star, X } from 'lucide-react'

// Dépôt de photos — le SEUL geste d'ajout d'image du site.
//
// Les quatre écrans concernés (activité, guide, catégorie, logo d'opérateur)
// affichaient un champ « URL » : il fallait héberger sa photo ailleurs avant de
// pouvoir publier. C'est un geste que personne n'attend d'un formulaire, et le
// bouton d'envoi ajouté à côté ne faisait qu'épaissir l'écran sans dire lequel
// des deux chemins prendre.
//
// Le fichier part du navigateur DIRECTEMENT vers Vercel Blob — la route
// `/api/upload` n'émet qu'un jeton signé et ne voit jamais l'octet. C'est ce
// qui permet d'accepter une photo de plusieurs mégaoctets sans la faire
// transiter par la mémoire d'une fonction.
//
// ⚠️ La saisie d'URL n'a PAS disparu, elle est repliée derrière un lien. Tant
// que le store Blob n'est pas provisionné (`BLOB_READ_WRITE_TOKEN` absent),
// tout envoi échoue et c'est le seul chemin qui fonctionne : la retirer
// rendrait le site incapable d'accepter la moindre image. Elle sert aussi, une
// fois le stockage en place, aux visuels déjà hébergés — les `/images/…` du
// dépôt, que le seed utilise partout.

/** Doit rester aligné sur `ALLOWED_CONTENT_TYPES` dans app/api/upload/route.ts. */
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'
const MAX_SIZE_BYTES = 8 * 1024 * 1024

/**
 * Traduit l'échec de `upload()` en une phrase qui désigne un geste.
 *
 * La bibliothèque ne transmet PAS ce que `/api/upload` a répondu : elle jette
 * « Vercel Blob: Failed to retrieve the client token » dès que la route rend
 * autre chose qu'un jeton, que ce soit un refus de rôle ou un stockage non
 * provisionné. Ce message-là ne s'adresse pas à celui qui essaie de poser une
 * photo — il ne lui dit ni ce qui manque, ni s'il y peut quelque chose.
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

/** Même prédicat que le schéma d'écriture : un chemin interne ou une URL http(s). */
function isUsableUrl(value: string): boolean {
  return value.startsWith('/') || /^https?:\/\//.test(value)
}

export function ImageDropzone({
  value,
  onChange,
  max = 10,
  hint,
}: {
  /** Les URLs déjà retenues. La PREMIÈRE sert de couverture. */
  value: string[]
  onChange: (next: string[]) => void
  max?: number
  hint?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [showUrl, setShowUrl] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')

  // Les entrées vides ne sont pas des images : `imageUrls` démarre à `['']`
  // dans les formulaires, et les compter ferait afficher « 1 / 10 » sur une
  // zone vide.
  const images = value.filter((url) => url.trim().length > 0)
  const full = images.length >= max
  const single = max === 1

  function replace(next: string[]) {
    onChange(next)
  }

  function addUrls(urls: string[]) {
    // `slice` au cas où plusieurs fichiers sont déposés d'un coup : on prend ce
    // qui tient et on le dit, plutôt que d'en perdre en silence.
    const room = max - images.length
    replace([...images, ...urls.slice(0, room)])
    if (urls.length > room) {
      setError(`Seules ${room} photo(s) supplémentaires étaient acceptées.`)
    }
  }

  async function uploadFiles(files: File[]) {
    setError(null)

    const accepted = files.filter((f) => f.type.startsWith('image/'))
    if (accepted.length === 0) {
      setError('Choisissez une image (JPEG, PNG, WebP ou AVIF).')
      return
    }

    // Vérifié ici EN PLUS du serveur, pas à sa place : refuser 20 Mo avant de
    // les téléverser évite de faire attendre pour rien.
    const tooBig = accepted.find((f) => f.size > MAX_SIZE_BYTES)
    if (tooBig) {
      setError(
        `« ${tooBig.name} » dépasse 8 Mo. Redimensionnez-la avant l’envoi.`,
      )
      return
    }

    setBusy(true)
    try {
      const uploaded: string[] = []
      // En série, pas en parallèle : plusieurs photos de 8 Mo envoyées
      // simultanément depuis une connexion mauricienne se gênent entre elles,
      // et la barre d'attente ne dirait plus rien de l'avancement.
      for (const file of accepted.slice(0, max - images.length)) {
        const blob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: '/api/upload',
        })
        uploaded.push(blob.url)
      }
      replace([...images, ...uploaded])
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
        multiple={!single}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) void uploadFiles(files)
        }}
      />

      {/* La zone est un <button> et non une <div onClick> : elle doit être
          atteignable au clavier et annoncée comme actionnable. Le glisser-
          déposer se greffe dessus, il ne le remplace pas — un lecteur d'écran
          ne peut pas déposer de fichier. */}
      <button
        type="button"
        disabled={busy || full}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy && !full) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (busy || full) return
          const files = Array.from(e.dataTransfer.files)
          if (files.length > 0) void uploadFiles(files)
        }}
        className={`w-full rounded-2xl border-2 border-dashed bg-white transition-colors flex flex-col items-center justify-center gap-2 text-center px-4 ${
          single ? 'h-32' : 'h-40'
        } ${
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-muted/40 hover:border-primary/60'
        } ${busy || full ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {busy ? (
          <>
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="text-sm text-muted">Envoi en cours…</span>
          </>
        ) : full ? (
          <span className="text-sm text-muted">
            {single
              ? 'Image choisie — retirez-la pour en mettre une autre'
              : `Maximum atteint (${max} photos)`}
          </span>
        ) : (
          <>
            <ImagePlus className="w-7 h-7 text-muted" />
            <span className="text-sm font-medium text-ink">
              Glissez {single ? 'une image' : 'vos photos'} ici, ou cliquez pour
              parcourir
            </span>
            <span className="text-xs text-muted">
              JPEG, PNG, WebP ou AVIF — 8 Mo maximum
              {!single && images.length > 0 && ` · ${images.length}/${max}`}
            </span>
          </>
        )}
      </button>

      {hint && <p className="text-xs text-muted mt-2">{hint}</p>}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {images.length > 0 && (
        <ul
          className={`mt-3 grid gap-3 ${
            single ? 'grid-cols-1 max-w-[12rem]' : 'grid-cols-3 sm:grid-cols-4'
          }`}
        >
          {images.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className="relative group rounded-xl overflow-hidden border border-muted/20 bg-base aspect-[4/3]"
            >
              {/* `unoptimized` : les URLs Blob et les chemins internes ne
                  passent pas par le même pipeline, et `images.unoptimized` est
                  déjà posé globalement (cf. CLAUDE.md). */}
              <Image
                src={url}
                alt=""
                fill
                unoptimized
                className="object-cover"
              />

              {/* La première image est la COUVERTURE : c'est elle qu'on voit
                  dans le catalogue. Le dire sur la vignette évite d'avoir à
                  l'expliquer en légende — et de découvrir l'ordre après coup. */}
              {!single && index === 0 && (
                <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-ink/80 text-white text-[10px] font-medium">
                  <Star className="w-2.5 h-2.5" />
                  Couverture
                </span>
              )}

              {!single && index > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    // Promue en tête : le réordonnancement complet par
                    // glisser-déposer serait un autre chantier, alors que le
                    // seul ordre qui compte vraiment est « laquelle est la
                    // couverture ».
                    const next = [...images]
                    const [picked] = next.splice(index, 1)
                    replace([picked, ...next])
                  }}
                  className="absolute bottom-1 left-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/90 text-ink text-[10px] font-medium opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                >
                  <Star className="w-2.5 h-2.5" />
                  Couverture
                </button>
              )}

              <button
                type="button"
                onClick={() => replace(images.filter((_, i) => i !== index))}
                aria-label="Retirer cette image"
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-ink/80 text-white flex items-center justify-center hover:bg-red-600 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Replié par défaut : c'est un chemin de secours, pas une alternative
          qu'on propose. Le déplier reste indispensable tant que le stockage
          Blob n'existe pas — et pour les visuels déjà hébergés dans le dépôt. */}
      {!full && (
        <div className="mt-3">
          {showUrl ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={urlDraft}
                autoFocus
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  const trimmed = urlDraft.trim()
                  if (!isUsableUrl(trimmed)) return
                  addUrls([trimmed])
                  setUrlDraft('')
                }}
                placeholder="/images/regions/east.jpg ou https://…"
                className="flex-1 px-3 h-10 rounded-xl border border-surface bg-base text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                disabled={!isUsableUrl(urlDraft.trim())}
                onClick={() => {
                  addUrls([urlDraft.trim()])
                  setUrlDraft('')
                }}
                className="h-10 px-4 rounded-xl border border-muted/30 text-sm font-medium disabled:opacity-40"
              >
                Ajouter
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUrl(false)
                  setUrlDraft('')
                }}
                className="h-10 px-3 rounded-xl text-sm text-muted hover:text-ink"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowUrl(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary"
            >
              <Link2 className="w-3.5 h-3.5" />
              Coller une adresse à la place
            </button>
          )}
        </div>
      )}
    </div>
  )
}
