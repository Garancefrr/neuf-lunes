// Page de confidentialité. Le nom et l'adresse viennent de Vercel : ils ne sont pas dans le dépôt public.
const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = function handler(req, res) {
  const nom = esc(process.env.RESPONSABLE_NOM || "");
  const email = esc(process.env.CONTACT_EMAIL || "");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Confidentialité - Neuf Lunes</title>
<style>
:root{--bg:#f8f5f3;--ink:#2a2331;--muted:#6f6577;--accent:#0d7468;--line:#e7e0e6;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#19151d;--ink:#f1ecf4;--muted:#ab9fb4;--accent:#5fcab8;--line:#373040;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 "Segoe UI",system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:24px 18px 48px}h1{font-family:Georgia,serif;font-weight:400;font-size:34px;line-height:1.1;margin:12px 0}
h2{font-family:Georgia,serif;font-weight:400;font-size:23px;margin:28px 0 6px}p,li{color:var(--ink)}ul{padding-left:20px}a{color:var(--accent);font-weight:600}.m{color:var(--muted);font-size:15px}
</style></head><body><main>
<a href="/">← Retour à l'appli</a>
<h1>Tes données dans Neuf Lunes</h1>
<p class="m">Dernière mise à jour : 23 novembre 2026</p>
<h2>Qui est responsable ?</h2>
<p>Neuf Lunes est éditée par ${nom}. Pour toute question ou demande : <a href="mailto:${email}">${email}</a>.</p>
<h2>Ce que l'appli utilise, et pourquoi</h2>
<ul>
<li><strong>Tes photos et tes questions</strong> : pour analyser un aliment, une carte ou un soin. L'appli ne les conserve pas.</li>
<li><strong>Ta situation</strong> (trimestre ou allaitement, immunité à la toxoplasmose) : pour adapter la réponse. Ce sont des données de santé. Elles restent sur ton téléphone et sont envoyées seulement au moment d'une analyse.</li>
<li><strong>Ton compte Google</strong> : seulement un identifiant technique, transformé pour ne pas être lisible. Ni ton nom, ni ton e-mail.</li>
<li><strong>Ton historique</strong> : les 8 dernières vérifications, uniquement sur ton téléphone.</li>
<li><strong>Tes signalements</strong>, si tu en envoies : ton message, le nom du produit, le verdict et ta période, sans photo ni identifiant de compte. Ils servent à corriger les erreurs et sont supprimés après 90 jours.</li>
</ul>
<h2>Sur quelle base ?</h2>
<p>Ton accord explicite, demandé avant la première analyse. Tu peux le retirer à tout moment.</p>
<h2>Qui reçoit ces données ?</h2>
<ul>
<li><strong>Anthropic</strong> (Claude, États-Unis) reçoit tes photos, tes questions et ta situation pour produire la réponse. Ces données quittent donc l'Union européenne. <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener">Sa politique de confidentialité</a>.</li>
<li><strong>Vercel</strong> héberge l'appli et les signalements, sur des serveurs situés à Paris.</li>
<li><strong>Google</strong> gère la connexion.</li>
<li><strong>Open Food Facts et Open Beauty Facts</strong> reçoivent un code-barres ou un nom de produit, sans aucune information sur toi.</li>
</ul>
<h2>La caméra</h2>
<p>Pour scanner un code-barres, l'image est lue sur ton téléphone. Elle n'est ni envoyée ni enregistrée : seul le numéro du code-barres est utilisé.</p>
<h2>Tes droits</h2>
<p>Tu peux accéder à tes données, les corriger, les effacer, ou retirer ton accord. Dans Réglages, « Se déconnecter et effacer mes données » supprime tout ce qui est sur ton téléphone. Pour le reste, écris à l'adresse ci-dessus. Tu peux aussi saisir la <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener">CNIL</a>.</p>
<h2>Important</h2>
<p>Neuf Lunes aide à repérer les risques. Elle ne remplace pas l'avis d'une sage-femme, d'un médecin ou d'un pharmacien.</p>
</main></body></html>`);
};
