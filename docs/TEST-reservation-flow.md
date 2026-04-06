# EXEMPLE DE FIL ROUGE BDD/TOGAF COMPLET (V2.1 - REVUE ET CORRIGÉ)

> [!NOTE]
> Cette documentation représente le "Perfect Path". Aucun dangling pointer, alignement strict sur Mermaid, ajout des contraintes NFR/ADR, modélisation de données (CLASS), contrat d'API (OpenAPI) et scénarios Gherkin pour le TDD.

---

## 1. Exigence Non-Fonctionnelle (NFR)
*Fichier : `docs/values/NFR-001-securite-paiement.md`*

```markdown
---
id: NFR-001
type: non-functional-requirement
status: active
category: security
refs:
  adr: [ADR-001]
---
# NFR-001 — Sécurité et conformité des paiements (PCI-DSS)

- Les numéros de carte de crédit ne doivent **jamais** transiter par les serveurs ou l'API MauriExplore (passage obligatoire via Stripe Elements/JS).
- Le backend MauriExplore ne stocke que l'ID de transaction (PaymentIntent) reçu via Webhook.
```

---

## 2. Décision d'Architecture (ADR)
*Fichier : `docs/adr/ADR-001-stripe-async-webhooks.md`*

```markdown
---
id: ADR-001
type: adr
status: accepted
date: 2026-04-05
deciders: [@architect]
refs:
  uc: [UC-001]
  seqs: [SEQ-001]
---
# ADR-001 — Validation asynchrone des paiements via Webhooks Stripe

## Contexte et Décision
L'authentification forte (3D Secure) ou les délais bancaires empêchent une réponse HTTP synchrone immédiate.
**Décision** : L'API ne valide jamais une commande sur la base d'un retour Frontend. Seul un **Webhook Stripe** asynchrone (`charge.succeeded`) déclenche la transition vers `Confirmed`.

## Conséquences acceptées (Trade-offs)
+ Résistance totale aux failles de manipulation côté client.
- Complexité accrue : nécessite de l'idempotence sur le worker du Webhook pour éviter la double-validation du panier.
```

---

## 3. Cas d'Usage (UC)
*Fichier : `docs/usecases/UC-001-reserver-activite.md`*

```markdown
---
id: UC-001
type: use-case
phase: A
status: draft
actor: [tourist]
refs:
  needs: [NEED-001]
  rules: [RULE-001]
  comps: [COMP-Booking, COMP-Payment]
  seqs:  [SEQ-001]
---

# UC-001 — Réserver un créneau d'activité avec acompte

## Préconditions
- Le créneau est disponible et affiché à l'utilisateur.

## Scénario nominal
1. L'acteur demande la réservation des places (créneau + participants).
2. L'API calcule l'acompte nécessaire `[RULE-001]`.
3. L'acteur saisit sa carte dans le widget Stripe.
4. L'API reçoit le Webhook de succès et finalise la réservation.

## Scénarios alternatifs
- **Alt 5a (Échec de paiement)** : Si la carte est refusée (fonds, 3DS annulé), Stripe informe l'UI. Le créneau reste à l'état `PendingPayment` et sera libéré par timeout après 15 minutes.
```

---

## 4. Règle Métier & BDD (RULE)
*Fichier : `docs/rules/RULE-001-calcul-acompte-garantie.md`*

```markdown
---
id: RULE-001
type: business-rule
status: active
refs:
  uc: [UC-001]
  classes: [CLASS-001]
---

# RULE-001 — Fractionnement 20% Acompte / 80% Solde sur place

## Énoncé
Toute réservation exige un acompte immédiat de 20% stricte. Le solde (80%) n'est pas recouvré par MauriExplore.

## Scénarios BDD (Gherkin)

```gherkin
Feature: Fractionnement de l'acompte

  Scenario: Calcul correct de l'acompte et du solde
    Given the activity price is 100 EUR per person
    And the tourist selects 2 persons
    When the booking totals are calculated
    Then the total price must be 200 EUR
    And the depositDue must be 40 EUR
    And the balanceDueOnSite must be 160 EUR
```
```

---

## 5. Modèle de Données (CLASS)
*Fichier : `docs/design/classes/CLASS-001-booking-model.md`*

```markdown
---
id: CLASS-001
type: class-diagram
scope: Booking Lifecycle
refs:
  comp: [COMP-Booking]
---

# CLASS-001 — Modèle de Réservation (Booking)

\```mermaid
classDiagram
  class Booking {
    +UUID id
    +UUID activityId
    +DateTime slotStart
    +int participants
    +Decimal totalPrice
    +Decimal depositPaid
    +Decimal balanceDueOnSite
    +BookingStatus status
    +String paymentIntentId
  }

  class BookingStatus {
    <<enumeration>>
    DRAFT
    PENDING_PAYMENT
    CONFIRMED
    EXPIRED
    CANCELLED
  }
  
  Booking --> BookingStatus : has
\```
```

---

## 6. Composants C4 (COMP)
*Fichier : `docs/architecture/COMP-Booking.md`*

```markdown
---
id: COMP-Booking
type: component
---
# COMP-Booking — Domaine Réservation
**Responsabilité** : Gère l'inventaire (capacités des créneaux) et l'état des réservations.
**Frontières négatives** : Ne gère aucune communication avec les banques (délégué à `COMP-Payment`).
```

---

## 7. Diagramme d'État (STATE)
*Fichier : `docs/design/states/STATE-001-booking-lifecycle.md`*

```markdown
---
id: STATE-001
type: state-diagram
scope: Booking Domain
refs:
  uc: [UC-001]
---
# STATE-001 — Booking Status Machine

\```mermaid
stateDiagram-v2
    [*] --> PendingPayment: Checkout
    PendingPayment --> Confirmed: event(stripe_success)
    PendingPayment --> Expired: timeout(15min)
    Confirmed --> Cancelled: action(cancel)
    Confirmed --> Completed: action(consume)
    Expired --> [*]
    Completed --> [*]
\```
```

---

## 8. Contrat API (OpenAPI)
*Fichier : `docs/api/API-001-create-intent.md`*

```markdown
---
id: API-001
type: api-endpoint
refs:
  uc: [UC-001]
  seqs: [SEQ-001]
---

# API-001 — POST /api/orders/create-intent

## OpenAPI
```yaml
/api/orders/create-intent:
  post:
    summary: Crée un PaymentIntent Stripe basé sur les 20% d'acompte (RULE-001)
    requestBody:
      content:
        application/json:
          schema:
            type: object
            required: [activityId, slotId, participants]
            properties:
              participants: { type: integer, minimum: 1 }
    responses:
      200:
        description: Retourne le Client Secret pour le Frontend
        content:
          application/json:
            schema:
              properties:
                clientSecret: { type: string }
                bookingId: { type: string, format: uuid }
```
```

---

## 9. Diagramme de Séquence (SEQ)
*Fichier : `docs/design/sequences/SEQ-001-tunnel-paiement.md`*

```markdown
---
id: SEQ-001
type: sequence
refs:
  uc: [UC-001]
  apis: [API-001]
---
# SEQ-001 — Paiement avec succès ET échec asynchrone

\```mermaid
sequenceDiagram
    participant U as Touriste
    participant UI as PWA Frontend
    participant API as Backend (COMP-Booking)
    participant S as Stripe (COMP-Payment)
    
    U->>UI: Demande confirmation Panier
    UI->>API: POST /api/orders/create-intent
    Note over API: Valide RULE-001 (Acompte 20%)<br/>Crée Booking (PENDING_PAYMENT)
    API->>S: POST /v1/payment_intents (amount)
    S-->>API: {client_secret}
    API-->>UI: {clientSecret, bookingId}
    
    UI->>S: StripeJS.confirmPayment()
    
    alt Paiement Exécuté avec Succès (Nominal)
        S-->>UI: Redirection Success
        S-)API: Webhook (payment_intent.succeeded)
        Note over API: Idempotence check<br/>Transition to CONFIRMED
    else Échec du Paiement (Alt 5a)
        S-->>UI: Erreur (Fonds/3DS raté)
        UI-->>U: Affiche erreur
        Note over API: Le cron interne expirera le booking<br/>après 15min sans Webhook
    end
\```
```
