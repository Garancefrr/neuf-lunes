// Fonction serveur Vercel : reçoit les photos, interroge Claude, renvoie le verdict.
// La clé API reste ici, côté serveur : elle n'est jamais envoyée au navigateur.
// Variable à définir dans Vercel : ANTHROPIC_API_KEY.

const AnthropicSDK = require("@anthropic-ai/sdk");
const { construireConsigne, lireJSON, reglesPour } = require("./_consigne.js");
const { lireSession } = require("./_session.js");
const { BASES, photoSure, identifierProduit, recommander } = require("./_produits.js");

const Anthropic = AnthropicSDK.default || AnthropicSDK;
const MODELE = "claude-sonnet-5-5";
const MAX_PHOTOS = 4;
const MODES = ["produit", "menu", "beaute", "texte"];

// Format imposé à la réponse : évite les réponses mal formées.
const VERDICT = { type: "string", enum: ["ok", "prudence", "eviter"] };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lisible", "categorie", "titre", "produit_identifie", "verdict", "resume", "elements", "alternatives", "questions", "a_verifier"],
  properties: {
    produit_identifie: { type: "object", additionalProperties: false, required: ["trouve", "marque", "nom"], properties: { trouve: { type: "boolean" }, marque: { type: "string" }, nom: { type: "string" } } },
    lisible: { type: "boolean" },
    categorie: { type: "string", enum: ["aliment", "beaute"] },
    titre: { type: "string" },
    verdict: VERDICT,
    resume: { type: "string" },
    elements: { type: "array", items: { type: "object", additionalProperties: false, required: ["nom", "verdict", "raison", "conseil"], properties: { nom: { type: "string" }, verdict: VERDICT, raison: { type: "string" }, conseil: { type: "string" } } } },
    alternatives: { type: "array", items: { type: "object", additionalProperties: false, required: ["nom", "pourquoi", "recherche"], properties: { nom: { type: "string" }, pourquoi: { type: "string" }, recherche: { type: "string" } } } },
    questions: { type: "array", items: { type: "string" } },
    a_verifier: { type: "array", items: { type: "string" } },
  },
};

async function chercherProduit(baseUrl, codebarre) {
  try {
    const r = await fetch(`${baseUrl}/api/v2/product/${codebarre}.json?fields=product_name,brands,ingredients_text,ingredients_text_fr,image_front_small_url,image_front_url`, {
      headers: { "User-Agent": "NeufLunes/1.0 (application personnelle)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.status === 1 ? d.product : null;
  } catch (e) {
    return null; // base indisponible : on continue avec la photo seule
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée." });

  const cle = (process.env.ANTHROPIC_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!cle) return res.status(500).json({ erreur: "Le serveur n'est pas configuré (clé API manquante)." });

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch (e) { body = {}; } }
  const { mode, toxo, precision, images } = body;

  let session = null;
  try { session = lireSession(req); } catch (e) { console.error("session:", e.name); }
  if (!session) return res.status(401).json({ erreur: "Connecte-toi pour continuer." });

  if (!MODES.includes(mode)) return res.status(400).json({ erreur: "Type d'analyse inconnu." });

  const photos = (Array.isArray(images) ? images : [])
    .slice(0, MAX_PHOTOS)
    .filter((p) => typeof p === "string" && /^[A-Za-z0-9+/=]+$/.test(p));
  const texte = String(precision || "").slice(0, 1000);
  if (mode !== "texte" && photos.length === 0) return res.status(400).json({ erreur: "Ajoute au moins une photo." });
  if (mode === "texte" && texte.trim().length < 3) return res.status(400).json({ erreur: "Écris ta question." });

  // Code-barres lu sur la photo : on cherche les ingrédients dans la base publique correspondante
  let infoBase = "", source = null;
  const codebarre = String(body.codebarre || "");
  if (/^\d{8,14}$/.test(codebarre) && (mode === "beaute" || mode === "produit")) {
    const base = mode === "beaute" ? BASES.beaute : BASES.aliment;
    const p = await chercherProduit(base.url, codebarre);
    if (p && (p.ingredients_text_fr || p.ingredients_text)) {
      source = { base: base.nom, codebarre, lien: `${base.url}/product/${codebarre}`, image: photoSure(p.image_front_small_url || p.image_front_url), nom: [p.brands, p.product_name].filter(Boolean).join(" - ") || null };
      infoBase = `Données trouvées dans la base collaborative ${base.nom} pour le code-barres ${codebarre} (elles peuvent être incomplètes ou anciennes ; si une photo montre une liste d'ingrédients différente, la photo prime) :
Nom : ${p.product_name || "inconnu"} ; marque : ${p.brands || "inconnue"}
Ingrédients : ${(p.ingredients_text_fr || p.ingredients_text).slice(0, 4000)}`;
    } else {
      infoBase = `Le code-barres ${codebarre} a été lu mais le produit n'a pas d'ingrédients dans la base ${base.nom}. Si les photos ne montrent pas la liste des ingrédients, renvoie "lisible": false et demande, dans "resume", de prendre en photo la liste des ingrédients.`;
    }
  }

  const contenu = photos.map((data) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }));
  contenu.push({ type: "text", text: construireConsigne(mode, toxo, texte, infoBase) });

  try {
    const client = new Anthropic({ apiKey: cle, timeout: 55000, maxRetries: 1 });
    const data = await client.beta.messages.create({
      model: MODELE,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: contenu }],
    });
    if (data.stop_reason === "refusal") return res.status(422).json({ erreur: "Je ne peux pas analyser cette demande. Demande conseil à ta sage-femme ou à ton pharmacien." });
    if (data.stop_reason === "max_tokens") return res.status(502).json({ erreur: "La réponse était trop longue. Envoie moins de photos à la fois." });
    const txt = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const resultat = lireJSON(txt);
    const categorie = (mode === "beaute" || resultat.categorie === "beaute") ? "beaute" : "aliment";

    // Fiche du produit photographié, si son nom est lisible. Le verdict reste fondé sur la photo.
    if (!source && resultat.lisible !== false && mode !== "menu") {
      source = await identifierProduit(categorie, resultat.produit_identifie).catch(() => null);
      console.info("fiche:", { nomLu: !!(resultat.produit_identifie && resultat.produit_identifie.trouve), trouvee: !!source });
    }
    if (source) resultat.source = source;
    delete resultat.produit_identifie;

    // Produits réels du même type, gardés seulement après vérification de leurs ingrédients.
    const idees = Array.isArray(resultat.alternatives) ? resultat.alternatives : [];
    if (resultat.lisible !== false && mode !== "menu" && resultat.verdict !== "ok" && idees.length) {
      try {
        const situation = { immunisee: "est immunisée contre la toxoplasmose", non: "n'est pas immunisée contre la toxoplasmose" }[toxo] || "ne sait pas si elle est immunisée contre la toxoplasmose";
        const produits = await recommander({ client, modele: MODELE, categorie, titre: resultat.titre, idees, regles: reglesPour(categorie), situation, exclu: source });
        if (produits.length) resultat.alternatives = produits;
      } catch (e) {
        console.error("recommandations:", e && e.name, e && e.status);
      }
    }
    if (Array.isArray(resultat.alternatives)) resultat.alternatives.forEach((a) => { if (a) delete a.recherche; });
    return res.status(200).json(resultat);
  } catch (e) {
    // Ne jamais journaliser les photos ni la question : seulement le type d'erreur.
    console.error("analyse:", e && e.name, e && e.status);
    if (e instanceof Anthropic.RateLimitError) return res.status(502).json({ erreur: "Trop de demandes d'un coup. Attends une minute puis réessaie." });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ erreur: "L'analyse a échoué. Réessaie dans un instant." });
    return res.status(500).json({ erreur: "La réponse n'a pas pu être lue. Réessaie avec une photo plus nette." });
  }
};
