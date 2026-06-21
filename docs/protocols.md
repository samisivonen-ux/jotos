# Agentic Protocol Direction

The current protocol recommendation and its relationship to the GPS data plane are maintained in [Agentic GPS ecosystem architecture](agentic-ecosystem-architecture.md). That document is the source of truth for MCP 2025-11-25, A2A 1.0, AG-UI, UCP/AP2 and geospatial standards.

Jotos should use protocols where they give interoperability without making the core product dependent on one AI vendor.

## A2A: Agent-To-Agent

Use A2A for agent discovery and task handoff.

Initial agent:

- name: Jotos Steward Agent
- purpose: answer questions about public trail data, licensing, route provenance and import jobs
- transport: HTTPS JSON endpoints
- public metadata: `public/.well-known/agent-card.json`

Good early tasks:

- Find reusable trail data for a region.
- Explain license obligations for a route.
- Propose a safe import plan for an uploaded dataset.
- Hand off geospatial processing tasks to worker agents.

## MCP: Model Context Protocol

Use MCP for tools and data access.

Initial resources:

- `jotos://routes/{id}`
- `jotos://datasets/{id}`
- `jotos://licenses/{id}`
- `jotos://imports/{jobId}`

Initial tools:

- `search_routes`
- `inspect_gpx`
- `validate_license`
- `prepare_osm_overpass_query`
- `create_import_job`

Security rules:

- no write tools without explicit user confirmation
- no scraping closed route platforms
- no public upload without license and provenance
- redact private start/end zones before publishing activity tracks

## UCP: Universal Commerce Protocol

UCP appears to be a commerce-oriented agent protocol. For Jotos, it should be optional and narrow.

Potential future use:

- donation flows to trail communities
- paid printed maps
- guide or club event booking
- paid offline map bundles where licensing allows it

Not a core dependency:

- public route search
- public GPX download
- open data access
- trail condition reports

## Open Knowledge Format

Each public dataset should expose machine-readable metadata:

- title
- description
- license
- provenance
- source URL
- update cadence
- geographic coverage
- format
- maintainer
- attribution text

Use Data Package style metadata so public exports can be indexed by open-data catalogues.
