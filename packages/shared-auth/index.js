/**
 * Shared Auth Module (placeholder)
 * verifyToken is a small placeholder to allow local development.
 * Real implementation should verify JWTs or session tokens.
 */

async function verifyToken(token) {
	if (!token) return null;

	// Development placeholder behavior:
	// - If token === 'test' -> returns test user { id: 1 }
	// - If token begins with 'user:' -> parse id (e.g. 'user:5')
	// - Otherwise, attempt to parse numeric token as user id
	if (token === 'test') return { id: 1, name: 'Test User' };

	if (token.startsWith && token.startsWith('user:')) {
		const id = parseInt(token.split(':')[1], 10) || 0;
		if (id) return { id, name: `User ${id}` };
	}

	const numeric = parseInt(token, 10);
	if (!Number.isNaN(numeric) && numeric > 0) return { id: numeric, name: `User ${numeric}` };

	return null;
}

module.exports = {
	verifyToken,
};
