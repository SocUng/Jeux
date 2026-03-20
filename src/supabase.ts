import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ScoreEntry {
  id?: number;
  player_name: string;
  score: number;
  created_at?: string;
}

export async function getLeaderboard() {
  if (!isSupabaseConfigured) {
    console.warn('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    return [];
  }

  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('score', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('Error fetching leaderboard:', error);
    if (error.code === 'PGRST116') {
      console.error('Table "leaderboard" not found. Did you run the SQL query?');
    }
    return [];
  }
  return data as ScoreEntry[];
}

export async function saveScore(playerName: string, scoreToAdd: number) {
  // First, try to find the existing score for this player
  const { data: existingEntries, error: fetchError } = await supabase
    .from('leaderboard')
    .select('id, score')
    .eq('player_name', playerName)
    .limit(1);

  if (fetchError) {
    console.error('Error fetching existing score:', fetchError);
    return null;
  }

  if (existingEntries && existingEntries.length > 0) {
    // Update existing entry
    const existingEntry = existingEntries[0];
    const newTotalScore = existingEntry.score + scoreToAdd;
    
    const { data, error: updateError } = await supabase
      .from('leaderboard')
      .update({ score: newTotalScore })
      .eq('id', existingEntry.id);
    
    if (updateError) {
      console.error('Error updating score:', updateError);
      return null;
    }
    return data;
  } else {
    // Insert new entry
    const { data, error: insertError } = await supabase
      .from('leaderboard')
      .insert([{ player_name: playerName, score: scoreToAdd }]);
    
    if (insertError) {
      console.error('Error saving new score:', insertError);
      return null;
    }
    return data;
  }
}
