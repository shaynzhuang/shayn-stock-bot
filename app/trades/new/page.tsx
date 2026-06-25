import { createTrade } from '../actions'

export default function NewTradePage() {
  return (
    <div className="max-w-md">
      <h1 className="text-xl font-bold mb-6">补录交易</h1>
      <form action={createTrade} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">交易方向</label>
          <select name="direction" required className="w-full border rounded px-3 py-2 text-sm">
            <option value="BUY">买入</option>
            <option value="SELL">卖出</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">市场</label>
          <select name="market" required className="w-full border rounded px-3 py-2 text-sm">
            <option value="CN">A股</option>
            <option value="HK">港股</option>
            <option value="US">美股</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">股票代码</label>
          <input name="symbol" required placeholder="如 600519 / 0700.HK / AAPL"
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">股票名称</label>
          <input name="name" required placeholder="如 茅台"
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">数量（股）</label>
            <input name="quantity" type="number" required min="1"
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">价格</label>
            <input name="price" type="number" required min="0" step="0.0001"
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">币种</label>
          <select name="currency" required className="w-full border rounded px-3 py-2 text-sm">
            <option value="CNY">CNY（人民币）</option>
            <option value="HKD">HKD（港币）</option>
            <option value="USD">USD（美元）</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">交易日期</label>
          <input name="trade_date" type="date" required
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">备注（可选）</label>
          <input name="note" placeholder="备注信息"
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <button type="submit"
          className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700">
          提交
        </button>
      </form>
    </div>
  )
}
