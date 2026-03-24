/* =========================================================
   data.js — Couche données : Supabase + API helpers
   ========================================================= */

let tontines      = [];
let alertes       = [];
let tontineActive = null;
let membreEnEdition = null;

let estEnLigne       = navigator.onLine;
let donneesModifiees = false;

// ─── API Fetch centralisé ───
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      console.warn('⛔ Token expiré');
      await seDeconnecter(true);
      throw new Error('Session expirée');
    }
    return res;
  } catch (err) {
    console.error('❌ apiFetch:', err);
    throw err;
  }
}

// ─── Skeleton loader ───
function afficherSkeleton(nb = 3) {
  const cibles = ['listeTontines', 'listeTontinesPage'];
  const html = Array.from({ length: nb }, () => `
    <div class="skeleton-card">
      <div style="display:flex;gap:10px;margin-bottom:14px;">
        <div class="skeleton skel-line" style="width:36px;height:36px;border-radius:10px;flex-shrink:0;"></div>
        <div style="flex:1;">
          <div class="skeleton skel-line skel-title"></div>
          <div class="skeleton skel-line skel-sub"></div>
        </div>
      </div>
      <div class="skeleton skel-bar"></div>
      <div class="skeleton skel-status"></div>
      <div class="skel-btns">
        <div class="skeleton skel-btn"></div>
        <div class="skeleton skel-btn"></div>
      </div>
    </div>`).join('');
  cibles.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
}

function masquerSkeleton() {
  // Le skeleton est remplacé automatiquement par afficherTontines()
}

// ─── Cache localStorage ───
const CACHE_KEY_PREFIX = 'tontines_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function sauvegarderCache(userId, data) {
  if (!userId) return;
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + userId, JSON.stringify({
      data, ts: Date.now()
    }));
  } catch (e) { /* quota dépassé → ignorer */ }
}

function lireCache(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + userId);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null; // expiré
    return data;
  } catch { return null; }
}

// ─── Charger données Supabase (avec skeleton + cache) ───
async function chargerDepuisSupabase() {
  if (!utilisateurConnecte) return;

  // 1. Afficher skeleton immédiatement
  afficherSkeleton(3);

  // 2. Charger depuis le cache si disponible (affichage instantané)
  const cached = lireCache(utilisateurConnecte.id);
  if (cached) {
    tontines = cached;
    afficherTontines();
    mettreAJourAffichage();
    console.log('📦 Données depuis le cache');
  }

  // 3. Charger depuis Supabase en arrière-plan
  try {
    const { data: rows, error } = await sb
      .from('tontines')
      .select(`
        id, nom, type, montant_cotisation, frequence_cotisation, jour_cotisation,
        frequence_tirage, nombre_membres, description, cree_le, statut,
        membres ( id, nom, telephone, adresse, cree_le ),
        cotisations ( id, membre_id, montant, date_cotisation ),
        tirages ( id, membre_id, date_tirage )
      `)
      .order('cree_le', { ascending: true });

    if (error) {
      console.error(error);
      if (!cached) showNotification('❌ Erreur chargement: ' + error.message, 'error');
      return;
    }

    tontines = (rows || []).map(mapTontineRowToLocal);

    tontines.forEach(t => {
      (t.cotisations || []).forEach(c => {
        const m = t.membres.find(mm => mm.id === c.membreId);
        if (m) m.cotisationsPayees.push({ id: c.id, date: c.date, montant: c.montant });
      });
    });

    // 4. Sauvegarder dans le cache + rafraîchir l'affichage
    sauvegarderCache(utilisateurConnecte.id, tontines);
    afficherTontines();
    mettreAJourAffichage();

  } catch (err) {
    console.error('❌ chargerDepuisSupabase:', err);
    if (!cached) showNotification('❌ Chargement impossible. Vérifiez votre connexion.', 'error');
  }
}

function mapTontineRowToLocal(r) {
  const membres = (r.membres || []).map(m => ({
    id: m.id, nom: m.nom,
    telephone: m.telephone || '-', adresse: m.adresse || '-',
    aGagne: false, dateAjout: m.cree_le, cotisationsPayees: []
  }));

  const cotisations = (r.cotisations || []).map(c => ({
    id: c.id, membreId: c.membre_id,
    montant: Number(c.montant),
    date: new Date(c.date_cotisation).toISOString()
  }));

  const tirages = (r.tirages || []).map(t => ({
    id: t.id, gagnantId: t.membre_id,
    date: new Date(t.date_tirage).toISOString()
  }));

  return {
    id: r.id, nom: r.nom, type: r.type,
    montant: Number(r.montant_cotisation || 0),
    frequenceCotisation: r.frequence_cotisation,
    jourCotisation: r.jour_cotisation,
    frequenceTirage: r.frequence_tirage,
    nombreMembresMax: r.nombre_membres,
    description: r.description || '',
    statut: r.statut || 'active',
    membres, cotisations, tirages,
    gagnants: tirages.map(tr => ({
      gagnantId: tr.gagnantId,
      nom: (r.membres || []).find(m => m.id === tr.membre_id)?.nom || 'Inconnu',
      date: tr.date
    }))
  };
}

// ─── Utilitaires période cotisation ───
function obtenirPeriodeCotisation(date, frequence) {
  const d = new Date(date);
  switch (frequence) {
    case 'quotidien':    return date.split('T')[0];
    case 'hebdomadaire': {
      const ds = new Date(d); ds.setDate(d.getDate() - d.getDay());
      return ds.toISOString().split('T')[0];
    }
    case 'mensuel': return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    case 'annuel':  return d.getFullYear().toString();
    default:        return date.split('T')[0];
  }
}

function obtenirPeriodeActuelle(frequence) {
  return obtenirPeriodeCotisation(new Date().toISOString(), frequence);
}

function aPayePeriode(membre, tontine) {
  const pa = obtenirPeriodeActuelle(tontine.frequenceCotisation);
  return (membre.cotisationsPayees || []).some(c =>
    obtenirPeriodeCotisation(c.date, tontine.frequenceCotisation) === pa
  );
}

function verifierCotisationsCompletes(tontine) {
  if (!tontine.membres?.length) return false;
  const tousGagne = tontine.membres.every(m => m.aGagne);
  if (tousGagne) return true;
  return tontine.membres.filter(m => !m.aGagne).every(m => aPayePeriode(m, tontine));
}

function verifierDateTiragePossible(tontine) {
  if (!tontine.tirages?.length) return true;
  const dernierTirage = new Date(tontine.tirages[tontine.tirages.length - 1].date);
  const maintenant    = new Date();
  const diffJours     = (maintenant - dernierTirage) / (1000 * 60 * 60 * 24);
  const freqJours = {
    quotidien: 1, hebdomadaire: 7, mensuel: 30, trimestriel: 90, annuel: 365
  };
  return diffJours >= (freqJours[tontine.frequenceTirage] || 30);
}

function obtenirJoursRestantsAvantTirage(tontine) {
  if (!tontine.tirages?.length) return 0;
  const dernierTirage = new Date(tontine.tirages[tontine.tirages.length - 1].date);
  const freqJours = { quotidien: 1, hebdomadaire: 7, mensuel: 30, trimestriel: 90, annuel: 365 };
  const periodicite = freqJours[tontine.frequenceTirage] || 30;
  const prochainTirage = new Date(dernierTirage.getTime() + periodicite * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil((prochainTirage - new Date()) / (1000 * 60 * 60 * 24)));
}

function getUserProfile() {
  const token = localStorage.getItem('token');
  return fetch(`${API_BASE}/utilisateurs/me`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }).then(r => r.ok ? r.json() : { nom_complet: 'Utilisateur' })
    .catch(() => ({ nom_complet: 'Utilisateur' }));
}

function sauvegarderDonneesUtilisateur() {
  if (!utilisateurConnecte) return;
  const cle = `tontines_${utilisateurConnecte.id}`;
  localStorage.setItem(cle, JSON.stringify(tontines));
}

function sauvegarder() {
  sauvegarderDonneesUtilisateur();
  donneesModifiees = true;
}

function getUserTontineCount() { return tontines?.length ?? 0; }

// ─── Init application ───
function initialiserApplication() {
  window.addEventListener('online',  () => { estEnLigne = true;  setReseau('synced'); });
  window.addEventListener('offline', () => { estEnLigne = false; setReseau('offline'); });
  if (!estEnLigne) setReseau('offline');
  mettreAJourAffichage(); // appelle verifierAlertes → mettreAJourAlertes en interne
  const dateCot = document.getElementById('dateCotisation');
  if (dateCot) dateCot.value = new Date().toISOString().split('T')[0];
}

function mettreAJourAffichage() {
  const nb = tontines.filter(t => t.statut === 'active').length;
  const el = document.getElementById('nombreTontines');
  if (el) el.textContent = nb;
  const wc = document.getElementById('welcomeCount');
  if (wc) wc.textContent = nb;
  // Alertes chargées séparément (évite double appel)
}

// ─── Alertes ───
async function mettreAJourAlertes() {
  try {
    // Génération silencieuse — ignorer si backend KO
    await apiFetch(`${API_BASE}/alertes/generer`, { method: 'POST' }).catch(() => {});
    const res = await apiFetch(`${API_BASE}/alertes`);
    if (!res.ok) {
      // 500 côté backend → pas d'erreur critique, retourner tableau vide
      console.warn('⚠️ /alertes retourné', res.status, '— badges masqués');
      mettreAJourBadgeAlertes([]);
      return [];
    }
    const al = await res.json();
    mettreAJourBadgeAlertes(al);
    return al;
  } catch (err) {
    // Erreur réseau / offline → silencieux
    console.warn('⚠️ mettreAJourAlertes offline:', err.message);
    return [];
  }
}

function verifierAlertes() { return mettreAJourAlertes(); }

function mettreAJourBadgeAlertes(al = []) {
  const badge = document.getElementById('badgeAlertes');
  const badgeNav = document.getElementById('navBadgeAlertes');

  if (al?.length > 0) {
    if (badge) { badge.textContent = al.length; badge.classList.remove('hidden'); }
    if (badgeNav) { badgeNav.textContent = al.length; badgeNav.classList.remove('hidden'); }

    const haute = al.some(a => a.urgence === 'haute');
    if (haute) {
      badge?.classList.add('animate-bounce');
      flashVisuel();
    } else {
      badge?.classList.remove('animate-bounce');
    }
  } else {
    badge?.classList.add('hidden');
    badgeNav?.classList.add('hidden');
  }
}

// ─── Format helpers ───
function formatMoyen(type) {
  return { wave: '🌊 Wave', orange_money: '🟧 Orange Money', especes: '💵 Espèces' }[type] || type;
}
