// Fonction serveur Vercel : reçoit les photos, interroge Claude, renvoie le verdict.
// La clé API reste ici, côté serveur : elle n'est jamais envoyée au navigateur.
// Variable à définir dans Vercel : ANTHROPIC_API_KEY.

const { construireConsigne, lireJSON } = require("./_consigne.js");

const MODELE = "claude-sonnet-5-5";
const MAX_PHOTOS = 4;
const MODES = ["produit", "menu", "beaute", "texte"];

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

const BASES = {
  beaute: { nom: "Open Beauty Facts", url: "https://world.openbeautyfacts.org" },
  aliment: { nom: "Open Food Facts", url: "https://world.openfoodfacts.org" },
};

// N'accepte que les photos hébergées par les bases Open Facts
function photoSure(u) {
  return typeof u === "string" && /^https:\/\/images\.open(beauty|food)facts\.org\/[\w\/.\-]+$/.test(u) ? u : null;
}

// Recherche d'un produit par son nom, pour illustrer une alternative
async function chercherParNom(base, termes) {
  try {
    const q = new URLSearchParams({
      search_terms: termes, search_simple: "1", action: "process", json: "1", page_size: "1",
      fields: "code,product_name,brands,image_front_small_url",
    });
    const r = await fetch(`${base.url}/cgi/search.pl?${q}`, {
      headers: { "User-Agent": "NeufLunes/1.0 (application personnelle)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const p = d && d.products && d.products[0];
    const image = p && photoSure(p.image_front_small_url);
    if (!image) return null;
    return { image, lien: /^\d{8,14}$/.test(p.code || "") ? `${base.url}/product/${p.code}` : null, base: base.nom };
  } catch (e) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erreur: "Méthode non autorisée." });

  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) return res.status(500).json({ erreur: "Le serveur n'est pas configuré (clé API manquante)." });

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body || "{}"); } catch (e) { body = {}; } }
  const { mode, toxo, precision, images } = body;

  // Accès libre : aucune vérification de code.
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
    const resultat = lireJSON(txt);
    if (source) resultat.source = source;

    // Photos des alternatives qui citent un produit précis (3 au maximum, en parallèle)
    if (Array.isArray(resultat.alternatives)) {
      const base = (mode === "beaute" || resultat.categorie === "beaute") ? BASES.beaute : BASES.aliment;
      await Promise.all(resultat.alternatives.slice(0, 3).map(async (a) => {
        const termes = a && typeof a.recherche === "string" ? a.recherche.trim().slice(0, 100) : "";
        if (termes.length < 3) return;
        const trouve = await chercherParNom(base, termes);
        if (trouve) Object.assign(a, trouve);
      }));
    }
    return res.status(200).json(resultat);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erreur: "La réponse n'a pas pu être lue. Réessaie avec une photo plus nette." });
  }
};
