# LayCode

LayCode 是一个本地可视化 UI 编辑器。你可以直接在浏览器里点选页面元素、描述要改什么，然后把改动转成：

1. 清晰的自然语言修改指令（中英双语）
2. git diff 风格补丁片段

适合产品经理、设计师、运营同学和不想反复手写提示词的开发者。

## 核心特性

1. 本地单机可用，默认免登录
2. 支持导入本地前端项目目录
3. 兼容 React/Vite、Vue/Vite、纯 HTML 项目
4. 可视化编辑后可直接回写源码
5. 自动生成变更说明、可一键复制或导出
6. 内置 Project Explorer（三栏）：文件树、源码预览、属性映射

## 适用场景

1. 先让 AI 生成页面，再用可视化方式做精细调整
2. 不想手动组织复杂修改提示词
3. 希望把视觉改动沉淀为可复用的改动说明和补丁

## 环境要求

1. Node.js >= 18（推荐 20）
2. pnpm >= 10
3. Linux 或 macOS

## 快速开始（3 分钟）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动服务

```bash
./dev.sh
```

### 3. 打开地址

1. Dashboard: http://localhost:3000/dashboard
2. Server API: http://localhost:8787

## 完整使用流程

### 第一步：导入本地项目

1. 打开 http://localhost:3000/dashboard/import
2. 在 Import Local Project 区块输入本地绝对路径
3. 创建项目后进入项目详情页

### 第二步：启动可视化编辑器

1. 点击 Start Editor
2. 系统会自动识别框架、安装依赖、启动 dev server 与代理
3. 启动后打开 Editor（通常是 6100/6101 端口）

### 第三步：可视化修改页面

1. 点击页面元素
2. 输入修改指令（例如颜色、圆角、尺寸、文本）
3. 查看实时生效结果

### 第四步：导出修改说明与补丁

编辑器右侧 Change Notes 支持：

1. 中文/英文切换
2. Copy 复制全部修改说明
3. Export 导出为 Markdown
4. 查看 git diff 风格片段

示例指令：

请将 button#hero-button 的 background-color 从 #007bff 改为 #1a1a2e，并将 border-radius 调整为 12px。

## Project Explorer 使用说明

项目页内置三栏区域：

1. 左侧：文件树（浏览项目结构）
2. 中间：源码预览（点击文件即时查看）
3. 右侧：属性映射（提取可编辑样式线索与提示模板）

这个面板适合在可视化编辑前快速定位文件和样式方向。

## 本地自测（建议首次运行后执行）

```bash
./scripts/self-test-local-import.sh
```

脚本会自动验证：

1. React 示例导入与代理注入
2. HTML 示例导入与代理注入

## 与 AI 协作最佳实践

1. 在 LayCode 内先完成可视化调整
2. 从 Change Notes 复制中文说明或英文说明
3. 连同 diff 片段粘贴给 AI（如 ChatGPT/Claude/Codex）
4. 让 AI 在目标仓库中批量应用
5. 回到 LayCode 再做精修

## 常见问题

### 1) 6100/6101 打不开

1. 先确认项目状态：是否点击过 Start Editor
2. 检查端口占用：`ss -ltnp | grep -E ':6100|:6101'`
3. 重新跑一遍自测脚本：`./scripts/self-test-local-import.sh`

### 2) 页面显示但编辑不生效

1. 检查 agent 是否可用
2. 查看 server 日志与 project logs
3. 尝试更明确的指令（包含目标元素和属性）

### 3) 本地项目依赖安装慢

1. 首次安装属于正常
2. 建议提前在项目目录执行一次 `pnpm install` 或 `npm install`

## 目录结构（简版）

1. packages/cli: 可视化代理与 overlay
2. packages/app: Dashboard 与 API
3. packages/server: 进程管理与项目编排
4. samples: 本地自测示例项目

## 免责声明

1. LayCode 基于 Layrr 开源项目二次开发（MIT 许可）
2. 默认工作流在本地执行，不主动上传你的代码

## License

MIT








