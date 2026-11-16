import { createStore, get, set, del, keys } from 'idb-keyval'
import { defaultProcessing, defaultSongKey, type Monster, type Song } from '../types'

// A single IDB object store keyed with string prefixes. idb-keyval's
// createStore only creates one object store per call reliably when sharing a
// database name across calls requires version bumps, so we avoid that
// footgun entirely by using one store and namespacing keys.
const store = createStore('stewnion-db', 'kv')

const MONSTER_PREFIX = 'monster:'
const SONG_PREFIX = 'song:'
const BLOB_PREFIX = 'blob:'

function monsterKey(id: string) {
  return `${MONSTER_PREFIX}${id}`
}
function songKey(id: string) {
  return `${SONG_PREFIX}${id}`
}

export async function saveMonster(monster: Monster): Promise<void> {
  await set(monsterKey(monster.id), monster, store)
}

export async function deleteMonster(id: string): Promise<void> {
  await del(monsterKey(id), store)
}

/** Fills in "Make It Sound Good" fields for monsters saved before this
 * feature existed, so older songs keep loading without a migration step. */
function withMonsterDefaults(monster: Monster): Monster {
  if (monster.processing) return monster
  return { ...monster, processing: defaultProcessing() }
}

function withSongDefaults(song: Song): Song {
  if (song.key) return song
  return { ...song, key: defaultSongKey() }
}

export async function loadAllMonsters(): Promise<Monster[]> {
  const allKeys = await keys(store)
  const monsterKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(MONSTER_PREFIX))
  const monsters = await Promise.all(monsterKeys.map((k) => get<Monster>(k, store)))
  return (monsters.filter(Boolean) as Monster[]).map(withMonsterDefaults).sort((a, b) => a.createdAt - b.createdAt)
}

export async function saveSong(song: Song): Promise<void> {
  await set(songKey(song.id), song, store)
}

export async function deleteSong(id: string): Promise<void> {
  await del(songKey(id), store)
}

export async function loadAllSongs(): Promise<Song[]> {
  const allKeys = await keys(store)
  const songKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(SONG_PREFIX))
  const songs = await Promise.all(songKeys.map((k) => get<Song>(k, store)))
  return (songs.filter(Boolean) as Song[]).map(withSongDefaults).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Stores a raw Blob (audio or image) under a fresh key and returns that key. */
export async function saveBlob(blob: Blob, hint = ''): Promise<string> {
  const key = `${BLOB_PREFIX}${hint}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  await set(key, blob, store)
  return key
}

export async function loadBlob(key: string): Promise<Blob | undefined> {
  return get<Blob>(key, store)
}

export async function deleteBlob(key: string | null): Promise<void> {
  if (!key) return
  await del(key, store)
}
