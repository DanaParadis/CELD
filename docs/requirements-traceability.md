# Requirements Traceability Matrix

**Baseline:** CELD SRS v1.1.1 supplied from Downloads (treated as the approved
baseline per the user's instruction).  
**Architecture:** [ADR-002](./adr/002-profile-f-full-product.md), Group 6 /
profile F.  
**Evidence source:** [Test plan and results](./test-plan-and-results.md).

Status definitions: **Pass** means the named automated check was executed and
passed; **Partial** means only part of the acceptance evidence exists;
**Unrun** means no execution evidence is claimed; **Pending** means the command
must be rerun after final edits before the result is updated. The current local
test run passed; see the [execution record](./test-plan-and-results.md). The
tested source includes uncommitted changes on base `72390fe40bbed99974e6436630af4e2a35a272c9`.

## Functional requirements

| Requirement | Implementation | Verification | Status |
|---|---|---|---|
| FR-AUT-001 | `server/CELD.Api/Program.cs` login; `Data/SeedData.cs` password hashes | `Authentication_uses_hashed_credentials...`; `Invalid_credentials...` | Pass |
| FR-AUT-002 | `POST /api/auth/logout`; cookie sign-out | `Invalid_credentials_missing_csrf_and_ended_sessions_are_refused` | Pass |
| FR-AUT-003 | `client/src/App.tsx` role-aware navigation and views | UI sign-in and Staff queue tests | Pass |
| FR-CAT-001 | Anonymous `GET /api/equipment` | `Anonymous_catalog_search_and_missing_item_are_authoritative` | Pass |
| FR-CAT-002 | Server-side name/category query in `Program.cs` | API catalog query + client filter-request tests | Pass |
| FR-CAT-003 | `GET /api/equipment/{id}` and details dialog | API missing-item test + UI details test | Pass |
| FR-RES-001 | Student `POST /api/reservations` | `Login_reserve_and_listing_use_the_authenticated_student` | Pass |
| FR-RES-002 | Student-scoped `GET /api/reservations` and detail route | Login/ownership/persistence integration tests | Pass |
| FR-RES-003 | Owner-only `/cancel` transition | `Ownership_staff_authorization_and_legal_transitions_are_enforced` | Pass |
| FR-RES-004 | Staff queue and status filter | Lifecycle and performance integration tests | Pass |
| FR-RES-005 | Staff `/pickup` route | Lifecycle and competing-transition tests | Pass |
| FR-RES-006 | Staff `/return` route | Lifecycle integration test | Pass |
| FR-RES-007 | DTO maps chronological history with actor/time | Lifecycle/history-failure tests and UI history test | Pass |
| FR-ERR-001 | Problem Details, validation, 401/403/404/409 responses | API negative-path tests | Pass |
| FR-ERR-002 | UI loading, empty, success, and failure states | `client/src/App.test.tsx` | Pass |

## Business rules

| Requirement | Enforcement location | Verification | Status |
|---|---|---|---|
| BR-AUT-001 | Claims issued by cookie login; body identity/role ignored | Login/create request includes forged `studentId`/`role` | Pass |
| BR-AUT-002 | Owner predicates on Student read/cancel routes; Staff can inspect | Ownership API integration test | Pass |
| BR-AUT-003 | Staff authorization policies on queue/pickup/return | Student queue and pickup denied in lifecycle test | Pass |
| BR-RES-001 | Active-only unique index rejects unavailable reservations | Competing reservation test | Pass |
| BR-RES-002 | SQLite unique filtered index for `Reserved`/`CheckedOut` | Concurrent two-Student provider-faithful test | Pass |
| BR-RES-003 | Conditional source-status update in transition handler | Cancel/pickup/return and repeated-transition test | Pass |
| BR-RES-004 | `SaveChanges` for create; transaction around update + event | Trigger-forced create and pickup rollback test | Pass |
| BR-RES-005 | Completed rows retained; active index frees on cancel/return | Cancel/re-reserve and return/re-reserve checks | Pass |
| BR-RES-006 | Invalid source states return 409 without a new event | Repeated cancel/pickup and history-count checks | Pass |
| BR-RES-007 | Availability/status projected from persisted reservations | Catalog/detail after mutation integration checks | Pass |
| BR-RES-008 | No product delete endpoint or UI | API delete returns method-not-allowed | Pass |

## Nonfunctional requirements

| Requirement | Implementation / evidence | Status |
|---|---|---|
| NFR-SEC-001 | Cookie auth, role policies, Student ownership scoping; auth integration tests | Pass |
| NFR-SEC-002 | HttpOnly/SameSite cookie, production Secure flag, explicit CSRF validation, no committed credentials | Pass |
| NFR-REL-001 | SQLite provider, filtered unique index, competing-request test | Pass |
| NFR-REL-002 | Transactional status/history writes and second-host persistence test | Pass |
| NFR-USAB-001 | Labeled forms/buttons, text status, keyboard-open/close and dialog focus handling; UI tests | Pass |
| NFR-PERF-001 | Warmed SQLite test at 56 Items / 100 historical Reservations, under 2-second bound | Pass; 2 ms catalog / 5 ms Staff list |
| NFR-TEST-001 | API SQLite integration tests and Vitest workflow tests | Pass |
| NFR-TEST-002 | Manual Reserve → Pickup → Return and negative-path procedure in README; browser execution not yet claimed | Unrun |
| NFR-TRC-001 | This matrix plus AC evidence table and current test report | Pass |
| NFR-DOC-001 | README, API contract, ADR, traceability, test/setup instructions | Pass |
| NFR-CI-001 | GitHub Actions workflow authored; no GitHub run or deliberate-failure demonstration recorded | Unrun |
| NFR-DEP-001 | No instructor target/environment was supplied; no deployment attempted | Unrun |

## Acceptance criteria

| AC | Verification / expected evidence | Status |
|---|---|---|
| AC-01 | Anonymous catalog search/filter, missing item, no-match UI | Pass |
| AC-02 | Valid/invalid sign-in, logout, protected request after logout | Pass |
| AC-03 | Student reservation and authoritative availability | Pass |
| AC-04 | Two concurrent Student requests against SQLite | Pass |
| AC-05 | Owner list/detail/cancel boundaries; other Student gets no private data | Pass |
| AC-06 | Cancellation retained, item available, re-reservation succeeds | Pass |
| AC-07 | Staff queue/pickup; Student Staff-action denial | Pass |
| AC-08 | Staff return and re-reservation | Pass |
| AC-09 | Invalid/repeated/stale transitions refuse without extra history | Pass |
| AC-10 | Actor/time history and forced persistence failure rollback | Pass |
| AC-11 | UI loading/empty/failure and keyboard operation | Pass |
| AC-12 | Automated test suites plus witnessed/manual end-to-end procedure and revision evidence | Partial; manual browser procedure unrun |
| AC-13 | README setup/build/run/test instructions match implementation | Pass |
| AC-14 | GitHub Actions pass and deliberate failing-check demo | Unrun |
| AC-15 | Instructor-approved deployment and post-deploy workflow | Unrun |
| AC-16 | Warmed 56-item/100-history SQLite performance run | Pass; catalog 2 ms / Staff list 5 ms |

Update Pending rows only after running the named check. Do not mark AC-12,
AC-14, or AC-15 passed from authored instructions or workflow configuration.
