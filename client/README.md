# CELD browser client

The React/TypeScript client supports the public equipment catalog and the
Student and Lending Staff reservation workflows. Protected changes are sent to
same-origin `/api` endpoints with the server-issued antiforgery token; the API
remains the authorization and availability authority.

## Run locally

Start the API from the repository root with `.\scripts\Start-CeldLocal.ps1`,
then run from this directory:

```powershell
npm.cmd ci
npm.cmd run dev
```

Vite serves `http://localhost:5173` and proxies `/api` to
`http://localhost:5133`.

## Check the client

```powershell
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
```

The API and relational integration test instructions are in the root
[README](../README.md); current execution evidence is in
[test-plan-and-results](../docs/test-plan-and-results.md).
