# CELD Test Plan and Execution Evidence

## Executable checks

Run from the repository root in PowerShell:

```powershell
dotnet build server\CELD.Api\CELD.Api.csproj
dotnet test server\CELD.Api.Tests\CELD.Api.Tests.csproj

Push-Location client
npm.cmd ci
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
Pop-Location
```

The API tests use EF Core with Microsoft.Data.Sqlite, a relational SQLite
provider, against an isolated shared in-memory SQLite database per test. This
preserves relational indexes, transactions, foreign keys, and concurrent-write
behavior; EF InMemory and mocked repositories are not used. A trigger forces
History Event insertion failures for both creation and transition rollback
checks. Test-only account passwords are randomly generated at runtime and
passed only through in-memory test configuration.

The performance check in `ApiWorkflowTests` warms catalog and Staff list
requests, creates 56 equipment items and 100 historical reservations, times
both list requests, and fails if either reaches two seconds. It prints observed
durations when run with a detailed test logger:

```powershell
dotnet test server\CELD.Api.Tests\CELD.Api.Tests.csproj `
  --filter "FullyQualifiedName~Warmed_catalog_and_reservation_lists" `
  --logger "console;verbosity=detailed"
```

## Browser acceptance procedure

Use the running app at `http://localhost:5173` after starting the API with
`.\scripts\Start-CeldLocal.ps1`:

1. As a Visitor, search by partial name and category, open details, and verify
   the visible availability matches the catalog.
2. Submit an invalid password; verify a generic sign-in error and no session.
3. Sign in as `student1`, reserve an Available item, and verify the reservation
   and updated Unavailable catalog state.
4. Sign out and sign in as `staff1`; record pickup, inspect the event history,
   record return, and verify availability returns.
5. Sign out and sign in as `student1`; reserve the returned item again.
6. Confirm protected Staff actions are not offered to Students. Attempting to
   bypass the UI remains a server-side check covered by the API integration
   tests, including cross-Student detail/cancel and Student-to-Staff attempts.

This procedure is executable but is not evidence until performed and recorded.

## Execution record

| Check | Command | Result | Environment / revision |
|---|---|---|---|
| API build | `dotnet build server\CELD.Api\CELD.Api.csproj` | Pass; 0 warnings, 0 errors | Windows; .NET SDK 10.0.401 |
| Provider-faithful API suite | `dotnet test server\CELD.Api.Tests\CELD.Api.Tests.csproj` | Pass; 9 passed, 0 failed | SQLite relational provider |
| Frontend tests | `npm.cmd test -- --run` in `client` | Pass; 10 passed | Vitest/jsdom |
| Frontend lint | `npm.cmd run lint` in `client` | Pass | ESLint |
| Frontend production build | `npm.cmd run build` in `client` | Pass; TypeScript check and Vite production build | TypeScript + Vite |
| Warmed 56/100 performance check | filtered `dotnet test` command above | Pass; catalog 2 ms, Staff list 5 ms (both below 2-second bound) | Local SQLite / TestServer |
| Manual browser workflow | procedure above | Unrun | No browser workflow executed yet |
| GitHub Actions / forced failing check | workflow and deliberate failure demonstration | Unrun | No remote run available in this session |
| Deployment / post-deploy workflow | instructor-approved target | Unrun | Target environment not supplied |

The repository `HEAD` at test time was `72390fe40bbed99974e6436630af4e2a35a272c9`.
The tested implementation includes uncommitted worktree changes; this SHA
identifies the base revision, not a commit containing these changes.

## Findings and design trade-offs

- **Profile-F trade-off:** direct endpoint handlers avoid adding unassigned
  service/repository layers, but `Program.cs` is now the main navigation point
  for many HTTP and policy decisions. Revisit only if review shows concrete
  comprehension or change-locality problems.
- **Provider-specific invariant:** the filtered unique index is SQLite syntax.
  It is effective and exercised here, but the instructor's provider sheet was
  unavailable; the equivalent constraint and tests must be confirmed if the
  approved provider differs.
- **Schema lifecycle:** `EnsureCreated` is straightforward for local setup and
  restart persistence, but does not migrate an existing schema. Replace it
  with reviewed migrations before release or schema evolution.
- **Local/deployment boundary:** Vite uses a same-origin API proxy. A deployed
  client/API topology must preserve same-origin cookie/antiforgery behavior or
  add a separately reviewed CORS/CSRF configuration.
- **Authentication scope:** accounts are provisioned only through seed
  configuration. There is no registration, password recovery, or login
  throttling; those remain product/security limitations, not implemented
  requirements in this slice.
- **Unverified release claims:** GitHub Actions, a deliberate failing-check
  demonstration, manual browser acceptance, and the instructor deployment are
  not inferred from source files or local tests.
