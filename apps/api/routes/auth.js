const express = require('express');
const { registerUser, loginUser } = require('@collabnotes/shared-auth');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await registerUser(username, password);
    if (result.success) return res.status(201).json({ success: true, data: result.data });
    const e = result.error;
    const code = e && e.code ? e.code : 'AUTH_004';
    const message = e && e.message ? e.message : 'Unable to register';
    return res.apiError(400, code, message);
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
    const e = result.error;
    const code = e && e.code ? e.code : 'AUTH_004';
    const message = e && e.message ? e.message : 'Invalid credentials';
    return res.apiError(401, code, message);
  } catch (err) {
    err.code = err.code || 'AUTH_500';
    err.status = err.status || 500;
    next(err);
  }
});

module.exports = router;
