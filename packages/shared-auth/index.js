/**
 * Shared Auth Module (placeholder)
 * verifyToken is a small placeholder to allow local development.
 * Real implementation should verify JWTs or session tokens.
 */

const users = new Map();
const tokens = new Map();
let seq = 100;

function createToken(user) {
	const token = `tok_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	tokens.set(token, user);
	return token;
}

async function registerUser(username, password) {
	if (!username || !password) return { success: false, error: 'username and password are required' };
	const key = String(username).toLowerCase();
	if (users.has(key)) return { success: false, error: 'User already exists' };
	const user = { id: seq++, username: String(username) };
	users.set(key, { ...user, password: String(password) });
	return { success: true, data: { id: user.id, username: user.username } };
}

async function loginUser(username, password) {
	if (!username || !password) return { success: false, error: 'username and password are required' };
	const key = String(username).toLowerCase();
	const row = users.get(key);
	if (!row || row.password !== String(password)) return { success: false, error: 'Invalid credentials' };
	const user = { id: row.id, username: row.username };
	const token = createToken(user);
	return { success: true, data: { token, user } };
}

async function verifyToken(token) {
	if (!token) return null;

	if (tokens.has(token)) {
		return tokens.get(token);
	}

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
	registerUser,
	loginUser,
	verifyToken,
};
