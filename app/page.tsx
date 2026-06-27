import { createClient } from '@/lib/supabase'
import type { Holding, Market } from '@/types'
import { CURRENCY_SYMBOL } from '@/lib/constants'

const MARKET_LABEL: Record<Market, string> = { CN: 'A股', HK: '港股', US: '美股' }

export const revalidate = 0

export default async function HoldingsPage() {
  const supabase = createClient()
  const { data: holdings } = await supabase
    .from('holdings')
    .select('*')
    .gt('quantity', 0)
    .order('market')
    .order('symbol')

  const list = (holdings ?? []) as Holding[]

  if (list.length === 0) {
    return (
      <div className="text-center text-gray-500 mt-16">
        <p className="text-lg">暂无持仓</p>
        <p className="text-sm mt-2">
          通过 Telegram Bot 或
          <a href="/trades/new" className="text-blue-600 ml-1">补录表单</a>
          添加第一笔交易
        </p>
      </div>
    )
  }

  const grouped = list.reduce<Record<Market, Holding[]>>((acc, h) => {
    const m = h.market as Market
    if (!acc[m]) acc[m] = []
    acc[m].push(h)
    return acc
  }, {} as Record<Market, Holding[]>)

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">持仓总览</h1>
      {(Object.entries(grouped) as [Market, Holding[]][]).map(([market, items]) => {
        const totalCost = items.reduce((sum, h) => sum + Number(h.total_cost), 0)
        const sym = CURRENCY_SYMBOL[items[0].currency]
        return (
          <section key={market} className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">{MARKET_LABEL[market]}</h2>
              <span className="text-sm text-gray-500">
                总成本 {sym}{totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-4">名称</th>
                  <th className="py-2 pr-4">代码</th>
                  <th className="py-2 pr-4 text-right">持仓量</th>
                  <th className="py-2 pr-4 text-right">平均成本</th>
                  <th className="py-2 text-right">总成本</th>
                </tr>
              </thead>
              <tbody>
                {items.map(h => (
                  <tr key={h.symbol} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium">{h.name}</td>
                    <td className="py-2 pr-4 text-gray-500">{h.symbol}</td>
                    <td className="py-2 pr-4 text-right">{Number(h.quantity).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">
                      {sym}{Number(h.avg_cost).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 text-right">
                      {sym}{Number(h.total_cost).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
