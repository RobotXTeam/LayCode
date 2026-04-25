# LayCode

LayCode 是基于 Layrr 二次开发的本地可视化 UI 编辑器。

核心能力：

- 导入本地前端项目目录（新增）
- 支持 React/Vite、Vue/Vite、纯 HTML 等项目检测与启动
- 通过可视化编辑代理对本地页面进行操作并写回源码
- 在 overlay 中实时捕获页面变更，自动生成中英双语自然语言修改说明（新增）
- 支持复制/导出变更说明（新增）

## 1. 环境要求

- Node.js >= 18（建议 20）
- pnpm >= 10
- Linux/macOS（Windows 未做完整验证）

## 2. 安装与启动

```bash
pnpm install
./dev.sh
```

默认地址：

- Dashboard: http://localhost:3000
- Server API: http://localhost:8787

## 3. 本地项目导入（新功能）

在 Dashboard 的 Import 页面：

1. 使用 Import Local Project 区块输入本地绝对路径
2. 创建项目后进入项目页
3. 点击 Start Editor 启动可视化代理

项目页新增：

- Local 路径标识
- 项目文件树面板（基础版）

## 4. 变更说明导出（新功能）

在编辑器 overlay 的 Edit 面板新增 Change Notes 区块：

- 自动捕获结构、文本、样式变化
- 中/英语言切换（默认中文）
- Copy 一键复制说明
- Export 导出为 Markdown 文件

说明可直接粘贴给 AI，例如：

"请将 button#hero-button 的 background-color 从 #007bff 改为 #1a1a2e，并将 border-radius 调整为 12px。"

## 5. 与 AI 协作建议

推荐流程：

1. 在 LayCode 里可视化调整
2. 从 Change Notes 复制描述
3. 粘贴给 ChatGPT/Claude/Codex，要求其在对应代码仓中应用
4. 回到 LayCode 继续微调

## 6. 本地自测示例

仓库内置了两个示例目录：

- samples/react-vite
- samples/html-bootstrap

可通过 Server API 启动验证（需 `Authorization: Bearer dev-secret`）：

```bash
curl -X POST http://localhost:8787/projects/react-local/start \
  -H 'Authorization: Bearer dev-secret' \
  -H 'Content-Type: application/json' \
  -d '{"sourceType":"local","localPath":"/absolute/path/to/samples/react-vite"}'
```

```bash
curl -X POST http://localhost:8787/projects/html-local/start \
  -H 'Authorization: Bearer dev-secret' \
  -H 'Content-Type: application/json' \
  -d '{"sourceType":"local","localPath":"/absolute/path/to/samples/html-bootstrap"}'
```

## 7. 注意事项

- 所有操作默认在本地完成，不会主动上传代码到云端。
- 若 `LAYRR_AGENT` 对应代理未登录，编辑请求会失败，需要先配置代理登录状态。
- 建议不要把被编辑项目放在本仓库内部，以避免 git 提交边界混淆。

## License

MIT
