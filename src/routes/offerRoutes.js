const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  createOffer,
  getPublicOffers,
  getMyOffers,
  cancelOffer,
  createRequestForOffer,
  getOfferRequests,
  acceptRequest,
  getNearbyOffers,
} = require("../controllers/offerController");

// Buscar ofertas cercanas (radio alrededor de lat/lng)
router.get("/nearby", getNearbyOffers);

// Crear oferta
router.post("/", auth, createOffer);

// Listar ofertas públicas activas (todas)
router.get("/", getPublicOffers);

// Mis ofertas
router.get("/my", auth, getMyOffers);

// Cancelar oferta
router.patch("/:id/cancel", auth, cancelOffer);

// Solicitudes a una oferta
router.post("/:offerId/requests", auth, createRequestForOffer);
router.get("/:offerId/requests", auth, getOfferRequests);

// Aceptar solicitud
router.post("/:offerId/requests/:requestId/accept", auth, acceptRequest);

module.exports = router;
