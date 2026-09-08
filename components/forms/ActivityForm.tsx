'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { ImageUploadButton } from '@/components/forms/ImageUploadButton'
import { useTRPC } from '@/lib/trpc/client'
import { DURATIONS } from '@/lib/durations'
import { REGIONS, REGION_VALUES } from '@/lib/regions'
import type { ActivityInput } from '@/lib/schemas/operator'
import type { OperatorActivityDetail } from '@/types/operator'

// Formulaire de création / édition d'activité.
//
// Deux écarts avec la version précédente, tous deux dictés par le schéma réel :
//
// 1. La base stocke des URLs, jamais un fichier encodé en base64 — un base64 de
//    1 Mo dans `imageUrls` serait relu à chaque affichage du catalogue. L'envoi
//    de fichiers existe désormais (`ImageUploadButton`), mais il ne change rien
//    à cette règle : le fichier part vers Vercel Blob et c'est son URL qui est
//    enregistrée.
// 2. La description n'a plus de découpage court/long — la base stocke un objet
//    multilingue. Le français est obligatoire, les autres langues sont
//    facultatives et retombent sur lui à l'affichage.

// Les catégories viennent de la base (`activity.categories`).
//
// La liste en dur qui vivait ici — « Cultural », « Gastronomy », « Nightlife »,
// « Family » — ne correspondait ni à celle du tiroir de filtres ni à celle de
// l'accueil. Un opérateur pouvait classer son activité dans « Nightlife », que
// personne ne pouvait ensuite filtrer.

// Régions et durées : mêmes sources uniques que le tiroir de filtres.
//
// Ce fichier portait sa propre liste de durées — « 1 hour », « 2 hours »,
// « 3 hours », « 2 days » — dont AUCUNE n'était proposée au visiteur. Une
// activité saisie « 3 hours » n'apparaissait donc dans aucun filtre de durée,
// exactement comme les catégories inventées décrites ci-dessus.
const LANGUAGES = [
  { code: 'FR', label: 'Français' },
  { code: 'EN', label: 'Anglais' },
  { code: 'DE', label: 'Allemand' },
  { code: 'ES', label: 'Espagnol' },
  { code: 'RU', label: 'Russe' },
]

const TRANSLATIONS = [
  { key: 'en', label: 'Anglais' },
  { key: 'de', label: 'Allemand' },
  { key: 'es', label: 'Espagnol' },
  { key: 'ru', label: 'Russe' },
] as const

/**
 * L'état du formulaire, pas encore validé : région et durée y valent `''` tant
 * que rien n'est choisi, alors que `ActivityInput` n'accepte que des valeurs
 * réelles. C'est le `<select>` qui garantit qu'on n'en sortira jamais autre
 * chose, et Zod qui refuse le `''` à la soumission.
 */
type FormState = Omit<ActivityInput, 'region' | 'duration'> & {
  region: ActivityInput['region'] | ''
  duration: ActivityInput['duration'] | ''
}

const EMPTY: FormState = {
  title: '',
  categoryId: '',
  region: '',
  duration: '',
  description: { fr: '', en: '', de: '', es: '', ru: '' },
  priceHT: 0,
  maxParticipants: 10,
  languages: ['EN'],
  imageUrls: [''],
  included: [''],
  excluded: [''],
}

/**
 * Ramène une valeur venue de la base dans la liste fermée, ou à `''`.
 *
 * La base contient encore des activités saisies avant que région et durée
 * soient contraintes. Les recharger telles quelles remettrait dans le
 * formulaire une valeur qu'aucune option ne propose : le `<select>` afficherait
 * un choix vide sans le dire, et l'enregistrement échouerait à la validation
 * sans que rien ne désigne le champ fautif. Retomber sur « Choisir… » rend le
 * problème visible et forçe la correction.
 */
function knownOr<T extends string>(
  value: string,
  allowed: readonly T[],
): T | '' {
  return (allowed as readonly string[]).includes(value) ? (value as T) : ''
}

function fromDetail(detail: OperatorActivityDetail): FormState {
  return {
    title: detail.title,
    categoryId: detail.categoryId,
    region: knownOr(detail.region, REGION_VALUES),
    duration: knownOr(detail.duration, DURATIONS),
    description: detail.description,
    priceHT: detail.priceHT,
    maxParticipants: detail.maxParticipants,
    languages: detail.languages,
    imageUrls: detail.imageUrls.length > 0 ? detail.imageUrls : [''],
    included: detail.included.length > 0 ? detail.included : [''],
    excluded: detail.excluded.length > 0 ? detail.excluded : [''],
  }
}

/** Liste de champs texte répétables (inclus, non inclus, images). */
function RepeatableList({
  label,
  placeholder,
  values,
  onChange,
  max = 10,
}: {
  label: string
  placeholder: string
  values: string[]
  onChange: (next: string[]) => void
  max?: number
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-ink">{label}</label>
        {values.length < max && (
          <button
            type="button"
            onClick={() => onChange([...values, ''])}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        )}
      </div>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) =>
                onChange(values.map((v, i) => (i === index ? e.target.value : v)))
              }
              className="flex-1 px-4 py-2 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder={placeholder}
            />
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                aria-label="Retirer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface ActivityFormProps {
  /** Fourni ⇒ le formulaire édite ; absent ⇒ il crée. */
  activity?: OperatorActivityDetail
  /**
   * Qui écrit.
   *
   * `operator` (défaut) écrit sous `ctx.operator.id` et renvoie une fiche
   * publiée en modération. `admin` écrit pour l'opérateur désigné et ne touche
   * pas au statut. Un seul formulaire pour les deux : c'est la même saisie, et
   * deux copies auraient divergé dès le premier champ ajouté au schéma.
   */
  scope?: 'operator' | 'admin'
  /** Obligatoire en `scope="admin"` à la création : pour quel opérateur. */
  operatorId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function ActivityForm({
  activity,
  scope = 'operator',
  operatorId,
  onSuccess,
  onCancel,
}: ActivityFormProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(
    activity ? fromDetail(activity) : EMPTY,
  )

  // Seules les catégories ACTIVES sont proposées. Une activité déjà classée
  // dans une catégorie désactivée garde la sienne — c'est `fromDetail` qui la
  // pose — mais personne ne peut plus en choisir une nouvelle.
  const { data: categories = [] } = useQuery(
    trpc.activity.categories.queryOptions(),
  )

  const isAdmin = scope === 'admin'

  const invalidate = () => {
    if (isAdmin) {
      queryClient.invalidateQueries({
        queryKey: trpc.admin.activities.queryKey(),
      })
      queryClient.invalidateQueries({ queryKey: trpc.admin.overview.queryKey() })
      return
    }

    queryClient.invalidateQueries({
      queryKey: trpc.operator.listActivities.queryKey(),
    })
    queryClient.invalidateQueries({ queryKey: trpc.operator.stats.queryKey() })
  }

  // Les quatre mutations sont déclarées inconditionnellement : un `useMutation`
  // derrière un `if` violerait les règles des hooks au premier changement de
  // `scope`. C'est `handleSubmit` qui choisit, pas le rendu.
  const done = {
    onSuccess: () => {
      invalidate()
      onSuccess?.()
    },
  }

  const operatorCreate = useMutation(
    trpc.operator.createActivity.mutationOptions(done),
  )
  const operatorUpdate = useMutation(
    trpc.operator.updateActivity.mutationOptions(done),
  )
  const adminCreate = useMutation(
    trpc.admin.createActivity.mutationOptions(done),
  )
  const adminUpdate = useMutation(
    trpc.admin.updateActivity.mutationOptions(done),
  )

  const pending =
    operatorCreate.isPending ||
    operatorUpdate.isPending ||
    adminCreate.isPending ||
    adminUpdate.isPending

  const error =
    operatorCreate.error ??
    operatorUpdate.error ??
    adminCreate.error ??
    adminUpdate.error

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const canProceed = () => {
    switch (step) {
      case 1:
        return Boolean(
          form.title.trim().length >= 3 &&
            form.categoryId &&
            form.region &&
            form.description.fr.trim(),
        )
      case 2:
        return (
          form.priceHT > 0 && Boolean(form.duration) && form.languages.length > 0
        )
      case 3:
        return form.imageUrls.some((url) => url.trim())
      default:
        return true
    }
  }

  const handleSubmit = () => {
    // Région et durée sont obligatoires — l'étape 1 et l'étape 2 refusent déjà
    // d'avancer sans elles. Le rappeler ici sort le `''` du type, et couvre le
    // jour où quelqu'un desserrera `canProceed`.
    if (!form.region || !form.duration) return

    // Les lignes vides des listes répétables sont retirées ici plutôt que
    // laissées au serveur : le schéma les filtre aussi, mais l'utilisateur doit
    // voir ce qui part.
    const payload: ActivityInput = {
      ...form,
      region: form.region,
      duration: form.duration,
      imageUrls: form.imageUrls.map((u) => u.trim()).filter(Boolean),
      included: form.included.map((i) => i.trim()).filter(Boolean),
      excluded: form.excluded.map((i) => i.trim()).filter(Boolean),
      description: {
        fr: form.description.fr.trim(),
        // Une traduction vide ne doit pas être stockée : c'est le repli à la
        // lecture qui comblera, et une chaîne vide en base masquerait ce repli.
        en: form.description.en?.trim() || undefined,
        de: form.description.de?.trim() || undefined,
        es: form.description.es?.trim() || undefined,
        ru: form.description.ru?.trim() || undefined,
      },
    }

    if (activity) {
      const variables = { activityId: activity.id, data: payload }
      if (isAdmin) adminUpdate.mutate(variables)
      else operatorUpdate.mutate(variables)
      return
    }

    if (isAdmin) {
      // Garde d'affichage : le bouton est déjà désactivé sans opérateur choisi.
      // Elle existe pour que l'oubli soit une erreur ici, et non une requête
      // rejetée par Zod que l'admin lirait comme un bug.
      if (!operatorId) return
      adminCreate.mutate({ operatorId, data: payload })
      return
    }

    operatorCreate.mutate(payload)
  }

  const steps = [
    { number: 1, label: 'Informations' },
    { number: 2, label: 'Détails' },
    { number: 3, label: 'Photos' },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => (
          <div key={s.number} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                step >= s.number ? 'bg-primary text-white' : 'bg-surface text-muted'
              }`}
            >
              {step > s.number ? <Check className="w-5 h-5" /> : s.number}
            </div>
            <span
              className={`ml-2 text-sm hidden sm:block ${
                step >= s.number ? 'text-ink font-medium' : 'text-muted'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`w-8 sm:w-16 h-0.5 mx-2 sm:mx-4 ${
                  step > s.number ? 'bg-primary' : 'bg-surface'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Titre de l&apos;activité *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Croisière en catamaran au coucher du soleil"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Catégorie *
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
                disabled={categories.length === 0}
                className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              >
                <option value="">
                  {categories.length === 0 ? 'Chargement…' : 'Choisir…'}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji ? `${c.emoji} ${c.label}` : c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Région *
              </label>
              <select
                value={form.region}
                onChange={(e) => set('region', e.target.value as FormState['region'])}
                className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Choisir…</option>
                {/* On affiche le libellé français, on enregistre la valeur
                    stockée en base. */}
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Description en français *
            </label>
            <textarea
              value={form.description.fr}
              onChange={(e) =>
                set('description', { ...form.description, fr: e.target.value })
              }
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Décrivez le déroulé, ce que le client va vivre, les points forts…"
            />
          </div>

          <details className="rounded-xl border border-surface p-4">
            <summary className="text-sm font-medium text-ink cursor-pointer">
              Traductions (facultatives)
            </summary>
            <p className="text-xs text-muted mt-2 mb-4">
              Laissez vide pour afficher le texte français aux visiteurs de cette
              langue. Mieux vaut un français assumé qu&apos;une fausse
              traduction.
            </p>
            <div className="space-y-4">
              {TRANSLATIONS.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm text-muted mb-1">{label}</label>
                  <textarea
                    value={form.description[key] ?? ''}
                    onChange={(e) =>
                      set('description', {
                        ...form.description,
                        [key]: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Prix par personne (€) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.priceHT || ''}
                onChange={(e) => set('priceHT', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="0.00"
              />
              {form.priceHT > 0 && (
                <p className="text-xs text-muted mt-1">
                  Acompte perçu : {(form.priceHT * 0.2).toFixed(2)} € · solde sur
                  place : {(form.priceHT * 0.8).toFixed(2)} €
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Durée *
              </label>
              <select
                value={form.duration}
                onChange={(e) => set('duration', e.target.value as FormState['duration'])}
                className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Choisir…</option>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-2">
                Participants max. *
              </label>
              <input
                type="number"
                min="1"
                value={form.maxParticipants}
                onChange={(e) =>
                  set('maxParticipants', parseInt(e.target.value) || 1)
                }
                className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Langues parlées *
            </label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() =>
                    set(
                      'languages',
                      form.languages.includes(lang.code)
                        ? form.languages.filter((l) => l !== lang.code)
                        : [...form.languages, lang.code],
                    )
                  }
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    form.languages.includes(lang.code)
                      ? 'bg-primary text-white'
                      : 'bg-surface text-muted hover:bg-surface/80'
                  }`}
                >
                  {lang.code} — {lang.label}
                </button>
              ))}
            </div>
          </div>

          <RepeatableList
            label="Ce qui est inclus"
            placeholder="Déjeuner, équipement, guide…"
            values={form.included}
            onChange={(v) => set('included', v)}
          />

          <RepeatableList
            label="Ce qui n'est pas inclus"
            placeholder="Transferts hôtel, pourboires…"
            values={form.excluded}
            onChange={(v) => set('excluded', v)}
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted mb-4">
              Envoyez vos photos depuis votre ordinateur, ou indiquez
              l&apos;adresse d&apos;images déjà hébergées : un chemin interne
              (<code>/images/…</code>) ou une URL <code>https://</code>. La
              première sert de photo de couverture.
            </p>

            {/* L'envoi remplit la première ligne vide de la liste plutôt que
                d'en ajouter une : `imageUrls` démarre à `['']`, et empiler
                sans cela laisserait une entrée vide en tête — donc une
                couverture vide. */}
            <div className="mb-4">
              <ImageUploadButton
                onUploaded={(url) =>
                  set(
                    'imageUrls',
                    (() => {
                      const next = [...form.imageUrls]
                      const slot = next.findIndex((u) => !u.trim())
                      if (slot === -1) next.push(url)
                      else next[slot] = url
                      return next
                    })(),
                  )
                }
              />
            </div>

            <RepeatableList
              label="Photos *"
              placeholder="/images/regions/east.jpg"
              values={form.imageUrls}
              onChange={(v) => set('imageUrls', v)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {form.imageUrls
              .filter((u) => u.trim())
              .map((url, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-xl overflow-hidden bg-surface"
                >
                  {/* <img> volontairement, pas next/image : l'URL est saisie à
                      la main et peut pointer n'importe où — l'optimiseur
                      refuserait un domaine non déclaré et casserait l'aperçu. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Aperçu ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute bottom-2 left-2 px-2 py-1 bg-primary text-white text-xs rounded-lg">
                      Couverture
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm mt-6">{error.message}</p>
      )}

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-surface">
        <button
          type="button"
          onClick={() => (step === 1 ? onCancel?.() : setStep((s) => s - 1))}
          className="flex items-center gap-2 px-6 py-3 text-muted hover:text-ink"
        >
          <ChevronLeft className="w-5 h-5" />
          {step === 1 ? 'Annuler' : 'Retour'}
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Suivant
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              !canProceed() || pending || (isAdmin && !activity && !operatorId)
            }
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            {activity ? 'Enregistrer' : 'Créer le brouillon'}
          </button>
        )}
      </div>
    </div>
  )
}
