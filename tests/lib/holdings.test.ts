import { describe, it, expect, vi } from 'vitest'
import { upsertHolding } from '@/lib/holdings'
import type { Holding } from '@/types'

function makeMockSupabase(existingHolding: Holding | null) {
  const eqForUpdate = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn().mockReturnValue({ eq: eqForUpdate })
  const insertMock = vi.fn().mockResolvedValue({ error: null })
  const singleMock = vi.fn().mockResolvedValue({ data: existingHolding, error: null })
  const eqForSelect = vi.fn().mockReturnValue({ single: singleMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqForSelect })
  const fromMock = vi.fn().mockReturnValue({
    select: selectMock,
    insert: insertMock,
    update: updateMock,
  })
  return { from: fromMock as any, updateMock, insertMock }
}

describe('upsertHolding', () => {
  it('inserts new holding on first BUY', async () => {
    const { from, insertMock } = makeMockSupabase(null)

    await upsertHolding({ from } as any, {
      symbol: '600519', name: '茅台', market: 'CN',
      direction: 'BUY', quantity: 100, price: 1800, currency: 'CNY',
    })

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      symbol: '600519',
      quantity: 100,
      avg_cost: 1800,
      total_cost: 180000,
    }))
  })

  it('updates holding with weighted average on subsequent BUY', async () => {
    const existing: Holding = {
      symbol: '600519', name: '茅台', market: 'CN',
      quantity: 100, avg_cost: 1800, total_cost: 180000,
      currency: 'CNY', updated_at: '2026-06-01T00:00:00Z',
    }
    const { from, updateMock } = makeMockSupabase(existing)

    await upsertHolding({ from } as any, {
      symbol: '600519', name: '茅台', market: 'CN',
      direction: 'BUY', quantity: 100, price: 1900, currency: 'CNY',
    })

    // new_quantity=200, new_total_cost=180000+190000=370000, avg_cost=1850
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 200,
      total_cost: 370000,
      avg_cost: 1850,
    }))
  })

  it('reduces quantity on SELL, keeps avg_cost unchanged', async () => {
    const existing: Holding = {
      symbol: '600519', name: '茅台', market: 'CN',
      quantity: 200, avg_cost: 1850, total_cost: 370000,
      currency: 'CNY', updated_at: '2026-06-01T00:00:00Z',
    }
    const { from, updateMock } = makeMockSupabase(existing)

    await upsertHolding({ from } as any, {
      symbol: '600519', name: '茅台', market: 'CN',
      direction: 'SELL', quantity: 50, price: 2000, currency: 'CNY',
    })

    // new_quantity=150, total_cost=1850*150=277500
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 150,
      total_cost: 277500,
    }))
  })

  it('zeros out holding on full SELL', async () => {
    const existing: Holding = {
      symbol: '600519', name: '茅台', market: 'CN',
      quantity: 100, avg_cost: 1800, total_cost: 180000,
      currency: 'CNY', updated_at: '2026-06-01T00:00:00Z',
    }
    const { from, updateMock } = makeMockSupabase(existing)

    await upsertHolding({ from } as any, {
      symbol: '600519', name: '茅台', market: 'CN',
      direction: 'SELL', quantity: 100, price: 2000, currency: 'CNY',
    })

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 0,
      total_cost: 0,
    }))
  })
})
