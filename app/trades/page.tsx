import { createClient } from '@/lib/supabase'
import type { Trade } from '@/types'
import { deleteTrade } from './actions'

const DIRECTION_LABEL: Record<string, string> = { BUY: '买入', SELL: '卖出' }
const CURRENCY_SYMBOL: Record<string, string> = { CNY: '¥', HKD: 'HK$', USD: '$' }

export const revalidate = 0

export default async function TradesPage() {
  const supabase = createClient()
  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .order('trade_date', { ascending: false })
    .order('created_at', { ascending: false })

  if ((trades ?? []).length === 0) {
    return (
      <div className="text-center text-gray-500 mt-16">
        <p className="text-lg">暂无交易记录</p>
        <p className="text-sm mt-2">
          <a href="/trades/new" className="text-blue-600">补录第一笔交易</a>
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">交易记录</h1>
        <a href="/trades/new" className="text-sm text-blue-600 hover:underline">+ 补录</a>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2 pr-3">日期</th>
            <th className="py-2 pr-3">方向</th>
            <th className="py-2 pr-3">名称</th>
            <th className="py-2 pr-3">代码</th>
            <th className="py-2 pr-3 text-right">数量</th>
            <th className="py-2 pr-3 text-right">价格</th>
            <th className="py-2 pr-3 text-right">总额</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(trades as Trade[]).map(t => {
            const sym = CURRENCY_SYMBOL[t.currency]
            return (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="py-2 pr-3 text-gray-500">{t.trade_date}</td>
                <td className={`py-2 pr-3 font-medium ${t.direction === 'BUY' ? 'text-green-600' : 'text-red-500'}`}>
                  {DIRECTION_LABEL[t.direction]}
                </td>
                <td className="py-2 pr-3">{t.name}</td>
                <td className="py-2 pr-3 text-gray-500">{t.symbol}</td>
                <td className="py-2 pr-3 text-right">{Number(t.quantity).toLocaleString()}</td>
                <td className="py-2 pr-3 text-right">{sym}{t.price}</td>
                <td className="py-2 pr-3 text-right">
                  {sym}{Number(t.total_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2">
                  <form action={deleteTrade.bind(null, t.id)}>
                    <button type="submit" className="text-red-400 hover:text-red-600 text-xs">
                      删除
                    </button>
                  </form>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
