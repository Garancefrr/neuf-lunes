// Session de connexion : un cookie signé, gardé sur le téléphone. Aucune base de données.
// Il contient un identifiant anonymisé, le profil (toxoplasmose, période) et l'accord donné.
// Variable à définir dans Vercel : SESSION_SECRET.

const crypto = require("crypto");

const SESSION = "nl_session";
const OAUTH = "nl_oauth";
const DUREE_SESSION = 400 * 24 * 3600; // maximum accepté par les navigateurs, renouvelé à chaque ouverture
const DUREE_OAUTH = 10 * 60;
const TOXO = ["immunisee", "non", "inconnu"];
const PERIODES = ["t1", "t2", "t3", "allaitement"];
const CONSENTEMENT = "2026-11"; // à changer si les traitements de données évoluent : l'accord sera redemandé

function secret() {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 32) throw new Error("SESSION_SECRET manquant");
  return s;
}

// L'usage entre dans la signature : un cookie temporaire de connexion ne peut pas servir de session.
function signature(usage, charge) {
  return crypto.createHmac("sha256", secret()).update(`${usage}\0${charge}`).digest("base64url");
}

function sceller(usage, donnees, duree) {
  const charge = Buffer.from(JSON.stringify({ ...donnees, exp: Math.floor(Date.now() / 1000) + duree })).toString("base64url");
  return `${charge}.${signature(usage, charge)}`;
}

function ouvrir(usage, valeur) {
  try {
    const [charge, sig] = String(valeur || "").split(".");
    if (!charge || !sig) return null;
    const a = Buffer.from(sig), b = Buffer.from(signature(usage, charge));
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

const texte = (v) => typeof v === "string" && v.length > 0;
function lireSession(req) {
  const d = ouvrir("session", lireCookie(req, SESSION));
  return d && texte(d.id) ? d : null;
}
function lireOAuth(req) {
  const d = ouvrir("oauth", lireCookie(req, OAUTH));
  return d && texte(d.state) && texte(d.nonce) && texte(d.verifier) ? d : null;
}
const poserSession = (res, { id, toxo, periode, consent }) => ajouterCookie(res, SESSION, sceller("session", { id, toxo: TOXO.includes(toxo) ? toxo : null, periode: PERIODES.includes(periode) ? periode : null, consent: consent === CONSENTEMENT ? consent : null }, DUREE_SESSION), DUREE_SESSION);
const effacerSession = (res) => ajouterCookie(res, SESSION, "", 0);
const poserOAuth = (res, d) => ajouterCookie(res, OAUTH, sceller("oauth", d, DUREE_OAUTH), DUREE_OAUTH);
const effacerOAuth = (res) => ajouterCookie(res, OAUTH, "", 0);
const adresseRetour = () => `${process.env.APP_URL || "https://neuf-lunes-pi.vercel.app"}/api/auth/callback`;

module.exports = { TOXO, PERIODES, CONSENTEMENT, secret, lireSession, poserSession, effacerSession, lireOAuth, poserOAuth, effacerOAuth, adresseRetour };
