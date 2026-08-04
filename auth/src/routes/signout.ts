import express from 'express';

const router = express.Router();

// cookie-session middleware uses a session object to manage the cookie, so clearing the session will clear the cookie.
router.post('/api/users/signout', (req, res) => {
  req.session = null;

  res.send({});
});

export { router as signoutRouter };
