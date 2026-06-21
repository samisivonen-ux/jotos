# Jotos Architecture

The detailed 2026 target architecture, protocol choices, Garmin and Intervals.icu integrations, open-source reuse analysis, competitor map and commercialization plan are documented in [Agentic GPS ecosystem architecture](agentic-ecosystem-architecture.md).

Jotos should grow as an open, self-hostable trail and GPS knowledge commons. The first AWS deployment should stay inexpensive and reversible while leaving room for geospatial search, offline maps and agent integrations.

## Phase 1: Public Web App

- Vite TypeScript web client.
- MapLibre GL JS for map rendering.
- PMTiles for future offline basemaps.
- S3 private bucket for static app assets.
- CloudFront CDN with origin access control.
- GitHub Actions deploy through AWS OIDC, without long-lived AWS keys.

## Phase 2: Open Route Data API

- API Gateway + Lambda for low-cost API endpoints.
- S3 for original GPX/FIT/TCX/KML/GeoJSON files.
- DynamoDB for route metadata, licenses, provenance, visibility and moderation state.
- EventBridge + worker Lambdas for parsing, privacy trimming and normalized GeoJSON generation.

## Phase 3: Geospatial Search

- PostGIS when spatial queries need to become first-class.
- Start with a small RDS instance only after there is enough route data to justify the cost.
- Keep original files in S3 and use PostGIS for derived searchable geometry.

## Phase 4: Agentic Layer

- MCP server exposes Jotos tools and resources to AI clients.
- A2A agent card advertises the public route/data steward agent.
- UCP support is scoped to optional commerce-like flows such as paid map-printing, club memberships, guide bookings or donation flows, not core public trail access.
- Open Knowledge package metadata makes route datasets discoverable and reusable.

## Cost Guardrails

- Prefer S3, CloudFront, Lambda, DynamoDB on-demand and static PMTiles.
- Avoid always-on compute for the MVP.
- Avoid RDS/PostGIS until product usage needs it.
- Use CloudFront PriceClass_100 while testing.
- Add budget alerts before public launch.
