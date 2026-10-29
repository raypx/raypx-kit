/** Localized navigation and search metadata; package names remain their public names. */
export const chinesePageMetadata: Record<string, { title: string; description: string }> = {
  index: {
    title: "概览",
    description: "Raypx Kit 可独立发布的 TypeScript 库、现有 API 与扩展设计。",
  },
  "architecture/index": {
    title: "架构",
    description: "包的职责、依赖边界、构建产物和文档内容流程。",
  },
  "codemods/index": {
    title: "Codemods",
    description: "针对明确文件执行迁移，提供预览和可扩展的 CLI 注册表。",
  },
  "devkit/index": {
    title: "Devkit",
    description: "工作区边界、工具链版本、静态词条、产物探测和共享工程配置。",
  },
  "drizzle/index": {
    title: "Drizzle",
    description: "适用于 postgres.js 的 PostgreSQL、JSONB 和查询诊断工具。",
  },
  "drizzle/drizzle-plus": {
    title: "drizzle-plus 能力清单",
    description: "固定版本的上游能力清单及合并建议。",
  },
  "drizzle/better-drizzle": {
    title: "better-drizzle 能力清单",
    description: "上游 API、插件、规则和错误码的完整清单。",
  },
  "drizzle/merge-plan": {
    title: "合并与扩展计划",
    description: "未来扩展的模块边界、共享语义和验收标准。",
  },
  "drizzle/provenance": {
    title: "源码来源",
    description: "固定的源码版本、改编说明与保留的上游许可证。",
  },
  "drizzle-kit/index": {
    title: "Drizzle Kit",
    description: "保留 drizzle-kit CLI 和 defineConfig，移除未使用的预构建包。",
  },
  "env/index": {
    title: "Env",
    description: "具有类型约束的环境变量校验、嵌套预设、默认值和客户端访问保护。",
  },
  "email-preview/index": {
    title: "Email Preview",
    description: "通过 Vite 插件和预构建界面预览 React Email。",
  },
  "email-preview/vite-plugin": {
    title: "Vite 插件设计",
    description: "拟议的 Vite 插件架构、隔离限制和迁移步骤。",
  },
  "intl/index": {
    title: "Intl",
    description: "语言协商、类型安全的 ICU 翻译、Intl 格式化和受控 React Provider。",
  },
  "intl/migration": {
    title: "受控 Provider 迁移",
    description: "运行时职责、消息类型、平台偏好和 alpha 版本迁移。",
  },
  "analytics/index": {
    title: "Analytics",
    description: "由用户同意控制的 PostHog 事件、错误脱敏和可选 React 绑定。",
  },
  "logger/index": {
    title: "Logger",
    description: "基于 evlog 的结构化日志、宽事件和 Node 请求上下文。",
  },
  "notifications/index": {
    title: "Notifications",
    description: "Knock 工作流、签名用户令牌和可选 React 通知流。",
  },
  "security/index": {
    title: "Security",
    description: "Nosecone 安全响应头和由应用提供规则的可选 Arcjet 防护。",
  },
  "storage/index": {
    title: "Storage",
    description: "S3 兼容服务、本地文件与内存存储，以及签名上传下载地址。",
  },
  "themes/index": {
    title: "Themes",
    description: "主题令牌、首屏初始化脚本和可选 React 偏好状态。",
  },
  "ui/index": {
    title: "UI",
    description: "基于 Base UI、共享主题令牌和 shadcn 约定的 React 基础组件。",
  },
  "tsconfig/index": {
    title: "TSConfig",
    description: "适用于 ESM 库、浏览器应用和 Node 运行时的严格 TypeScript 预设。",
  },
  "development/index": { title: "开发指南", description: "仓库环境搭建、命令、验证和新增包流程。" },
  "development/dependencies": {
    title: "依赖维护",
    description: "版本范围、运行时版本、兼容性检查和升级流程。",
  },
  "development/changesets": {
    title: "Changesets 工作流",
    description: "独立版本、首次发布和后续版本准备。",
  },
  "development/publishing": {
    title: "发布指南",
    description: "环境配置、alpha 发布、CI 发布、稳定版本和故障恢复。",
  },
};

/** Add a maintained translation here when its Markdown is ready. */
export const chineseContentSources: Record<string, string> = {
  index: "docs/content/zh/index.md",
};
