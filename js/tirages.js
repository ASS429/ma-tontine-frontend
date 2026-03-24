/* =========================================================
   tirages.js — Gestion des tirages
   ========================================================= */

async function chargerTontineTirage() {
  const id = document.getElementById('selectTontineTirage').value;
  if (!id) { document.getElementById('panneauTirage').classList.add('hidden'); return; }

  try {
    const res = await apiFetch(`${API_BASE}/tirages/${id}`);
    if (!res.ok) throw new Error();
    const tirages = await res.json();
    tontineActive = tontines.find(t => t.id === id);
    if (!tontineActive) throw new Error('Tontine non trouvée');

    tontineActive.gagnants = tirages.map((tr, i) => ({
      id: tr.id, membreId: tr.membre_id, nom: tr.membre_nom,
      ordre: i+1, date: tr.date_tirage, montant: tr.montant_gagne||0
    }));
    (tontineActive.membres||[]).forEach(m => {
      m.aGagne = tontineActive.gagnants.some(g => g.membreId === m.id);
    });

    document.getElementById('panneauTirage').classList.remove('hidden');
    afficherInfosTirage();
    afficherMembresEligibles();
    afficherHistoriqueGagnants();
  } catch {
    showNotification('❌ Impossible de charger la tontine', 'error');
  }
}

async function afficherInfosTirage() {
  const infoDiv  = document.getElementById('infoTirage');
  const btnTirage = document.getElementById('btnTirage');
  if (!tontineActive) return;

  try {
    const res  = await apiFetch(`${API_BASE}/tirages/run/${tontineActive.id}`, { method: 'POST' });
    const data = await res.json();

    if (!data.possible) {
      const couleur = data.error?.includes('cotisé') ? '#EF4444' : data.error?.includes('terminée') ? '#6B7280' : '#F59E0B';
      infoDiv.innerHTML = `<div style="background:${couleur};color:#fff;padding:16px;border-radius:14px;">
        <div style="font-weight:700;margin-bottom:4px;">⚠️ Tirage impossible</div>
        <div style="font-size:.85rem;opacity:.9;">${data.error}</div>
        ${data.retardataires?.length ? `<div style="margin-top:8px;font-size:.82rem;">En retard: ${data.retardataires.join(', ')}</div>` : ''}
      </div>`;
      btnTirage.disabled = true; btnTirage.style.display = 'none';
      return;
    }

    infoDiv.innerHTML = `<div style="background:linear-gradient(135deg,#10B981,#34D399);color:#fff;padding:16px;border-radius:14px;">
      <div style="font-weight:700;margin-bottom:4px;">✅ Tirage disponible !</div>
      <div style="font-size:.85rem;opacity:.9;margin-bottom:8px;">Toutes les conditions sont remplies</div>
      <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px;font-size:.82rem;">
        <div>Cycle: ${data.cycle}</div>
        <div>Candidat: ${data.gagnantPotentiel}</div>
        <div style="font-weight:700;">Montant: ${Number(data.montant_gagne||0).toLocaleString()} FCFA</div>
      </div>
    </div>`;
    btnTirage.disabled = false; btnTirage.style.display = 'inline-flex';
  } catch {
    infoDiv.innerHTML = `<div style="background:#6B7280;color:#fff;padding:14px;border-radius:14px;">⚠️ Impossible de vérifier les conditions</div>`;
    btnTirage.disabled = true;
  }
}

async function effectuerTirage() {
  if (!tontineActive) return;
  document.getElementById('animationDe').classList.remove('hidden');
  document.getElementById('resultatTirage').classList.add('hidden');

  try {
    const res = await apiFetch(`${API_BASE}/tirages/run/${tontineActive.id}?force=1`, { method: 'POST' });
    const g   = await res.json();
    if (!res.ok) { showNotification(g.error||'Erreur tirage', 'error'); return; }

    setTimeout(() => {
      document.getElementById('animationDe').classList.add('hidden');
      document.getElementById('resultatTirage').classList.remove('hidden');
      document.getElementById('gagnantTirage').textContent  = `🎉 ${g.membre_nom}`;
      document.getElementById('montantGagne').textContent   = `Montant gagné : ${Number(g.montant_gagne||g.montant_total||0).toLocaleString()} FCFA`;
      chargerTontineTirage();
    }, 2000);
  } catch {
    showNotification('❌ Erreur réseau', 'error');
  }
}

function afficherMembresEligibles() {
  const liste = document.getElementById('membresEligibles');
  if (!liste) return;
  liste.innerHTML = '';
  const eligibles = (tontineActive?.membres||[]).filter(m => !m.aGagne);
  if (!eligibles.length) { liste.innerHTML = '<p style="color:#6B7280;text-align:center;padding:16px;">Aucun membre éligible</p>'; return; }

  eligibles.forEach((m, i) => {
    const d = document.createElement('div');
    d.className = 'member-card fade-in-up';
    d.style.animationDelay = `${i * 0.07}s`;
    d.innerHTML = `
      <div class="member-avatar" style="width:36px;height:36px;font-size:.85rem;">${(m.nom||'?')[0].toUpperCase()}</div>
      <div style="flex:1;font-weight:600;color:#1e1b4b;">${m.nom}</div>
      <span class="pill pill-purple">${(m.cotisationsPayees||[]).length} cotis.</span>`;
    liste.appendChild(d);
  });
}

async function afficherHistoriqueGagnants() {
  const liste = document.getElementById('historiqueGagnants');
  if (!liste || !tontineActive) return;
  try {
    const res    = await apiFetch(`${API_BASE}/tirages/${tontineActive.id}`);
    const tirages = await res.json();
    if (!tirages.length) { liste.innerHTML = "<p style='color:#6B7280;font-style:italic;'>Aucun tirage effectué.</p>"; return; }

    const byCycle = {};
    tirages.forEach(t => { if (!byCycle[t.cycle_numero]) byCycle[t.cycle_numero] = []; byCycle[t.cycle_numero].push(t); });

    liste.innerHTML = Object.entries(byCycle).map(([cycle, ts]) => `
      <div style="margin-bottom:16px;">
        <h4 style="font-weight:700;color:#7C3AED;margin-bottom:8px;font-size:.9rem;">Cycle ${cycle}</h4>
        ${ts.map(t => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#F9FAFB;border-radius:10px;margin-bottom:6px;">
            <div>
              <div style="font-weight:600;color:#1e1b4b;">🏆 ${t.membre_nom}</div>
              <div style="font-size:.75rem;color:#6B7280;">${new Date(t.date_tirage).toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'})}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span style="font-weight:700;color:#10B981;">+${Number(t.montant_gagne||0).toLocaleString()} FCFA</span>
              <button onclick="supprimerTirage('${t.id}')" class="btn btn-danger btn-xs">🗑️</button>
            </div>
          </div>`).join('')}
      </div>`).join('');
  } catch {
    liste.innerHTML = "<p style='color:#EF4444;'>Impossible de charger l'historique.</p>";
  }
}

async function supprimerTirage(id) {
  const ok = await confirm('❌ Supprimer ce tirage ?');
  if (!ok) return;
  try {
    const res = await apiFetch(`${API_BASE}/tirages/${id}`, { method: 'DELETE' });
    if (res.ok) { showNotification('✅ Tirage supprimé !', 'success'); chargerTontineTirage(); }
    else { const e = await res.json(); showNotification('❌ ' + (e.error||'Erreur'), 'error'); }
  } catch { showNotification('❌ Erreur réseau', 'error'); }
}
