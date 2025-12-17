const express = require('express');
const {
  register,
  confirmAccount,
  login
} = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.get('/confirm/:token', confirmAccount);
router.post('/login', login);

module.exports = router;
