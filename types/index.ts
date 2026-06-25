export type Market = 'CN' | 'HK' | 'US'
export type Direction = 'BUY' | 'SELL'
export type Currency = 'CNY' | 'HKD' | 'USD'

export interface Trade {
  id: string
  symbol: string
  name: string
  market: Market
  direction: Direction
  quantity: number
  price: number
  currency: Currency
  total_amount: number
  trade_date: string // YYYY-MM-DD
  note: string | null
  created_at: string
}

export interface Holding {
  symbol: string
  name: string
  market: Market
  quantity: number
  avg_cost: number
  total_cost: number
  currency: Currency
  updated_at: string
}

export interface ParsedTrade {
  symbol: string
  name: string
  market: Market
  direction: Direction
  quantity: number
  price: number
  currency: Currency
  trade_date: string // YYYY-MM-DD
}
