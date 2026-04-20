# CollabNotes - Collaborative Note-Taking Platform

A monorepo for CBSD group project enabling real-time collaborative note-taking with sharing, sync, and search capabilities.

## Architecture

### Apps
- **web**: Frontend application
- **api**: REST API server
- **cli**: Command-line interface

### Packages (Shared Libraries)
- **shared-database**: SQLite database layer (Leul)
- **shared-auth**: Authentication & authorization (TBD)
- **shared-notes**: Note CRUD operations (Miki)
- **shared-sync**: Real-time sync engine (TBD)
- **shared-sharing**: Note sharing & permissions (TBD)
- **shared-search**: Full-text search (TBD)

## Setup

```bash
npm install
```

## Development

```bash
npm run dev:api    # Start API server on port 3001
npm run dev:web    # Start web app
npm run dev:cli    # Run CLI
```

## Building

```bash
npm run build
```

## Testing

```bash
npm run test
```

## Team

- **Miki**: Notes Core & REST API
- **Leul**: Database Layer
- (Other team members for remaining modules)
