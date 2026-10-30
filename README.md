# 青鸟 IRIVA · Household 落地页

Next.js 16 (App Router) + Tailwind CSS v4，静态导出。

## 开发

```bash
npm install
npm run dev        # http://localhost:3000
```

## 构建 / 部署

```bash
npm run build      # 生成 out/，纯静态文件
npm start          # 本地预览 out/
```

`out/` 可直接部署到 Vercel、Netlify、Cloudflare Pages、OSS 等任意静态托管。

## 目录

- `lib/content.ts` — 页面全部文案、价格、FAQ、退款规则（改内容只改这里）
- `app/page.tsx` — 页面各区块
- `components/Pricing.tsx` — 价格档位与"每周 1/2 次圆桌"切换（客户端组件）
- `app/globals.css` — 品牌色（`@theme`）、字体与基础样式
- `original-export/` — 原 Claude artifact 的打包产物，仅作对照，可删除

## 上线前待办

- `lib/content.ts` 里的 `contactPlaceholder`：替换为真实报名入口和联系方式
- "预约 15 分钟认识一下"按钮目前跳到页内 `#apply`，可改成表单 / 小程序链接
