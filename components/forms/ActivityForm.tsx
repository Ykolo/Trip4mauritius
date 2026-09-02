'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import type { ActivityInput } from '@/lib/schemas/operator'
import type { OperatorActivityDetail } from '@/types/operator'

// Formulaire de création / édition d'activité.
//
// Deux écarts avec la version précédente, tous deux dictés par le schéma réel :
//
// 1. Les images sont des URLs, pas des fichiers encodés en base64. Un base64 de
//    1 Mo stocké dans `imageUrls` serait relu à chaque affichage du catalogue.
//    L'upload arrivera avec Vercel Blob.
// 2. La description n'a plus de découpage court/long — la base stocke un objet
//    multilingue. Le français est obligatoire, les autres langues sont
//    facultatives et retombent sur lui à l'affichage.

// Les catégories viennent de la base (`activity.categories`).
//
// La liste en dur qui vivait ici — « Cultural », « Gastronomy », « Nightlife »,
// « Family » — ne correspondait ni à celle du tiroir de filtres ni à celle de
// l'accueil. Un opérateur pouvait classer son activité dans « Nightlife », que
// personne ne pouvait ensuite filtrer.

const REGIONS = ['North', 'South', 'East', 'West', 'Centre']

const DURATIONS = [
  '1 hour',
  '2 hours',
  '3 hours',
  'Half day',
  'Full day',
  '2 days',
]

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

type FormState = ActivityInput

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

function fromDetail(detail: OperatorActivityDetail): FormState {
  return {
    title: detail.title,
    categoryId: detail.categoryId,
    region: detail.region,
    duration: detail.duration,
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
  onSuccess?: () => void
  onCancel?: () => void
}

export function ActivityForm({
  activity,
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

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.operator.listActivities.queryKey(),
    })
    queryClient.invalidateQueries({ queryKey: trpc.operator.stats.queryKey() })
  }

  const create = useMutation(
    trpc.operator.createActivity.mutationOptions({
      onSuccess: () => {
        invalidate()
        onSuccess?.()
      },
    }),
  )

  const update = useMutation(
    trpc.operator.updateActivity.mutationOptions({
      onSuccess: () => {
        invalidate()
        onSuccess?.()
      },
    }),
  )

  const pending = create.isPending || update.isPending
  const error = create.error ?? update.error

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
    // Les lignes vides des listes répétables sont retirées ici plutôt que
    // laissées au serveur : le schéma les filtre aussi, mais l'utilisateur doit
    // voir ce qui part.
    const payload: FormState = {
      ...form,
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
      update.mutate({ activityId: activity.id, data: payload })
    } else {
      create.mutate(payload)
    }
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
                onChange={(e) => set('region', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-surface bg-base focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Choisir…</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
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
                onChange={(e) => set('duration', e.target.value)}
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
              Indiquez l&apos;adresse de vos photos : un chemin interne
              (<code>/images/…</code>) ou une URL <code>https://</code>. La
              première sert de photo de couverture.
            </p>
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
            disabled={!canProceed() || pending}
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
