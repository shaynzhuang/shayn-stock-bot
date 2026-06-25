import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const supabase = createClient()

  const update: Record<string, unknown> = {}
  if (body.quantity !== undefined) update.quantity = Number(body.quantity)
  if (body.price !== undefined) update.price = Number(body.price)
  if (body.trade_date !== undefined) update.trade_date = body.trade_date
  if (body.note !== undefined) update.note = body.note

  if (update.quantity !== undefined || update.price !== undefined) {
    const { data: existing } = await supabase
      .from('trades').select('quantity,price').eq('id', params.id).single()
    const qty = Number(update.quantity ?? existing?.quantity)
    const price = Number(update.price ?? existing?.price)
    update.total_amount = qty * price
  }

  const { data, error } = await supabase
    .from('trades')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { error } = await supabase.from('trades').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
