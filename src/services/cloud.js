import { reactive } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { db, store } from './storage'

const saved = JSON.parse(localStorage.getItem('momentum.cloud') || '{}')
export const cloud = reactive({
  configured: false,
  connected: false,
  user: null,
  syncing: false,
  error: '',
  lastSync: localStorage.getItem('momentum.lastSync') || '',
  url: import.meta.env.VITE_SUPABASE_URL || saved.url || '',
  key: import.meta.env.VITE_SUPABASE_ANON_KEY || saved.key || ''
})

let client = null
let channel = null

function makeClient() {
  if (!cloud.url || !cloud.key) return null
  client = createClient(cloud.url, cloud.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  cloud.configured = true
  return client
}

async function prepareUserCache(user) {
  if (!user) return
  const previous = localStorage.getItem('momentum.cloudUserId')
  if (previous && previous !== user.id) {
    await db.records.clear()
    localStorage.removeItem('momentum.localTouched')
    await store.reload()
  }
  localStorage.setItem('momentum.cloudUserId', user.id)
}

export async function initCloud() {
  if (!makeClient()) return
  const { data } = await client.auth.getSession()
  await prepareUserCache(data.session?.user)
  cloud.user = data.session?.user || null
  cloud.connected = !!cloud.user
  client.auth.onAuthStateChange((_event, session) => {
    setTimeout(async () => {
      await prepareUserCache(session?.user)
      cloud.user = session?.user || null
      cloud.connected = !!session
      if (session) await syncNow()
    }, 0)
  })
  if (cloud.user) {
    await syncNow()
    subscribe()
  }
}

export async function configureCloud(url, key) {
  localStorage.setItem('momentum.cloud', JSON.stringify({ url: url.trim(), key: key.trim() }))
  cloud.url = url.trim(); cloud.key = key.trim(); cloud.error = ''
  makeClient()
}

export async function signIn(email, password) {
  if (!client) throw new Error('Сначала подключите Supabase')
  cloud.error = ''
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) { cloud.error = error.message; throw error }
  await prepareUserCache(data.user)
  cloud.user = data.user; cloud.connected = true
  await syncNow(); subscribe()
}

export async function signUp(email, password) {
  if (!client) throw new Error('Сначала подключите Supabase')
  cloud.error = ''
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) { cloud.error = error.message; throw error }
  cloud.user = data.user
  return data
}

export async function signOut() {
  channel?.unsubscribe()
  channel = null
  await client?.auth.signOut()
  cloud.user = null; cloud.connected = false
}

function subscribe() {
  if (!client || !cloud.user || channel) return
  channel = client.channel('momentum-records')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${cloud.user.id}` }, () => syncNow())
    .subscribe()
}

async function fetchRemoteRecords() {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from('records').select('id,payload,updated_at,deleted_at').order('updated_at').range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

export async function syncNow() {
  if (!client || !cloud.user || cloud.syncing) return
  cloud.syncing = true; cloud.error = ''; store.state.syncing = true
  try {
    // Pull first: a brand-new device must not upload its demo seed into an existing account.
    const data = await fetchRemoteRecords()
    if (data.length && !localStorage.getItem('momentum.localTouched')) await db.records.clear()

    const localBeforeMerge = new Map((await db.records.toArray()).map(r => [r.id, r]))
    const remoteUpdates = []
    for (const row of data || []) {
      const current = localBeforeMerge.get(row.id)
      if (!current || (!current.dirty && new Date(row.updated_at) >= new Date(current.updatedAt))) {
        remoteUpdates.push({ ...row.payload, updatedAt: row.updated_at, deleted: row.deleted_at ? 1 : 0, dirty: 0 })
      }
    }
    if (remoteUpdates.length) await db.records.bulkPut(remoteUpdates)

    const dirty = (await db.records.toArray()).filter(r => r.dirty)
    if (dirty.length) {
      const rows = dirty.map(({ dirty: _dirty, ...record }) => ({
        id: record.id,
        user_id: cloud.user.id,
        type: record.type,
        payload: record,
        updated_at: record.updatedAt,
        deleted_at: record.deleted ? record.updatedAt : null
      }))
      const { error: pushError } = await client.from('records').upsert(rows, { onConflict: 'id' })
      if (pushError) throw pushError
      await db.records.bulkPut(dirty.map(r => ({ ...r, dirty: 0 })))
    }
    localStorage.setItem('momentum.localTouched', '1')
    await store.reload()
    cloud.lastSync = new Date().toISOString()
    localStorage.setItem('momentum.lastSync', cloud.lastSync)
    store.state.syncLabel = 'Синхронизировано'
  } catch (error) {
    cloud.error = error.message
    store.state.syncLabel = 'Без сети'
  } finally {
    cloud.syncing = false; store.state.syncing = false
  }
}

export function getClient() { return client }
