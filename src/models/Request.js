const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String
    },
    status: {
      type: String,
      enum: ['pendiente', 'aceptada', 'cancelada', 'rechazada'],
      default: 'pendiente'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Request', requestSchema);
