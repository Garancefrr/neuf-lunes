// Session de connexion : un cookie signé, gardé sur le téléphone. Aucune base de données.
// Il contient seulement un identifiant anonymisé et la réponse sur la toxoplasmose.
// Variable à définir dans Vercel : SESSION_SECRET.

const crypto = require("crypto");

const SESSION = "nl_session";
const OAUTH = "nl_oauth";
const DUREE_SESSION = 400 * 24 * 3600; // maximum accepté par les navigateurs, renouvelé à chaque ouverture
const DUREE_OAUTH = 10 * 60;
const TOXO = ["immunisee", "non", "inconnu"];

function secret() {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 32) throw new Error("SESSION_SECRET manquant");
  return s;
}

function signature(charge) {
  return crypto.createHmac("sha256", secret()).update(charge).digest("base64url");
}

function sceller(donnees, duree) {
  const charge = Buffer.from(JSON.stringify({ ...donnees, exp: Math.floor(Date.now() / 1000) + duree })).toString("base64url");
  return `${charge}.${signature(charge)}`;
}

function ouvrir(valeur) {
  try {
    const [charge, sig] = String(valeur || "").split(".");
    if (!charge || !sig) return null;
    const a = Buffer.from(sig), b = Buffer.from(signature(charge));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const d = JSON.parse(Buffer.from(charge, "base64url").toString());
    return d.exp > Math.floor(Date.now() / 1000) ? d : null;
  } catch (e) {
    return null;
  }
}

function lireCookie(req, nom) {
  for (const morceau of String(req.headers.cookie || "").split(";")) {
    const i = morceau.indexOf("=");
    if (i > 0 && morceau.slice(0, i).trim() === nom) return morceau.slice(i + 1).trim();
  }
  return null;
}

function ajouterCookie(res, nom, valeur, duree) {
  const ligne = `${nom}=${valeur}; Path=/; Max-Age=${duree}; HttpOnly; Secure; SameSite=Lax`;
  const deja = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", deja ? [].concat(deja, ligne) : ligne);
}

const lireSession = (req) => ouvrir(lireCookie(req, SESSION));
const poserSession = (res, { id, toxo }) => ajouterCookie(res, SESSION, sceller({ id, toxo: TOXO.includes(toxo) ? toxo : null }, DUREE_SESSION), DUREE_SESSION);
const effacerSession = (res) => ajouterCookie(res, SESSION, "", 0);
const lireOAuth = (req) => ouvrir(lireCookie(req, OAUTH));
const poserOAuth = (res, d) => ajouterCookie(res, OAUTH, sceller(d, DUREE_OAUTH), DUREE_OAUTH);
const effacerOAuth = (res) => ajouterCookie(res, OAUTH, "", 0);
const adresseRetour = () => `${process.env.APP_URL || "https://neuf-lunes-pi.vercel.app"}/api/auth/callback`;

module.exports = { TOXO, secret, lireSession, poserSession, effacerSession, lireOAuth, poserOAuth, effacerOAuth, adresseRetour };
