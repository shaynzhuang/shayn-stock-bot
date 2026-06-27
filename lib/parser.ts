import OpenAI from 'openai'
import type { ParsedTrade } from '@/types'

let _client: OpenAI | null = null
function getClient() {
  if (!_client) _client = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: process.env.DEEPSEEK_API_KEY })
  return _client
}

const SYSTEM_PROMPT = `你是一个股票交易记录解析助手。从用户的自然语言输入中提取交易信息，只返回 JSON，不要任何额外文字。

市场规则：
- CN（A股）：代码为6位数字，如 600519，货币 CNY
- HK（港股）：代码为4位数字加 .HK，如 0700.HK，货币 HKD
- US（美股）：代码为英文字母，如 AAPL，货币 USD

常见股票：
茅台/贵州茅台 → symbol:"600519", market:"CN", currency:"CNY"
腾讯/腾讯控股 → symbol:"0700.HK", market:"HK", currency:"HKD"
比亚迪(A股) → symbol:"002594", market:"CN", currency:"CNY"
比亚迪(港股) → symbol:"1211.HK", market:"HK", currency:"HKD"
苹果/Apple/AAPL → symbol:"AAPL", market:"US", currency:"USD"
特斯拉/Tesla/TSLA → symbol:"TSLA", market:"US", currency:"USD"
英伟达/NVIDIA/NVDA → symbol:"NVDA", market:"US", currency:"USD"
汇丰(港股) → symbol:"0005.HK", market:"HK", currency:"HKD"
汇丰(美股) → symbol:"HSBC", market:"US", currency:"USD"

成功时返回：
{"symbol":"代码","name":"名称","market":"CN|HK|US","direction":"BUY|SELL","quantity":数量,"price":价格,"currency":"CNY|HKD|USD","trade_date":"YYYY-MM-DD"}

市场歧义时返回：
{"error":"ambiguous","message":"请问 XX 是港股 YY 还是美股 ZZ？"}

信息不完整时返回：
{"error":"incomplete","missing":["quantity"或"price"或"symbol"]}

完全无法理解时返回：
{"error":"unparseable"}`

export type ParseResult =
  | { success: true; data: ParsedTrade }
  | { success: false; error: 'ambiguous'; message: string }
  | { success: false; error: 'incomplete'; missing: string[] }
  | { success: false; error: 'unparseable' }

export async function parseTrade(
  text: string,
  today: string = new Date().toISOString().slice(0, 10)
): Promise<ParseResult> {
  const response = await getClient().chat.completions.create({
    model: 'deepseek-chat',
    max_tokens: 256,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `今天是 ${today}。\n用户输入：${text}` },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ''

  let obj: Record<string, unknown>
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('no json')
    obj = JSON.parse(match[0])
  } catch {
    return { success: false, error: 'unparseable' }
  }

  if (obj.error === 'ambiguous') {
    return { success: false, error: 'ambiguous', message: String(obj.message) }
  }
  if (obj.error === 'incomplete') {
    return { success: false, error: 'incomplete', missing: obj.missing as string[] }
  }
  if (obj.error) {
    return { success: false, error: 'unparseable' }
  }

  return {
    success: true,
    data: {
      symbol: String(obj.symbol),
      name: String(obj.name),
      market: obj.market as ParsedTrade['market'],
      direction: obj.direction as ParsedTrade['direction'],
      quantity: Number(obj.quantity),
      price: Number(obj.price),
      currency: obj.currency as ParsedTrade['currency'],
      trade_date: String(obj.trade_date),
    },
  }
}
