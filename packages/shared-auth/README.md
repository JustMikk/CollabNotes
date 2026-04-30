# `@collabnotes/shared-auth`

Authentication for CollabNotes: registration, bcrypt password hashing, SQLite-backed sessions (7-day expiry), profile updates, and account deletion with cascading cleanup of related rows.

## Dependencies

- `@collabnotes/shared-database` — `users` and `sessions` tables (see database package)
- `bcrypt` — password hashing

Install from the monorepo root:

```bash
npm install
```

## Return format

Successful operations return `{ success: true, data: ... }`.

Failures return `{ success: false, error: ... }`. After Iteration 8, `error` is `{ code, message }` with stable `AUTH_*` codes (see below).

`verifyToken(token)` is tailored for Express middleware: it returns a **user object** `{ id, username, email }` or **`null`** (invalid/expired session).

## API

| Export | Description |
|--------|-------------|
| `register(username, password, email?)` | Create user; stores bcrypt hash. |
| `login(username, password)` | Verify password; creates session row; returns `{ token, user }`. |
| `verifyToken(token)` | Resolve session → user or `null`. Runs expired-session cleanup first. |
| `logout(token)` | Delete session row for token. |
| `getUserById(id)` | Public user fields only (no password). |
| `updateProfile(userId, updates)` | `updates`: `{ email?, password? }`; passwords are re-hashed. |
| `changePassword(userId, oldPassword, newPassword)` | Verify old password, then set new hash. |
| `deleteAccount(userId)` | Transaction: removes sessions, shares, owned notes/versions, `note_shares`, then user. |
| `cleanupExpiredSessions()` | Deletes expired rows from `sessions`. Also invoked by login/verify. |
| `registerUser(username, password)` | Alias for `register` without email (used by REST routes). |
| `loginUser(username, password)` | Alias for `login`. |

## Integration (REST / middleware)

**Require**

```javascript
const auth = require('@collabnotes/shared-auth');
```

**Register / login**

Use `registerUser` / `loginUser` or `register` / `login`. Responses:

```javascript
// success
{ success: true, data: { id, username, email, created_at } }  // register
{ success: true, data: { token, user: { id, username, email } } } // login
```

**Protected routes**

Read `Authorization: Bearer <token>` and pass the token to `verifyToken`. Attach the returned user to `req.user`:

```javascript
const user = await verifyToken(token);
if (!user) return res.status(401).json({ success: false, error: { code: 'AUTH_004', message: '...' } });
req.user = user;
```

## Tests

Uses isolated `test.db` via `CNB_DB_PATH` (gitignored).

```bash
cd packages/shared-auth
npm test
```

## Error codes (Iteration 8)

| Code | Meaning |
|------|---------|
| `AUTH_001` | User not found |
| `AUTH_002` | Invalid password |
| `AUTH_003` | Token expired |
| `AUTH_004` | Token invalid |
| `AUTH_005` | Username taken |
| `AUTH_006` | Session not found |

`verifyToken` remains **nullable** for middleware compatibility; map `null` to `AUTH_003`/`AUTH_004` in HTTP responses as appropriate.
