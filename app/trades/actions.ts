'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { upsertHolding } from '@/lib/holdings'

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

  await supabase.from('trades').insert(trade)
  await upsertHolding(supabase, trade)
  revalidatePath('/')
  revalidatePath('/trades')
  redirect('/trades')
}

export async function deleteTrade(id: string) {
  const supabase = createClient()
  await supabase.from('trades').delete().eq('id', id)
  revalidatePath('/')
  revalidatePath('/trades')
}
