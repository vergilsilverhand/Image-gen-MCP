# Replicate MCP Server

这是一个基于 Model Context Protocol (MCP) 的 Replicate API 服务器，与官方 [replicate-mcp](https://www.npmjs.com/package/replicate-mcp) 包完全同步。

## 功能特性

### 🚀 完整的 Replicate API 支持
- **预测 (Predictions)**: 创建、获取、取消和列出预测
- **模型 (Models)**: 列出、获取和搜索模型
- **集合 (Collections)**: 获取和列出模型集合
- **训练 (Training)**: 创建、获取、取消和列出训练任务

### 🔧 动态工具支持
- `list_api_endpoints` - 发现可用的 API 端点
- `get_api_endpoint_schema` - 获取特定端点的详细架构
- `invoke_api_endpoint` - 动态调用任何 API 端点

### 🎯 客户端兼容性
支持多种 MCP 客户端：
- **Cursor** (`--client=cursor`)
- **Claude Desktop** (`--client=claude`)
- **Claude Code** (`--client=claude-code`)
- **OpenAI Agents** (`--client=openai-agents`)

### ⚙️ 灵活的工具配置
- **静态工具** (`--tools=static`) - 一对一的端点映射
- **动态工具** (`--tools=dynamic`) - 动态发现和调用端点
- **混合模式** (`--tools=both`) - 同时支持静态和动态工具

## 安装

### 环境要求
- Node.js >= 18
- Replicate API Token

### 依赖安装
```bash
npm install
```

### 构建
```bash
npm run build
```

## 使用方法

### 1. 设置环境变量
```bash
export REPLICATE_API_TOKEN="your_replicate_token_here"
```

### 2. 基本使用
```bash
# 默认模式（静态工具）
npm start

# 或者使用构建后的二进制文件
node build/index.js
```

### 3. 高级配置

#### 客户端特定配置
```bash
# 为 Cursor 优化
node build/index.js --client=cursor

# 为 Claude Desktop 优化
node build/index.js --client=claude

# 为 OpenAI Agents 优化
node build/index.js --client=openai-agents
```

#### 工具模式配置
```bash
# 仅使用动态工具
node build/index.js --tools=dynamic

# 同时使用静态和动态工具
node build/index.js --tools=both
```

#### 资源和操作过滤
```bash
# 仅包含预测相关的工具
node build/index.js --resource predictions

# 仅包含读取操作
node build/index.js --operation read

# 仅包含特定工具
node build/index.js --tool create_prediction get_prediction
```

#### 列出可用工具
```bash
node build/index.js --list
```

## 可用工具

### 预测 (Predictions)
- `create_prediction` - 创建新预测
- `get_prediction` - 获取预测状态和结果
- `cancel_prediction` - 取消运行中的预测
- `list_predictions` - 列出所有预测

### 模型 (Models)
- `list_models` - 列出所有可用模型
- `get_model` - 获取特定模型详情
- `search_models` - 搜索模型

### 集合 (Collections)
- `list_collections` - 列出所有模型集合
- `get_collection` - 获取特定集合详情

### 训练 (Training)
- `create_training` - 创建新训练任务
- `get_training` - 获取训练状态和结果
- `cancel_training` - 取消运行中的训练
- `list_trainings` - 列出所有训练任务

### 动态工具
- `list_api_endpoints` - 发现可用的 API 端点
- `get_api_endpoint_schema` - 获取端点架构信息
- `invoke_api_endpoint` - 动态调用任何端点

## 在 MCP 客户端中使用

### Claude Desktop 配置
在 Claude Desktop 的配置文件中添加：
```json
{
  "mcpServers": {
    "replicate": {
      "command": "node",
      "args": ["path/to/your/build/index.js", "--client=claude", "--tools=dynamic"],
      "env": {
        "REPLICATE_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

### Cursor 配置
在 Cursor 的 MCP 配置中添加：
```json
{
  "mcpServers": {
    "replicate": {
      "command": "node",
      "args": ["path/to/your/build/index.js", "--client=cursor", "--tools=static"],
      "env": {
        "REPLICATE_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

## 示例用法

### 创建图像生成预测
```bash
# 使用 create_prediction 工具
{
  "version": "black-forest-labs/flux-schnell",
  "input": {
    "prompt": "a beautiful sunset over the ocean",
    "width": 1024,
    "height": 1024,
    "num_outputs": 1
  }
}
```

### 搜索模型
```bash
# 使用 search_models 工具
{
  "query": "image generation",
  "cursor": null
}
```

### 动态调用端点
```bash
# 使用 invoke_api_endpoint 工具
{
  "endpoint_name": "create_prediction",
  "parameters": {
    "version": "model-version-id",
    "input": { "prompt": "your prompt here" }
  }
}
```

## 开发

### 开发模式
```bash
npm run dev
```

### 构建
```bash
npm run build
```

### 测试
```bash
npm test
```

## 许可证

Apache-2.0

## 更新记录

### v0.9.0
- 与官方 replicate-mcp 包完全同步
- 添加完整的 Replicate API 工具集
- 支持动态工具发现和调用
- 添加多客户端兼容性
- 添加命令行参数支持
- 改进错误处理和类型安全

## 相关链接

- [官方 replicate-mcp 包](https://www.npmjs.com/package/replicate-mcp)
- [Replicate API 文档](https://replicate.com/docs/reference)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Desktop MCP 指南](https://claude.ai/docs/mcp)

## 贡献

欢迎提交 Issue 和 Pull Request。

## 支持

如果您在使用过程中遇到问题，请：
1. 检查 Replicate API Token 是否正确设置
2. 确认网络连接正常
3. 查看控制台错误日志
4. 提交 Issue 到 GitHub 仓库
