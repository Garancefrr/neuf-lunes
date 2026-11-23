// Envoie vers la page de connexion Google. On ne demande que l'identifiant du compte (ni nom, ni e-mail).
const crypto = require("crypto");
const { poserOAuth, adresseRetour } = require("../_session.js");

module.exports = function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  res.setHeader("Cache-Control", "no-store");
  if (!clientId) return res.redirect(302, "/?connexion=erreur");

  try {
    const state = crypto.randomBytes(24).toString("base64url");
    const nonce = crypto.randomBytes(24).toString("base64url");
    const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    poserOAuth(res, { state, nonce, verifier });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: adresseRetour(),
      response_type: "code",
      scope: "openid",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (e) {
    console.error("connexion:", e.name);
    return res.redirect(302, "/?connexion=erreur");
  }
};
