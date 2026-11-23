// GET : suis-je connectée ? (et renouvelle la session). POST : retient le profil et l'accord. DELETE : déconnexion et effacement.
const { TOXO, PERIODES, CONSENTEMENT, lireSession, poserSession, effacerSession } = require("./_session.js");

const profil = (s) => ({ connecte: true, compte: s.id, toxo: s.toxo || null, periode: s.periode || null, consent: s.consent === CONSENTEMENT });

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "DELETE") { effacerSession(res); return res.status(200).json({ connecte: false }); }

    const session = lireSession(req);
    if (!session) return res.status(req.method === "GET" ? 200 : 401).json({ connecte: false });

    if (req.method === "GET") {
      poserSession(res, session);
      return res.status(200).json(profil(session));
    }
    if (req.method === "POST") {
      const b = req.body || {};
      const suivante = { id: session.id, toxo: session.toxo, periode: session.periode, consent: session.consent };
      if (b.toxo !== undefined) {
        if (!TOXO.includes(b.toxo)) return res.status(400).json({ erreur: "Réponse inconnue." });
        suivante.toxo = b.toxo;
      }
      if (b.periode !== undefined) {
        if (!PERIODES.includes(b.periode)) return res.status(400).json({ erreur: "Réponse inconnue." });
        suivante.periode = b.periode;
      }
      if (b.consentement !== undefined) {
        if (b.consentement !== true) return res.status(400).json({ erreur: "Réponse inconnue." });
        suivante.consent = CONSENTEMENT;
      }
      poserSession(res, suivante);
      return res.status(200).json(profil(suivante));
    }
    return res.status(405).json({ erreur: "Méthode non autorisée." });
  } catch (e) {
    console.error("session:", e.name);
    return res.status(500).json({ erreur: "Connexion indisponible." });
  }
};
