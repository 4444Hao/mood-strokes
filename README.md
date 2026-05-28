# 三笔心情（Mood Strokes）

一个用「三条线 + 随手画」记录每日情绪的极简微表情日记 Web App。

线上地址：`https://mood-strokes.pages.dev`

## 产品定位

- 不做心理诊断，不做情绪评分。
- 不强制用户用固定标签定义自己。
- 用低成本的线条微调表达复杂情绪。
- 默认私密，用户主动投稿才会进入精选审核流。

## 当前功能完成度（2026-05）

- 今日页
- 三笔心情绘制与微调（含自由绘制 + 细调）
- 一句话备注
- 一天一条记录，重复保存走覆盖确认

- 月历页
- 周视图/挂历式浏览（当前交互版本）
- 日期跳转与历史查看

- 精选页
- 展示已入选模板作品（脸 + 文案 + 作者/匿名）

- 设置页
- 邮箱魔法链接登录
- 本地与云端同步（安全合并 / 双向覆盖）
- 我的投稿列表
- 管理员审核（通过 / 驳回 / 入选模板）
- 隐私政策与投稿授权说明入口
- 导出本地数据、清空本地数据、PWA 安装入口

## 核心规则（已实现）

- 投稿前必须勾选公开展示与模板授权。
- 投稿支持匿名展示（前台匿名，管理员可见账号标识用于审核/风控）。
- 投稿频率限制：每账号每小时最多 10 次（数据库侧强约束）。
- 撤回投稿会联动下架已入选模板。
- 禁止直接删除投稿，必须通过“撤回”流程。

## 技术栈

- 前端：Vite + React + TypeScript
- 绘制：SVG
- PWA：`vite-plugin-pwa`
- 云端：Supabase（Auth + PostgreSQL + RLS）
- 部署：Cloudflare Pages
- CI：GitHub Actions（lint + test + build）

## 本地开发

### 1) 安装与启动

```bash
npm install
npm run dev
```

### 2) 质量检查

```bash
npm run lint
npm run test:run
npm run build
```

### 3) 敏感信息扫描

```bash
npm run security:scan
```

## 环境变量

复制 `.env.example` 并新建 `.env`：

```bash
VITE_SUPABASE_URL=你的Supabase项目URL
VITE_SUPABASE_ANON_KEY=你的Supabase匿名公钥
VITE_AUTH_REDIRECT_URL=https://mood-strokes.pages.dev
```

说明：`VITE_AUTH_REDIRECT_URL` 必须与 Supabase Auth 的 Redirect URLs 一致。

## Supabase 初始化

在 Supabase SQL Editor 执行：

- `supabase/schema.sql`

该脚本包含：

- 表结构（`mood_entries` / `profiles` / `mood_submissions` / `featured_templates`）
- RLS 与策略
- 管理员判定函数 `is_admin()`
- 投稿限流与撤回联动函数
- 必要的 `GRANT` 权限基线

## 管理员与精选流

### 1) 设管理员

管理员由 `public.profiles.role = 'admin'` 判定。

### 2) 审核语义

- `通过`：仅审核通过，不会进入精选展示。
- `入选模板`：写入 `featured_templates`，会在精选页展示。
- `撤回投稿`：将投稿标记 `withdrawn`，并下架相关精选模板。

## 部署（Cloudflare Pages）

### 方式 ：GitHub 自动部署

1. Cloudflare Pages 连接 GitHub 仓库。
2. Build settings：
- Build command：`npm run build`
- Build output directory：`dist`
- Root directory：`/`
3. 推送到生产分支（如 `main`）后自动部署。


## 常见问题排查

### 1) `permission denied for table mood_submissions`

原因：表权限未授予 `authenticated`。

处理：重新执行 `supabase/schema.sql` 中 GRANT 段落。

### 2) 精选页为空

优先检查：

- 投稿状态是否是 `featured`（不是 `approved`）。
- `featured_templates` 是否存在该投稿 `source_submission_id` 且 `is_active=true`。
- 是否误点“撤回投稿”（撤回后会下架精选）。

### 3) 手机端显示旧版本

原因通常是 PWA/浏览器缓存。

处理：

- Cloudflare 确认最新部署成功。
- 手机端强制刷新或清理站点缓存后重开。

## 数据与安全说明

- 前端只使用 `anon key`，禁止在前端使用 `service_role key`。
- 云端数据隔离依赖 RLS + `auth.uid()`。
- 投稿限流在数据库层执行，不依赖前端校验。
- 账号登录采用邮箱魔法链接，管理员账号建议使用独立邮箱并开启更强邮箱安全策略。

## 目录结构

```text
.
├─ .github/workflows/ci.yml
├─ public/
│  ├─ favicon.svg
│  ├─ pwa-icon.svg
│  ├─ privacy.html
│  └─ submission-license.html
├─ src/
│  ├─ components/
│  │  ├─ ThreeStrokeMoodEditor.tsx
│  │  ├─ MoodFaceSvg.tsx
│  │  ├─ ParametricFaceEditor.tsx
│  │  └─ FreehandFaceEditor.tsx
│  ├─ pages/
│  │  ├─ TodayPage.tsx
│  │  ├─ MonthPage.tsx
│  │  ├─ FeaturedPage.tsx
│  │  └─ SettingsPage.tsx
│  ├─ lib/
│  │  ├─ storage.ts
│  │  ├─ cloudSync.ts
│  │  ├─ curation.ts
│  │  ├─ supabase.ts
│  │  ├─ strokeAdjust.ts
│  │  ├─ date.ts
│  │  └─ presets.ts
│  ├─ types/
│  │  ├─ mood.ts
│  │  └─ curation.ts
│  ├─ App.tsx
│  └─ main.tsx
└─ supabase/schema.sql
```

## 合规文档

- 隐私政策：`/privacy.html`
- 投稿授权说明：`/submission-license.html`

建议在每次策略变化时同步更新生效日期和文案版本。
