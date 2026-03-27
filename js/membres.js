/* =========================================================
   membres.js — Gestion des membres (ajout, édition, suppression)
   ✅ CORRECTIFS XSS : esc() sur toutes les données API dans innerHTML
   ✅ Validation renforcée : format téléphone, longueur nom
   ========================================================= */

// ─── Validation membre ───
function validerMembre({ nom, telephone }) {
  if (!nom?.trim() || nom.length > 100)
    return 'Nom invalide (1 à 100 caractères requis)';
  if (telephone && !/^[0-9+\s\-(). ]{6,20}$/.test(telephone))
    return 'Numéro de téléphone invalide (6 à 20 chiffres)';
  return null;
}

// ─── Afficher les membres d'une tontine ───
async function afficherMembresTontine() {
  const tontineId = document.getElementById('selectTontineMembres').value;
  const panneau   = document.getElementById('panneauMembres');
  const cartes    = document.getElementById('cartesMembres');
  if (!tontineId) { panneau.classList.add('hidden'); return; }

  try {
    const res = await apiFetch(`${API_BASE}/membres/${tontineId}`);
    if (!res.ok) throw new Error(res.statusText);
    const data    = await res.json();
    const membres = data.membres || [];
    tontineActive = data;

    panneau.classList.remove('hidden');
    cartes.innerHTML = '';

    if (!membres.length) {
      cartes.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px 16px;">
          <div style="font-size:3.5rem;margin-bottom:12px;animation:floatY 3s ease-in-out infinite;">👥</div>
          <h3 style="font-weight:700;color:#374151;">Aucun membre</h3>
          <p style="color:#6B7280;">Ajoutez des membres via la page Gestion.</p>
        </div>`;
      return;
    }

    membres.forEach((m, i) => {
      const cotCount = m.cotisationsPayees?.length || 0;
      const cotTotal = (m.cotisationsPayees||[]).reduce((s,c) => s + Number(c.montant||0), 0);
      // ✅ initiale calculée en JS, pas dans le HTML
      const initiale = (m.nom||'?')[0].toUpperCase();

      const div = document.createElement('div');
      div.className = 'card card-p fade-in-up';
      div.style.animationDelay = `${i * 0.08}s`;
      // ✅ esc() sur nom, téléphone, adresse
      div.innerHTML = `
        <div style="text-align:center;margin-bottom:14px;">
          <div class="member-avatar" style="width:54px;height:54px;font-size:1.4rem;margin:0 auto 10px;">${esc(initiale)}</div>
          <h3 style="font-weight:700;font-size:1rem;color:#1e1b4b;">${esc(m.nom)}</h3>
          <span class="pill pill-success">Actif</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:.82rem;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;padding:6px 8px;background:#F9FAFB;border-radius:8px;">
            <span style="color:#6B7280;">📞 Tél</span><span style="font-weight:600;">${esc(m.telephone||'-')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 8px;background:#F9FAFB;border-radius:8px;">
            <span style="color:#6B7280;">📍 Adresse</span><span style="font-weight:600;">${esc(m.adresse||'-')}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 8px;background:#F9FAFB;border-radius:8px;">
            <span style="color:#6B7280;">Cotisations</span><span style="font-weight:700;color:#7C3AED;">${cotCount}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 8px;background:#F9FAFB;border-radius:8px;">
            <span style="color:#6B7280;">Total cotisé</span><span style="font-weight:700;color:#10B981;">${cotTotal.toLocaleString()} FCFA</span>
          </div>
        </div>
        <div class="grid-2">
          <button onclick="ouvrirModaleEditionMembre('${esc(m.id)}')" class="btn btn-warning btn-sm">✏️ Éditer</button>
          <button onclick="retirerMembreTontine('${esc(m.id)}','${esc(tontineId)}')" class="btn btn-danger btn-sm">🗑️ Retirer</button>
        </div>`;
      cartes.appendChild(div);
    });
  } catch (err) {
    console.error('❌ afficherMembresTontine:', err);
    showNotification('❌ Impossible de charger les membres', 'error');
  }
}

// ─── Afficher membres dans la page Gestion ───
function afficherMembresTontineGestion() {
  const container = document.getElementById('listeMembresTontineGestion');
  if (!container) return;
  container.innerHTML = '';

  if (!tontineActive?.membres?.length) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:32px;">
        <div style="font-size:3rem;margin-bottom:10px;animation:floatY 3s ease-in-out infinite;">👥</div>
        <p style="color:#6B7280;">Aucun membre — ajoutez-en ci-dessous.</p>
      </div>`;
    return;
  }

  tontineActive.membres.forEach((m, i) => {
    const cotisations = (tontineActive.cotisations||[]).filter(c => c.membre_id === m.id);
    const aGagne      = (tontineActive.tirages||[]).some(t => t.membre_id === m.id);

    const div = document.createElement('div');
    div.className = 'member-card fade-in-up';
    div.style.animationDelay = `${i * 0.07}s`;
    // ✅ esc() sur nom
    div.innerHTML = `
      <div class="member-avatar">${esc((m.nom||'?')[0].toUpperCase())}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-weight:700;color:#1e1b4b;">${esc(m.nom)}</span>
          <span class="pill ${aGagne ? 'pill-warning' : 'pill-success'}">${aGagne ? '🏆 Gagnant' : 'Actif'}</span>
        </div>
        <div style="font-size:.78rem;color:#6B7280;margin-top:2px;">${cotisations.length} cotisation(s) • ${cotisations.reduce((s,c)=>s+Number(c.montant||0),0).toLocaleString()} FCFA</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button onclick="ouvrirModaleEditionMembre('${esc(m.id)}')" class="btn btn-warning btn-xs">✏️</button>
        <button onclick="retirerMembreTontine('${esc(m.id)}','${esc(tontineActive.id)}')" class="btn btn-danger btn-xs">🗑️</button>
      </div>`;
    container.appendChild(div);
  });

  mettreAJourSelectMembres();
}

function mettreAJourSelectMembres() {
  const sel = document.getElementById('selectMembreCotisation');
  if (!sel || !tontineActive) return;
  sel.innerHTML = '<option value="">Choisir un membre</option>';
  (tontineActive.membres||[]).forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    // ✅ textContent échappe automatiquement
    o.textContent = m.nom;
    sel.appendChild(o);
  });
}

// ─── Ajouter un membre ───
async function ajouterMembreTontine() {
  if (!tontineActive) return showNotification('⚠️ Aucune tontine active !', 'warning');

  const nom       = document.getElementById('nomMembre').value.trim();
  const telephone = document.getElementById('telephoneMembre').value.trim();
  const adresse   = document.getElementById('adresseMembre').value.trim();

  // ✅ Validation renforcée
  const erreur = validerMembre({ nom, telephone });
  if (erreur) return showNotification(`⚠️ ${erreur}`, 'warning');

  if (!telephone)
    return showNotification('⚠️ Le numéro de téléphone est requis.', 'warning');

  try {
    const res = await apiFetch(`${API_BASE}/membres`, {
      method: 'POST',
      body: JSON.stringify({ tontineId: tontineActive.id, nom, telephone, adresse })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    const m = await res.json();
    tontineActive.membres = tontineActive.membres || [];
    tontineActive.membres.push({
      id: m.id, nom: m.nom, telephone: m.telephone, adresse: m.adresse,
      dateAjout: m.cree_le || new Date().toISOString(), cotisationsPayees: []
    });
    document.getElementById('nomMembre').value = '';
    document.getElementById('telephoneMembre').value = '';
    document.getElementById('adresseMembre').value = '';
    afficherMembresTontineGestion?.();
    afficherMembresTontine?.();
    showNotification(`✅ Membre "${esc(nom)}" ajouté !`, 'success');
  } catch (err) {
    showNotification('❌ ' + esc(err.message), 'error');
  }
}

// ─── Retirer un membre ───
async function retirerMembreTontine(membreId, tontineId) {
  if (!tontineActive) return showNotification('⚠️ Aucune tontine active !', 'warning');
  const m = tontineActive.membres?.find(x => x.id === membreId);
  if (!m) return;

  const cots  = m.cotisationsPayees || [];
  const total = cots.reduce((s,c) => s+Number(c.montant||0), 0);
  const ok = await customConfirm(`Retirer "${m.nom}" ?\n${cots.length} cotisation(s) (${total.toLocaleString()} FCFA) seront supprimées.`);
  if (!ok) return;

  try {
    const res = await apiFetch(`${API_BASE}/membres/${membreId}`, { method: 'DELETE' });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    tontineActive.membres = tontineActive.membres.filter(x => x.id !== membreId);
    if (pageActuelle === 'gestion') { afficherMembresTontineGestion?.(); mettreAJourSelectMembres?.(); }
    else afficherMembresTontine?.();
    mettreAJourAlertes?.();
    showNotification(`✅ Membre "${esc(m.nom)}" retiré.`, 'success');
  } catch (err) {
    showNotification('❌ ' + esc(err.message), 'error');
  }
}

// ─── Édition membre ───
function ouvrirModaleEditionMembre(membreId) {
  let membre;
  if (tontineActive) {
    membre = tontineActive.membres?.find(m => m.id === membreId);
  }
  if (!membre) return;
  membreEnEdition = membre;
  // ✅ .value = ... échappe automatiquement, pas besoin de esc()
  document.getElementById('editNomMembre').value      = membre.nom || '';
  document.getElementById('editTelephoneMembre').value = membre.telephone || '';
  document.getElementById('editAdresseMembre').value   = membre.adresse || '';
  document.getElementById('editDateAjoutMembre').value =
    membre.cree_le ? new Date(membre.cree_le).toISOString().split('T')[0] : '';
  document.getElementById('modaleEditionMembre').classList.remove('hidden');
}

function fermerModaleEditionMembre() {
  document.getElementById('modaleEditionMembre').classList.add('hidden');
  membreEnEdition = null;
}

async function sauvegarderEditionMembre() {
  if (!membreEnEdition) return;
  const nom       = document.getElementById('editNomMembre').value.trim();
  const telephone = document.getElementById('editTelephoneMembre').value.trim();
  const adresse   = document.getElementById('editAdresseMembre').value.trim();
  const dateAjout = document.getElementById('editDateAjoutMembre').value;

  // ✅ Validation renforcée
  const erreur = validerMembre({ nom, telephone });
  if (erreur) return showNotification(`⚠️ ${erreur}`, 'warning');
  if (!dateAjout) return showNotification('⚠️ La date est requise', 'warning');

  try {
    const res = await apiFetch(`${API_BASE}/membres/${membreEnEdition.id}`, {
      method: 'PUT',
      body: JSON.stringify({ nom, telephone, adresse, dateAjout: new Date(dateAjout).toISOString() })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    const updated = await res.json();
    membreEnEdition.nom       = updated.nom;
    membreEnEdition.telephone = updated.telephone;
    membreEnEdition.adresse   = updated.adresse;
    membreEnEdition.cree_le   = updated.cree_le;
    fermerModaleEditionMembre();
    if (pageActuelle === 'gestion') afficherMembresTontineGestion?.();
    else afficherMembresTontine?.();
    showNotification(`✅ Membre "${esc(updated.nom)}" modifié.`, 'success');
  } catch (err) {
    showNotification('❌ ' + esc(err.message), 'error');
  }
}

// ─── Enregistrer cotisation ───
async function enregistrerCotisationTontine() {
  if (!tontineActive) return showNotification('⚠️ Aucune tontine active !', 'warning');
  const membreId = document.getElementById('selectMembreCotisation').value;
  if (!membreId)  return showNotification('⚠️ Sélectionnez un membre.', 'warning');

  const montant = tontineActive.montant_cotisation || tontineActive.montant;
  const date    = document.getElementById('dateCotisation').value || new Date().toISOString().split('T')[0];

  try {
    const res = await apiFetch(`${API_BASE}/cotisations`, {
      method: 'POST',
      body: JSON.stringify({ tontineId: tontineActive.id, membreId, montant, dateCotisation: date })
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    const data = await res.json();
    if (!tontineActive.cotisations) tontineActive.cotisations = [];
    tontineActive.cotisations.push({
      id: data.id, membre_id: data.membre_id,
      montant: Number(data.montant), date_cotisation: data.date_cotisation
    });
    afficherHistoriqueCotisations?.();
    afficherMembresTontineGestion?.();
    mettreAJourAlertes?.();
    showNotification('✅ Cotisation enregistrée.', 'success');
  } catch (err) {
    showNotification('❌ ' + esc(err.message), 'error');
  }
}

// ─── Historique cotisations ───
function afficherHistoriqueCotisations() {
  const liste = document.getElementById('historiqueCotisations');
  if (!liste) return;
  liste.innerHTML = '';

  if (!tontineActive?.cotisations?.length) {
    liste.innerHTML = `<div style="text-align:center;padding:24px;color:#6B7280;"><div style="font-size:2.5rem;margin-bottom:8px;">💰</div><p>Aucune cotisation</p></div>`;
    return;
  }

  const recentes = [...tontineActive.cotisations]
    .sort((a,b) => new Date(b.date_cotisation||b.date) - new Date(a.date_cotisation||a.date))
    .slice(0, 10);

  recentes.forEach((c, i) => {
    const m = tontineActive.membres?.find(x => x.id === (c.membre_id||c.membreId));
    const d = document.createElement('div');
    d.className = 'member-card fade-in-up';
    d.style.animationDelay = `${i * 0.05}s`;
    // ✅ esc() sur le nom du membre
    d.innerHTML = `
      <div class="member-avatar" style="width:36px;height:36px;font-size:.9rem;">${esc((m?.nom||'?')[0].toUpperCase())}</div>
      <div style="flex:1;">
        <span style="font-weight:600;color:#1e1b4b;">${esc(m?.nom||'Membre supprimé')}</span>
        <div style="font-size:.75rem;color:#6B7280;">${new Date(c.date_cotisation||c.date).toLocaleDateString('fr-FR')}</div>
      </div>
      <span style="font-weight:700;color:#10B981;">+${Number(c.montant).toLocaleString()} FCFA</span>`;
    liste.appendChild(d);
  });
}
