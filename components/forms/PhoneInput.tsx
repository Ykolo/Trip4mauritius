'use client'

import { useId } from 'react'
import {
  DEFAULT_DIAL_CODE,
  DIAL_CODES,
  joinPhone,
  splitPhone,
} from '@/lib/dial-codes'

// Saisie d'un numéro joignable sur WhatsApp.
//
// Un champ de texte libre produit `wa.me/0612345678` pour un Français qui tape
// son numéro par réflexe — un lien qui ouvre WhatsApp sur « numéro invalide »
// sans rien expliquer. Séparer l'indicatif du reste rend l'oubli impossible :
// il n'y a plus de numéro sans pays.
//
// Le composant est CONTRÔLÉ et ne connaît qu'une chaîne complète
// (`+230 5789 1234`) : c'est ce que stocke la base, et ce que `lib/whatsapp.ts`
// sait normaliser. Exposer deux champs séparés au reste de l'application aurait
// obligé chaque appelant à les recoller — donc, tôt ou tard, à les recoller
// différemment.

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  /** `null` = pas de contrainte. Sinon message affiché sous le champ. */
  error?: string | null
  label?: string
  hint?: string
  required?: boolean
  /** Numéros déjà en base, saisis avant ce composant : voir plus bas. */
  name?: string
  disabled?: boolean
}

export function PhoneInput({
  value,
  onChange,
  error,
  label = 'WhatsApp',
  hint,
  required = false,
  name,
  disabled = false,
}: PhoneInputProps) {
  const id = useId()
  const parsed = splitPhone(value)

  // Un numéro enregistré AVANT l'arrivée de ce composant peut ne porter aucun
  // indicatif connu. On retombe alors sur Maurice pour le sélecteur — mais on
  // ne réécrit RIEN tant que l'utilisateur ne touche pas au champ : corriger
  // silencieusement le numéro d'un touriste étranger en « +230 » composerait un
  // inconnu à Maurice, et personne ne s'en apercevrait avant l'appel.
  const dial = parsed.dial ?? DEFAULT_DIAL_CODE

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1">
        {label} {required && '*'}
      </label>

      <div className="flex gap-2">
        <select
          aria-label="Indicatif pays"
          value={dial}
          disabled={disabled}
          onChange={(e) => onChange(joinPhone(e.target.value, parsed.national))}
          className="h-12 px-2 rounded-xl border border-surface bg-base text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        >
          {DIAL_CODES.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.code} · {entry.label}
            </option>
          ))}
        </select>

        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={20}
          disabled={disabled}
          value={parsed.national}
          onChange={(e) => onChange(joinPhone(dial, e.target.value))}
          placeholder="5789 1234"
          className={`flex-1 min-w-0 h-12 px-4 rounded-xl border ${
            error ? 'border-red-500' : 'border-surface'
          } bg-base focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60`}
          required={required}
        />
      </div>

      {error ? (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted mt-1">{hint}</p>
      ) : null}

      {/* Le zéro de tête est retiré à la saisie (`joinPhone`) : « 06 12 34 56 78 »
          devient « +33 6 12 34 56 78 ». Le dire évite que l'utilisateur croie à
          une perte de frappe et le retape. */}
      {parsed.national.length > 0 && (
        <p className="text-xs text-muted mt-1">
          Enregistré : <span className="font-mono">{joinPhone(dial, parsed.national)}</span>
        </p>
      )}
    </div>
  )
}
