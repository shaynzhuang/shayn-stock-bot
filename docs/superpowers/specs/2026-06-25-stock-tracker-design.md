# 股票投资记账系统 — 设计规格

**日期：** 2026-06-25  
**状态：** 已确认

---

## 概述

个人股票投资记账系统，支持通过 Telegram Bot 自然语言输入交易记录，同时提供 Web 界面进行表单补录和持仓查看。数据存储于 Supabase（云端 PostgreSQL），Web 端部署于 Vercel。

---

## 技术栈

| 层 | 技术 |
|----|------|
| Bot | Telegram Bot API（Webhook 模式） |
| Web + API | Next.js 15（App Router） |
| AI 解析 | Claude API（claude-haiku-4-5，低延迟低成本） |
| 数据库 | Supabase（PostgreSQL） |
| 部署 | Vercel |

---

## 整体架构

```
┌─────────────────┐     ┌──────────────────────┐
│  Telegram Bot   │────▶│  Next.js API Routes  │
│  (自然语言输入)  │     │  /api/bot             │
└─────────────────┘     └──────────┬───────────┘
                                   │
┌─────────────────┐                │ AI 解析
│  Web 界面       │     ┌──────────▼───────────┐
│  - 表单补录     │────▶│  Claude API          │
│  - 持仓看板     │     │  (解析自然语言交易)   │
│  (Next.js)      │     └──────────┬───────────┘
└─────────────────┘                │
                                   │
                    ┌──────────────▼───────────┐
                    │  Supabase (PostgreSQL)   │
                    │  - trades（交易记录）     │
                    │  - holdings（持仓汇总）   │
                    └──────────────────────────┘
```

**核心流程：**
1. 用户在 Telegram 发送交易消息，如"买了 200 茅台 1800 元"
2. Bot Webhook 触发 `/api/bot`
3. API 调用 Claude 解析出结构化交易数据
4. 写入 Supabase `trades` 表，同步 upsert `holdings`
5. Bot 回复确认，如"已记录：买入 茅台(600519) x200 @¥1800，成本 ¥360,000"
6. Web 端实时显示最新持仓

---

## 数据模型

### trades（交易记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键，默认 gen_random_uuid() |
| symbol | text | 股票代码，如 600519、0700.HK、AAPL |
| name | text | 股票名称，如 茅台、腾讯、苹果 |
| market | enum(CN/HK/US) | 所属市场 |
| direction | enum(BUY/SELL) | 买入 / 卖出 |
| quantity | integer | 股数（正整数） |
| price | decimal(12,4) | 成交价（原币种） |
| currency | enum(CNY/HKD/USD) | 币种 |
| total_amount | decimal(16,4) | price × quantity |
| trade_date | date | 交易日期 |
| note | text | 原始输入文本或备注（可为空） |
| created_at | timestamptz | 记录创建时间，默认 now() |

### holdings（持仓汇总）

| 字段 | 类型 | 说明 |
|------|------|------|
| symbol | text | 主键，股票代码 |
| name | text | 股票名称 |
| market | enum(CN/HK/US) | 市场 |
| quantity | integer | 当前持仓数量（0 表示已清仓） |
| avg_cost | decimal(12,4) | 加权平均成本价 |
| total_cost | decimal(16,4) | 当前持仓总成本 |
| currency | enum(CNY/HKD/USD) | 币种 |
| updated_at | timestamptz | 最后更新时间 |

`holdings` 在每次写入 `trades` 后自动 upsert，不独立维护。

---

## 自然语言解析

**AI 模型：** claude-haiku-4-5（低延迟，适合实时 Bot 场景）

**支持输入格式：**
- "买了 100 腾讯 450 港币"
- "以 1800 买入 200 股茅台"
- "卖出 AAPL 50 股 195 美元"
- "清仓比亚迪，均价 230"

**系统提示包含：**
- 当前日期（用于默认 trade_date）
- 支持的市场和常见股票代码映射
- 输出 JSON schema

**解析输出 schema：**
```json
{
  "symbol": "600519",
  "name": "茅台",
  "market": "CN",
  "direction": "BUY",
  "quantity": 200,
  "price": 1800.00,
  "currency": "CNY",
  "trade_date": "2026-06-25"
}
```

**歧义处理：**
- 股票名跨市场歧义（如"汇丰"）→ Bot 追问"是港股 0005.HK 还是美股 HSBC？"
- 数量或价格缺失 → Bot 追问缺失字段
- 日期未提及 → 默认今天
- 完全无法解析 → 回复"没看懂，能说得更具体吗？例如：买了 XX 股 XX，均价 XX"

---

## Web 界面（MVP）

### 页面

**1. 持仓总览 `/`**
- 按市场（CN / HK / US）分组展示当前持仓
- 每行：股票名、代码、持仓量、平均成本、总成本、币种
- 顶部各市场总成本汇总

**2. 交易记录 `/trades`**
- 按 trade_date 倒序列出所有交易
- 支持按股票代码、市场筛选
- 每行支持编辑（误录修正）和删除

**3. 补录表单 `/trades/new`**
- 结构化表单，字段对应 trades 表
- 适合批量录入历史记录

### 设计原则
- 响应式布局，手机浏览器可用
- 无需登录（个人使用，依赖 Supabase Row Level Security 或简单 token）

---

## 不在 MVP 范围内（后续迭代）

- 实时行情接入（雪球、Yahoo Finance API）
- 盈亏计算（需要行情）
- 图表分析看板
- 汇率换算（多币种统一计价）
- 股息记录
- 导入历史 CSV

---

## 部署

- **Vercel**：Next.js 部署，设置 Telegram Webhook 指向 `/api/bot`
- **Supabase**：免费 tier，个人用量充足
- **环境变量：**
  - `TELEGRAM_BOT_TOKEN`
  - `ANTHROPIC_API_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
