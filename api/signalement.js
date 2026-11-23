// « Ce résultat me semble faux » : garde le message 90 jours, sans photo ni identifiant de compte.
// La suppression après 90 jours est faite chaque jour par /api/purge-signalements.
const crypto = require("crypto");
const { put } = require("@vercel/blob");
const { PERIODES, CONSENTEMENT, lireSession } = require("./_session.js");

const MODES = ["produit", "menu", "beaute", "texte"];
const VERDICTS = ["ok", "prudence", "eviter"];
const propre = (s, max) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\p{Cf}/gu, "").trim().slice(0, max);

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée." });

  let session = null;
  try { session = lireSession(req); } catch (e) { console.error("session:", e.name); }
  if (!session) return res.status(401).json({ erreur: "Connecte-toi pour continuer." });
  if (session.consent !== CONSENTEMENT) return res.status(403).json({ erreur: "Ton accord est nécessaire.", consentement: true });

  const b = req.body || {};
  const commentaire = propre(b.commentaire, 500);
  if (commentaire.length < 3) return res.status(400).json({ erreur: "Explique en quelques mots ce qui te semble faux." });

  const date = new Date().toISOString();
  const contenu = {
    date,
    titre: propre(b.titre, 120),
    mode: MODES.includes(b.mode) ? b.mode : null,
    verdict: VERDICTS.includes(b.verdict) ? b.verdict : null,
    periode: PERIODES.includes(session.periode) ? session.periode : null,
    commentaire,
  };

  try {
    await put(`signalements/${date.slice(0, 10)}/${crypto.randomUUID()}.json`, JSON.stringify(contenu), { access: "private", contentType: "application/json" });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("signalement:", e && e.name);
    return res.status(502).json({ erreur: "L'envoi a échoué. Réessaie dans un instant." });
  }
};
