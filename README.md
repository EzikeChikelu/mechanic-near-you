# Mechanic Near You

A location-first roadside assistance marketplace for Nigeria. Customers can discover available nearby mechanics, call them directly, or request help and chat in-app.

## Product direction

- Android-first mobile app built with Expo, React Native and TypeScript.
- Customer and mechanic experiences in one app.
- Mechanics explicitly go online to share their live location.
- Customers discover verified, recently active mechanics by distance.
- Direct phone calls and in-app assistance requests/chat.
- Initial pilot in Lagos, designed for nationwide coverage.

## Development

```bash
npm install
npx expo start
```

## Supabase setup

1. Copy `.env.example` to `.env` in the project root.
2. Set `EXPO_PUBLIC_SUPABASE_URL` to your Supabase project URL (the base URL, without `/rest/v1/`).
3. Set `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the project's publishable key.
4. Restart Expo after changing environment variables.

The `.env` file is ignored by Git. Never add a database password or service-role/secret key to the mobile app.

## Planned integrations

- Supabase Auth sign-up/sign-in with customer and mechanic roles; PostgreSQL/PostGIS, Row Level Security and Realtime.
- Expo Location for consent-based mechanic location updates.
- Google Maps or another supported maps provider.
- Push notifications for new service requests.

## Current status

Initial project setup, Supabase client configuration, and email/password authentication screens. Apply migrations `0001`–`0005` in order in the Supabase SQL Editor. Migrations `0001`–`0004` establish the current pilot schema and profile-completion listing rule; `0005` enables customer roadside-help requests and secure request-status transitions. The app now includes request creation, customer request history, and a mechanic job inbox. In-app chat, realtime updates, push notifications, live maps, and formal identity/licence verification remain future work. The profile-completion listing rule is not proof of identity verification.
