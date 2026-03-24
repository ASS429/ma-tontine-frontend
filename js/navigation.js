/* =========================================================
   navigation.js — Routing, sidebar, bottom nav
   ========================================================= */

let pageActuelle = 'connexion';

// ─── Ouvrir une page ───
function ouvrirPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  pageActuelle = page;

  // Bouton retour header
  const btnRetour = document.getElementById('btnRetour');
  if (btnRetour) btnRetour.classList.toggle('hidden', page === 'accueil');

  // Mise à jour bottom nav
  updateNavActive(page);

  // Scroll en haut
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Charger contenu page
  switch (page) {
    case 'accueil':      afficherTontines?.(); break;
    case 'tontines':     afficherTontines?.(); break;
    case 'gestion':      chargerSelectsTontines?.(); break;
    case 'membres':      chargerSelectsTontines?.(); break;
    case 'tirages':      chargerSelectsTontines?.(); break;
    case 'statistiques': afficherStatistiques?.(); break;
    case 'alertes':      afficherAlertes?.(); break;
    case 'paiements':
      chargerComptes?.();
      chargerSelectsTontines?.();
      break;
  }

  synchroniserBoutonRetour?.();
}

function ouvrirPageConnexion() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-connexion').classList.add('active');
  pageActuelle = 'connexion';
}

function ouvrirPageInscription() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-inscription').classList.add('active');
  pageActuelle = 'inscription';
}

function afficherPageConnexion() {
  document.getElementById('appHeader')?.classList.add('hidden');
  document.getElementById('bottomNav')?.style.setProperty('display', 'none');
  ouvrirPageConnexion();
}

function afficherInterfaceConnectee() {
  document.getElementById('appHeader')?.classList.remove('hidden');
  document.getElementById('bottomNav').style.display = 'block';
  document.getElementById('btnDeconnexion')?.classList.remove('hidden');
  document.getElementById('btnRetour')?.classList.add('hidden');
  majSidebarInfos?.();
  ouvrirPage('accueil');
}

function retourAccueil() { ouvrirPage('accueil'); }

function synchroniserBoutonRetour() {
  const btn = document.getElementById('btnRetour');
  if (!btn) return;
  btn.classList.toggle('hidden', pageActuelle === 'accueil');
}

// ─── Bottom Nav active state ───
function updateNavActive(page) {
  const map = {
    accueil:      'nav-accueil',
    tontines:     'nav-accueil',
    creer:        'nav-creer',
    gestion:      'nav-gestion',
    membres:      'nav-gestion',
    paiements:    'nav-paiements',
    statistiques: 'nav-stats',
    alertes:      'nav-plus',
    tirages:      'nav-plus',
  };

  document.querySelectorAll('.nav-item, .nav-fab').forEach(el => el.classList.remove('active'));
  const target = map[page];
  if (target) document.getElementById(target)?.classList.add('active');
}

// ─── Sidebar ───
function toggleSidebar(force = null) {
  const sidebar  = document.getElementById('sidebarInfos');
  const overlay  = document.getElementById('sidebarOverlay');
  const isOpen   = sidebar.classList.contains('open');

  const open = force !== null ? force : !isOpen;

  if (open) {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
  } else {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sidebarInfos')?.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleSidebar(false); });

  // Plus menu toggle
  const plusMenu = document.getElementById('plusMenu');
  document.getElementById('nav-plus')?.addEventListener('click', () => {
    plusMenu?.classList.toggle('hidden');
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#nav-plus') && !e.target.closest('#plusMenu')) {
      plusMenu?.classList.add('hidden');
    }
  });
});

// ─── Mise à jour sidebar user info ───
async function majSidebarInfos() {
  try {
    const nomElt = document.getElementById('nomUtilisateur');
    const nbElt  = document.getElementById('nombreTontines');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.nom && nomElt) nomElt.textContent = userData.nom;

    const token = localStorage.getItem('token');
    if (!token) return;

    const [stats, user] = await Promise.allSettled([
      apiFetch(`${API_BASE}/stats/overview`).then(r => r.json()),
      apiFetch(`${API_BASE}/utilisateurs/me`).then(r => r.json())
    ]);

    const newData = { ...userData };

    if (user.status === 'fulfilled' && user.value) {
      const nom = user.value.nom_complet || user.value.nom || user.value.email?.split('@')[0];
      if (nom && nomElt) { nomElt.textContent = nom; newData.nom = nom; }
    }

    if (stats.status === 'fulfilled' && stats.value) {
      const n = stats.value.tontines_actives;
      if (typeof n === 'number' && nbElt) { nbElt.textContent = n; newData.nombreTontines = n; }

      // Welcome block update
      const welcomeName  = document.getElementById('welcomeName');
      const welcomeCount = document.getElementById('welcomeCount');
      if (welcomeName) welcomeName.textContent = 'Bonjour, ' + (newData.nom || 'Utilisateur') + ' 👋';
      if (welcomeCount) welcomeCount.textContent = n ?? 0;
    }

    localStorage.setItem('userData', JSON.stringify(newData));
  } catch (err) {
    console.error('❌ majSidebarInfos:', err);
  }
}

// ─── Handle create click with plan check ───
function handleCreateClick() {
  const plan = localStorage.getItem('userPlan') || 'Free';
  const paymentStatus = localStorage.getItem('paymentStatus') || 'none';
  const count = tontines?.length ?? 0;

  if (plan === 'Free' && count >= 2) {
    showModalById('premiumModal');
    return;
  }
  if (plan === 'Premium' && paymentStatus === 'en_attente') {
    showNotification('⏳ Abonnement Premium en attente de validation.', 'warning');
    return;
  }
  ouvrirPage('creer');
}
