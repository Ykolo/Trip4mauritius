'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, MessageCircle, Plus, Store } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import { MAURITIUS_DIAL_CODE } from '@/lib/whatsapp'
import type { AdminOperator } from '@/types/admin'

// Écran opérateurs — création et listing, plus de validation.
//
// Il portait une file de demandes d'accès avec « Valider » et « Révoquer ».
// L'auto-inscription ayant disparu au lot 1, il n'y a plus rien à valider : un
// opérateur existe parce que Trip4mauritius l'a créé.

function CreateOperatorForm({ onDone }: { onDone: () => void }) {
  const trpc = useTRPC()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation(
    trpc.admin.createOperator.mutationOptions({
      onSuccess: () => {
        setEmail('')
        setName('')
        setDisplayName('')
        setWhatsapp('')
        setError(null)
        onDone()
      },
      onError: (e) => setError(e.message),
    }),
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        create.mutate({ email, name, displayName, whatsapp })
      }}
      className="bg-white rounded-2xl shadow-card p-6 mb-6 space-y-4"
    >
      <h2 className="font-semibold text-ink">Nouvel opérateur</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="text-sm text-muted">Nom commercial</span>
          <input
            required
            maxLength={120}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Blue Safari Mauritius"
            className="mt-1 w-full h-11 px-3 rounded-xl border border-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <label className="block">
          <span className="text-sm text-muted">Contact</span>
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Prénom Nom"
            className="mt-1 w-full h-11 px-3 rounded-xl border border-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <label className="block">
          <span className="text-sm text-muted">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@exemple.mu"
            className="mt-1 w-full h-11 px-3 rounded-xl border border-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        {/* Facultatif, mais c'est ce numéro qui alimente le bouton WhatsApp du
            listing des réservations : sans lui le bouton reste grisé. */}
        <label className="block md:col-span-3">
          <span className="text-sm text-muted">
            WhatsApp <span className="text-muted/70">(facultatif)</span>
          </span>
          <input
            type="tel"
            inputMode="tel"
            maxLength={30}
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder={`${MAURITIUS_DIAL_CODE} 5789 1234`}
            className="mt-1 w-full h-11 px-3 rounded-xl border border-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <span className="text-xs text-muted mt-1 block">
            Format international, indicatif compris — c&apos;est ce numéro que le
            bouton WhatsApp des réservations composera.
          </span>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Dit explicitement ce que la création ne fait pas : sans ça, l'admin
          croit avoir ouvert un accès et l'opérateur ne peut pas se connecter. */}
      <p className="text-xs text-muted">
        Le compte est créé sans mot de passe. Son titulaire doit utiliser
        « mot de passe oublié » pour en choisir un. Si l&apos;adresse existe
        déjà, le compte est promu sans être modifié.
      </p>

      <button
        type="submit"
        disabled={create.isPending}
        className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60"
      >
        {create.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        Créer l&apos;opérateur
      </button>
    </form>
  )
}

/**
 * Numéro WhatsApp d'un opérateur déjà créé.
 *
 * En ligne, dans le listing, plutôt que derrière un écran d'édition : les
 * opérateurs existants n'ont AUCUN numéro (la colonne vient d'être ajoutée), et
 * l'admin doit pouvoir tous les renseigner d'affilée sans naviguer.
 */
function WhatsappField({
  operator,
  onSaved,
}: {
  operator: AdminOperator
  onSaved: () => void
}) {
  const trpc = useTRPC()
  const [value, setValue] = useState(operator.whatsapp ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = useMutation(
    trpc.admin.setOperatorWhatsapp.mutationOptions({
      onSuccess: () => {
        setError(null)
        setSaved(true)
        onSaved()
      },
      onError: (e) => {
        setSaved(false)
        setError(e.message)
      },
    }),
  )

  // Rien d'enregistré tant que la valeur n'a pas bougé : sans ça, un simple
  // passage au clavier dans la liste déclencherait autant d'écritures que de
  // champs traversés.
  const dirty = value.trim() !== (operator.whatsapp ?? '')

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <MessageCircle className="w-4 h-4 text-muted shrink-0" />
        <input
          type="tel"
          inputMode="tel"
          maxLength={30}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setSaved(false)
          }}
          placeholder={`${MAURITIUS_DIAL_CODE} 5789 1234`}
          className="flex-1 min-w-[10rem] h-9 px-3 rounded-lg border border-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate({ operatorId: operator.operatorId, whatsapp: value })
          }
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-muted/30 text-sm font-medium disabled:opacity-40"
        >
          {save.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : saved && !dirty ? (
            <Check className="w-3.5 h-3.5 text-green-600" />
          ) : null}
          {saved && !dirty ? 'Enregistré' : 'Enregistrer'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  )
}

export default function AdminOperatorsPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: operators, isLoading } = useQuery(
    trpc.admin.operators.queryOptions(),
  )

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="font-body font-bold text-3xl text-ink">Opérateurs</h1>
        <p className="text-muted mt-1">
          Les prestataires référencés sur la plateforme. Vous seul pouvez en
          créer.
        </p>
      </header>

      <CreateOperatorForm
        onDone={() =>
          queryClient.invalidateQueries({
            queryKey: trpc.admin.operators.queryKey(),
          })
        }
      />

      {isLoading || !operators ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 bg-white rounded-2xl shadow-card animate-pulse"
            />
          ))}
        </div>
      ) : operators.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-10 text-center">
          <Store className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-muted text-sm">
            Aucun opérateur pour le moment.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {operators.map((operator) => (
            <li
              key={operator.operatorId}
              className="bg-white rounded-2xl shadow-card p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">
                    {operator.displayName}
                  </p>
                  <p className="text-sm text-muted truncate">
                    {operator.userName} · {operator.userEmail}
                  </p>
                </div>
                <span className="text-sm text-muted whitespace-nowrap">
                  {operator.activityCount} activité
                  {operator.activityCount > 1 ? 's' : ''}
                </span>
              </div>

              <WhatsappField
                operator={operator}
                onSaved={() =>
                  queryClient.invalidateQueries({
                    queryKey: trpc.admin.operators.queryKey(),
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
