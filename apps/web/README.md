# CollabNotes Web

## Setup

1. Install dependencies from monorepo root:
   - `npm install`
2. Start API:
   - `npm run dev:api`
3. Start web app:
   - `npm run dev:web`

## Environment

- `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:3001`)
- `NEXT_PUBLIC_SYNC_URL` (default: `ws://localhost:3002`)

## Usage

1. Register a user on `/register`
2. Login on `/login`
3. Open `/dashboard` to create, search, edit, and delete notes
4. Use the share controls to share notes and manage permissions
5. Open a note page to see real-time presence placeholders and sync events

## Notes

- Search endpoint: `GET /api/search?q=...`
- Notifications endpoint: `GET /api/notifications`
