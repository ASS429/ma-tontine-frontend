/* =========================================================
   tontines.js — Création, affichage, édition, suppression
   ========================================================= */

// ─── Créer une tontine (pas à pas) ───
let etape = 1;

function changerEtape(dir) {
  if (dir === 1 && !validerEtape(etape)) return;
  document.getElementById('etape-' + etape).style.display = 'none';
  etape += dir;
  document.getElementById('etape-' + etape).style.display = 'flex';
  document.getElementById('etapeNum').textContent = etape;

  // Mise à jour indicateur de progression
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('step-dot-' + i);
    if (dot) {
      dot.classList.remove('curr', 'done');
      if (i < etape) dot.classList.add('done');
      if (i === etape) dot.classList.add('curr');
    }
  }

  document.getElementById('btnPrev').classList.toggle('hidden', etape === 1);
  document.getElementById('btnNext').classList.toggle('hidden', etape === 4);
  document.getElementById('btnCreate').classList.toggle('hidden', etape !== 4);
}

function validerEtape(num) {
  switch (num) {
    case 1:
      if (!document.getElementById('nomTontine').value.trim()) {
        afficherErreur('Veuillez entrer un nom de tontine'); return false;
      } return true;
    case 2:
      if (!(parseFloat(document.getElementById('montantCotisation').value) > 0)) {
        afficherErreur('Veuillez entrer un montant valide'); return false;
      } return true;
    case 3: {
      const freq = document.getElementById('frequenceCotisation').value;
      if (freq !== 'quotidien' && !document.getElementById('jourCotisation').value) {
        afficherErreur('Veuillez choisir un jour de cotisation'); return false;
      } return true;
    }
    case 4:
      if (!(parseInt(document.getElementById('nombreMembres').value) >= 2)) {
        afficherErreur('Veuillez entrer au moins 2 membres'); return false;
      } return true;
  }
  return true;
}

async function creerTontine() {
  const body = {
    nom:                 document.getElementById('nomTontine').value.trim(),
    type:                document.getElementById('typeTontine').value,
    montant_cotisation:  parseFloat(document.getElementById('montantCotisation').value),
    frequence_cotisation:document.getElementById('frequenceCotisation').value,
    jour_cotisation:     document.getElementById('jourCotisation').value,
    frequence_tirage:    document.getElementById('frequenceTirage').value,
    nombre_membres:      parseInt(document.getElementById('nombreMembres').value),
    description:         document.getElementById('descriptionTontine').value
  };

  try {
    const btn = document.getElementById('btnCreate');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Création…'; }

    const res = await apiFetch(`${API_BASE}/tontines`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur API');
    }
    const data = await res.json();
    tontines.push(mapTontineRowToLocal({ ...data, membres: [], cotisations: [], tirages: [] }));
    sauvegarder();

    // Reset form
    etape = 1;
    document.querySelectorAll('.etape').forEach((e, i) => e.classList.toggle('hidden', i > 0));
    document.getElementById('etapeNum').textContent = '1';
    document.getElementById('nomTontine').value = '';
    document.getElementById('montantCotisation').value = '';
    document.getElementById('nombreMembres').value = '';
    document.getElementById('descriptionTontine').value = '';

    showNotification(`✅ Tontine "${body.nom}" créée avec succès !`, 'success');
    ouvrirPage('accueil');
  } catch (err) {
    console.error('❌ creerTontine:', err);
    showNotification('❌ ' + err.message, 'error');
  } finally {
    const btn = document.getElementById('btnCreate');
    if (btn) { btn.disabled = false; btn.textContent = '✅ Créer la Tontine'; }
  }
}

// ─── État recherche/filtre ───
let _searchQuery  = '';
let _activeFilter = 'tous';

// ─── Afficher liste tontines (avec search + filtre) ───
function afficherTontines() {
  // Mettre à jour les deux conteneurs (accueil + page tontines)
  _renderTontineList('listeTontines');
  _renderTontineList('listeTontinesPage');
  _updateFilterCounts();
}

function _renderTontineList(containerId) {
  const liste = document.getElementById(containerId);
  if (!liste) return;
  liste.innerHTML = '';

  // Filtrer selon recherche + chip actif
  const filtered = tontines.filter(t => {
    const matchSearch = !_searchQuery ||
      t.nom.toLowerCase().includes(_searchQuery) ||
      (t.type || '').toLowerCase().includes(_searchQuery) ||
      (t.description || '').toLowerCase().includes(_searchQuery);
    const matchFilter =
      _activeFilter === 'tous' ||
      _activeFilter === t.type ||
      (_activeFilter === 'active'   && (t.statut || 'active') === 'active') ||
      (_activeFilter === 'terminee' && t.statut === 'terminee');
    return matchSearch && matchFilter;
  });

  if (!tontines.length) {
    liste.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px 16px;">
        <div style="font-size:4rem;margin-bottom:16px;animation:floatY 3s ease-in-out infinite;">🎯</div>
        <h3 style="font-size:1.2rem;font-weight:700;color:#374151;margin-bottom:8px;">Aucune tontine créée</h3>
        <p style="color:#6B7280;margin-bottom:20px;">Commencez par créer votre première tontine.</p>
        <button onclick="handleCreateClick()" class="btn btn-primary" style="width:auto;padding:12px 28px;">
          ➕ Créer une tontine
        </button>
      </div>`;
    return;
  }

  if (!filtered.length) {
    liste.innerHTML = `
      <div class="search-empty" style="grid-column:1/-1;">
        <div class="search-empty-icon">🔍</div>
        <p style="font-size:.95rem;font-weight:600;color:rgba(255,255,255,.7);">Aucune tontine trouvée</p>
        <p style="font-size:.82rem;color:rgba(255,255,255,.4);margin-top:4px;">Essayez un autre mot-clé ou filtre</p>
        <button onclick="resetRecherche()" style="margin-top:14px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.8);padding:8px 18px;border-radius:20px;cursor:pointer;font-size:.82rem;">
          Effacer les filtres
        </button>
      </div>`;
    return;
  }

  filtered.forEach((tontine, index) => {
    const membres     = tontine.membres     || [];
    const cotisations = tontine.cotisations || [];
    const tirages     = tontine.tirages     || [];
    const progression = tontine.nombreMembresMax ? (membres.length / tontine.nombreMembresMax) * 100 : 0;
    const eligibles   = membres.filter(m => !m.aGagne);
    const cComplete   = verifierCotisationsCompletes({ ...tontine, membres, cotisations });
    const tiragePoss  = verifierDateTiragePossible({ ...tontine, membres, cotisations, tirages });

    let statusBand = '';
    if (eligibles.length === 0)
      statusBand = `<div style="background:linear-gradient(135deg,#6B7280,#9CA3AF);color:#fff;padding:6px 12px;border-radius:8px;font-size:.78rem;font-weight:600;margin-bottom:12px;">🏁 Tontine terminée</div>`;
    else if (!membres.length)
      statusBand = `<div style="background:linear-gradient(135deg,#3B82F6,#60A5FA);color:#fff;padding:6px 12px;border-radius:8px;font-size:.78rem;font-weight:600;margin-bottom:12px;">👥 En attente de membres</div>`;
    else if (!cotisations.length)
      statusBand = `<div style="background:linear-gradient(135deg,#8B5CF6,#A78BFA);color:#fff;padding:6px 12px;border-radius:8px;font-size:.78rem;font-weight:600;margin-bottom:12px;">💰 En attente de cotisations</div>`;
    else if (cComplete && tiragePoss)
      statusBand = `<div style="background:linear-gradient(135deg,#10B981,#34D399);color:#fff;padding:6px 12px;border-radius:8px;font-size:.78rem;font-weight:600;margin-bottom:12px;">🎲 Tirage disponible !</div>`;
    else if (cComplete && !tiragePoss)
      statusBand = `<div style="background:linear-gradient(135deg,#F59E0B,#FCD34D);color:#78350F;padding:6px 12px;border-radius:8px;font-size:.78rem;font-weight:600;margin-bottom:12px;">⏳ Prochain tirage dans ${obtenirJoursRestantsAvantTirage(tontine)} j.</div>`;
    else
      statusBand = `<div style="background:linear-gradient(135deg,#EF4444,#F87171);color:#fff;padding:6px 12px;border-radius:8px;font-size:.78rem;font-weight:600;margin-bottom:12px;">❌ Cotisations incomplètes</div>`;

    const card = document.createElement('div');
    card.className = 'tontine-card fade-in-up';
    card.style.animationDelay = `${index * 0.08}s`;
    card.innerHTML = `
      <div class="tontine-card-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="font-size:2rem;">${TYPE_ICONS[tontine.type]||'🎁'}</div>
            <div>
              <h3 style="font-weight:700;font-size:1.05rem;color:#1e1b4b;line-height:1.2;">${tontine.nom}</h3>
              <p style="color:#6B7280;font-size:.8rem;">${FREQ_LABELS[tontine.frequenceCotisation]||tontine.frequenceCotisation} · ${tontine.montant.toLocaleString()} FCFA</p>
            </div>
          </div>
          <span class="pill pill-success">${tontine.statut||'active'}</span>
        </div>

        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:.75rem;color:#6B7280;margin-bottom:4px;">
            <span>Membres: ${membres.length}/${tontine.nombreMembresMax}</span>
            <span>${Math.round(progression)}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width:${progression}%"></div>
          </div>
        </div>

        ${statusBand}

        <div class="grid-2" style="margin-bottom:8px;">
          <button onclick="gererTontine('${tontine.id}')" class="btn btn-primary btn-sm">⚙️ Gérer</button>
          <button onclick="voirMembres('${tontine.id}')" class="btn btn-sm" style="background:linear-gradient(135deg,#f093fb,#f5576c);color:#fff;">👥 Membres</button>
        </div>
        <div class="grid-2">
          <button onclick="editerTontineAccueil('${tontine.id}')" class="btn btn-warning btn-sm">✏️ Éditer</button>
          <button onclick="demanderSuppressionTontine('${tontine.id}')" class="btn btn-danger btn-sm">🗑️ Supprimer</button>
        </div>
      </div>`;
    liste.appendChild(card);
  });
}

// ─── Helpers recherche & filtre ───
function onSearchInput(val) {
  _searchQuery = val.toLowerCase().trim();
  afficherTontines();
}

function setFiltreActif(chip, filtre) {
  _activeFilter = filtre;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  afficherTontines();
}

function resetRecherche() {
  _searchQuery  = '';
  _activeFilter = 'tous';
  const input = document.getElementById('searchTontines');
  if (input) input.value = '';
  document.querySelectorAll('.filter-chip').forEach((c, i) => {
    c.classList.toggle('active', i === 0);
  });
  afficherTontines();
}

function _updateFilterCounts() {
  const counts = {
    tous:     tontines.length,
    argent:   tontines.filter(t => t.type === 'argent').length,
    electronique: tontines.filter(t => t.type === 'electronique').length,
    cosmetique:   tontines.filter(t => t.type === 'cosmetique').length,
    autre:        tontines.filter(t => t.type === 'autre').length,
    active:   tontines.filter(t => (t.statut || 'active') === 'active').length,
    terminee: tontines.filter(t => t.statut === 'terminee').length,
  };
  document.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
    const f   = chip.dataset.filter;
    const cnt = document.getElementById('filter-count-' + f);
    if (cnt) cnt.textContent = counts[f] ?? '';
  });
}

// ─── Naviguer vers gestion/membres ───
function gererTontine(id) {
  ouvrirPage('gestion');
  const sel = document.getElementById('selectTontineGestion');
  if (sel) { sel.value = id; chargerTontineGestion(); }
}

function voirMembres(id) {
  ouvrirPage('membres');
  const sel = document.getElementById('selectTontineMembres');
  if (sel) { sel.value = id; afficherMembresTontine(); }
}

function allerAuTirage(id) {
  ouvrirPage('tirages');
  const sel = document.getElementById('selectTontineTirage');
  if (sel) { sel.value = id; chargerTontineTirage(); }
}

// ─── Charger les selects de tontines ───
function chargerSelectsTontines() {
  ['selectTontineGestion','selectTontineMembres','selectTontineTirage','selectTontinePaiements'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">Choisir une tontine…</option>';
    tontines.forEach(t => {
      const o = document.createElement('option');
      o.value = t.id; o.textContent = t.nom;
      sel.appendChild(o);
    });
  });
}

// ─── Gestion (charger tontine active) ───
async function chargerTontineGestion() {
  const id = document.getElementById('selectTontineGestion').value;
  if (!id) { document.getElementById('panneauGestion').classList.add('hidden'); return; }

  try {
    const res = await apiFetch(`${API_BASE}/tontines/${id}`);
    tontineActive = await res.json();
    document.getElementById('panneauGestion').classList.remove('hidden');
    afficherInfosTontine?.();
    afficherMembresTontineGestion?.();
    afficherHistoriqueCotisations?.();
    mettreAJourAlertes?.();
  } catch (err) {
    showNotification('❌ Impossible de charger la tontine', 'error');
  }
}

// ─── Infos tontine ───
function afficherInfosTontine() {
  if (!tontineActive) return;
  const t = tontineActive;
  const total = t.cotisations?.length || 0;
  const max   = t.nombreMembresMax || t.nombre_membres || 0;
  const cycle = total > 0 && max > 0 ? Math.ceil(total / max) : 1;

  document.getElementById('infosTontine').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;">
      <div class="stat-card">
        <div style="font-size:2rem;margin-bottom:6px;">${TYPE_ICONS[t.type]||'🎁'}</div>
        <div style="font-weight:700;font-size:.95rem;color:#1e1b4b;">${t.nom}</div>
        <div style="font-size:.75rem;color:#6B7280;">${t.type}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${Number(t.montant_cotisation||t.montant||0).toLocaleString()}</div>
        <div class="stat-label">FCFA / cotisation</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${(t.membres?.length||0)}/${max}</div>
        <div class="stat-label">Membres</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${cycle}/${max||'?'}</div>
        <div class="stat-label">Cycle actuel</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${total}</div>
        <div class="stat-label">Cotisations</div>
      </div>
    </div>`;
}

// ─── Suppression tontine ───
let tontineASupprimer = null;

function demanderSuppressionTontine(id) {
  tontineASupprimer = id;
  const t = tontines.find(t => t.id === id);
  if (t) {
    document.getElementById('texteSuppression').innerHTML =
      `Supprimer <strong>${t.nom}</strong> ? Tous les membres, cotisations et tirages seront effacés.`;
  }
  document.getElementById('modaleSuppressionTontine').classList.remove('hidden');
}

function fermerModaleSuppression() {
  document.getElementById('modaleSuppressionTontine').classList.add('hidden');
  tontineASupprimer = null;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnConfirmerSuppression')?.addEventListener('click', async () => {
    if (!tontineASupprimer) return;
    await supprimerTontine(tontineASupprimer);
    fermerModaleSuppression();
  });
});

async function supprimerTontine(id) {
  try {
    const res = await apiFetch(`${API_BASE}/tontines/${id}`, { method: 'DELETE' });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    tontines = tontines.filter(t => t.id !== id);
    mettreAJourAffichage?.();
    afficherTontines();
    showNotification('✅ Tontine supprimée.', 'success');
  } catch (err) {
    showNotification('❌ ' + err.message, 'error');
  }
}

// ─── Édition tontine ───
async function editerTontineAccueil(id) {
  try {
    const res = await apiFetch(`${API_BASE}/tontines/${id}`);
    if (!res.ok) throw new Error();
    tontineActive = await res.json();
    document.getElementById('editNomTontine').value        = tontineActive.nom;
    document.getElementById('editTypeTontine').value       = tontineActive.type;
    document.getElementById('editMontantCotisation').value = tontineActive.montant_cotisation;
    document.getElementById('editFrequenceCotisation').value= tontineActive.frequence_cotisation;
    document.getElementById('editJourCotisation').value    = tontineActive.jour_cotisation||'';
    document.getElementById('editFrequenceTirage').value   = tontineActive.frequence_tirage;
    document.getElementById('editNombreMembres').value     = tontineActive.nombre_membres;
    document.getElementById('editDescriptionTontine').value= tontineActive.description||'';
    document.getElementById('modaleEditionTontine').classList.remove('hidden');
  } catch { showNotification('❌ Chargement impossible', 'error'); }
}

function fermerModaleEditionTontine() {
  document.getElementById('modaleEditionTontine').classList.add('hidden');
}

async function sauvegarderEditionTontine() {
  try {
    const body = {
      nom:                  document.getElementById('editNomTontine').value,
      type:                 document.getElementById('editTypeTontine').value,
      montant_cotisation:   parseFloat(document.getElementById('editMontantCotisation').value),
      frequence_cotisation: document.getElementById('editFrequenceCotisation').value,
      jour_cotisation:      document.getElementById('editJourCotisation').value,
      frequence_tirage:     document.getElementById('editFrequenceTirage').value,
      nombre_membres:       parseInt(document.getElementById('editNombreMembres').value),
      description:          document.getElementById('editDescriptionTontine').value
    };

    const res = await apiFetch(`${API_BASE}/tontines/${tontineActive.id}`, {
      method: 'PUT', body: JSON.stringify(body)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    const updated = await res.json();
    tontines = tontines.map(t => t.id === updated.id ? mapTontineRowToLocal({ ...updated, membres:updated.membres||[], cotisations:updated.cotisations||[], tirages:updated.tirages||[] }) : t);
    afficherTontines();
    fermerModaleEditionTontine();
    showNotification(`✅ Tontine "${body.nom}" mise à jour.`, 'success');
  } catch (err) { showNotification('❌ ' + err.message, 'error'); }
}

// ─── Fréquence cotisation — afficher/masquer jour ───
document.addEventListener('DOMContentLoaded', () => {
  const initJour = () => {
    const freq = document.getElementById('frequenceCotisation')?.value;
    const zone = document.getElementById('zoneJourCotisation');
    if (zone) zone.style.display = freq === 'quotidien' ? 'none' : 'block';
  };
  document.getElementById('frequenceCotisation')?.addEventListener('change', initJour);
  initJour();
});
