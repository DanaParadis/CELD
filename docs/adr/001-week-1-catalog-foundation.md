# ADR-001: Week 1 Catalog Foundation

- **Status:** Accepted for the initial catalog
- **Scope:** Week 1 implementation; not the final system architecture

## Context

The first implemented slice is the read-only equipment catalog (UC-001). The
project documentation leaves persistent storage and the shared team contract
for later integration.

## Decisions

1. **Keep the client and API separate.** A React/TypeScript client requests
   JSON over HTTP from an ASP.NET Core API. The client keeps API access in an
   equipment service and shares a typed `Equipment` contract.
2. **Use a minimal catalog endpoint for this slice.** The API exposes one
   `GET /api/equipment`; the client loads the returned list and applies name
   and category filters locally. This keeps the initial read-only feature
   small, but is not intended for large catalogs.
3. **Use in-memory demonstration data, not a database.** This is an explicit
   temporary deviation from persistent production storage while the database
   and shared data contract remain undecided.

## Consequences

The catalog can be developed and exercised without a database, but data resets
when the API restarts and the whole list is transferred to the client. Before
production, replace the demonstration data with agreed persistent storage and
revisit server-side filtering or pagination if the catalog size requires it.
Authentication, reservations, and reservation lifecycle rules are outside this
ADR; no decisions about those features are implied.
