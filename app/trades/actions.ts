'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { upsertHolding, recomputeHolding } from '@/lib/holdings'

const VALID_MARKETS = ['CN', 'HK', 'US'] as const
const VALID_DIRECTIONS = ['BUY', 'SELL'] as const
const VALID_CURRENCIES = ['CNY', 'HKD', 'USD'] as const

function validateTrade(trade: {
  symbol: string
  name: string
  market: string
  direction: string
  quantity: number
  price: number
  currency: string
}) {
  if (!VALID_MARKETS.includes(trade.market as 'CN' | 'HK' | 'US'))
    throw new Error(`Invalid market: ${trade.market}`)
  if (!VALID_DIRECTIONS.includes(trade.direction as 'BUY' | 'SELL'))
    throw new Error(`Invalid direction: ${trade.direction}`)
  if (!VALID_CURRENCIES.includes(trade.currency as 'CNY' | 'HKD' | 'USD'))
    throw new Error(`Invalid currency: ${trade.currency}`)
  if (!Number.isInteger(trade.quantity) || trade.quantity <= 0)
    throw new Error('quantity must be a positive integer')
  if (trade.price <= 0) throw new Error('price must be positive')
  if (!trade.symbol.trim()) throw new Error('symbol must not be empty')
  if (!trade.name.trim()) throw new Error('name must not be empty')
}

export async function createTrade(formData: FormData) {
  const supabase = createClient()
  const quantity = Number(formData.get('quantity'))
  const price = Number(formData.get('price'))

  const trade = {
    symbol: String(formData.get('symbol')),
    name: String(formData.get('name')),
    market: String(formData.get('market')) as 'CN' | 'HK' | 'US',
    direction: String(formData.get('direction')) as 'BUY' | 'SELL',
    quantity,
    price,
    currency: String(formData.get('currency')) as 'CNY' | 'HKD' | 'USD',
    total_amount: quantity * price,
    trade_date: String(formData.get('trade_date')),
    note: String(formData.get('note') ?? ''),
  }

  validateTrade(trade)

  const { error: insertError } = await supabase.from('trades').insert(trade)
  if (insertError) throw new Error(`Failed to insert trade: ${insertError.message}`)

  await upsertHolding(supabase, trade)
  revalidatePath('/')
  revalidatePath('/trades')
  redirect('/trades')
}

export async function deleteTrade(id: string) {
  const supabase = createClient()

  // Critical 4: fetch trade first so we can reverse its effect on holdings
  const { data: trade, error: fetchError } = await supabase
    .from('trades')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) throw new Error(`Failed to fetch trade: ${fetchError.message}`)

  // Delete the trade record
  const { error: deleteError } = await supabase.from('trades').delete().eq('id', id)
  if (deleteError) throw new Error(`Failed to delete trade: ${deleteError.message}`)

  // Recompute the holding from all remaining trades
  await recomputeHolding(supabase, trade.symbol)

  revalidatePath('/')
  revalidatePath('/trades')
}
