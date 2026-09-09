'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  Check,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Store,
  Trash2,
  X,
} from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import { PhoneInput } from '@/components/forms/PhoneInput'
import type { AdminOperator } from '@/types/admin'

// Écran opérateurs — création, édition, suppression ou désactivation.
//
// Il portait une file de demandes d'accès avec « Valider » et « Révoquer ».
// L'auto-inscription ayant disparu au lot 1, il n'y a plus rien à valider : un
// opérateur existe parce que Trip4mauritius l'a créé.
//
// Longtemps, il ne savait QUE créer : un nom mal saisi ou une adresse fautive
// n'avaient aucun chemin de correction, et une adresse fautive rend le compte
// définitivement inconnectable — son titulaire ne peut même pas demander une
// réinitialisation. D'où l'édition complète ci-dessous.
//
// Suppression et désactivation ne sont pas deux goûts : `slots → bookings` est
// en RESTRICT. Un opérateur qui a vendu ne se supprime pas sans effacer
// l'historique de touristes qui n'ont rien demandé. C'est le serveur qui
// tranche (`deletable`), l'écran ne fait qu'afficher la branche retenue.

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
            listing des réservations : sans lui le bouton reste grisé.
            L'indicatif est un SÉLECTEUR et non du texte : un numéro sans pays
            produit un lien wa.me qui n'ouvre la conversation de personne. */}
        <div className="md:col-span-3">
          <PhoneInput
            label="WhatsApp (facultatif)"
            value={whatsapp}
            onChange={setWhatsapp}
            hint="C'est ce numéro que le bouton WhatsApp des réservations composera."
          />
        </div>
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
 * Formulaire d'édition d'un opérateur.
 *
 * Il remplace l'ancien champ WhatsApp en ligne : celui-ci était le SEUL champ
 * modifiable, et le garder à part aurait laissé deux chemins d'écriture sur la
 * même colonne — le second finissant par oublier une validation que le premier
 * applique.
 *
 * `key={operator.operatorId}` côté appelant : l'état local est initialisé
 * depuis les props, et sans remontage il survivrait à un changement de ligne.
 */
function EditOperatorForm({
  operator,
  onDone,
  onCancel,
}: {
  operator: AdminOperator
  onDone: () => void
  onCancel: () => void
}) {
  const trpc = useTRPC()
  const [displayName, setDisplayName] = useState(operator.displayName)
  const [name, setName] = useState(operator.userName)
  const [email, setEmail] = useState(operator.userEmail)
  const [whatsapp, setWhatsapp] = useState(operator.whatsapp ?? '')
  const [avatarUrl, setAvatarUrl] = useState(operator.avatarUrl ?? '')
  const [error, setError] = useState<string | null>(null)

  const save = useMutation(
    trpc.admin.updateOperator.mutationOptions({
      onSuccess: () => {
        setError(null)
        onDone()
      },
      onError: (e) => setError(e.message),
    }),
  )

  const emailChanged = email.trim().toLowerCase() !== operator.userEmail

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        save.mutate({
          operatorId: operator.operatorId,
          displayName,
          name,
          email,
          whatsapp,
          avatarUrl,
        })
      }}
      className="mt-4 pt-4 border-t border-muted/10 space-y-4"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <label className="block">
          <span className="text-sm text-muted">Nom commercial</span>
          <input
            required
            maxLength={120}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
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
            className="mt-1 w-full h-11 px-3 rounded-xl border border-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
      </div>

      {/* L'email est l'identifiant de connexion, et le projet ne vérifie aucune
          adresse : le dire ici, au moment où l'admin la change, plutôt que de
          laisser découvrir plus tard qu'un opérateur ne peut plus se connecter. */}
      {emailChanged && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          C&apos;est l&apos;adresse de connexion de cet opérateur. Après
          enregistrement, il devra se connecter avec la nouvelle — son mot de
          passe, lui, ne change pas.
        </p>
      )}

      <PhoneInput
        label="WhatsApp"
        value={whatsapp}
        onChange={setWhatsapp}
        hint="Laisser vide retire le numéro : le bouton WhatsApp des réservations se grise."
      />

      <label className="block">
        <span className="text-sm text-muted">Logo (URL)</span>
        <input
          maxLength={500}
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="/images/operators/… ou https://…"
          className="mt-1 w-full h-11 px-3 rounded-xl border border-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-4 py-2 rounded-xl text-sm disabled:opacity-60"
        >
          {save.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-muted/30 text-sm font-medium"
        >
          <X className="w-4 h-4" />
          Annuler
        </button>
      </div>
    </form>
  )
}

/**
 * Suppression ou désactivation, selon ce que le SERVEUR autorise.
 *
 * L'écran ne rejoue aucune règle : il lit `deletable`, dérivé du nombre de
 * réservations par `listOperators`. La procédure recompte de son côté, sous
 * transaction — un bouton affiché n'a jamais autorisé quoi que ce soit.
 *
 * La suppression demande une confirmation en deux temps. Elle emporte les
 * activités et les créneaux, et rien ne la rejoue en arrière.
 */
function DangerZone({
  operator,
  onDone,
}: {
  operator: AdminOperator
  onDone: () => void
}) {
  const trpc = useTRPC()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlers = {
    onSuccess: () => {
      setError(null)
      setConfirming(false)
      onDone()
    },
    onError: (e: { message: string }) => setError(e.message),
  }

  const remove = useMutation(trpc.admin.deleteOperator.mutationOptions(handlers))
  const toggle = useMutation(
    trpc.admin.setOperatorActive.mutationOptions(handlers),
  )

  const pending = remove.isPending || toggle.isPending

  return (
    <div className="mt-4 pt-4 border-t border-muted/10">
      {!operator.active ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted flex-1 min-w-[14rem]">
            Opérateur désactivé. Le réactiver lui rend son accès, mais ses
            activités restent archivées — à remettre en ligne une par une depuis
            le catalogue.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              toggle.mutate({ operatorId: operator.operatorId, active: true })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60"
          >
            {toggle.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Réactiver
          </button>
        </div>
      ) : operator.deletable ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted flex-1 min-w-[14rem]">
            Aucune réservation : cet opérateur peut être supprimé
            définitivement, avec ses {operator.activityCount} activité
            {operator.activityCount > 1 ? 's' : ''}.
          </p>
          {confirming ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  remove.mutate({ operatorId: operator.operatorId })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {remove.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Confirmer la suppression
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-3 py-2 rounded-xl border border-muted/30 text-sm"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {/* Le motif en clair, pas un bouton grisé sans explication : sans le
              nombre, l'admin croit à une panne de l'écran. */}
          <p className="text-xs text-muted flex-1 min-w-[14rem]">
            {operator.bookingCount} réservation
            {operator.bookingCount > 1 ? 's' : ''} : la suppression effacerait
            l&apos;historique de clients qui n&apos;ont rien demandé. La
            désactivation archive ses activités et conserve tout.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              toggle.mutate({ operatorId: operator.operatorId, active: false })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
          >
            {toggle.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Ban className="w-4 h-4" />
            )}
            Désactiver
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}

function OperatorRow({
  operator,
  onChanged,
}: {
  operator: AdminOperator
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <li
      className={`bg-white rounded-2xl shadow-card p-5 ${
        operator.active ? '' : 'opacity-70'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-ink truncate">
              {operator.displayName}
            </p>
            {!operator.active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/20 text-muted">
                Désactivé
              </span>
            )}
          </div>
          <p className="text-sm text-muted truncate">
            {operator.userName} · {operator.userEmail}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {operator.activityCount} activité
            {operator.activityCount > 1 ? 's' : ''} ·{' '}
            {operator.bookingCount} réservation
            {operator.bookingCount > 1 ? 's' : ''}
            {operator.whatsapp ? ` · ${operator.whatsapp}` : ' · pas de WhatsApp'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-muted/30 text-sm font-medium shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
          {editing ? 'Fermer' : 'Modifier'}
        </button>
      </div>

      {editing && (
        <>
          <EditOperatorForm
            key={operator.operatorId}
            operator={operator}
            onDone={() => {
              setEditing(false)
              onChanged()
            }}
            onCancel={() => setEditing(false)}
          />
          <DangerZone operator={operator} onDone={onChanged} />
        </>
      )}
    </li>
  )
}

export default function AdminOperatorsPage() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: operators, isLoading } = useQuery(
    trpc.admin.operators.queryOptions(),
  )

  // Les DEUX requêtes, à chaque écriture. `operatorOptions` alimente le
  // sélecteur d'opérateur de /admin/activities et exclut les désactivés :
  // l'oublier laisserait proposer, à la création d'une fiche, un prestataire
  // dont on vient d'archiver tout le catalogue.
  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.admin.operators.queryKey(),
    })
    queryClient.invalidateQueries({
      queryKey: trpc.admin.operatorOptions.queryKey(),
    })
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="font-body font-bold text-3xl text-ink">Opérateurs</h1>
        <p className="text-muted mt-1">
          Les prestataires référencés sur la plateforme. Vous seul pouvez en
          créer, les modifier et les retirer.
        </p>
      </header>

      <CreateOperatorForm onDone={invalidate} />

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
            <OperatorRow
              key={operator.operatorId}
              operator={operator}
              onChanged={invalidate}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
