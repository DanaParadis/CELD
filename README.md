# Campus Equipment Lending Desk (CELD)

CELD is a small browser-based equipment lending product for visitors,
provisioned Students, and Lending Staff. It supports the public catalog,
Student reservations and cancellations, and Staff pickup/return processing.

The implementation follows Group 6's Week 1 starting profile **F**: direct
ASP.NET Core Minimal API handlers with few abstractions and emphasis on
end-to-end/provider-faithful integration checks. See
[ADR-002](docs/adr/002-profile-f-full-product.md) for the revised decision and
its pending provider confirmation.

## Architecture and enforcement

```text
React + TypeScript -- same-origin /api --> ASP.NET Core Minimal API
                                               |
                                   EF Core CeldDbContext
                                               |
                           SQLite: Items, Accounts, Reservations, History
```

- Cookie authentication derives user identity and role from validated server
  claims. Role policies protect Student and Staff routes; Student detail and
  cancellation queries are scoped to the current account. Cookie-authenticated
  mutations also require an antiforgery token.
- **BR-RES-002:** a unique filtered relational index permits at most one
  `Reserved`/`CheckedOut` reservation per item. The database, not the client
  availability display, decides the winner of competing requests.
- **BR-RES-003:** cancellation, pickup, and return write only from their
  specified source status. The expected status is part of the update predicate.
- **BR-RES-004:** reservation creation plus its initial History Event use one
  `SaveChanges`; status changes and their History Event share a database
  transaction. Integration tests inject a SQLite trigger failure and verify
  rollback.
- The product has no record-delete route. Availability is computed from
  persisted active Reservations.

SQLite is the provisional relational provider because the instructor
environment sheet was not supplied. Confirm it against that sheet before
deployment. The original Week 1 catalog ADR remains in the repository as the
historical decision; ADR-002 records the full-product revision.

## Requirements baseline and traceability

Implementation is based on the user-provided CELD SRS v1.1.1
(`COMP3402 - Campus Equipment Lending Desk SRS v1.1.1.md`, provided from
Downloads). The source document labels its baseline “proposed”; the team should
retain instructor approval with its course materials. The
[Requirements Traceability Matrix](docs/requirements-traceability.md) links
each `FR`, `BR`, `NFR`, and `AC` to code/tests and records pass, unrun, or
pending evidence honestly.

## Prerequisites

- .NET SDK 10.0.4xx
- Node.js 26.1.0 and npm
- Windows PowerShell (the local secure-seed helper is a `.ps1` script)

The SDK and Node versions above match the environment used for local
verification. Replace them only with the course-approved toolchain.

## Local setup and run

1. From the repository root, start the API:

   ```powershell
   .\scripts\Start-CeldLocal.ps1
   ```

   The script prompts securely for three local seed passwords (at least 12
   characters): Student 1, Student 2, and Staff. They are passed only to the
   API process, hashed before storage, and never written to source or docs.
   The account names are `student1`, `student2`, and `staff1`. The API creates
   six catalog items and stores its local database at
   `server\CELD.Api\App_Data\celd.db`.

   The API listens at `http://localhost:5133`. The selected SQLite provider and
   default local path are provisional pending instructor confirmation. Existing
   seeded account passwords are updated from the secure prompts when the API
   starts.

2. In a second terminal, start the client:

   ```powershell
   Set-Location client
   npm.cmd ci
   npm.cmd run dev
   ```

   Open `http://localhost:5173`. Vite proxies `/api` requests to the API, so
   development requests use same-origin cookies.

## API contract

All JSON uses camel-case fields. Errors use `application/problem+json` (or
validation problem details) and distinguish authentication, authorization,
not-found, validation, and conflict conditions.

| Method | Route | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/auth/csrf` | Public | Issue an antiforgery request token |
| `POST` | `/api/auth/login` | Public + CSRF | Sign in with a provisioned account |
| `GET` | `/api/auth/me` | Public | Return current display name/role, or `null` when anonymous |
| `POST` | `/api/auth/logout` | Signed in + CSRF | End the session |
| `GET` | `/api/equipment?search=&category=` | Public | Search/filter authoritative catalog |
| `GET` | `/api/equipment/{id}` | Public | Get current item details/availability |
| `POST` | `/api/reservations` | Student + CSRF | Create for `{ "equipmentId": 1 }` |
| `GET` | `/api/reservations` | Student | List only the current Student's records |
| `GET` | `/api/reservations/{id}` | Owner Student or Staff | Read a reservation and chronological history |
| `POST` | `/api/reservations/{id}/cancel` | Owner Student + CSRF | `Reserved → Cancelled` |
| `GET` | `/api/staff/reservations?status=` | Staff | List/filter the lending queue |
| `POST` | `/api/reservations/{id}/pickup` | Staff + CSRF | `Reserved → CheckedOut` |
| `POST` | `/api/reservations/{id}/return` | Staff + CSRF | `CheckedOut → Returned` |

Protected writes send the request token in `X-CSRF-TOKEN`; the browser client
fetches it from `/api/auth/csrf` before each write. Caller-supplied Student IDs
or roles are not used to authorize actions.

## Automated checks

From the repository root:

```powershell
dotnet build server\CELD.Api\CELD.Api.csproj
dotnet test server\CELD.Api.Tests\CELD.Api.Tests.csproj

Set-Location client
npm.cmd ci
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
```

The API tests use real EF Core SQLite relational behavior. They cover
concurrent reservation and status requests, ownership/role denial, valid and
invalid transitions, cookie/CSRF behavior, restart persistence, and failed
History Event writes. The performance test warms the API and checks catalog and
Staff list latency against the SRS's two-second local bound with 56 items and
100 historical reservations. Client tests cover loading/error/empty states,
search/filter requests, sign-in, reservation actions, and keyboard-operable
details.

Current execution evidence and unrun acceptance items are recorded in
[test plan and evidence](docs/test-plan-and-results.md); authoring a test does
not make it a pass until the command is executed.

## Manual browser acceptance

1. Browse/search the catalog without signing in; open an item and confirm
   details and current availability.
2. Attempt an invalid sign-in, then sign in as `student1` with the password
   entered at seed time.
3. Reserve an Available item and verify it appears in **My reservations** and
   becomes Unavailable in the catalog.
4. Sign out; sign in as `staff1`. In the Staff queue, record pickup and then
   return. Confirm the chronological history and that the item becomes
   Available.
5. Sign out; sign in as `student1` and reserve the returned item again.
6. Try Student 2's view of Student 1's reservation through the API or rely on
   the executed ownership integration test: the server returns not-found
   without private record details. A Student request to the Staff queue is
   forbidden.

The automated API tests exercise the negative paths in step 6. The manual
browser procedure must be performed separately before claiming the SRS's
end-to-end acceptance evidence.

## CI

GitHub Actions is configured in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) to use pinned .NET/Node
versions, `npm ci`, and the server/client build, test, and lint checks on pushes
and pull requests. A workflow file in the repository is not evidence that a
GitHub Actions run or deliberate failing-check demonstration has executed.

## Known limitations and trade-offs

- The database provider is provisional until the instructor environment sheet
  is checked. If it differs, replace SQLite, its provider-specific filtered
  index, and rerun AC-04/AC-10 tests against the approved provider.
- `EnsureCreated` bootstraps the local SQLite schema; a deployed release needs
  reviewed EF migrations, a deployment target, backup/recovery steps, and
  post-deployment verification.
- Profile F keeps endpoint logic direct and compact, but
  `server\CELD.Api\Program.cs` now owns many endpoint concerns. A service or
  feature split may improve navigation if the handlers continue to grow; do not
  add it without a concrete reason and an ADR update.
- The local SQLite file is ignored by Git and contains personal demo data.
  Remove it only when intentionally resetting the local demo database.
- For a local recovery copy, stop the API before copying
  `server\CELD.Api\App_Data\celd.db`; restore that file with the API stopped.
  Automated backups, schema migrations, and production restore testing are not
  configured because the deployment target was not supplied.
- Azure/deployment, GitHub workflow execution, deliberate CI failure evidence,
  and a witnessed manual browser run are not claimed here unless listed as
  executed in the evidence document.
