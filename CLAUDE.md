# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

"三笔心情"是一个极简微表情日记 PWA，用三条线记录每日情绪。部署于 Cloudflare Pages。

## 常用命令

```bash
npm run dev           # Vite 开发服务器
npm run build         # tsc 类型检查 + vite build（生产构建）
npm run lint          # ESLint
npm run test:run      # Vitest 单次运行（CI 用）
npm run test          # Vitest watch 模式
npm run security:scan # 扫描 git 跟踪文件中的密钥泄露
```

环境变量（`.env`，复制自 `.env.example`）：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AUTH_REDIRECT_URL`

## 架构要点

### 路由系统

没有使用路由库。`App.tsx` 中通过 `useState<PageId>`（`'today' | 'month' | 'featured' | 'settings'`）切换页面，通过 `useMemo` 条件渲染对应页面组件。

### 状态管理

所有应用状态提升到 `App.tsx` 中（约 20 个 `useState`），通过 props 向下传递给页面组件。不使用 Context 或外部状态库。数据流：`App handlers → lib/*.ts → localStorage / Supabase → setState → 重渲染`。

### 数据：本地优先 + 可选云同步

- **localStorage**（`src/lib/storage.ts`）：离线可用，所有条目存于 `three-line-mood.entries.v1` key
- **Supabase**（`src/lib/cloudSync.ts`）：魔法链接邮箱登录，三种同步模式（`merge` / `push_local` / `pull_cloud`），merge 按 `updatedAt` 时间戳取最新
- 同步是显式按钮触发，非自动

### 核心类型：MoodFace 可辨识联合

`src/types/mood.ts` 中 `MoodFace = ParametricFace | FreehandFace | ExpressiveFace`，以 `mode` 字段辨识。所有编辑器和 SVG 渲染器都通过 `switch (face.mode)` 分派。

### 编辑器：两阶段设计

`ThreeStrokeMoodEditor` 是主编辑器：
1. **绘制阶段**：用户画 3 笔，系统按 Y 质心自动推断角色（上方两笔→眼睛，最下方→嘴）
2. **微调阶段**：拖拽调整、角色重分配、语义滑块（"嘴角上扬"、"眼尾挑"等），调整逻辑在 `src/lib/strokeAdjust.ts`

### Supabase 表结构

`supabase/schema.sql` 定义 4 张表：`mood_entries`、`profiles`、`mood_submissions`、`featured_templates`，全部有 RLS 策略绑定 `auth.uid()`。管理员由 `profiles.role = 'admin'` 判定。

## 业务规则

- 投稿前必须勾选公开展示 + 模板授权
- 支持匿名展示（前台匿名，管理员可见账号标识）
- 投稿频率限制：每账号每小时最多 10 次（DB 层函数强约束，非前端校验）
- 撤回投稿联动下架已入选模板
- 禁止直接删除投稿，必须走"撤回"流程
- 前端仅使用 `anon key`，`service_role key` 禁止出现在前端
- 邮箱登录有 60 秒冷却期

## 样式

单文件 `src/App.css`（约 1120 行），CSS 自定义属性主题，暖纸色调。无预处理器、无 CSS 框架。响应式断点 `<=680px`。

## CI/CD

GitHub Actions（`.github/workflows/ci.yml`）：Node 22，`npm ci` → lint → test:run → build，所有分支和 PR 触发。Cloudflare Pages 连接 GitHub 自动部署，构建输出目录 `dist`。
