# 三笔心情

一个用「三条线 + 随手画」记录每日情绪的极简微表情日记 Web App。

## 产品定位

- 不是心理测试工具，也不是情绪打分系统
- 不强迫用户用固定标签定义心情
- 用低成本、私密、手绘感方式留下“今天的你”

## 已完成 MVP 能力

- 今日页
- 默认三笔模式（SVG 参数化编辑，支持拖拽微调）
- 自由手绘模式（多笔绘制、撤销、清空）
- 一句话备注
- 保存今日记录（本地）

- 月历页
- 展示当月记录墙（每一天真实小脸缩略图）
- 点击任意日期查看详情（脸 + 备注 + 更新时间）

- 设置页
- 本地数据统计（总记录、三笔、手绘、有备注）
- 导出 JSON
- 清空本地数据（二次确认）
- PWA 安装入口（支持安装到主屏与离线启动）

## 技术栈

- Vite
- React
- TypeScript
- SVG（参数化表情 + 手绘画布 + 缩略图复用）
- localStorage（后续可升级 IndexedDB / Supabase）
- PWA（vite-plugin-pwa）

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

安装与离线验证：

1. 打开设置页「安装到设备」
2. 点击「安装到主屏幕」或通过浏览器菜单添加
3. 断网后重新打开应用，仍可进入并查看本地记录

## 可选云同步（Supabase）

1. 复制环境变量模板

```bash
cp .env.example .env
```

Windows PowerShell 可手动创建 `.env`，并填入：

```bash
VITE_SUPABASE_URL=你的项目URL
VITE_SUPABASE_ANON_KEY=你的匿名公钥
```

2. 在 Supabase SQL Editor 执行建表脚本：

- `supabase/schema.sql`

3. 回到应用设置页：

- 输入邮箱并发送登录链接
- 邮件回跳后点击“刷新登录状态”
- 选择同步策略并执行：
  - `安全合并同步`：按更新时间合并两端记录（推荐）
  - `本地覆盖云端`：以本地为准覆盖云端
  - `云端覆盖本地`：以云端为准覆盖本地

## 数据结构（核心）

`src/types/mood.ts`：

- `MoodEntry`
- `ParametricFace`
- `FreehandFace`
- `Stroke / Point`

当前存储键：

- `three-line-mood.entries.v1`

## 目录结构

```text
src/
  components/
    ParametricFaceEditor.tsx
    FreehandFaceEditor.tsx
    MoodFaceSvg.tsx
  lib/
    date.ts
    presets.ts
    storage.ts
  pages/
    TodayPage.tsx
    MonthPage.tsx
    SettingsPage.tsx
  types/
    mood.ts
```

## 当前边界（刻意不做）

- 社区/分享
- 心理诊断与 AI 分析
- 连续打卡压力机制
- 复杂统计图
- 强制登录

## 下一步建议

1. 接入 Supabase（匿名可用 + 可选登录）
2. 增加云端同步状态（`local/synced/dirty` 全链路可见）
3. 增加月切换与历史月份浏览
4. 补测试（存储层单元测试 + 关键页面交互测试）
