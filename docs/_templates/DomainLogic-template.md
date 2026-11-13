# MetroLMS — Domain Business Rules Specification
## Subsystem / Domain: [Domain Name]

> **Document Title:** [Domain Logic Title]  
> **Document Identifier:** `METROLMS-DOM-[DOMAIN]-[NNN]`  
> **Document Status:** `[DRAFT | REVIEW | APPROVED]`  
> **Canonical Authority Level:** Level 4 Domain-Specific Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Domain Developers, System Architects, Quality Engineers  
> **Governing Decisions:** [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-DB-01`](../architecture/decision-register.md#d-db-01), Domain Decisions  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

## 1. Domain Overview & Mission
- **Domain Mission:** [Operational responsibility of this business domain].
- **Core Entities:** [List primary domain entities and value objects].

## 2. Formal Invariants & Business Constraints
| Invariant ID | Rule Title | Formal Logic Expression | Enforcement Point |
| :--- | :--- | :--- | :--- |
| `INV-D-[NNN]` | [Rule Title] | [Formula or condition that must always hold true] | Service Layer & DB Constraint |

## 3. State Transition Rules
- **Allowed Transitions:** [State machine table defining legal transitions].
- **Forbidden Transitions:** [Explicitly illegal state jumps and rejection behavior].

## 4. Calculation Pipelines & Rounding Rules
- **Calculation Formula:**
  $$\text{Score} = \left\lfloor \frac{\text{Points Earned}}{\text{Total Points}} \times 100 + 0.5 \right\rfloor$$
- **Precision Invariant:** Deterministic math rounding rules across frontend and backend.

## 5. Audit & Telemetry Invariants
- **Audit Attribution:** Explicit actor tracking (`actorId`, `actorRole`, `timestamp`, `ipAddress`).
- **No Anonymous Mutations:** Every write operation must be attributed to an authentic session identity.
