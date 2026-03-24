/* =========================================================
   config.js — Configuration de l'API et constantes
   ========================================================= */

const API_BASE = "https://ma-tontine-backend.onrender.com/api";

const SUPABASE_URL      = 'https://fcefsbpqyymxgjaijbka.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWZzYnBxeXlteGdqYWlqYmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MjQ2NTQsImV4cCI6MjA3MTQwMDY1NH0.B_Ys0FuZv5FPkFs8LkX_hNxW-MrXcKvI36owIE-eO8M';

// ─── Icônes par type de tontine ───
const TYPE_ICONS = {
  argent:      '💰',
  electronique:'📱',
  cosmetique:  '💄',
  autre:       '🎁',
  classique:   '🎯'
};

// ─── Labels fréquence ───
const FREQ_LABELS = {
  quotidien:    'Quotidien',
  hebdomadaire: 'Hebdomadaire',
  mensuel:      'Mensuel',
  annuel:       'Annuel',
  trimestriel:  'Trimestriel'
};
