# MetroLMS — Relational Database Specification
## Subsystem / Domain: [Domain Name]

> **Document Title:** [Database Specification Title]  
> **Document Identifier:** `METROLMS-DB-[DOMAIN]-[NNN]`  
> **Document Status:** `[DRAFT | REVIEW | APPROVED]`  
> **Canonical Authority Level:** Level 5 Implementation & Database Specification  
> **Target System:** MetroLMS (Cairo Metro E-Learning Platform)  
> **Prepared For:** Database Administrators, Django Backend Engineers, Data Architects  
> **Governing Decisions:** [`D-DB-01`](../architecture/decision-register.md#d-db-01), [`D-AUTH-01`](../architecture/decision-register.md#d-auth-01), [`D-SEC-01`](../architecture/decision-register.md#d-sec-01)  
> **Last Updated:** YYYY-MM-DD ([Author / Version])

---

### PART 1: Logical Database Design (Engine Agnostic)

#### 1. Domain Entities & Value Objects
- **Entity Definitions:** [Identify conceptual entities, business identifiers, and core domain state attributes].
- **Conceptual Attributes:** [Attribute lists and conceptual meaning without database-specific syntax].
- **Primary Domain Identifiers:** [Natural keys, UUIDs, or business code identifiers].

#### 2. Entity-Relationship Model & Cardinality
- **Association Matrix:**
  | Entity A | Association | Entity B | Optionality | Cascade Intent |
  | :--- | :--- | :--- | :--- | :--- |
  | `Course` | 1 : N | `CourseVersion` | Mandatory | Cascade deletion of unapproved drafts |
  | `CourseVersion` | 1 : N | `Module` | Mandatory | Restrict deletion if published |
- **Crow's Foot Entity-Relationship Diagram:**
  ```mermaid
  erDiagram
      USER ||--o{ ENROLLMENT : participates
      COURSE ||--|{ COURSE_VERSION : contains
      COURSE_VERSION ||--o{ ENROLLMENT : bounds
  ```

#### 3. Data Dictionary & Business Constraints
- **Attribute Definitions:** [Logical types (Text, Number, Date, Boolean), nullability, domain validation constraints].
- **Domain Business Rules:** [e.g., Progress percentage must be integer between 0 and 100].

#### 4. Conceptual Keys & Integrity
- **Natural Keys:** [e.g., employee training national ID or corporate badge number].
- **Composite Candidate Keys:** [e.g., `(course_id, version_number)`].
- **Foreign Key Conceptual Mappings:** [Logical lineage between parent and child records].

---

### PART 2: Physical Microsoft SQL Server Schema Design Guidelines (Technology Specific)

#### 1. Target Engine & Connector Standards
- **Database Engine:** Microsoft SQL Server Standard / Enterprise (`D-DB-01`).
- **Python / Django Connectors:** `pyodbc` with `mssql-django` backend engine.
- **Connection Parameters:** Encrypt=yes; TrustServerCertificate=no; Connection Timeout=30.

#### 2. T-SQL Data Type Mappings
| Conceptual Type | SQL Server Target Type | Justification / Boundary |
| :--- | :--- | :--- |
| **Short Text / Code** | `NVARCHAR(50)` / `NVARCHAR(100)` | Controlled character sets, indexing |
| **Descriptive Text** | `NVARCHAR(255)` | Titles, labels, email addresses |
| **Unbounded Text / Markdown** | `NVARCHAR(MAX)` | Rich text curriculum content, logs |
| **UUID / Unique Identifiers** | `UNIQUEIDENTIFIER` | System primary and surrogate keys |
| **Monetary / Decimal Values** | `DECIMAL(18, 4)` | Exact precision calculations |
| **Percentages / Scores** | `DECIMAL(5, 2)` or `INT` | Deterministic grade rounding |
| **Timestamp with Timezone** | `DATETIMEOFFSET` | Cairo local timezone alignment (UTC offset) |
| **Booleans / Flags** | `BIT` | 0/1 boolean representation |

#### 3. Collation & Localization Considerations
- **Domain-Specific Collation Requirements:** Document specific linguistic or search sensitivity rules.
- **Arabic Collation Evaluation:** Arabic collation options (e.g., `Arabic_CI_AS` for case-insensitive, accent-sensitive search) must be evaluated as illustrative options based on search and accent sensitivity analysis; no global default collation is assumed.

#### 4. Referential Integrity & Delete Behaviors
- **Explicit FK Delete Rule Evaluation:** Explicit evaluation of foreign key delete rules (`ON DELETE NO ACTION`, `ON DELETE CASCADE`, `ON DELETE SET NULL`) per relationship based on domain invariants; no global default delete rule is assumed.
- **Soft Deletion & Tombstones:** Invariants governing tombstone records (`is_deleted`, `deleted_at`, `deleted_by`) for audited entities.

#### 5. Indexing Strategy
- **Clustered Index Selection:** Explicit choice between integer surrogate (`BIGINT IDENTITY`) vs sequential GUID (`NEWSEQUENTIALID()`) based on fragmentation analysis.
- **Non-Clustered Indexes:** Filtered indexes on active status flags (`WHERE is_deleted = 0`), composite indexes covering frequent query paths.

#### 6. Concurrency & Locking Considerations
- **Optimistic Locking:** Row versioning via `ROWVERSION` / timestamp column for optimistic concurrency.
- **Transaction Isolation:** Read Committed Snapshot Isolation (RCSI) enabled on database level to prevent read/write blocking.

#### 7. Django Models Implementation Guidance
- **Model Declarations:** Inherit from `MetroBaseModel`, define explicit `db_table`, specify `verbose_name_plural`.
- **Migration Sequencing:** All production tables are generated and evolved exclusively via Django Models and Migrations; handwritten production DDL is strictly prohibited.
