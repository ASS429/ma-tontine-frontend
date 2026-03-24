/* =========================================================
   config.js — Configuration de l'API et constantes
   =========================================================
   ⚠️ SÉCURITÉ — Clé Supabase ANON :
   La SUPABASE_ANON_KEY est la clé "anonyme" de Supabase.
   Elle est CONÇUE pour être publique côté frontend.
   La protection des données passe par les politiques RLS
   (Row Level Security) dans Supabase, pas par le secret de
   cette clé.

   ✅ Ce qui est déjà sécurisé :
   - La SERVICE_ROLE key reste uniquement dans le backend (Render).
   - Les routes backend utilisent requireAuth (JWT Supabase).

   ✅ À vérifier dans Supabase Dashboard → Authentication → Policies :
   - Table "tontines" : SELECT WHERE createur = auth.uid()
   - Table "membres"  : SELECT WHERE tontine_id IN (SELECT id FROM tontines WHERE createur = auth.uid())
   - Table "alertes"  : SELECT WHERE "utilisateurId" = auth.uid()
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
