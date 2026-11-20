// Fonction serveur Vercel : reçoit les photos, interroge Claude, renvoie le verdict.
// La clé API reste ici, côté serveur : elle n'est jamais envoyée au navigateur.
// Variables à définir dans Vercel : ANTHROPIC_API_KEY et CODE_ACCES.

const { construireConsigne, lireJSON } = require("./_consigne.js");

const MODELE = "claude-sonnet-5-5";
const MAX_PHOTOS = 4;
const MODES = ["produit", "menu", "beaute", "texte"];

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée." });

  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) return res.status(500).json({ erreur: "Le serveur n'est pas configuré (clé API manquante)." });

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch (e) { body = {}; } }
  const { code, mode, toxo, precision, images } = body;

  if (!process.env.CODE_ACCES || code !== process.env.CODE_ACCES) {
    return res.status(401).json({ erreur: "Code d'accès incorrect.", code: "code" });
  }
  if (!MODES.includes(mode)) return res.status(400).json({ erreur: "Type d'analyse inconnu." });

  const photos = (Array.isArray(images) ? images : [])
    .slice(0, MAX_PHOTOS)
    .filter((p) => typeof p === "string" && /^[A-Za-z0-9+/=]+$/.test(p));
  const texte = String(precision || "").slice(0, 1000);
  if (mode !== "texte" && photos.length === 0) return res.status(400).json({ erreur: "Ajoute au moins une photo." });
  if (mode === "texte" && texte.trim().length < 3) return res.status(400).json({ erreur: "Écris ta question." });

  const contenu = photos.map((data) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }));
  contenu.push({ type: "text", text: construireConsigne(mode, toxo, texte) });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": cle, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODELE, max_tokens: 3000, messages: [{ role: "user", content: contenu }] }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Erreur API", r.status, data);
      const msg = r.status === 429 ? "Trop de demandes d'un coup. Attends une minute puis réessaie." : "L'analyse a échoué. Réessaie dans un instant.";
      return res.status(502).json({ erreur: msg });
    }
    const txt = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    return res.status(200).json(lireJSON(txt));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erreur: "La réponse n'a pas pu être lue. Réessaie avec une photo plus nette." });
  }
};
