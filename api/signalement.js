// « Ce résultat me semble faux » : garde le message 90 jours, sans photo ni identifiant de compte.
const crypto = require("crypto");
const { put, list, del } = require("@vercel/blob");
const { PERIODES, lireSession } = require("./_session.js");

const DUREE_MS = 90 * 24 * 3600 * 1000;
const MODES = ["produit", "menu", "beaute", "texte"];
const VERDICTS = ["ok", "prudence", "eviter"];
const propre = (s, max) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\p{Cf}/gu, "").trim().slice(0, max);

async function purger() {
  try {
    const limite = Date.now() - DUREE_MS;
    let curseur;
    do {
      const page = await list({ prefix: "signalements/", limit: 200, cursor: curseur });
      const anciens = page.blobs.filter((b) => new Date(b.uploadedAt).getTime() < limite).map((b) => b.url);
      if (anciens.length) await del(anciens);
      curseur = page.hasMore ? page.cursor : undefined;
    } while (curseur);
  } catch (e) {
    console.error("purge:", e && e.name);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée." });

  let session = null;
  try { session = lireSession(req); } catch (e) { console.error("session:", e.name); }
  if (!session) return res.status(401).json({ erreur: "Connecte-toi pour continuer." });

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
    await purger();
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("signalement:", e && e.name);
    return res.status(502).json({ erreur: "L'envoi a échoué. Réessaie dans un instant." });
  }
};
