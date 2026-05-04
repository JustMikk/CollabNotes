# CollabNotes API

REST API for collaborative notes, sharing, tags, versions, and exports.

## Base URL

`http://localhost:3001`

## Authentication

Protected endpoints require:

`Authorization: Bearer <token>`

Get token via:
- `POST /api/auth/register`
- `POST /api/auth/login`

## Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT",
    "message": "Too many requests"
  }
}
```

## Endpoints

### Health

- `GET /health`
- Auth: none
- Response:

```json
{
  "status": "ok",
  "timestamp": "2026-05-05T12:00:00.000Z"
}
```

### Auth

#### Register

- `POST /api/auth/register`
- Auth: none
- Request:

```json
{
  "username": "miki",
  "password": "pass123"
}
```

- Response:

```json
{
  "success": true,
  "data": {
    "id": 100,
    "username": "miki"
  }
}
```

#### Login

- `POST /api/auth/login`
- Auth: none
- Request:

```json
{
  "username": "miki",
  "password": "pass123"
}
```

- Response:

```json
{
  "success": true,
  "data": {
    "token": "tok_100_...",
    "user": {
      "id": 100,
      "username": "miki"
    }
  }
}
```

### Notes

#### Create Note

- `POST /api/notes`
- Auth: required
- Request:

```json
{
  "title": "Project Plan",
  "content": "Draft notes",
  "tags": ["cbsd", "draft"]
}
```

- Response: note object

#### Get All Notes

- `GET /api/notes`
- Auth: required
- Includes owned + shared notes

#### Get Notes By Tag

- `GET /api/notes?tag=cbsd`
- Auth: required

#### Get Single Note

- `GET /api/notes/:id`
- Auth: required

#### Update Note

- `PUT /api/notes/:id`
- Auth: required (owner or shared with write permission)
- Request:

```json
{
  "title": "Updated title",
  "content": "Updated content",
  "tags": ["final"]
}
```

#### Delete Note

- `DELETE /api/notes/:id`
- Auth: required (owner only)

### Sharing

#### Share Note

- `POST /api/shares`
- Auth: required (owner)
- Request:

```json
{
  "noteId": 1,
  "userId": 101,
  "canWrite": true
}
```

### Tags

#### Get All Tags

- `GET /api/tags`
- Auth: required
- Returns unique tag array for current user

### Versions

#### List Versions

- `GET /api/notes/:id/versions`
- Auth: required

#### Restore Version

- `POST /api/notes/:id/versions/:versionId/restore`
- Auth: required

### Export

#### Export Note

- `GET /api/notes/:id/export?format=json|markdown|text`
- Auth: required
- Returns downloadable file with `Content-Disposition` filename
- Content types:
  - `application/json`
  - `text/markdown`
  - `text/plain`

## Error Codes Reference

- `RATE_LIMIT`: Too many requests in 1-minute window
- `ROUTE_404`: Unknown route
- `AUTH_001`: Missing auth header
- `AUTH_002`: Invalid token
- `AUTH_101`: Registration failed
- `AUTH_102`: Login failed
- `TAGS_001`: Tags fetch failed
- `SHARE_001`: Share operation failed
- `NOTE_001`: Note not found / no access
- `NOTE_002`: Note creation failed
- `NOTE_003`: Note update failed
- `NOTE_004`: Note list fetch failed
- `NOTE_005`: Version restore failed
- `NOTE_500`: Internal notes route error
- `INTERNAL_ERROR`: Unhandled server error

## Rate Limiting

- 100 requests per IP per minute (in-memory)

## Request Logging

Each request is logged as:

`[REQ] METHOD /path STATUS DURATIONms`
