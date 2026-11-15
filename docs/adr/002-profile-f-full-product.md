# ADR-002: Profile-F Full-Product Architecture

- **Status:** Implemented proposal; team and instructor confirmation pending
- **Supersedes:** The Week 1 catalog-only scope in [ADR-001](./001-week-1-catalog-foundation.md)
- **Requirements baseline:** CELD SRS v1.1.1 (provided from Downloads; user identified it as the approved SRS)
- **Group/profile:** Group 6, starting profile F

## Context

ADR-001 deliberately covered only a read-only, in-memory catalog. Week 2 requires
the complete UC-001–UC-005 product, persistent relational data, cookie sessions,
server authorization, reservation concurrency, lifecycle enforcement, atomic
history, and provider-faithful tests. The Week 2 guide defines profile F as
minimal direct handlers with end-to-end and integration-test emphasis.

The instructor environment sheet fixing the relational provider and deployment
target was not present in the workspace or the supplied Downloads. Per the
team's direction to choose using the Week 1/2 guides, the implementation uses
SQLite provisionally; confirm or replace it if the instructor sheet mandates a
different provider. The SRS behavior is not changed by this choice.

## Decision

Keep the profile-F shape: a React/TypeScript browser client calls ASP.NET Core
Minimal API handlers, which operate directly on one EF Core `CeldDbContext`.
Use explicit request/response DTOs, relational entities, and a small seed
initializer; do not introduce controllers, a service layer, or generic
repositories. The client calls same-origin `/api` routes; Vite proxies those
routes to the local API during development.

The local/default relational database is a file-backed SQLite database under
`server/CELD.Api/App_Data`. API integration tests use the same SQLite provider
with isolated shared in-memory databases; they do not substitute EF's InMemory
provider or mock persistence.

### Enforcement points

- **Identity and roles:** `/api/auth/login` verifies a seeded PBKDF2 password
  hash and issues an ASP.NET Core cookie. Protected route policies derive the
  role and account ID from the validated cookie claims; request bodies do not
  accept caller-supplied identity or role as authority. State-changing routes
  also validate an antiforgery token.
- **Role and ownership:** Student and Staff policies are applied at route
  mapping. Students list only their own records; a Student's detail and cancel
  queries include the authenticated account ID and return not-found for another
  Student's record. Staff queue and pickup/return routes require the Staff role.
- **BR-RES-002:** `CeldDbContext` defines a provider-specific unique filtered
  index on `Reservation.EquipmentItemId` for `Reserved` and `CheckedOut`.
  Database enforcement resolves concurrent inserts; uniqueness/SQLite-lock
  failures are returned as a controlled conflict. Availability is computed
  from persisted active Reservations.
- **BR-RES-003 / BR-RES-006:** cancel, pickup, and return handlers accept only
  their expected source status. The transition write includes the expected
  status in its database predicate, so stale competing actions cannot both
  succeed. Unsupported/repeated transitions return conflict.
- **BR-RES-004:** creation saves the Reservation and its first History Event in
  one EF Core `SaveChanges` operation. Status transitions use a relational
  transaction containing the conditional status update and History Event
  insert; a failed event write rolls the status update back.
- **Durability/history:** completed Reservations are retained; there is no
  product delete operation. History responses include event type, resulting
  status, actor display name, and UTC timestamp in chronological order.

## Alternatives considered

1. **Central service or layered repositories:** clearer policy/service seams,
   but adds indirection and changes the assigned profile. Deferred unless
   evidence shows the handlers have become difficult to reason about or test.
2. **In-memory persistence:** simpler startup, but fails the persistent
   relational and provider-faithful acceptance requirements; rejected.
3. **Choose a different relational provider now:** appropriate if required by
   the instructor environment, but that information was unavailable. SQLite is
   a temporary implementation choice, not a claim that the instructor approved
   it.

## Consequences and known trade-offs

- The partial-index SQL is SQLite-specific; changing providers requires an
  equivalent filtered/partial unique constraint and rerunning AC-04/AC-10
  against that provider.
- `EnsureCreated` gives a small repeatable local bootstrap, but is not a
  production schema migration strategy. Add reviewed EF migrations before a
  deployed release or any schema evolution.
- Direct handlers keep the solution aligned to profile F but concentrate HTTP,
  authorization, persistence, and response mapping in `Program.cs`. Split
  handlers only if review shows concrete readability or testability problems.
- SQLite is suitable for the local course workflow but is not a substitute for
  validating the instructor's deployment provider, concurrency behavior, and
  backup/recovery setup.
- Authentication is limited to provisioned seed accounts; there is no
  registration or password-recovery UI, per SRS scope.
- If an operation response is lost, the UI refreshes authoritative state on
  conflicts; the API does not provide a general idempotency-key protocol.

## Architecture sketch

```text
Visitor / Student / Lending Staff
              |
      React + TypeScript
              | same-origin /api (Vite proxy in development)
              v
 ASP.NET Core Minimal API
   cookie authentication + antiforgery
   Student/Staff policies + ownership predicates
              |
        EF Core DbContext
   transaction / conditional updates
   active-reservation unique index
              |
     SQLite relational database
 Equipment Items | Accounts | Reservations | History Events
```

## Review trigger

Before delivery to the instructor-approved target, confirm the official
relational provider, SDK/toolchain, and deployment environment; update this ADR
and re-run provider-faithful concurrency and rollback tests if any provider or
schema decision changes.
