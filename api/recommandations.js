// Deuxième étape, après le verdict : cherche de vrais produits et vérifie leurs ingrédients.
const AnthropicSDK = require("@anthropic-ai/sdk");
const { reglesPour, situationPour } = require("./_consigne.js");
const { CONSENTEMENT, lireSession } = require("./_session.js");
const { recommander } = require("./_produits.js");

const Anthropic = AnthropicSDK.default || AnthropicSDK;
const MODELE = "claude-sonnet-5-5";
const propre = (s, max) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\p{Cf}/gu, "").trim().slice(0, max);

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée." });

  let session = null;
  try { session = lireSession(req); } catch (e) { console.error("session:", e.name); }
  if (!session) return res.status(401).json({ erreur: "Connecte-toi pour continuer." });
  if (session.consent !== CONSENTEMENT) return res.status(403).json({ erreur: "Ton accord est nécessaire.", consentement: true });

  const cle = (process.env.ANTHROPIC_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!cle) return res.status(500).json({ erreur: "Le serveur n'est pas configuré." });

  const b = req.body || {};
  if (b.categorie !== "aliment" && b.categorie !== "beaute") return res.status(400).json({ erreur: "Demande incomplète." });
  const idees = (Array.isArray(b.idees) ? b.idees : []).slice(0, 3)
    .map((a) => ({ nom: propre(a && a.nom, 120), recherche: propre(a && a.recherche, 60) }))
    .filter((a) => a.nom && a.recherche.length >= 3);
  if (!idees.length) return res.status(200).json({ produits: [] });
  const e = b.exclu && typeof b.exclu === "object" ? b.exclu : null;
  const exclu = e ? { code: /^\d{8,14}$/.test(String(e.code || "")) ? String(e.code) : null, codebarre: /^\d{8,14}$/.test(String(e.codebarre || "")) ? String(e.codebarre) : null, nom: propre(e.nom, 120) } : null;

  try {
    const client = new Anthropic({ apiKey: cle, timeout: 40000, maxRetries: 1 });
    const produits = await recommander({
      client, modele: MODELE, categorie: b.categorie, titre: propre(b.titre, 120), idees,
      regles: reglesPour(b.categorie, session.periode), situation: situationPour(session.toxo, session.periode), exclu,
    });
    return res.status(200).json({ produits });
  } catch (err) {
    console.error("recommandations:", err && err.name, err && err.status);
    return res.status(200).json({ produits: [] });
  }
};
