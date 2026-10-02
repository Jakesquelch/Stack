import type { Player } from './api'
import { must, supabase } from './supabase'

/** Tidies a typed name: trims it and squashes repeated spaces */
export function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export async function createPlayer(name: string): Promise<Player> {
  return must(await supabase.from('players').insert({ name: cleanName(name) }).select('id, name').single())
}
