const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    denom: { type: Number, required: true },
    quantity: { type: Number, required: true }
  },
  { _id: false }
);

const offerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    items: {
      type: [itemSchema],
      required: true
    },

    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // lng, lat
        required: true
      },
      address: String,
      comuna: String
    },

    status: {
      type: String,
      enum: ['activa', 'asignada', 'cancelada', 'cerrada'],
      default: 'activa'
    },

    acceptedRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      default: null
    }
  },
  { timestamps: true }
);

offerSchema.index({ location: "2dsphere" });

module.exports = mongoose.model('Offer', offerSchema);
