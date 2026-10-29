# Raypx Kit 文档

Raypx Kit 提供可独立发布的 TypeScript 包。查看各包的使用指南了解现有 API，查看架构文档了解职责边界，或通过开发指南参与维护。

## 从这里开始 [#start-here]

| 目标                             | 文档                                                 |
| -------------------------------- | ---------------------------------------------------- |
| 了解包的职责、依赖边界和构建流程 | [架构](../../architecture/README.md)                 |
| 搭建仓库环境并运行检查           | [开发指南](../../development/README.md)              |
| 升级工具、运行时和依赖           | [依赖维护](../../development/dependencies.md)        |
| 为各包准备独立版本               | [Changesets 工作流](../../development/changesets.md) |
| 发布正式包或消费者预览包         | [发布指南](../../development/publishing.md)          |

## 包使用指南 [#package-guides]

以下包的英文 README 是 API、兼容性与安装方式的权威说明，也会随 npm 包一起发布。

| 包                                                         | 能力                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| [Codemods](../../../packages/codemods/README.md)           | 针对明确文件执行代码迁移，支持预览和可扩展的迁移注册表 |
| [Devkit](../../../packages/devkit/README.md)               | 工作区与工具链检查、静态词条读取、工程配置和产物探测   |
| [Drizzle](../../../packages/drizzle/README.md)             | PostgreSQL、JSONB 表达式和 postgres.js 查询诊断        |
| [Drizzle Kit](../../../packages/drizzle-kit/README.md)     | 精简的 Drizzle CLI 与配置入口                          |
| [Email Preview](../../../packages/email-preview/README.md) | 通过 Vite 插件和预构建界面预览 React Email 模板        |
| [Env](../../../packages/env/README.md)                     | 环境变量校验、嵌套预设、默认值与客户端访问保护         |
| [Intl](../../../packages/intl/README.md)                   | 语言协商、ICU 翻译、格式化与受控 React Provider        |
| [Analytics](../../../packages/analytics/README.md)         | 由用户同意控制的浏览器分析与可选 React 绑定            |
| [Logger](../../../packages/logger/README.md)               | evlog 结构化日志与请求上下文                           |
| [Notifications](../../../packages/notifications/README.md) | Knock 工作流与 React 通知流                            |
| [Security](../../../packages/security/README.md)           | 安全响应头与可选的请求防护                             |
| [Storage](../../../packages/storage/README.md)             | 对象存储驱动与签名上传下载地址                         |
| [TSConfig](../../../packages/tsconfig/README.md)           | 严格的 TypeScript 编译配置预设                         |
| [Themes](../../../packages/themes/README.md)               | 共享主题令牌、初始化脚本和可选 React 状态              |
| [UI](../../../packages/ui/README.md)                       | 基于 Base UI 的 React 基础组件和共享样式               |

各包独立管理版本，当前处于 Changesets alpha 模式。安装时请固定准确的预发布版本，以包清单记录的版本为准。

## 设计与迁移参考 [#designs-and-migration-references]

这些资料补充包的使用指南。研究清单中的一项能力或拟议的导入方式，不代表当前包已经实现该 API。

### Drizzle

- [Drizzle 扩展计划](../../drizzle/merge-plan.md)：当前基础能力、拟议的查询与关系模块、插件边界和验收标准。
- [drizzle-plus 能力清单](../../drizzle/drizzle-plus-capabilities.md)：固定版本的上游能力研究。
- [better-drizzle 能力清单](../../drizzle/better-drizzle-capabilities.md)：上游 API、插件、规则与错误码。
- [源码来源](../../../packages/drizzle/NOTICE.md)：源码版本、改编说明和保留的许可证。

Drizzle 的现有实现面向通过 postgres.js 使用 PostgreSQL 的场景。清单中保留了超出这一范围的上游能力，并单独标明其状态。

### Intl

- [Intl 受控 Provider 迁移](../../intl/migration.md)：运行时职责、消息类型、格式化与请求状态的迁移方式。

## 阅读与维护 [#editing-documentation]

### 语言与译文 [#languages-and-translations]

通过侧边栏的语言菜单切换 English 和简体中文。英文地址为 `/docs`，中文地址为 `/zh/docs`；语言切换保留当前页面、查询参数和锚点。导航、搜索和界面文案随语言变化，尚无中文翻译的正文会显示英文原文及提示。

文档站使用自己的 `@raypx-kit/intl` 包：URL 决定语言，受控 Provider 负责应用文案，Fumadocs 负责多语言页面目录与搜索。

在仓库根目录运行 `bun run docs:dev`，访问 `http://localhost:3100/zh/docs`。页面注册与语言来源映射位于 [pages.ts](../../src/lib/pages.ts)，英文内容直接编译权威 Markdown，中文译文位于 `docs/content/zh/`。新增译文时登记来源映射，并保留 API 状态、完整清单和源码说明。

运行 `bun run test:toolchain` 检查文档结构与词条一致性，运行 `bun run docs:build` 检查编译和预渲染，运行 `bun run test:e2e --project docs` 验证浏览器操作。

仓库设计与维护文档不进入 npm 包。站点职责与来源说明请见 [AGENTS.md](../../AGENTS.md) 和 [NOTICE.md](../../NOTICE.md)。
