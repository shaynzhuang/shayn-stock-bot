import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockCreate } }
  }),
}))

function makeResponse(obj: object) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }] }
}

describe('parseTrade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('parses a valid BUY trade', async () => {
    mockCreate.mockResolvedValue(makeResponse({
      symbol: '600519', name: '茅台', market: 'CN',
      direction: 'BUY', quantity: 100, price: 1800,
      currency: 'CNY', trade_date: '2026-06-25',
    }))

    const { parseTrade } = await import('@/lib/parser')
    const result = await parseTrade('买了 100 股茅台 1800 元', '2026-06-25')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.symbol).toBe('600519')
      expect(result.data.market).toBe('CN')
      expect(result.data.direction).toBe('BUY')
      expect(result.data.quantity).toBe(100)
      expect(result.data.price).toBe(1800)
      expect(result.data.currency).toBe('CNY')
    }
  })

  it('returns ambiguous error when market is unclear', async () => {
    mockCreate.mockResolvedValue(makeResponse({
      error: 'ambiguous',
      message: '汇丰是港股 0005.HK 还是美股 HSBC？',
    }))

    const { parseTrade } = await import('@/lib/parser')
    const result = await parseTrade('买了 100 汇丰 50 元')

    expect(result.success).toBe(false)
    if (!result.success && result.error === 'ambiguous') {
      expect(result.message).toContain('汇丰')
    }
  })

  it('returns incomplete error when quantity is missing', async () => {
    mockCreate.mockResolvedValue(makeResponse({
      error: 'incomplete',
      missing: ['quantity'],
    }))

    const { parseTrade } = await import('@/lib/parser')
    const result = await parseTrade('买了茅台 1800 元')

    expect(result.success).toBe(false)
    if (!result.success && result.error === 'incomplete') {
      expect(result.missing).toContain('quantity')
    }
  })

  it('returns unparseable on garbled input', async () => {
    mockCreate.mockResolvedValue(makeResponse({ error: 'unparseable' }))

    const { parseTrade } = await import('@/lib/parser')
    const result = await parseTrade('asdfjkl')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('unparseable')
  })

  it('handles JSON wrapped in markdown code fences', async () => {
    const inner = JSON.stringify({
      symbol: 'AAPL', name: '苹果', market: 'US',
      direction: 'SELL', quantity: 50, price: 195,
      currency: 'USD', trade_date: '2026-06-25',
    })
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + inner + '\n```' }],
    })

    const { parseTrade } = await import('@/lib/parser')
    const result = await parseTrade('卖出苹果 50 股 195 美元', '2026-06-25')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.symbol).toBe('AAPL')
      expect(result.data.direction).toBe('SELL')
    }
  })
})
