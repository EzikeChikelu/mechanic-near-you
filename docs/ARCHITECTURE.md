# Technical architecture

## Application

- Expo SDK 55, React Native and TypeScript.
- One Android application with role-aware Customer and Mechanic workspaces.
- Expo Location for foreground location and an Android foreground location service when a mechanic explicitly enables availability.
- Native development builds are required for background/foreground-service location testing; Expo Go is not sufficient for that production behavior.

## Backend

Supabase provides authentication, PostgreSQL, PostGIS, Realtime and Storage. The initial SQL migration is in `supabase/migrations/0001_initial_schema.sql`.

### Core entities

- `profiles`: account identity and role.
- `mechanic_profiles`: business details, verification and online status.
- `mechanic_services`: searchable mechanic skills.
- `mechanic_locations`: latest private GPS point and timestamp.
- `service_requests`: roadside assistance lifecycle.
- `messages`: request-scoped customer/mechanic chat.
- `reviews`: rating after a completed job.

### Nearby discovery contract

Call `find_nearby_mechanics(customer_lat, customer_lon, radius_m)` for an authenticated customer. The function:
- Returns verified mechanics who opted into online status.
- Excludes location pings older than five minutes.
- Caps search radius at 50 km.
- Returns distance, not raw mechanic coordinates.
- Requires authenticated access.

Mechanic location writes must be performed only by the authenticated mechanic. The client should update the point and `updated_at` while online, and set `is_online = false` when going offline or signing out.

## Location lifecycle

1. Explain why location is needed before requesting permission.
2. Request foreground location permission.
3. When the mechanic explicitly taps Go Online, start location updates and show a persistent Android foreground-service notification for continued tracking.
4. Send periodic location updates to the authenticated mechanic's own row.
5. Stop updates and mark offline when the mechanic taps Go Offline, signs out, or revokes permission.
6. Treat stale pings as unavailable on the server, even if a client forgot to go offline.

Background location is not silently enabled. Request it only if product testing proves it is essential and after completing the required Android permission disclosures and Play policy review.

## Security and privacy

- Never ship Supabase service-role keys in the mobile app.
- Use the publishable/anon key with Row Level Security.
- Keep exact mechanic coordinates private; discovery returns a distance only.
- Limit request and chat access to the customer and assigned mechanic.
- Store verification documents in a private Storage bucket with restricted access.
- Require verified status before mechanics appear in public discovery.
- Add server-side validation for request state transitions, rate limits and abuse prevention before launch.

## Maps and external services

The current map is a UI preview, not a live map. Select a maps provider and configure Android API keys before enabling actual map tiles, geocoding or navigation. Never commit API secrets.

## Current implementation status

- [x] Expo / React Native TypeScript repository foundation.
- [x] Customer and mechanic UI preview.
- [x] Mechanic search/filter interaction and direct dial action using sample data.
- [x] Initial PostGIS schema and RLS policies.
- [ ] Supabase project credentials and schema deployment.
- [ ] Real authentication and role onboarding.
- [ ] Live GPS writes and nearby discovery.
- [ ] Real map provider and map markers.
- [ ] Booking state machine, realtime chat and push notifications.
- [ ] Identity verification, abuse reporting and production QA.
