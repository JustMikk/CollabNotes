const express = require('express');
const { registerUser, loginUser } = require('@collabnotes/shared-auth');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await registerUser(username, password);
    if (result.success) return res.status(201).json({ success: true, data: result.data });
    return res.apiError(400, 'AUTH_101', result.error || 'Unable to register');
  } catch (err) {
    err.code = err.code || 'AUTH_500';
    err.status = err.status || 500;
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await loginUser(username, password);
    if (result.success) return res.json({ success: true, data: result.data });
    return res.apiError(401, 'AUTH_102', result.error || 'Invalid credentials');
  } catch (err) {
    err.code = err.code || 'AUTH_500';
    err.status = err.status || 500;
    next(err);
  }
});

module.exports = router;
