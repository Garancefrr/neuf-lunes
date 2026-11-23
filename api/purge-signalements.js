// Tâche quotidienne de Vercel : supprime les signalements de plus de 90 jours.
const crypto = require("crypto");
const { list, del } = require("@vercel/blob");

const DUREE_MS = 90 * 24 * 3600 * 1000;

function autorise(req) {
  const secret = process.env.CRON_SECRET || "";
  if (secret.length < 32) return false;
  const a = Buffer.from(String(req.headers.authorization || "")), b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!autorise(req)) return res.status(401).json({ erreur: "Non autorisé." });
  try {
    const limite = Date.now() - DUREE_MS;
    let curseur, supprimes = 0;
    do {
      const page = await list({ prefix: "signalements/", limit: 500, cursor: curseur });
      const anciens = page.blobs.filter((b) => new Date(b.uploadedAt).getTime() < limite).map((b) => b.url);
      if (anciens.length) { await del(anciens); supprimes += anciens.length; }
      curseur = page.hasMore ? page.cursor : undefined;
    } while (curseur);
    console.info("purge:", { supprimes });
    return res.status(200).json({ ok: true, supprimes });
  } catch (e) {
    console.error("purge en échec:", e && e.name);
    return res.status(500).json({ erreur: "Purge en échec." });
  }
};
