// Writes made during a live game
import { must, supabase } from './supabase'

/** A rebuy (or any extra buy-in). recorded_by is filled in by the database. */
export async function addBuyIn(gameId: string, playerId: string, amountPence: number) {
  must(await supabase.from('buy_ins').insert({ game_id: gameId, player_id: playerId, amount_pence: amountPence }))
}

/** Sets a player's final stack (cash out / fix it), or null to put them back in */
export async function setStack(gameId: string, playerId: string, stackPence: number | null) {
  must(
    await supabase
      .from('game_players')
      .update({ final_stack_pence: stackPence })
      .eq('game_id', gameId)
      .eq('player_id', playerId),
  )
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** "Fri 2 Oct 2026" */
export function formatDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    .replace(',', '')
}
