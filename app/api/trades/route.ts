import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { upsertHolding } from '@/lib/holdings'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const market = searchParams.get('market')

  const supabase = createClient()
  let query = supabase
    .from('trades')
    .select('*')
    .order('trade_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (symbol) query = query.eq('symbol', symbol)
  if (market) query = query.eq('market', market)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createClient()

  const quantity = Number(body.quantity)
  const price = Number(body.price)
  const trade = {
    symbol: String(body.symbol),
    name: String(body.name),
    market: body.market,
    direction: body.direction,
    quantity,
    price,
    currency: body.currency,
    total_amount: quantity * price,
    trade_date: String(body.trade_date),
    note: body.note ?? null,
  }

  const { data, error } = await supabase.from('trades').insert(trade).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await upsertHolding(supabase, trade)

  return NextResponse.json(data, { status: 201 })
}
