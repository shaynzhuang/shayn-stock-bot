# 股票投资记账系统 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建支持 Telegram Bot 自然语言输入 + Next.js Web 表单录入的个人股票投资记账系统，数据存储于 Supabase，部署于 Vercel。

**Architecture:** Next.js 15 App Router 同时提供 Web UI 和 API Routes；Telegram Bot 通过 Webhook 调用 `/api/bot`，该路由调用 Claude API 解析自然语言后写入 Supabase；持仓表 `holdings` 在每次写入 `trades` 后自动 upsert。

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Supabase JS v2, Anthropic SDK, Tailwind CSS, Vitest

## Global Constraints

- Node.js >= 20
- Next.js 15 with App Router（不使用 Pages Router）
- TypeScript strict mode
- Market enum 取值：`CN` | `HK` | `US`（大写）
- Direction enum 取值：`BUY` | `SELL`（大写）
- Currency enum 取值：`CNY` | `HKD` | `USD`（大写）
- Claude 模型：`claude-haiku-4-5-20251001`
- 价格存为 decimal(12,4)，总额存为 decimal(16,4)
- 持仓 `avg_cost` 使用加权平均；卖出只减少数量，avg_cost 不变
- Telegram Bot 使用 Webhook 模式（非 polling）
- 无需用户认证（个人使用）

---

## 文件结构

```
stock-tracker/
├── app/
│   ├── layout.tsx                  # 全局导航布局
│   ├── page.tsx                    # 持仓总览 /
│   ├── trades/
│   │   ├── actions.ts              # Server Actions (createTrade, deleteTrade)
│   │   ├── page.tsx                # 交易记录列表 /trades
│   │   └── new/
│   │       └── page.tsx            # 补录表单 /trades/new
│   └── api/
│       ├── bot/
│       │   └── route.ts            # POST /api/bot — Telegram Webhook
│       └── trades/
│           ├── route.ts            # GET /api/trades, POST /api/trades
│           └── [id]/
│               └── route.ts        # PUT /api/trades/[id], DELETE /api/trades/[id]
├── lib/
│   ├── supabase.ts                 # createClient()
│   ├── parser.ts                   # parseTrade() — Claude NLP
│   └── holdings.ts                 # upsertHolding()
├── types/
│   └── index.ts                    # Trade, Holding, ParsedTrade, Market, Direction, Currency
├── tests/
│   ├── lib/
│   │   ├── supabase.test.ts
│   │   ├── parser.test.ts
│   │   └── holdings.test.ts
│   └── api/
│       └── bot.test.ts
├── supabase/
│   └── migrations/
│       └── 001_initial.sql
├── .env.local.example
└── vitest.config.ts
```

---

### Task 1: 项目初始化 + 数据库 Schema

**Files:**
- Create: `package.json`（via create-next-app）
- Create: `vitest.config.ts`
- Create: `supabase/migrations/001_initial.sql`
- Create: `.env.local.example`

**Interfaces:**
- Produces: Next.js 项目脚手架 + Vitest 配置 + Supabase schema SQL

- [ ] **Step 1: 创建 Next.js 项目**

```bash
cd C:\Users\shayn\shayn-cc
npx create-next-app@latest stock-tracker --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd stock-tracker
```

Expected: 生成项目目录，包含 `app/`、`public/`、`package.json`

- [ ] **Step 2: 安装依赖**

```bash
npm install @supabase/supabase-js @anthropic-ai/sdk
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/dom jsdom
```

- [ ] **Step 3: 配置 Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

在 `package.json` 的 `scripts` 中添加：
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 编写 Supabase Migration SQL**

Create `supabase/migrations/001_initial.sql`:

```sql
create extension if not exists "uuid-ossp";

create type market_type as enum ('CN', 'HK', 'US');
create type direction_type as enum ('BUY', 'SELL');
create type currency_type as enum ('CNY', 'HKD', 'USD');

create table trades (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  name text not null,
  market market_type not null,
  direction direction_type not null,
  quantity integer not null check (quantity > 0),
  price decimal(12,4) not null check (price > 0),
  currency currency_type not null,
  total_amount decimal(16,4) not null,
  trade_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create table holdings (
  symbol text primary key,
  name text not null,
  market market_type not null,
  quantity integer not null default 0,
  avg_cost decimal(12,4) not null,
  total_cost decimal(16,4) not null,
  currency currency_type not null,
  updated_at timestamptz not null default now()
);

create index trades_symbol_idx on trades(symbol);
create index trades_trade_date_idx on trades(trade_date desc);
```

- [ ] **Step 5: 在 Supabase 控制台执行 Migration**

1. 打开 https://supabase.com，新建项目（免费 tier）
2. 进入 SQL Editor，粘贴上方 SQL 并执行
3. 确认 `trades` 和 `holdings` 表已创建

- [ ] **Step 6: 创建 .env.local.example**

Create `.env.local.example`:

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

复制为 `.env.local` 并填入真实值（URL 和 service_role key 在 Supabase 项目设置 → API 中获取）。

- [ ] **Step 7: 验证项目启动**

```bash
npm run dev
```

Expected: http://localhost:3000 显示 Next.js 默认页面，无报错

- [ ] **Step 8: 验证测试配置**

```bash
npm run test
```

Expected: `No test files found` 或 0 tests（无报错）

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: initialize Next.js project with Supabase schema"
```

---

### Task 2: TypeScript 类型定义 + Supabase 客户端

**Files:**
- Create: `types/index.ts`
- Create: `lib/supabase.ts`
- Create: `tests/lib/supabase.test.ts`

**Interfaces:**
- Produces:
  - `Market = 'CN' | 'HK' | 'US'`（exported from `@/types`）
  - `Direction = 'BUY' | 'SELL'`（exported from `@/types`）
  - `Currency = 'CNY' | 'HKD' | 'USD'`（exported from `@/types`）
  - `interface Trade`（exported from `@/types`）
  - `interface Holding`（exported from `@/types`）
  - `interface ParsedTrade`（exported from `@/types`）
  - `createClient(): SupabaseClient`（exported from `@/lib/supabase`）

- [ ] **Step 1: 编写类型定义**

Create `types/index.ts`:

```typescript
export type Market = 'CN' | 'HK' | 'US'
export type Direction = 'BUY' | 'SELL'
export type Currency = 'CNY' | 'HKD' | 'USD'

export interface Trade {
  id: string
  symbol: string
  name: string
  market: Market
  direction: Direction
  quantity: number
  price: number
  currency: Currency
  total_amount: number
  trade_date: string // YYYY-MM-DD
  note: string | null
  created_at: string
}

export interface Holding {
  symbol: string
  name: string
  market: Market
  quantity: number
  avg_cost: number
  total_cost: number
  currency: Currency
  updated_at: string
}

export interface ParsedTrade {
  symbol: string
  name: string
  market: Market
  direction: Direction
  quantity: number
  price: number
  currency: Currency
  trade_date: string // YYYY-MM-DD
}
```

- [ ] **Step 2: 编写 Supabase 客户端**

Create `lib/supabase.ts`:

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 3: 编写 Supabase 客户端测试**

Create `tests/lib/supabase.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}))

describe('createClient', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
  })

  it('returns a supabase client instance', async () => {
    const { createClient } = await import('@/lib/supabase')
    const client = createClient()
    expect(client).toBeDefined()
    expect(typeof client.from).toBe('function')
  })
})
```

- [ ] **Step 4: 运行测试**

```bash
npx vitest run tests/lib/supabase.test.ts
```

Expected: 1 test passed

- [ ] **Step 5: Commit**

```bash
git add types/ lib/supabase.ts tests/lib/supabase.test.ts
git commit -m "feat: add TypeScript types and Supabase client"
```

---

### Task 3: Claude NLP 解析器

**Files:**
- Create: `lib/parser.ts`
- Create: `tests/lib/parser.test.ts`

**Interfaces:**
- Consumes: `ParsedTrade` from `@/types`
- Produces:
  - `type ParseResult` (exported from `@/lib/parser`)
  - `parseTrade(text: string, today?: string): Promise<ParseResult>` (exported from `@/lib/parser`)

- [ ] **Step 1: 编写解析器测试（先写测试）**

Create `tests/lib/parser.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

function makeResponse(obj: object) {
  return { content: [{ type: 'text', text: JSON.stringify(obj) }] }
}

describe('parseTrade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('parses a valid BUY trade', async () => {
    mockCreate.mockResolvedValue(makeResponse({
      symbol: '600519', name: '茅台', market: 'CN',
      direction: 'BUY', quantity: 100, price: 1800,
      currency: 'CNY', trade_date: '2026-06-25',
    }))

    const { parseTrade } = await import('@/lib/parser')
    const result = await parseTrade('买了 100 股茅台 1800 元', '2026-06-25')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.symbol).toBe('600519')
      expect(result.data.market).toBe('CN')
      expect(result.data.direction).toBe('BUY')
      expect(result.data.quantity).toBe(100)
      expect(result.data.price).toBe(1800)
      expect(result.data.currency).toBe('CNY')
    }
  })

  it('returns ambiguous error when market is unclear', async () => {
    mockCreate.mockResolvedValue(makeResponse({
      error: 'ambiguous',
      message: '汇丰是港股 0005.HK 还是美股 HSBC？',
    }))

    const { parseTrade } = await import('@/lib/parser')
    const result = await parseTrade('买了 100 汇丰 50 元')

    expect(result.success).toBe(false)
    if (!result.success && result.error === 'ambiguous') {
      expect(result.message).toContain('汇丰')
    }
  })

  it('returns incomplete error when quantity is missing', async () => {
    mockCreate.mockResolvedValue(makeResponse({
      error: 'incomplete',
      missing: ['quantity'],
    }))

    const { parseTrade } = await import('@/lib/parser')
    const result = await parseTrade('买了茅台 1800 元')

    expect(result.success).toBe(false)
    if (!result.success && result.error === 'incomplete') {
      expect(result.missing).toContain('quantity')
    }
  })

  it('returns unparseable on garbled input', async () => {
    mockCreate.mockResolvedValue(makeResponse({ error: 'unparseable' }))

    const { parseTrade } = await import('@/lib/parser')
    const result = await parseTrade('asdfjkl')

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('unparseable')
  })

  it('handles JSON wrapped in markdown code fences', async () => {
    const inner = JSON.stringify({
      symbol: 'AAPL', name: '苹果', market: 'US',
      direction: 'SELL', quantity: 50, price: 195,
      currency: 'USD', trade_date: '2026-06-25',
    })
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + inner + '\n```' }],
    })

    const { parseTrade } = await import('@/lib/parser')
    const result = await parseTrade('卖出苹果 50 股 195 美元', '2026-06-25')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.symbol).toBe('AAPL')
      expect(result.data.direction).toBe('SELL')
    }
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run tests/lib/parser.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/parser'`

- [ ] **Step 3: 实现解析器**

Create `lib/parser.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { ParsedTrade } from '@/types'

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
  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `今天是 ${today}。\n用户输入：${text}` }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run tests/lib/parser.test.ts
```

Expected: 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/parser.ts tests/lib/parser.test.ts
git commit -m "feat: add Claude NLP trade parser"
```

---

### Task 4: 持仓 Upsert 逻辑

**Files:**
- Create: `lib/holdings.ts`
- Create: `tests/lib/holdings.test.ts`

**Interfaces:**
- Consumes: `Trade`, `Holding` from `@/types`
- Produces:
  - `upsertHolding(supabase: SupabaseClient, trade: Pick<Trade, 'symbol'|'name'|'market'|'direction'|'quantity'|'price'|'currency'>): Promise<void>` (exported from `@/lib/holdings`)

- [ ] **Step 1: 编写持仓逻辑测试（先写测试）**

Create `tests/lib/holdings.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { upsertHolding } from '@/lib/holdings'
import type { Holding } from '@/types'

function makeMockSupabase(existingHolding: Holding | null) {
  const eqForUpdate = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn().mockReturnValue({ eq: eqForUpdate })
  const insertMock = vi.fn().mockResolvedValue({ error: null })
  const singleMock = vi.fn().mockResolvedValue({ data: existingHolding, error: null })
  const eqForSelect = vi.fn().mockReturnValue({ single: singleMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqForSelect })
  const fromMock = vi.fn().mockReturnValue({
    select: selectMock,
    insert: insertMock,
    update: updateMock,
  })
  return { from: fromMock as any, updateMock, insertMock }
}

describe('upsertHolding', () => {
  it('inserts new holding on first BUY', async () => {
    const { from, insertMock } = makeMockSupabase(null)

    await upsertHolding({ from } as any, {
      symbol: '600519', name: '茅台', market: 'CN',
      direction: 'BUY', quantity: 100, price: 1800, currency: 'CNY',
    })

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      symbol: '600519',
      quantity: 100,
      avg_cost: 1800,
      total_cost: 180000,
    }))
  })

  it('updates holding with weighted average on subsequent BUY', async () => {
    const existing: Holding = {
      symbol: '600519', name: '茅台', market: 'CN',
      quantity: 100, avg_cost: 1800, total_cost: 180000,
      currency: 'CNY', updated_at: '2026-06-01T00:00:00Z',
    }
    const { from, updateMock } = makeMockSupabase(existing)

    await upsertHolding({ from } as any, {
      symbol: '600519', name: '茅台', market: 'CN',
      direction: 'BUY', quantity: 100, price: 1900, currency: 'CNY',
    })

    // new_quantity=200, new_total_cost=180000+190000=370000, avg_cost=1850
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 200,
      total_cost: 370000,
      avg_cost: 1850,
    }))
  })

  it('reduces quantity on SELL, keeps avg_cost unchanged', async () => {
    const existing: Holding = {
      symbol: '600519', name: '茅台', market: 'CN',
      quantity: 200, avg_cost: 1850, total_cost: 370000,
      currency: 'CNY', updated_at: '2026-06-01T00:00:00Z',
    }
    const { from, updateMock } = makeMockSupabase(existing)

    await upsertHolding({ from } as any, {
      symbol: '600519', name: '茅台', market: 'CN',
      direction: 'SELL', quantity: 50, price: 2000, currency: 'CNY',
    })

    // new_quantity=150, total_cost=1850*150=277500
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 150,
      total_cost: 277500,
    }))
  })

  it('zeros out holding on full SELL', async () => {
    const existing: Holding = {
      symbol: '600519', name: '茅台', market: 'CN',
      quantity: 100, avg_cost: 1800, total_cost: 180000,
      currency: 'CNY', updated_at: '2026-06-01T00:00:00Z',
    }
    const { from, updateMock } = makeMockSupabase(existing)

    await upsertHolding({ from } as any, {
      symbol: '600519', name: '茅台', market: 'CN',
      direction: 'SELL', quantity: 100, price: 2000, currency: 'CNY',
    })

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 0,
      total_cost: 0,
    }))
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run tests/lib/holdings.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/holdings'`

- [ ] **Step 3: 实现持仓 Upsert 逻辑**

Create `lib/holdings.ts`:

```typescript
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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run tests/lib/holdings.test.ts
```

Expected: 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/holdings.ts tests/lib/holdings.test.ts
git commit -m "feat: add holdings upsert logic"
```

---

### Task 5: Telegram Bot Webhook

**Files:**
- Create: `app/api/bot/route.ts`
- Create: `tests/api/bot.test.ts`

**Interfaces:**
- Consumes: `parseTrade` from `@/lib/parser`; `upsertHolding` from `@/lib/holdings`; `createClient` from `@/lib/supabase`
- Produces: `POST /api/bot` — Telegram Webhook 端点，返回 `{ ok: true }`

- [ ] **Step 1: 编写 Bot Route 测试（先写测试）**

Create `tests/api/bot.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockParseTrade = vi.fn()
const mockUpsertHolding = vi.fn()
const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
const mockCreateClient = vi.fn().mockReturnValue({ from: mockFrom })
const mockFetch = vi.fn().mockResolvedValue({ ok: true })

vi.mock('@/lib/parser', () => ({ parseTrade: mockParseTrade }))
vi.mock('@/lib/holdings', () => ({ upsertHolding: mockUpsertHolding }))
vi.mock('@/lib/supabase', () => ({ createClient: mockCreateClient }))

global.fetch = mockFetch as any

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/bot', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/bot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    mockUpsertHolding.mockResolvedValue(undefined)
    mockInsert.mockResolvedValue({ error: null })
  })

  it('records trade and sends confirmation on successful parse', async () => {
    mockParseTrade.mockResolvedValue({
      success: true,
      data: {
        symbol: '600519', name: '茅台', market: 'CN',
        direction: 'BUY', quantity: 100, price: 1800,
        currency: 'CNY', trade_date: '2026-06-25',
      },
    })

    const { POST } = await import('@/app/api/bot/route')
    const res = await POST(makeRequest({
      message: { text: '买了 100 股茅台 1800', chat: { id: 12345 } },
    }))

    expect(res.status).toBe(200)
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      symbol: '600519',
      total_amount: 180000,
      note: '买了 100 股茅台 1800',
    }))
    expect(mockUpsertHolding).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage'),
      expect.objectContaining({ method: 'POST' })
    )
    const fetchBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body)
    expect(fetchBody.text).toContain('✅')
    expect(fetchBody.text).toContain('茅台')
  })

  it('sends error message on unparseable input', async () => {
    mockParseTrade.mockResolvedValue({ success: false, error: 'unparseable' })

    const { POST } = await import('@/app/api/bot/route')
    await POST(makeRequest({
      message: { text: 'hello', chat: { id: 12345 } },
    }))

    const fetchBody = JSON.parse((mockFetch.mock.calls[0][1] as any).body)
    expect(fetchBody.text).toContain('没看懂')
  })

  it('returns 200 with no Telegram call on missing message', async () => {
    const { POST } = await import('@/app/api/bot/route')
    const res = await POST(makeRequest({ update_id: 1 }))

    expect(res.status).toBe(200)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run tests/api/bot.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/bot/route'`

- [ ] **Step 3: 实现 Bot Webhook Route**

Create `app/api/bot/route.ts`:

```typescript
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
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run tests/api/bot.test.ts
```

Expected: 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add app/api/bot/ tests/api/bot.test.ts
git commit -m "feat: add Telegram bot webhook handler"
```

---

### Task 6: Trades CRUD API Routes

**Files:**
- Create: `app/api/trades/route.ts`
- Create: `app/api/trades/[id]/route.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase`; `upsertHolding` from `@/lib/holdings`
- Produces:
  - `GET /api/trades?symbol=&market=` — 按 trade_date 降序返回交易列表
  - `POST /api/trades` — 创建交易并 upsert 持仓，返回 201
  - `PUT /api/trades/[id]` — 更新交易字段
  - `DELETE /api/trades/[id]` — 删除交易

- [ ] **Step 1: 实现 Trades 列表 + 创建 API**

Create `app/api/trades/route.ts`:

```typescript
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
```

- [ ] **Step 2: 实现单笔交易更新 + 删除 API**

Create `app/api/trades/[id]/route.ts`:

```typescript
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
```

- [ ] **Step 3: 手动测试 API**

启动 dev server：
```bash
npm run dev
```

测试 GET（空）：
```bash
curl http://localhost:3000/api/trades
```
Expected: `[]`

测试 POST：
```bash
curl -X POST http://localhost:3000/api/trades \
  -H "Content-Type: application/json" \
  -d '{"symbol":"600519","name":"茅台","market":"CN","direction":"BUY","quantity":100,"price":1800,"currency":"CNY","trade_date":"2026-06-25"}'
```
Expected: 返回新建 trade 对象，HTTP 201

测试 GET（有数据）：
```bash
curl http://localhost:3000/api/trades
```
Expected: 包含刚插入的记录

- [ ] **Step 4: Commit**

```bash
git add app/api/trades/
git commit -m "feat: add trades CRUD API routes"
```

---

### Task 7: 持仓总览页面

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase`; `Holding`, `Market` from `@/types`
- Produces: `/` 路由 — 按市场分组展示当前持仓（quantity > 0）

- [ ] **Step 1: 更新全局 Layout**

Replace `app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '股票记账',
  description: '个人股票投资记账系统',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className={inter.className}>
        <nav className="border-b px-6 py-3 flex gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-blue-600">持仓总览</Link>
          <Link href="/trades" className="hover:text-blue-600">交易记录</Link>
          <Link href="/trades/new" className="hover:text-blue-600">补录交易</Link>
        </nav>
        <main className="max-w-4xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: 实现持仓总览页**

Replace `app/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase'
import type { Holding, Market } from '@/types'

const MARKET_LABEL: Record<Market, string> = { CN: 'A股', HK: '港股', US: '美股' }
const CURRENCY_SYMBOL: Record<string, string> = { CNY: '¥', HKD: 'HK$', USD: '$' }

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
```

- [ ] **Step 3: 手动验证**

```bash
npm run dev
```

打开 http://localhost:3000：
- 若无持仓：显示"暂无持仓"提示和补录链接
- 若有持仓（Task 6 测试时已插入）：按市场分组显示表格，每组顶部显示总成本

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: add holdings overview page"
```

---

### Task 8: 交易记录列表 + 补录表单

**Files:**
- Create: `app/trades/actions.ts`
- Create: `app/trades/page.tsx`
- Create: `app/trades/new/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase`; `upsertHolding` from `@/lib/holdings`; `Trade` from `@/types`
- Produces:
  - `createTrade(formData: FormData): Promise<void>` Server Action
  - `deleteTrade(id: string): Promise<void>` Server Action
  - `/trades` 路由 — 交易记录列表（倒序）+ 删除按钮
  - `/trades/new` 路由 — 补录表单，提交后跳转到 /trades

- [ ] **Step 1: 实现 Server Actions**

Create `app/trades/actions.ts`:

```typescript
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
```

- [ ] **Step 2: 实现交易记录列表页**

Create `app/trades/page.tsx`:

```typescript
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
```

- [ ] **Step 3: 实现补录表单页**

Create `app/trades/new/page.tsx`:

```typescript
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
```

- [ ] **Step 4: 手动验证所有页面**

```bash
npm run dev
```

1. 打开 http://localhost:3000/trades/new，填写一笔买入，点提交
2. 确认跳转到 http://localhost:3000/trades，记录出现在列表
3. 打开 http://localhost:3000，确认持仓总览显示该股票
4. 在 /trades 点"删除"，确认记录消失

- [ ] **Step 5: Commit**

```bash
git add app/trades/
git commit -m "feat: add trades list page and new trade form"
```

---

### Task 9: 全量测试 + 部署到 Vercel

**Files:**
- 无新文件，确认 `.env.local` 在 `.gitignore` 中

**Interfaces:**
- Produces: 线上可访问的生产 URL + 已注册的 Telegram Webhook

- [ ] **Step 1: 运行全量测试**

```bash
npm run test
```

Expected: 12 tests passed（parser: 5, holdings: 4, bot: 3）

- [ ] **Step 2: TypeScript 类型检查**

```bash
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 3: 确认 .env.local 在 .gitignore 中**

```bash
grep ".env.local" .gitignore
```

Expected: 输出包含 `.env.local`（Next.js 默认已包含）

- [ ] **Step 4: 部署到 Vercel**

```bash
npx vercel
```

按提示操作：
1. Set up and deploy? → Y
2. Which scope? → 选你的账户
3. Link to existing project? → N
4. Project name: `stock-tracker`
5. Directory: `./`

- [ ] **Step 5: 在 Vercel Dashboard 设置环境变量**

进入 Vercel Dashboard → 项目 → Settings → Environment Variables，添加四个变量：
- `TELEGRAM_BOT_TOKEN`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 6: 生产部署**

```bash
npx vercel --prod
```

记录返回的生产 URL，如 `https://stock-tracker-xxx.vercel.app`

- [ ] **Step 7: 注册 Telegram Webhook**

将 `YOUR_TOKEN` 和 `YOUR_DOMAIN` 替换后执行：
```bash
curl "https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://YOUR_DOMAIN/api/bot"
```

Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`

- [ ] **Step 8: 端到端测试**

在 Telegram 向 Bot 发送：`买了 100 腾讯 450 港币`

Expected Bot 回复：`✅ 已记录：买入 腾讯(0700.HK) x100 @HK$450 总额：HK$45,000`

打开生产 URL，确认持仓总览显示港股持仓。

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "chore: finalize deployment configuration"
```
