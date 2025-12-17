const Offer = require('../models/Offer');
const Request = require('../models/Request');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// Crear solicitud a una oferta
// POST /api/offers/:offerId/requests
const createRequest = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { message } = req.body;

    const offer = await Offer.findById(offerId).populate('user', 'name email');

    if (!offer) {
      return res.status(404).json({ error: 'Oferta no encontrada' });
    }

    if (offer.status !== 'activa') {
      return res
        .status(400)
        .json({ error: 'No puedes solicitar una oferta no activa' });
    }

    // Evitar que el creador se solicite a sí mismo (opcional)
    if (offer.user._id.toString() === req.userId) {
      return res
        .status(400)
        .json({ error: 'No puedes solicitar tu propia oferta' });
    }

    const request = await Request.create({
      offer: offer._id,
      user: req.userId,
      message
    });

    return res.status(201).json(request);
  } catch (error) {
    console.error('Error en createRequest:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Ver solicitudes de una oferta (solo dueño de la oferta)
// GET /api/offers/:offerId/requests
const getRequestsForOffer = async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ error: 'Oferta no encontrada' });
    }

    if (offer.user.toString() !== req.userId) {
      return res.status(403).json({
        error: 'No puedes ver solicitudes de ofertas que no son tuyas'
      });
    }

    const requests = await Request.find({ offer: offerId })
      .populate('user', 'name email')
      .sort('-createdAt');

    return res.json(requests);
  } catch (error) {
    console.error('Error en getRequestsForOffer:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Ver MIS solicitudes (las que yo he hecho a ofertas)
// GET /api/my-requests
const getMyRequests = async (req, res) => {
  try {
    const requests = await Request.find({ user: req.userId })
      .populate('offer')
      .sort('-createdAt');

    return res.json(requests);
  } catch (error) {
    console.error('Error en getMyRequests:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Cancelar MI solicitud
// PATCH /api/requests/:id/cancel
const cancelRequest = async (req, res) => {
  try {
    const request = await Request.findOne({
      _id: req.params.id,
      user: req.userId
    });

    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (request.status !== 'pendiente') {
      return res
        .status(400)
        .json({ error: 'Solo puedes cancelar solicitudes pendientes' });
    }

    request.status = 'cancelada';
    await request.save();

    return res.json(request);
  } catch (error) {
    console.error('Error en cancelRequest:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
};

// Aceptar UNA solicitud (dueño de la oferta)
// POST /api/offers/:offerId/requests/:requestId/accept
const acceptRequest = async (req, res) => {
  try {
    const { offerId, requestId } = req.params;

    const offer = await Offer.findById(offerId).populate('user', 'name email');
    if (!offer) {
      return res.status(404).json({ error: 'Oferta no encontrada' });
    }

    // Solo el dueño de la oferta puede aceptar
    if (offer.user._id.toString() !== req.userId) {
      return res
        .status(403)
        .json({ error: 'No puedes aceptar solicitudes de otra oferta' });
    }

    if (offer.status !== 'activa') {
      return res
        .status(400)
        .json({ error: 'Solo puedes aceptar solicitudes de ofertas activas' });
    }

    const request = await Request.findOne({
      _id: requestId,
      offer: offerId
    }).populate('user', 'name email');

    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (request.status !== 'pendiente') {
      return res
        .status(400)
        .json({ error: 'Solo puedes aceptar solicitudes pendientes' });
    }

    // 1) Marcar oferta como asignada y guardar qué request se aceptó
    offer.status = 'asignada';
    offer.acceptedRequest = request._id;
    await offer.save();

    // 2) Marcar esta solicitud como aceptada
    request.status = 'aceptada';
    await request.save();

    // 3) Opcional: rechazar otras solicitudes pendientes de esa oferta
    await Request.updateMany(
      {
        offer: offerId,
        _id: { $ne: request._id },
        status: 'pendiente'
      },
      { $set: { status: 'rechazada' } }
    );

    // 4) Enviar correo a la persona cuya solicitud fue aceptada
    try {
      await sendEmail({
        to: request.user.email,
        subject: 'Tu solicitud fue aceptada en Recircular',
        html: `
          <p>Hola ${request.user.name},</p>
          <p>Tu solicitud a la oferta de <strong>${offer.user.name}</strong> ha sido <strong>ACEPTADA</strong>.</p>
          <p>Pónganse de acuerdo para el intercambio. Puedes responder a este correo o contactar directamente a: <strong>${offer.user.email}</strong>.</p>
          <p>Detalle aproximado de la oferta:</p>
          <pre>${JSON.stringify(offer.items, null, 2)}</pre>
        `
      });
    } catch (err) {
      console.error('Error enviando correo de aceptación:', err.message);
    }

    return res.json({
      message: 'Solicitud aceptada y correo enviado al solicitante',
      offer,
      request
    });
  } catch (error) {
    console.error('Error en acceptRequest:', error);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = {
  createRequest,
  getRequestsForOffer,
  getMyRequests,
  cancelRequest,
  acceptRequest
};
