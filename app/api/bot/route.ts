import { NextRequest, NextResponse } from 'next/server'
import { parseTrade } from '@/lib/parser'
import { upsertHolding } from '@/lib/holdings'
import { createClient } from '@/lib/supabase'

const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: '¥', HKD: 'HK$', USD: '$',
}

async function sendMessage(chatId: number, text: string) {
  await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const message = body?.message
  if (!message?.text || !message?.chat?.id) {
    return NextResponse.json({ ok: true })
  }

  const chatId: number = message.chat.id
  const text: string = message.text

  const result = await parseTrade(text)

  if (!result.success) {
    if (result.error === 'ambiguous') {
      await sendMessage(chatId, result.message)
    } else if (result.error === 'incomplete') {
      await sendMessage(chatId, `信息不完整，缺少：${result.missing.join('、')}`)
    } else {
      await sendMessage(chatId, '没看懂，能说得更具体吗？\n例如：买了 100 股茅台，均价 1800')
    }
    return NextResponse.json({ ok: true })
  }

  const trade = result.data
  const total_amount = trade.price * trade.quantity
  const supabase = createClient()

  await supabase.from('trades').insert({
    symbol: trade.symbol,
    name: trade.name,
    market: trade.market,
    direction: trade.direction,
    quantity: trade.quantity,
    price: trade.price,
    currency: trade.currency,
    total_amount,
    trade_date: trade.trade_date,
    note: text,
  })

  await upsertHolding(supabase, trade)

  const dir = trade.direction === 'BUY' ? '买入' : '卖出'
  const sym = CURRENCY_SYMBOL[trade.currency] ?? ''
  await sendMessage(
    chatId,
    `✅ 已记录：${dir} ${trade.name}(${trade.symbol}) x${trade.quantity} @${sym}${trade.price}\n总额：${sym}${total_amount.toLocaleString('zh-CN')}`
  )

  return NextResponse.json({ ok: true })
}
