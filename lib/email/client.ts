import 'server-only'
import { Resend } from 'resend'

// Envoi d'emails transactionnels — point d'entrée UNIQUE.
//
// Trois garanties, dans cet ordre d'importance :
//
// 1. `sendEmail` ne LÈVE JAMAIS. Un email est un effet de bord ; il ne doit
//    pas pouvoir faire échouer la transaction métier qui l'a déclenché. Une
//    panne Resend qui annulerait une réservation confirmée et relibérerait la
//    place serait bien pire que l'absence d'email.
// 2. Sans clé, l'envoi est un no-op journalisé. La CI et tout poste de
//    développement sans `RESEND_API_KEY` doivent fonctionner.
// 3. `EMAIL_OVERRIDE_TO` réachemine TOUT vers une adresse unique. Sans ce
//    garde-fou, un test lancé sur une copie des données de production écrirait
//    à de vrais clients.

const apiKey = process.env.RESEND_API_KEY
const overrideTo = process.env.EMAIL_OVERRIDE_TO?.trim()

/**
 * Expéditeur, en variable d'environnement et non en dur : le domaine d'envoi
 * est aujourd'hui un sous-domaine de repli (`trip4mauritius.ykolo.dev`) et
 * basculera sur celui du client. Ce jour-là, c'est une valeur à changer, pas
 * du code à modifier.
 */
const from = process.env.EMAIL_FROM ?? 'Trip4mauritius <onboarding@resend.dev>'

const resend = apiKey ? new Resend(apiKey) : null

export interface SendEmailInput {
  to: string
  subject: string
  react: React.ReactElement
  /** Repli texte brut. Un email sans version texte perd des points en filtrage anti-spam. */
  text: string
}

export interface SendEmailResult {
  sent: boolean
  /** Renseigné en cas d'échec — journalisé, jamais propagé à l'appelant. */
  reason?: string
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY absente — email « ${input.subject} » non envoyé à ${input.to}.`,
    )
    return { sent: false, reason: 'no-api-key' }
  }

  // Le destinataire réel est conservé dans le sujet : sans ça, une boîte de
  // test reçoit vingt emails identiques sans qu'on sache à qui ils étaient
  // destinés.
  const to = overrideTo ?? input.to
  const subject = overrideTo
    ? `[→ ${input.to}] ${input.subject}`
    : input.subject

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      react: input.react,
      text: input.text,
    })

    if (error) {
      console.error(`[email] échec « ${input.subject} » → ${to}:`, error.message)
      return { sent: false, reason: error.message }
    }

    console.info(`[email] envoyé « ${input.subject} » → ${to} (${data?.id})`)
    return { sent: true }
  } catch (error) {
    // Réseau coupé, DNS, timeout : tout ce que le SDK peut jeter.
    console.error(`[email] exception « ${input.subject} » → ${to}:`, error)
    return { sent: false, reason: String(error) }
  }
}
