/* =========================================================
   alertes.js — Affichage et gestion des alertes
   ========================================================= */

async function afficherAlertes() {
  const al = await mettreAJourAlertes();
  const liste = document.getElementById('listeAlertes');
  if (!liste) return;
  liste.innerHTML = '';

  if (!al?.length) {
    liste.innerHTML = `
      <div style="text-align:center;padding:48px 16px;">
        <div style="font-size:4rem;margin-bottom:16px;animation:floatY 3s ease-in-out infinite;">✅</div>
        <h3 style="font-weight:700;font-size:1.2rem;color:#374151;margin-bottom:8px;">Aucune alerte active</h3>
        <p style="color:#6B7280;">Toutes les tontines sont bien gérées !</p>
      </div>`;
    document.getElementById('badgeAlertes')?.classList.add('hidden');
    document.getElementById('navBadgeAlertes')?.classList.add('hidden');
    return;
  }

  const urgOrd = { haute:3, moyenne:2, basse:1 };
  al.sort((a,b) => (urgOrd[b.urgence]||0) - (urgOrd[a.urgence]||0));

  al.forEach((a, i) => {
    const cfg = {
      retard:         { border:'#EF4444', icon:'🚨', label:'Retard de cotisation' },
      tirage:         { border:'#3B82F6', icon:'🎲', label:'Tirage disponible' },
      cycle_retard:   { border:'#F59E0B', icon:'⏳', label:'Cycle en retard' },
      paiement_attente:{ border:'#8B5CF6',icon:'💳', label:'Paiement en attente' },
    }[a.type] || { border:'#6B7280', icon:'ℹ️', label:'Information' };

    const urgClass = { haute:'danger', moyenne:'warning', basse:'info' }[a.urgence] || 'info';

    const dateStr = (a.dateCreation||'').replace(' ','T');
    const d = new Date(dateStr);
    const dateLocale = !isNaN(d) ? d.toLocaleDateString('fr-FR') + ' · ' + d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—';
    const diff = !isNaN(d) ? Math.floor((Date.now()-d.getTime())/(1000*60*60*24)) : 0;
    const badgeT = diff===0 ? '🟢 Aujourd\'hui' : diff===1 ? '🟡 Hier' : `🔴 Il y a ${diff} j.`;

    const div = document.createElement('div');
    div.className = 'alert-card ' + (a.urgence||'basse');
    div.setAttribute('data-alerte-id', a.id);
    div.style.animationDelay = `${i * 0.06}s`;
    div.innerHTML = `
      <div style="font-size:2rem;flex-shrink:0;">${cfg.icon}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
          <span style="font-weight:600;color:#1e1b4b;">${a.message}</span>
          <span class="pill pill-${urgClass}">${a.urgence||'basse'}</span>
        </div>
        <div style="font-size:.75rem;color:#6B7280;">${cfg.label} · ${dateLocale} · ${badgeT}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button onclick="resoudreAlerte('${a.id}')" class="btn btn-success btn-xs">✅</button>
        <button onclick="supprimerAlerte('${a.id}')" class="btn btn-danger btn-xs">🗑️</button>
      </div>`;
    liste.appendChild(div);
  });

  mettreAJourBadgeAlertes(al);
}

async function resoudreAlerte(id) {
  try {
    const res = await apiFetch(`${API_BASE}/alertes/${id}`, { method:'PUT', body:JSON.stringify({estResolue:true}) });
    if (!res.ok) throw new Error();
    document.querySelector(`[data-alerte-id="${id}"]`)?.remove();
    showNotification('✅ Alerte résolue', 'success');
  } catch { showNotification('❌ Impossible de résoudre', 'error'); }
}

async function supprimerAlerte(id) {
  try {
    const res = await apiFetch(`${API_BASE}/alertes/${id}`, { method:'DELETE' });
    if (!res.ok) throw new Error();
    document.querySelector(`[data-alerte-id="${id}"]`)?.remove();
    showNotification('🗑️ Alerte supprimée', 'success');
  } catch { showNotification('❌ Impossible de supprimer', 'error'); }
}


/* =========================================================
   statistiques.js — Graphiques et tableau de bord
   ========================================================= */

let chartTypes = null, chartCotisations = null;

async function afficherStatistiques() {
  try {
    const stats = await apiFetch(`${API_BASE}/stats/overview`).then(r=>r.json());
    document.getElementById('statTotalTontines').textContent     = stats.tontines_actives;
    document.getElementById('statTotalMembres').textContent      = stats.membres_total;
    document.getElementById('statTotalCotisations').textContent  = stats.montant_collecte?.toLocaleString?.()??stats.montant_collecte;
    document.getElementById('statTotalTirages').textContent      = stats.tirages_effectues;
    document.getElementById('statRetards').textContent           = stats.retards;
    document.getElementById('statCyclesRetard').textContent      = stats.cycles_retard;
    document.getElementById('statPaiementsAttente').textContent  = stats.paiements_attente;
    document.getElementById('statTiragesDisponibles').textContent = stats.tirages_disponibles;

    const details = await apiFetch(`${API_BASE}/stats/details`).then(r=>r.json());
    creerGraphiques(details.types, details.cotisations);
    remplirTableauPerformance(details.performance);
    genererResumeAlertes();
  } catch (err) {
    console.error('❌ afficherStatistiques:', err);
    showNotification('Impossible de charger les statistiques', 'error');
  }
}

function creerGraphiques(types, cotisations) {
  const ctxT = document.getElementById('graphiqueTypes')?.getContext('2d');
  if (ctxT) {
    if (chartTypes) chartTypes.destroy();
    chartTypes = new Chart(ctxT, {
      type: 'doughnut',
      data: {
        labels: types.map(t => (TYPE_ICONS[t.type]||'📦') + ' ' + t.type),
        datasets: [{ data: types.map(t=>t.total), backgroundColor:['rgba(124,58,237,.8)','rgba(16,185,129,.8)','rgba(245,158,11,.8)','rgba(239,68,68,.8)'], borderWidth:0 }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
    });
  }

  const ctxC = document.getElementById('graphiqueCotisations')?.getContext('2d');
  if (ctxC) {
    if (chartCotisations) chartCotisations.destroy();
    chartCotisations = new Chart(ctxC, {
      type: 'line',
      data: {
        labels: cotisations.map(c=>c.mois).slice(-6),
        datasets: [{ label:'Cotisations (FCFA)', data:cotisations.map(c=>c.total).slice(-6), borderColor:'rgba(124,58,237,1)', backgroundColor:'rgba(124,58,237,.08)', borderWidth:3, tension:.4, fill:true, pointBackgroundColor:'rgba(124,58,237,1)' }]
      },
      options: { responsive:true, maintainAspectRatio:false }
    });
  }
}

function remplirTableauPerformance(perf) {
  const tb = document.getElementById('tableauPerformance');
  if (!tb) return;
  tb.innerHTML = '';
  (perf||[]).forEach((t, i) => {
    const pM = t.nombre_membres ? (t.membres_actuels/t.nombre_membres)*100 : 0;
    const pT = t.membres_actuels ? (t.tirages_effectues/t.membres_actuels)*100 : 0;
    const tr = document.createElement('tr');
    tr.className = 'fade-in-up';
    tr.style.animationDelay = `${i*.07}s`;
    tr.innerHTML = `
      <td style="padding:10px 12px;font-weight:600;">${TYPE_ICONS[t.type]||'📦'} ${t.nom}</td>
      <td style="padding:10px 12px;text-transform:capitalize;">${t.type}</td>
      <td style="padding:10px 12px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden;">
            <div style="height:100%;background:linear-gradient(135deg,#3B82F6,#60A5FA);width:${pM}%;"></div>
          </div>
          <span style="font-size:.72rem;color:#6B7280;">${t.membres_actuels}/${t.nombre_membres}</span>
        </div>
      </td>
      <td style="padding:10px 12px;font-weight:600;color:#10B981;">${(t.total_cotisations||0).toLocaleString()} FCFA</td>
      <td style="padding:10px 12px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:6px;background:#E5E7EB;border-radius:3px;overflow:hidden;">
            <div style="height:100%;background:linear-gradient(135deg,#8B5CF6,#A78BFA);width:${pT}%;"></div>
          </div>
          <span style="font-size:.72rem;color:#6B7280;">${t.tirages_effectues}/${t.membres_actuels}</span>
        </div>
      </td>
      <td style="padding:10px 12px;"><span class="pill ${t.statut==='active'?'pill-success':'pill-gray'}">${t.statut==='active'?'🟢 Active':'🏁 Terminée'}</span></td>`;
    tb.appendChild(tr);
  });
}

async function genererResumeAlertes() {
  try {
    const al = await mettreAJourAlertes();
    if (!Array.isArray(al)) return;
    const r = document.getElementById('resumeAlertes');
    if (!r) return;
    const retards  = al.filter(a=>a.type==='retard').length;
    const cycles   = al.filter(a=>a.type==='cycle_retard').length;
    const paiements= al.filter(a=>a.type==='paiement_attente').length;
    const tirages  = al.filter(a=>a.type==='tirage').length;
    r.innerHTML = `
      <div class="stat-card"><div class="stat-value" style="color:#EF4444;">${retards}</div><div class="stat-label">⚠️ Retards</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#F59E0B;">${cycles}</div><div class="stat-label">⏳ Cycles retard</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#3B82F6;">${paiements}</div><div class="stat-label">💳 Paiements attente</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#10B981;">${tirages}</div><div class="stat-label">🎲 Tirages dispo</div></div>`;
    document.getElementById('statRetards')?.           && (document.getElementById('statRetards').textContent = retards);
    document.getElementById('statCyclesRetard')?.      && (document.getElementById('statCyclesRetard').textContent = cycles);
    document.getElementById('statPaiementsAttente')?.  && (document.getElementById('statPaiementsAttente').textContent = paiements);
    document.getElementById('statTiragesDisponibles')?.&& (document.getElementById('statTiragesDisponibles').textContent = tirages);
  } catch (err) { console.error('❌ genererResumeAlertes:', err); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('page-statistiques')?.addEventListener('click', afficherStatistiques);
});


/* =========================================================
   paiements.js — Paiements et comptes
   ========================================================= */

async function chargerPaiements() {
  const id = document.getElementById('selectTontinePaiements').value;
  if (!id) return;
  try {
    const res = await apiFetch(`${API_BASE}/paiements/${id}`);
    if (!res.ok) throw new Error();
    const paiements = await res.json();
    const liste = document.getElementById('listePaiements');
    if (!liste) return;
    liste.innerHTML = '';

    if (!paiements.length) {
      liste.innerHTML = '<p style="color:#6B7280;font-style:italic;">Aucun paiement pour cette tontine.</p>';
      return;
    }

    paiements.forEach(p => {
      const div = document.createElement('div');
      div.className = 'member-card';
      div.innerHTML = `
        <div style="flex:1;">
          <div style="font-weight:700;color:#1e1b4b;">${p.membre_nom}</div>
          <div style="font-size:.82rem;color:#6B7280;">${p.type==='cotisation'?'💰 Cotisation':'🎉 Gain'} · ${p.montant.toLocaleString()} FCFA · ${formatMoyen(p.moyen)}</div>
          <span class="pill ${p.statut==='effectue'?'pill-success':'pill-warning'}">${p.statut==='effectue'?'✅ Effectué':'⏳ En attente'}</span>
        </div>
        <div style="display:flex;gap:6px;">
          ${p.statut!=='effectue' ? `<button onclick="validerPaiement('${p.id}')" class="btn btn-success btn-xs">✅</button>` : ''}
          <button onclick="supprimerPaiement('${p.id}')" class="btn btn-danger btn-xs">🗑️</button>
        </div>`;
      liste.appendChild(div);
    });
    await chargerSelectsPaiements();
  } catch { console.error('❌ chargerPaiements'); }
}

async function validerPaiement(id) {
  try {
    const res = await apiFetch(`${API_BASE}/paiements/${id}`, { method:'PUT', body:JSON.stringify({statut:'effectue'}) });
    const d = await res.json();
    if (!res.ok) { showNotification('❌ ' + (d.error||d.details), 'error'); return; }
    showNotification('✅ Paiement effectué', 'success');
    await chargerPaiements(); await chargerComptes();
  } catch { showNotification('❌ Erreur validation', 'error'); }
}

async function supprimerPaiement(id) {
  const ok = await confirm('❓ Supprimer ce paiement ?');
  if (!ok) return;
  try {
    const res = await apiFetch(`${API_BASE}/paiements/${id}`, { method:'DELETE' });
    if (!res.ok) { const d=await res.json(); showNotification('❌ '+(d.error||d.details),'error'); return; }
    showNotification('🗑️ Paiement supprimé', 'success');
    await chargerPaiements(); await chargerComptes();
  } catch { showNotification('❌ Erreur suppression', 'error'); }
}

async function chargerComptes() {
  try {
    const res = await apiFetch(`${API_BASE}/comptes`);
    if (!res.ok) throw new Error();
    const comptes = await res.json();
    const liste = document.getElementById('listeComptes');
    if (!liste) return;
    liste.innerHTML = '';

    if (!comptes.length) {
      liste.innerHTML = '<p style="color:#6B7280;font-style:italic;">Aucun compte ajouté.</p>'; return;
    }

    comptes.forEach(c => {
      const div = document.createElement('div');
      div.className = 'member-card';
      div.innerHTML = `
        <div style="font-size:1.5rem;flex-shrink:0;">${{wave:'🌊',orange_money:'🟧',especes:'💵'}[c.type]||'💳'}</div>
        <div style="flex:1;">
          <div style="font-weight:700;color:#1e1b4b;">${formatMoyen(c.type)}</div>
          <div style="font-size:.82rem;color:#10B981;font-weight:600;">${Number(c.solde).toLocaleString()} FCFA</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button onclick="modifierSoldeCompte('${c.id}',${c.solde})" class="btn btn-warning btn-xs">✏️</button>
          <button onclick="supprimerCompte('${c.id}')" class="btn btn-danger btn-xs">🗑️</button>
        </div>`;
      liste.appendChild(div);
    });
  } catch { console.error('❌ chargerComptes'); }
}

async function ajouterCompte() {
  const type  = document.getElementById('nouveauTypeCompte').value;
  const solde = document.getElementById('nouveauSolde').value || 0;
  try {
    const res = await apiFetch(`${API_BASE}/comptes`, { method:'POST', body:JSON.stringify({type,solde}) });
    if (!res.ok) throw new Error();
    showNotification('✅ Compte ajouté', 'success');
    await chargerComptes();
    document.getElementById('nouveauSolde').value = '';
  } catch { showNotification('❌ Impossible d\'ajouter le compte', 'error'); }
}

async function modifierSoldeCompte(id, soldeActuel) {
  const val = await prompt('💰 Nouveau solde :', soldeActuel);
  if (val === null || val === '') return;
  try {
    const res = await apiFetch(`${API_BASE}/comptes/${id}`, { method:'PUT', body:JSON.stringify({solde:Number(val)}) });
    if (!res.ok) throw new Error();
    showNotification('✅ Solde mis à jour', 'success');
    await chargerComptes();
  } catch { showNotification('❌ Impossible de modifier', 'error'); }
}

async function supprimerCompte(id) {
  const ok = await confirm('❓ Supprimer ce compte ?');
  if (!ok) return;
  try {
    const res = await apiFetch(`${API_BASE}/comptes/${id}`, { method:'DELETE' });
    if (!res.ok) throw new Error();
    showNotification('✅ Compte supprimé', 'success');
    await chargerComptes();
  } catch { showNotification('❌ Impossible de supprimer', 'error'); }
}

async function chargerSelectsPaiements() {
  const id = document.getElementById('selectTontinePaiements').value;
  if (!id) return;
  try {
    const [resM, resC] = await Promise.all([
      apiFetch(`${API_BASE}/membres/tontine/${id}`).then(r=>r.json()),
      apiFetch(`${API_BASE}/comptes`).then(r=>r.json())
    ]);
    const selM = document.getElementById('paiementMembre');
    if (selM) selM.innerHTML = resM.length ? resM.map(m=>`<option value="${m.id}">${m.nom}</option>`).join('') : '<option value="">Aucun membre</option>';
    const selC = document.getElementById('paiementMoyen');
    if (selC) selC.innerHTML = resC.length ? resC.map(c=>`<option value="${c.type}">${formatMoyen(c.type)} (${c.solde} FCFA)</option>`).join('') : '<option value="">Aucun compte</option>';
  } catch { console.error('❌ chargerSelectsPaiements'); }
}

async function ajouterPaiement() {
  const tontineId = document.getElementById('selectTontinePaiements').value;
  const membreId  = document.getElementById('paiementMembre').value;
  const type      = document.getElementById('paiementType').value;
  const montant   = Number(document.getElementById('paiementMontant').value);
  const moyen     = document.getElementById('paiementMoyen').value;

  if (!membreId || !montant || !moyen) { showNotification('⚠️ Remplissez tous les champs', 'warning'); return; }

  try {
    const res = await apiFetch(`${API_BASE}/paiements`, {
      method:'POST',
      body:JSON.stringify({ tontine_id:tontineId, membre_id:membreId, type, montant, moyen, statut: type==='gain'?'en_attente':'effectue' })
    });
    const d = await res.json();
    if (!res.ok) { showNotification('❌ '+(d.error||d.details), 'error'); return; }
    showNotification('✅ Paiement enregistré', 'success');
    document.getElementById('paiementMontant').value = '';
    await chargerPaiements(); await chargerComptes();
  } catch { showNotification('❌ Erreur ajout paiement', 'error'); }
}


/* =========================================================
   onboarding.js — Guide première utilisation
   ========================================================= */

const ONBOARDING_STEPS = [
  { icon:'🎯', title:'Bienvenue sur Samay Tontines !', desc:'Gérez vos tontines en toute simplicité, depuis votre téléphone ou votre ordinateur.' },
  { icon:'➕', title:'Créer une tontine', desc:'Appuyez sur le bouton central <strong>+</strong> pour créer votre première tontine en 4 étapes.' },
  { icon:'👥', title:'Ajouter des membres', desc:'Gérez vos tontines, ajoutez les membres avec leur nom, téléphone et adresse.' },
  { icon:'💰', title:'Enregistrer les cotisations', desc:'Notez les cotisations de chaque membre au fur et à mesure qu\'elles arrivent.' },
  { icon:'🎲', title:'Effectuer les tirages', desc:'Quand tous les membres ont cotisé, effectuez le tirage pour désigner le gagnant.' },
  { icon:'📊', title:'Suivre vos chiffres', desc:'Consultez les statistiques et les alertes pour garder le contrôle de vos tontines.' },
];

let onboardingStep = 0;

function afficherOnboarding() {
  if (localStorage.getItem('onboardingDone') === 'true') return;
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  renderOnboardingStep();
}

function renderOnboardingStep() {
  const s = ONBOARDING_STEPS[onboardingStep];
  document.getElementById('ob-icon').textContent = s.icon;
  document.getElementById('ob-title').textContent = s.title;
  document.getElementById('ob-desc').innerHTML = s.desc;
  document.getElementById('ob-current').textContent = onboardingStep + 1;
  document.getElementById('ob-total').textContent   = ONBOARDING_STEPS.length;

  // Update dots
  const dotsContainer = document.getElementById('ob-dots');
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    ONBOARDING_STEPS.forEach((_,i) => {
      const d = document.createElement('div');
      d.className = 'onboarding-dot' + (i === onboardingStep ? ' active' : '');
      dotsContainer.appendChild(d);
    });
  }

  // Update buttons
  const btnPrev = document.getElementById('ob-prev');
  const btnNext = document.getElementById('ob-next');
  const btnSkip = document.getElementById('ob-skip');
  if (btnPrev) btnPrev.style.display = onboardingStep > 0 ? 'inline-flex' : 'none';
  if (btnNext) btnNext.textContent = onboardingStep === ONBOARDING_STEPS.length-1 ? '🚀 Commencer' : 'Suivant →';
  if (btnSkip) btnSkip.style.display = onboardingStep < ONBOARDING_STEPS.length-1 ? 'inline-flex' : 'none';
}

function nextOnboardingStep() {
  if (onboardingStep < ONBOARDING_STEPS.length - 1) {
    onboardingStep++;
    renderOnboardingStep();
  } else {
    closeOnboarding();
  }
}

function prevOnboardingStep() {
  if (onboardingStep > 0) { onboardingStep--; renderOnboardingStep(); }
}

function closeOnboarding() {
  document.getElementById('onboarding-overlay')?.classList.add('hidden');
  localStorage.setItem('onboardingDone', 'true');
}

function resetOnboarding() {
  localStorage.removeItem('onboardingDone');
  onboardingStep = 0;
  afficherOnboarding();
}
