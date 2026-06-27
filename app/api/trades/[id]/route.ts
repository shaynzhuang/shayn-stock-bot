import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { recomputeHolding } from '@/lib/holdings'

const VALID_MARKETS = ['CN', 'HK', 'US']
const VALID_DIRECTIONS = ['BUY', 'SELL']
const VALID_CURRENCIES = ['CNY', 'HKD', 'USD']

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const supabase = createClient()

  if (body.market !== undefined && !VALID_MARKETS.includes(body.market))
    return NextResponse.json({ error: 'Invalid market' }, { status: 400 })
  if (body.direction !== undefined && !VALID_DIRECTIONS.includes(body.direction))
    return NextResponse.json({ error: 'Invalid direction' }, { status: 400 })
  if (body.currency !== undefined && !VALID_CURRENCIES.includes(body.currency))
    return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
  if (body.quantity !== undefined && (!Number.isInteger(Number(body.quantity)) || Number(body.quantity) <= 0))
    return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 })
  if (body.price !== undefined && Number(body.price) <= 0)
    return NextResponse.json({ error: 'price must be positive' }, { status: 400 })
  if (body.symbol !== undefined && !String(body.symbol).trim())
    return NextResponse.json({ error: 'symbol must not be empty' }, { status: 400 })
  if (body.name !== undefined && !String(body.name).trim())
    return NextResponse.json({ error: 'name must not be empty' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (body.quantity !== undefined) update.quantity = Number(body.quantity)
  if (body.price !== undefined) update.price = Number(body.price)
  if (body.trade_date !== undefined) update.trade_date = body.trade_date
  if (body.note !== undefined) update.note = body.note

  if (update.quantity !== undefined || update.price !== undefined) {
    const { data: existing } = await supabase
      .from('trades').select('quantity,price').eq('id', id).single()
    const qty = Number(update.quantity ?? existing?.quantity)
    const price = Number(update.price ?? existing?.price)
    update.total_amount = qty * price
  }

  const { data, error } = await supabase
    .from('trades')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (data?.symbol) {
    await recomputeHolding(supabase, data.symbol)
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createClient()
  const { error } = await supabase.from('trades').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
