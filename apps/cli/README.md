# CollabNotes CLI

Command-line interface for CollabNotes workflows: auth, notes, sharing, and notifications.

## Installation

From repository root:

```bash
npm install
```

Run CLI:

```bash
npm run dev:cli
```

## Commands (Menu Options)

- `1` Login
- `2` Register
- `3` List my notes
- `4` Create note
- `5` View note by ID
- `6` Share note with username/email and permission (`read|write`)
- `7` List note access list
- `8` Revoke note access
- `9` View notes shared with me
- `10` View notifications and mark read
- `11` Exit

## Examples

- Share note `12` with write permission:
  - Choose `6`
  - Note ID: `12`
  - Target: `alice`
  - Permission: `write`
- Revoke access:
  - Choose `8`
  - Note ID: `12`
  - Target user ID: `2`

## Session Management

- Session token stored in `.collabnotes-session`
- Command history stored in `.collabnotes-cli-history`
- History and recent note IDs improve tab completion speed

## Troubleshooting

- **"Please login first"**
  - Run option `1` and authenticate.
- **Permission denied errors**
  - Ensure you are the note owner for sharing/revocation actions.
- **Notification list empty**
  - Create share/revoke events first, then refresh with option `10`.
