/* =========================================================
   auth.js — Connexion, Inscription, Déconnexion, 2FA
   ========================================================= */

let utilisateurConnecte = null;
let sb; // Supabase client, initialisé dans init.js

function initSupabase() {
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ─── Connexion ───
async function seConnecter(event) {
  event.preventDefault();

  const email    = document.getElementById('emailConnexion').value.trim();
  const motPasse = document.getElementById('motPasseConnexion').value;

  if (!email || !motPasse) {
    showNotification('⚠️ Remplissez tous les champs.', 'warning');
    return;
  }

  const btnSubmit = event.target.querySelector('[type="submit"]');
  if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.textContent = '⏳ Connexion…'; }

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: motPasse });

    if (error) {
      showNotification('❌ ' + error.message, 'error');
      return;
    }

    const { user, session } = data;
    if (!session) { showNotification('❌ Session invalide', 'error'); return; }

    localStorage.setItem('token', session.access_token);

    utilisateurConnecte = {
      id: user.id,
      nom: user.user_metadata?.nom_complet || email.split('@')[0],
      email: user.email
    };
    localStorage.setItem('userData', JSON.stringify(utilisateurConnecte));

    // Vérifier / créer profil
    const { data: profil } = await sb.from('utilisateurs').select('*').eq('id', user.id).maybeSingle();
    if (!profil) {
      await sb.from('utilisateurs').insert({
        id: user.id,
        nom_complet: utilisateurConnecte.nom,
        email: utilisateurConnecte.email
      });
    }

    // Récupérer rôle depuis backend
    const res = await apiFetch(`${API_BASE}/utilisateurs/me`);
    if (res.ok) {
      const p = await res.json();
      localStorage.setItem('userRole', p.role);
      localStorage.setItem('userPlan', p.plan);
      localStorage.setItem('paymentStatus', p.payment_status);

      // Admin + 2FA
      if (p.role === 'admin') {
        const r2fa = await fetch(`${API_BASE}/auth/init-2fa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
        const d2fa = await r2fa.json();
        if (d2fa.active) {
          document.getElementById('champ-2fa').style.display = 'block';
          showNotification('🔐 Code envoyé par email.', 'info');
          return;
        }
        window.location.href = 'admin.html';
        return;
      }
    }

    await chargerDepuisSupabase();
    initialiserApplication();
    afficherInterfaceConnectee();

  } catch (err) {
    console.error('❌ seConnecter:', err);
    showNotification('❌ Erreur: ' + err.message, 'error');
  } finally {
    if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = '🔐 Se connecter'; }
  }
}

// ─── Validation 2FA ───
async function valider2FA() {
  const userId = utilisateurConnecte?.id;
  const code   = document.getElementById('code2fa').value.trim();

  if (!code) { showNotification('⚠️ Entrez votre code 2FA', 'warning'); return; }

  const verif = await fetch(`${API_BASE}/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, code })
  });

  const result = await verif.json();
  if (!result.success) { showNotification('❌ Code OTP invalide.', 'error'); return; }

  showNotification('✅ Vérification réussie !', 'success');
  window.location.href = 'admin.html';
}

// ─── Inscription ───
async function sInscrire(event) {
  event.preventDefault();

  const nom     = document.getElementById('nomInscription').value.trim();
  const email   = document.getElementById('emailInscription').value.trim();
  const motPasse  = document.getElementById('motPasseInscription').value;
  const confirm   = document.getElementById('confirmMotPasse').value;

  if (!nom || !email || !motPasse || !confirm) {
    showNotification('⚠️ Remplissez tous les champs.', 'warning'); return;
  }
  if (motPasse !== confirm) {
    showNotification('❌ Les mots de passe ne correspondent pas.', 'error'); return;
  }
  if (motPasse.length < 6) {
    showNotification('⚠️ Mot de passe trop court (6 min).', 'warning'); return;
  }

  const btn = event.target.querySelector('[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Création…'; }

  try {
    const { data, error } = await sb.auth.signUp({
      email, password: motPasse,
      options: { data: { nom_complet: nom } }
    });

    if (error) { showNotification('❌ ' + error.message, 'error'); return; }

    if (data.session?.access_token) {
      localStorage.setItem('token', data.session.access_token);
    }

    showNotification('✅ Compte créé avec succès !', 'success');
    setTimeout(() => ouvrirPageConnexion(), 1200);

  } catch (err) {
    showNotification('❌ ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ Créer mon compte'; }
  }
}

// ─── Déconnexion ───
async function seDeconnecter(silencieux = false) {
  await sb.auth?.signOut();
  localStorage.removeItem('token');
  utilisateurConnecte = null;
  tontines   = [];
  alertes    = [];
  tontineActive = null;
  pageActuelle  = 'connexion';

  toggleSidebar(false);
  document.getElementById('appHeader')?.classList.add('hidden');
  document.getElementById('bottomNav').style.display = 'none';

  afficherPageConnexion();
  if (!silencieux) showNotification('✅ Déconnexion réussie !', 'success');
}

// ─── Vérifier session au chargement ───
document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/pwa/sw.js')
      .then(() => console.log('✅ SW enregistré'))
      .catch(err => console.error('❌ SW:', err));
  }

  const token = localStorage.getItem('token');
  if (token) {
    try {
      const res = await apiFetch(`${API_BASE}/auth/me`);
      if (!res.ok) throw new Error('Token invalide');
      const user = await res.json();

      utilisateurConnecte = {
        id: user.id,
        nom: user.email.split('@')[0],
        email: user.email
      };

      await chargerDepuisSupabase();
      initialiserApplication();
      afficherInterfaceConnectee();
      majSidebarInfos();
    } catch {
      await seDeconnecter(true);
    }
  } else {
    afficherPageConnexion();
  }

  setInterval(mettreAJourAlertes, 5 * 60 * 1000);
});

// ─── PWA Install ───
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn')?.classList.remove('hidden');
});

document.getElementById('installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('installBtn')?.classList.add('hidden');
});
