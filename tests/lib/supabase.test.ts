import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}))

describe('createClient', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  })

  it('returns a supabase client instance', async () => {
    const { createClient } = await import('@/lib/supabase')
    const client = createClient()
    expect(client).toBeDefined()
    expect(typeof client.from).toBe('function')
  })
})
