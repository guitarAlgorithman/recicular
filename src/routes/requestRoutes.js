const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getMyRequests,
  cancelRequest
} = require('../controllers/requestController');

const router = express.Router();

// Ver MIS solicitudes
router.get('/my', authMiddleware, getMyRequests);

// Cancelar MI solicitud
router.patch('/:id/cancel', authMiddleware, cancelRequest);

module.exports = router;
    