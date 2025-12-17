const mongoose = require("mongoose");
const Offer = require("../models/Offer");
const Request = require("../models/Request");
const sendEmail = require("../utils/sendEmail");

const DEFAULT_RADIUS_KM = 0.2;

// Crear oferta
exports.createOffer = async (req, res) => {
  try {
    const { items, location } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Debes indicar denominaciones." });
    }

    if (!location?.lat || !location?.lng) {
      return res.status(400).json({ error: "Debes indicar coordenadas" });
    }

    const cleanItems = items.map((i) => ({
      denom: Number(i.denom),
      quantity: Number(i.quantity),
    }));

    const offer = await Offer.create({
      user: req.userId,
      items: cleanItems,
      location: {
        type: "Point",
        coordinates: [location.lng, location.lat],
        address: location.address || null,
        comuna: location.comuna || null,
      }
    });

    const populated = await Offer.findById(offer._id)
      .populate("user", "name email");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Error creando oferta:", err);
    res.status(500).json({ error: "Error al crear oferta" });
  }
};

// Ofertas activas dentro del radio
exports.getNearbyOffers = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radiusKm) || DEFAULT_RADIUS_KM;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Ubicación inválida" });
    }

    const userId = req.userId ? new mongoose.Types.ObjectId(req.userId) : null;

    const offers = await Offer.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distanceKm",
          spherical: true,
          maxDistance: radiusKm * 1000, 
          query: { status: "activa" }
        }
      },
      {
        $lookup: {
          from: "requests",
          localField: "_id",
          foreignField: "offer",
          as: "myReqs",
          pipeline: [
            ...(userId
              ? [{ $match: { user: userId, status: "pendiente" } }]
              : []),
          ],
        },
      },
      {
        $addFields: {
          requestedByMe: { $gt: [{ $size: "$myReqs" }, 0] },
        },
      },
      {
        $project: {
          myReqs: 0,
        },
      },
      { $sort: { distanceKm: 1 } },
    ]);

    res.json(offers);
  } catch (err) {
    console.error("Error en getNearbyOffers:", err);
    res.status(500).json({ error: "Error al buscar ofertas" });
  }
};

// Listar TODAS ofertas activas
exports.getPublicOffers = async (req, res) => {
  try {
    const offers = await Offer.find({ status: "activa" })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al listar" });
  }
};

// Mis ofertas
exports.getMyOffers = async (req, res) => {
  try {
    const offers = await Offer.find({ user: req.userId })
      .populate("user", "name email")
      .populate({
        path: "acceptedRequest",
        populate: { path: "user", select: "name email" },
      })
      .sort({ createdAt: -1 });

    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al listar" });
  }
};

// Cancelar oferta
exports.cancelOffer = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: "No encontrada" });

    if (offer.user.toString() !== req.userId)
      return res.status(403).json({ error: "No autorizado" });

    offer.status = "cancelada";
    await offer.save();

    await Request.updateMany(
      { offer: offer._id, status: "pendiente" },
      { status: "cancelada" }
    );

    res.json(offer);
  } catch (err) {
    res.status(500).json({ error: "Error al cancelar" });
  }
};

// Crear solicitud
exports.createRequestForOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { message } = req.body;

    const offer = await Offer.findById(offerId).populate("user", "name email");
    if (!offer) return res.status(404).json({ error: "Oferta no encontrada" });

    if (offer.status !== "activa") {
      return res.status(400).json({ error: "La oferta no está activa" });
    }

    // 🚫 No puedes solicitar tu propia oferta
    if (offer.user?._id?.toString() === req.userId) {
      return res.status(400).json({ error: "No puedes solicitar tu propia oferta" });
    }

    // 🚫 Evitar duplicados: un usuario no puede pedir 2 veces la misma oferta
    const existing = await Request.findOne({
      offer: offerId,
      user: req.userId,
      status: { $in: ["pendiente", "aceptada"] },
    });

    if (existing) {
      return res.status(400).json({ error: "Ya enviaste una solicitud para esta oferta" });
    }

    const created = await Request.create({
      offer: offerId,
      user: req.userId,
      message: message || "",
      status: "pendiente",
    });

    // ✅ Notificar al ofertante por correo (SIN revelar datos del solicitante)
    try {
      const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
      await sendEmail({
        to: offer.user.email,
        subject: "Nueva solicitud recibida - Recircular",
        html: `
          <p>Recibiste una nueva solicitud para tu oferta <strong>${offer._id.toString().slice(-6)}</strong>.</p>
          <p><strong>Mensaje del solicitante:</strong></p>
          <p>${(message || "(sin mensaje)").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          <p>Para revisar y aceptar/rechazar, entra a:</p>
          <p><a href="${frontend}/my-offers">${frontend}/my-offers</a></p>
          <p><small>Nota: por privacidad, los datos del solicitante se revelan solo cuando aceptas.</small></p>
        `,
      });
    } catch (e) {
      console.error("Error enviando email al ofertante:", e);
    }

    // Respuesta al solicitante (puede incluir su propio user si quieres; aquí devolvemos request básico)
    const populated = await Request.findById(created._id)
      .populate({
        path: "offer",
        select: "items location status createdAt user",
        populate: { path: "user", select: "name email" },
      });

    return res.status(201).json(populated);
  } catch (err) {
    console.error("Error creando solicitud:", err);
    return res.status(500).json({ error: "Error al solicitar" });
  }
};


// Ver solicitudes de una oferta
exports.getOfferRequests = async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ error: "Oferta no encontrada" });

    // Solo el dueño ve las solicitudes
    if (offer.user.toString() !== req.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    // Traemos solicitudes SIN populate del user por defecto
    const requests = await Request.find({ offer: offerId })
      .sort({ createdAt: -1 })
      .lean();

    // Si existe una aceptada, revelamos SOLO esa (la aceptada)
    let acceptedUserByRequestId = {};
    if (offer.acceptedRequest) {
      const accepted = await Request.findById(offer.acceptedRequest)
        .populate("user", "name email")
        .lean();
      if (accepted) {
        acceptedUserByRequestId[String(accepted._id)] = accepted.user; // {name,email}
      }
    }

    // Formateo: anonimiza siempre, excepto aceptada
    const safe = requests.map((r) => {
      const rid = String(r._id);
      const acceptedUser = acceptedUserByRequestId[rid];

      return {
        _id: r._id,
        offer: r.offer,
        message: r.message,
        status: r.status,
        createdAt: r.createdAt,

        // ✅ privacidad:
        user: acceptedUser
          ? { _id: acceptedUser._id, name: acceptedUser.name, email: acceptedUser.email }
          : { name: "Solicitante anónimo" },
      };
    });

    return res.json(safe);
  } catch (err) {
    console.error("Error listando solicitudes:", err);
    return res.status(500).json({ error: "Error al listar" });
  }
};


// Aceptar una solicitud
exports.acceptRequest = async (req, res) => {
  try {
    const { offerId, requestId } = req.params;

    const offer = await Offer.findById(offerId).populate(
      "user",
      "name email"
    );
    if (!offer) return res.status(404).json({ error: "Oferta no encontrada" });

    if (offer.user._id.toString() !== req.userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    if (offer.status !== "activa") {
      return res.status(400).json({ error: "La oferta ya no está activa" });
    }

    const acceptedRequest = await Request.findById(requestId).populate(
      "user",
      "name email"
    );
    if (!acceptedRequest) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    if (acceptedRequest.offer.toString() !== offerId) {
      return res.status(400).json({ error: "Solicitud no corresponde a la oferta" });
    }

    // 1️⃣ Aceptar la seleccionada
    acceptedRequest.status = "aceptada";
    await acceptedRequest.save();

    // 2️⃣ Rechazar las demás
    const rejectedRequests = await Request.find({
      offer: offerId,
      _id: { $ne: requestId },
      status: "pendiente",
    }).populate("user", "name email");

    await Request.updateMany(
      { offer: offerId, _id: { $ne: requestId } },
      { status: "rechazada" }
    );

    // 3️⃣ Actualizar oferta
    offer.status = "asignada";
    offer.acceptedRequest = requestId;
    await offer.save();

    // 4️⃣ Email al GANADOR
    try {
      await sendEmail({
        to: acceptedRequest.user.email,
        subject: "Solicitud aceptada - Recircular",
        html: `
          <p>✅ Tu solicitud fue aceptada.</p>
          <p><strong>Ofertante:</strong> ${offer.user.name} (${offer.user.email})</p>
          <p>Coordina el intercambio respondiendo este correo.</p>
        `,
      });
    } catch (e) {
      console.error("Error enviando email de aceptación:", e);
    }

    // 5️⃣ Email a los NO GANADORES
    for (const r of rejectedRequests) {
      try {
        await sendEmail({
          to: r.user.email,
          subject: "Solicitud no seleccionada - Recircular",
          html: `
            <p>Gracias por tu interés.</p>
            <p>Tu solicitud para una oferta no fue seleccionada.</p>
            <p>Te invitamos a seguir buscando otras ofertas cercanas.</p>
          `,
        });
      } catch (e) {
        console.error(
          "Error enviando email de rechazo a",
          r.user.email,
          e
        );
      }
    }

    const populatedOffer = await Offer.findById(offerId)
      .populate("user", "name email")
      .populate({
        path: "acceptedRequest",
        populate: { path: "user", select: "name email" },
      });

    return res.json({
      message: "Solicitud aceptada y notificaciones enviadas",
      offer: populatedOffer,
    });
  } catch (err) {
    console.error("Error aceptando solicitud:", err);
    return res.status(500).json({ error: "Error al aceptar solicitud" });
  }
};


