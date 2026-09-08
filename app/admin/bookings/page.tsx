'use client'

import { useState } from 'react'
import Link from 'next/link'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, Loader2, Mail, MessageCircle, Phone, Search, X } from 'lucide-react'
import {
  ADMIN_STATUS_TRANSITIONS,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_STYLE,
} from '@/lib/booking-status'
import { useTRPC } from '@/lib/trpc/client'
import { formatEUR } from '@/lib/format'
import { mauritiusDateTime } from '@/lib/datetime'
import { whatsAppLink } from '@/lib/whatsapp'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { AdminBookingRow } from '@/types/admin'
import type { BookingStatus } from '@/types/cart'

// Listing des réservations.
//
// Le back-office ne montrait qu'un COMPTEUR de réservations sur la vue
// d'ensemble. La mise en relation entre un touriste et son opérateur étant
// manuelle, l'admin devait ouvrir la base pour retrouver un numéro. Chaque
// ligne porte donc les deux contacts, cliquables.

const PERIODS = [
  { value: 'upcoming', label: 'À venir' },
  { value: 'past', label: 'Passées' },
  { value: 'all', label: 'Toutes' },
] as const

// Les libellés reprennent ceux de `lib/booking-status.ts` : un filtre qui
// nommerait un état autrement que la pastille de la carte est un piège.
const STATUSES = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'pending_validation', label: BOOKING_STATUS_LABEL.pending_validation },
  { value: 'confirmed', label: BOOKING_STATUS_LABEL.confirmed },
  { value: 'completed', label: BOOKING_STATUS_LABEL.completed },
  { value: 'cancelled', label: BOOKING_STATUS_LABEL.cancelled },
  { value: 'expired', label: BOOKING_STATUS_LABEL.expired },
] as const

/** Contact cliquable. Un numéro qu'il faut recopier à la main ne sert à rien. */
function Contact({
  name,
  email,
  phone,
}: {
  name: string
  email: string
  phone?: string | null
}) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-ink truncate">{name}</p>
      <a
        href={`mailto:${email}`}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-primary truncate"
      >
        <Mail className="w-3 h-3 shrink-0" />
        {email}
      </a>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-primary"
        >
          <Phone className="w-3 h-3 shrink-0" />
          {phone}
        </a>
      )}
    </div>
  )
}

/**
 * Messages pré-remplis des deux conversations.
 *
 * Deux destinataires, deux textes : l'opérateur a besoin de savoir QUI vient et
 * quand, le client de savoir que sa place est retenue. Un message unique aurait
 * envoyé au touriste ses propres coordonnées.
 *
 * Dans les deux cas la référence ouvre le message : opérateur comme client
 * reçoivent des conversations de plusieurs sources, un « Bonjour » nu les
 * obligerait à demander de quoi il s'agit.
 */
function operatorMessage(booking: AdminBookingRow): string {
  return [
    `Bonjour ${booking.operatorName},`,
    `Au sujet de la réservation ${booking.bookingRef} sur Trip4mauritius :`,
    `${booking.activityTitle} — départ le ${booking.date} à ${booking.time}, ${booking.participants} participant(s).`,
    `Client : ${booking.touristName}${booking.contactPhone ? ` (${booking.contactPhone})` : ''}.`,
    `Confirmez-vous la prise en charge ?`,
  ].join('\n')
}

function touristMessage(booking: AdminBookingRow): string {
  return [
    `Bonjour ${booking.touristName},`,
    `Trip4mauritius, au sujet de votre réservation ${booking.bookingRef} :`,
    `${booking.activityTitle} — départ le ${booking.date} à ${booking.time}, ${booking.participants} participant(s).`,
  ].join('\n')
}

/**
 * Bouton de contact WhatsApp.
 *
 * `whatsAppLink` rend `null` quand le numéro manque ou n'a pas d'indicatif —
 * on affiche alors POURQUOI, au lieu d'un lien mort qui ouvrirait WhatsApp sur
 * « numéro invalide » et ferait croire à une panne.
 *
 * Aucune connexion n'est nécessaire : `wa.me` ouvre simplement la conversation
 * avec le numéro, message pré-rempli, dans l'application déjà installée.
 */
function WhatsAppButton({
  phone,
  message,
  label,
  missingHint,
}: {
  phone: string | null
  message: string
  label: string
  missingHint: string
}) {
  const link = whatsAppLink(phone, message)

  if (!link) {
    return (
      <span
        title={missingHint}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/15 text-muted text-xs font-medium cursor-not-allowed"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Pas de WhatsApp
      </span>
    )
  }

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold hover:brightness-95 transition"
    >
      <MessageCircle className="w-3.5 h-3.5" />
      {label}
    </a>
  )
}

/**
 * Boutons de transition, dessinés à partir de `ADMIN_STATUS_TRANSITIONS`.
 *
 * L'écran ne connaît AUCUNE règle : il lit la table et affiche ce qu'elle
 * autorise depuis l'état courant. Le serveur revalide la même table. Une liste
 * écrite ici aurait fini par proposer un bouton que la procédure rejette.
 */
function StatusActions({ booking }: { booking: AdminBookingRow }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const move = useMutation(
    trpc.admin.setBookingStatus.mutationOptions({
      onSuccess: () => {
        setError(null)
        queryClient.invalidateQueries({ queryKey: trpc.admin.bookings.pathKey() })
        // Le résumé compte les réservations « Créée » : le laisser périmé
        // afficherait une file d'attente qu'on vient de vider.
        queryClient.invalidateQueries({ queryKey: trpc.admin.overview.queryKey() })
      },
      onError: (e) => setError(e.message),
    }),
  )

  const allowed = ADMIN_STATUS_TRANSITIONS[booking.status]
  if (allowed.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-muted/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted mr-1">Faire passer à</span>
        {allowed.map((target) => {
          const destructive = target === 'cancelled'
          return (
            <button
              key={target}
              type="button"
              disabled={move.isPending}
              onClick={() =>
                move.mutate({ bookingId: booking.id, status: target })
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                destructive
                  ? 'border border-red-200 text-red-700 hover:bg-red-50'
                  : 'bg-primary text-white hover:brightness-95'
              }`}
            >
              {move.isPending && move.variables?.status === target ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : destructive ? (
                <X className="w-3.5 h-3.5" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              {BOOKING_STATUS_LABEL[target]}
            </button>
          )
        })}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}

function BookingCard({ booking }: { booking: AdminBookingRow }) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-muted/10 px-5 py-4">
      {/* En-tête : UNIQUEMENT ce qui décrit la réservation.
          Les coordonnées et les contacts sont derrière les accordéons — l'admin
          parcourt d'abord une liste, il cherche une réservation, il n'appelle
          personne à ce stade. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm font-semibold text-ink">
              {booking.bookingRef}
            </code>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${BOOKING_STATUS_STYLE[booking.status]}`}
            >
              {BOOKING_STATUS_LABEL[booking.status]}
            </span>
            {booking.departed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted/20 text-muted">
                Départ passé
              </span>
            )}
          </div>
          <Link
            href={`/activities/${booking.activitySlug}`}
            className="text-sm text-muted hover:text-primary"
          >
            {booking.activityTitle}
          </Link>
          <p className="text-xs text-muted mt-0.5">
            Départ {booking.date} à {booking.time} · {booking.participants} pers.
          </p>
          {/* Quand la réservation a été PASSÉE — à ne pas confondre avec le
              départ juste au-dessus. Sans cette date, impossible de savoir si
              une demande date d'une heure ou de trois semaines. */}
          <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
            <Clock className="w-3 h-3 shrink-0" />
            Commandée le {mauritiusDateTime(new Date(booking.createdAt))}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="font-semibold text-ink">
            {formatEUR(booking.totalPrice)}
          </p>
          <p className="text-xs text-muted">
            acompte {formatEUR(booking.depositDue)}
          </p>
          <p className="text-xs text-muted">
            sur place {formatEUR(booking.balanceDueOnSite)}
          </p>
        </div>
      </div>

      <StatusActions booking={booking} />

      {/* Un contact par accordéon, chacun avec SON bouton.
          `multiple` et non `single` : comparer client et opérateur est
          précisément le geste que cet écran doit permettre, les refermer l'un
          l'autre le gênerait. Le nom reste sur le titre, donc lisible sans
          ouvrir. */}
      <Accordion type="multiple" className="mt-2 border-t border-muted/10">
        <AccordionItem value="tourist" className="border-muted/10">
          <AccordionTrigger className="py-2.5 hover:no-underline">
            <span className="text-xs text-muted">
              <span className="font-semibold uppercase tracking-wide">
                Client
              </span>
              {' · '}
              <span className="text-ink font-medium">{booking.touristName}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-3 space-y-3">
            <Contact
              name={booking.touristName}
              email={booking.touristEmail}
              phone={booking.contactPhone}
            />
            <WhatsAppButton
              phone={booking.contactPhone}
              message={touristMessage(booking)}
              label="Contacter le client"
              missingHint="Ce client n'a pas laissé de numéro exploitable (indicatif pays manquant)."
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="operator" className="border-muted/10">
          <AccordionTrigger className="py-2.5 hover:no-underline">
            <span className="text-xs text-muted">
              <span className="font-semibold uppercase tracking-wide">
                Opérateur
              </span>
              {' · '}
              <span className="text-ink font-medium">
                {booking.operatorName}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-3 space-y-3">
            <Contact
              name={booking.operatorName}
              email={booking.operatorEmail}
              phone={booking.operatorWhatsapp}
            />
            <WhatsAppButton
              phone={booking.operatorWhatsapp}
              message={operatorMessage(booking)}
              label="Contacter l'opérateur"
              missingHint="Renseignez le numéro WhatsApp de cet opérateur depuis /admin/operators."
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

export default function AdminBookingsPage() {
  const trpc = useTRPC()
  const [page, setPage] = useState(1)
  const [period, setPeriod] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [status, setStatus] = useState<string>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery(
    trpc.admin.bookings.queryOptions(
      {
        page,
        period,
        status: status as 'all',
        search: search.trim() || undefined,
      },
      {
        // Sans ça, changer de page ou de filtre vide la liste puis la repeint :
        // la hauteur saute et on perd sa place.
        placeholderData: keepPreviousData,
      },
    ),
  )

  const resetTo = (fn: () => void) => {
    fn()
    setPage(1)
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="font-body font-bold text-3xl text-ink">Réservations</h1>
        <p className="text-muted mt-1">
          Toutes les réservations de la plateforme, avec les coordonnées du
          client et de l&apos;opérateur — la mise en relation est manuelle.
        </p>
      </header>

      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={search}
            onChange={(e) => resetTo(() => setSearch(e.target.value))}
            placeholder="Référence MX-…, nom ou email du client"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-surface bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => resetTo(() => setPeriod(p.value))}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                period === p.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-muted border-muted/20 hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}

          <select
            value={status}
            onChange={(e) => resetTo(() => setStatus(e.target.value))}
            className="ml-auto px-3 py-1.5 rounded-xl text-sm border border-muted/20 bg-white focus:outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            // Hauteur alignée sur la carte repliée : un squelette plus haut que
            // le contenu réel fait sauter la page au premier rendu.
            <div
              key={i}
              className="bg-white rounded-2xl h-40 animate-pulse border border-muted/10"
            />
          ))}
        </div>
      ) : data.bookings.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-muted/10 p-10 text-center">
          <p className="text-muted">Aucune réservation ne correspond.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted mb-3">
            {data.total} réservation{data.total > 1 ? 's' : ''}
          </p>

          <div className="space-y-4">
            {data.bookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl border border-muted/20 text-sm disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-sm text-muted">
                {page} / {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="px-4 py-2 rounded-xl border border-muted/20 text-sm disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
