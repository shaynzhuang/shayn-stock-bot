import type { SupabaseClient } from '@supabase/supabase-js'
import type { Trade } from '@/types'

type TradeInput = Pick<Trade, 'symbol' | 'name' | 'market' | 'direction' | 'quantity' | 'price' | 'currency'>

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
