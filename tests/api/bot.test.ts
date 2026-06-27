import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockParseTrade = vi.fn()
const mockUpsertHolding = vi.fn()
const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
const mockCreateClient = vi.fn().mockReturnValue({ from: mockFrom })
const mockFetch = vi.fn().mockResolvedValue({ ok: true })

vi.mock('@/lib/parser', () => ({ parseTrade: mockParseTrade }))
vi.mock('@/lib/holdings', () => ({ upsertHolding: mockUpsertHolding }))
vi.mock('@/lib/supabase', () => ({ createClient: mockCreateClient }))

global.fetch = mockFetch as any

function makeRequest(body: object, withSecret = true) {
  return new NextRequest('http://localhost/api/bot', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(withSecret ? { 'x-telegram-bot-api-secret-token': 'test-secret' } : {}),
    },
  })
}

describe('POST /api/bot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret'
    mockUpsertHolding.mockResolvedValue(undefined)
    mockInsert.mockResolvedValue({ error: null })
  })

  it('records trade and sends confirmation on successful parse', async () => {
    mockParseTrade.mockResolvedValue({
      success: true,
      data: {
        symbol: '600519', name: '茅台', market: 'CN',
        direction: 'BUY', quantity: 100, price: 1800,
        currency: 'CNY', trade_date: '2026-06-25',
      },
    })

    const { POST } = await import('@/app/api/bot/route')
    const res = await POST(makeRequest({
      message: { text: '买了 100 股茅台 1800', chat: { id: 12345 } },
    }))

    expect(res.status).toBe(200)
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      symbol: '600519',
      total_amount: 180000,
      note: '买了 100 股茅台 1800',
    }))
    expect(mockUpsertHolding).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({ method: 'POST' })
    )
    const fetchBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body)
    expect(fetchBody.text).toContain('✅')
    expect(fetchBody.text).toContain('茅台')
  })

  it('sends error message on unparseable input', async () => {
    mockParseTrade.mockResolvedValue({ success: false, error: 'unparseable' })

    const { POST } = await import('@/app/api/bot/route')
    await POST(makeRequest({
      message: { text: 'hello', chat: { id: 12345 } },
    }))

    const fetchBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body)
    expect(fetchBody.text).toContain('没看懂')
  })

  it('returns 200 with no Telegram call on missing message', async () => {
    const { POST } = await import('@/app/api/bot/route')
    const res = await POST(makeRequest({ update_id: 1 }))

    expect(res.status).toBe(200)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
