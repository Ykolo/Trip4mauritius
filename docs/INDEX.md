# Documentation architecture — INDEX

## À lire en premier
Ce fichier est le point d'entrée. Il décrit les conventions, les préfixes d'id et la carte des dossiers pour le projet **MauriExplore**.

## Préfixes d'identifiants
| Préfixe | Type             | Dossier           |
|---------|------------------|-------------------|
| NEED-   | Besoin métier    | docs/values/      |
| UC-     | Cas d'usage      | docs/usecases/    |
| RULE-   | Règles métier    | docs/rules/       |
| CAP-    | Capability       | docs/capabilities/|
| ADR-    | Décision archi.  | docs/adr/         |
| COMP-   | Composant C4     | docs/architecture/|
| SEQ-    | Séquence UML     | docs/design/sequences/ |
| CLASS-  | Classes UML      | docs/design/classes/   |
| STATE-  | Diagramme d'état | docs/design/states/    |
| EVENT-  | Événement msg    | docs/design/events/    |
| API-    | Endpoint API     | docs/api/         |
| DEPLOY- | Infrastructure   | docs/infrastructure/   |
| SRC-    | Module source    | src/*/README.md   |

## Tables de traçabilité
Toutes dans `docs/traceability/` — une par relation inter-niveau.

## Carte des dossiers
| Dossier            | Phase TOGAF | Outil        |
|--------------------|-------------|--------------|
| docs/values/       | A           | Markdown     |
| docs/usecases/     | A/B         | Markdown     |
| docs/rules/        | B/C         | Markdown     |
| docs/capabilities/ | B           | Markdown     |
| docs/adr/          | E/F         | Markdown     |
| docs/architecture/ | C/D         | Structurizr  |
| docs/design/       | —           | UML / Mermaid|
| docs/api/          | —           | OpenAPI YAML |
| docs/infrastructure/| F          | Markdown     |
| docs/traceability/ | transversal | Markdown     |
