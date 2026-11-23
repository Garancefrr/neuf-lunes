// GET : suis-je connectée ? (et renouvelle la session). POST : retient la toxoplasmose. DELETE : déconnexion.
const { TOXO, lireSession, poserSession, effacerSession } = require("./_session.js");

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "DELETE") { effacerSession(res); return res.status(200).json({ connecte: false }); }

    const session = lireSession(req);
    if (!session) return res.status(req.method === "GET" ? 200 : 401).json({ connecte: false });

    if (req.method === "GET") {
      poserSession(res, session);
      return res.status(200).json({ connecte: true, compte: session.id, toxo: session.toxo || null });
    }
    if (req.method === "POST") {
      const toxo = req.body && req.body.toxo;
      if (!TOXO.includes(toxo)) return res.status(400).json({ erreur: "Réponse inconnue." });
      poserSession(res, { id: session.id, toxo });
      return res.status(200).json({ connecte: true, toxo });
    }
    return res.status(405).json({ erreur: "Méthode non autorisée." });
  } catch (e) {
    console.error("session:", e.name);
    return res.status(500).json({ erreur: "Connexion indisponible." });
  }
};
