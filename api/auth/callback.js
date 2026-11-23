// Retour de Google : vérifie la réponse et ouvre la session.
const crypto = require("crypto");
const { secret, lireOAuth, effacerOAuth, poserSession, adresseRetour } = require("../_session.js");

const egal = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const echec = () => res.redirect(302, "/?connexion=erreur");
  const attendu = lireOAuth(req);
  effacerOAuth(res);

  const { code, state, error } = req.query || {};
  if (error === "access_denied") return res.redirect(302, "/");
  if (!attendu || typeof code !== "string" || typeof state !== "string" || !egal(state, attendu.state)) return echec();

  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: adresseRetour(),
        grant_type: "authorization_code",
        code_verifier: attendu.verifier,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { console.error("connexion: jeton refusé", r.status); return echec(); }
    const { id_token: jeton } = await r.json();

    // Le jeton vient directement de Google par une connexion chiffrée : on contrôle ses champs.
    const infos = JSON.parse(Buffer.from(String(jeton).split(".")[1], "base64url").toString());
    const emetteurOk = infos.iss === "https://accounts.google.com" || infos.iss === "accounts.google.com";
    if (!emetteurOk || infos.aud !== process.env.GOOGLE_CLIENT_ID || infos.exp * 1000 <= Date.now() || !infos.sub || !egal(infos.nonce || "", attendu.nonce)) return echec();

    const id = crypto.createHmac("sha256", secret()).update(`compte:${infos.sub}`).digest("base64url").slice(0, 24);
    poserSession(res, { id, toxo: null });
    return res.redirect(302, "/");
  } catch (e) {
    console.error("connexion:", e.name);
    return echec();
  }
};
