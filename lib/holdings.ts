import type { SupabaseClient } from '@supabase/supabase-js'
import type { Trade } from '@/types'

type TradeInput = Pick<Trade, 'symbol' | 'name' | 'market' | 'direction' | 'quantity' | 'price' | 'currency'>

/**
 * Recompute the holding for a symbol from all its trades.
 * Used after a trade is updated to keep holdings in sync.
 */
export async function recomputeHolding(
  supabase: SupabaseClient,
  symbol: string
): Promise<void> {
  const { data: trades } = await supabase
    .from('trades')
    .select('direction,quantity,price,name,market,currency')
    .eq('symbol', symbol)

  if (!trades || trades.length === 0) {
    // No trades remain – zero out the holding
    await supabase.from('holdings').update({ quantity: 0, total_cost: 0 }).eq('symbol', symbol)
    return
  }

  let quantity = 0
  let total_cost = 0
  let name = ''
  let market = ''
  let currency = ''

  for (const t of trades) {
    name = t.name
    market = t.market
    currency = t.currency
    if (t.direction === 'BUY') {
      total_cost += t.price * t.quantity
      quantity += t.quantity
    } else {
      // SELL: reduce cost proportionally using avg cost before this sell
      const avg = quantity > 0 ? total_cost / quantity : 0
      quantity -= t.quantity
      total_cost -= avg * t.quantity
      if (quantity < 0) { quantity = 0; total_cost = 0 }
    }
  }

  const avg_cost = quantity > 0 ? total_cost / quantity : 0
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('holdings').select('symbol').eq('symbol', symbol).single()

  if (existing) {
    await supabase.from('holdings').update({ quantity, total_cost, avg_cost, updated_at: now }).eq('symbol', symbol)
  } else {
    await supabase.from('holdings').insert({ symbol, name, market, currency, quantity, total_cost, avg_cost, updated_at: now })
  }
}

export async function upsertHolding(
  supabase: SupabaseClient,
  trade: TradeInput
): Promise<void> {
  const { data: existing } = await supabase
    .from('holdings')
    .select('*')
    .eq('symbol', trade.symbol)
    .single()

  const now = new Date().toISOString()

  if (trade.direction === 'BUY') {
    if (!existing) {
      await supabase.from('holdings').insert({
        symbol: trade.symbol,
        name: trade.name,
        market: trade.market,
        quantity: trade.quantity,
        avg_cost: trade.price,
        total_cost: trade.price * trade.quantity,
        currency: trade.currency,
        updated_at: now,
      })
    } else {
      const new_quantity = existing.quantity + trade.quantity
      const new_total_cost = existing.total_cost + trade.price * trade.quantity
      await supabase.from('holdings').update({
        quantity: new_quantity,
        total_cost: new_total_cost,
        avg_cost: new_total_cost / new_quantity,
        updated_at: now,
      }).eq('symbol', trade.symbol)
    }
  } else {
    // SELL
    if (!existing) return
    const new_quantity = existing.quantity - trade.quantity
    if (new_quantity <= 0) {
      await supabase.from('holdings').update({
        quantity: 0,
        total_cost: 0,
        avg_cost: existing.avg_cost,
        updated_at: now,
      }).eq('symbol', trade.symbol)
    } else {
      await supabase.from('holdings').update({
        quantity: new_quantity,
        total_cost: existing.avg_cost * new_quantity,
        updated_at: now,
      }).eq('symbol', trade.symbol)
    }
  }
}
