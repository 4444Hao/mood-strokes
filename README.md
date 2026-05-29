<p align="center">
  <picture>
    <img src="public/pwa-icon.svg" alt="三笔心情 · Mood Strokes" width="150" />
  </picture>
</p>

<h1 align="center">三笔心情 · Mood Strokes</h1>

<p align="center">
  <strong>三笔极简，情绪万千。</strong><br />
  一个用三条线记录情绪的极简微表情日记。<br />
</p>

<p align="center">
  <a href="https://mood-strokes.pages.dev" target="_blank">
    <img src="https://img.shields.io/badge/🔗_在线体验-mood--strokes.pages.dev-4e8c4e?style=flat-square" alt="在线演示" />
  </a>
  <img src="https://img.shields.io/badge/状态-积极开发中-success?style=flat-square" alt="项目状态" />
  <img src="https://img.shields.io/badge/许可证-MIT-blue?style=flat-square" alt="许可证" />
  <img src="https://img.shields.io/badge/PWA-就绪-7b68ee?style=flat-square" alt="PWA" />
  <img src="https://img.shields.io/badge/离线-可用-orange?style=flat-square" alt="离线可用" />
</p>

---

## 💡 灵感起点

> 自己在书写日志时喜欢用简笔画表达心情，通常是三笔：两个弓形圆弧是微笑的眼睛，向上弯的弧形是微笑的嘴巴。将三笔倒置就成了难过。
> 通过控制这些弧度，会产生无数中间态：微笑的眼睛配上小小的嘴巴是淡淡的微笑，把眼睛微微向中间收拢又添了几分郁闷……
> 这就是三笔心情的起点：**用最少的笔触，捕捉最微妙的心绪。**

## 🎨 设计哲学。

不是精确测量，而是**直觉绘制 + 语义微调**。  
画完后，你可以像说话一样调整表情：

> “嘴角再上扬一点”  
> “眼尾挑起来一些”  
> “松一点，别那么紧”

最终呈现的不是像素级的精准，而是**笔触的温度**。  
每一天只有一条记录，覆盖意味着新的情绪覆盖旧的——就像日记本翻过一页。

## ✨ 功能亮点

- 🖌️ **三笔绘制** — 自由笔触，任意顺序，从极简微笑/难过开始，创建个人的微情绪记录库
- 🎛️ **语义微调滑块** — “嘴角上扬”“眼尾下垂”“松紧”“张力”，一键式微调表情
- 📅 **热力图月历** — 折叠式热力图，直观看见这个月的情绪色彩
- ☁️ **可选云同步** — Supabase Magic Link 免密登录，三种同步模式，RLS 行级安全
- 📤 **投稿 & 精选** — 投稿你的表情，审核通过后可入选社区精选挂历
- 📱 **PWA 就绪** — 可安装到桌面，完全离线使用

## 🧱 架构总览

```mermaid
graph TD
    A[用户浏览器<br/>PWA] --> B[localStorage<br/>离线数据自有]
    A --> C[可选云同步<br/>Supabase]
    B --> D[JSON 导入/导出<br/>换设备不依赖云端]
    C --> E[Magic Link 邮箱登录]
    C --> F[三种同步模式]
    C --> G[RLS 行级安全]
    A --> H[Cloudflare Pages<br/>自动部署]
    H --> I[GitHub Push<br/>tsc + vite build]
    H --> J[CSP 安全头]