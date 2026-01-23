# SkillHub MCP Server 使用指南

## 🚀 快速开始

### 1. 获取 API Key

1. 访问 [skillhub.club](https://www.skillhub.club)
2. 登录或注册账号
3. 前往 [开发者面板](https://www.skillhub.club/account/developer)
4. 点击 "New Key" 创建 API Key
5. 复制你的 API Key

### 2. 配置 Claude Code

编辑 `~/.claude/settings.json` 文件（如果不存在则创建）：

```json
{
  "mcpServers": {
    "skillhub": {
      "command": "npx",
      "args": ["-y", "@skill-hub/mcp-server"],
      "env": {
        "SKILLHUB_API_KEY": "sk-skillhubs-你的API密钥"
      }
    }
  }
}
```

### 3. 配置 Claude Desktop

编辑 `claude_desktop_config.json` 文件（位置取决于操作系统）：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "skillhub": {
      "command": "npx",
      "args": ["-y", "@skill-hub/mcp-server"],
      "env": {
        "SKILLHUB_API_KEY": "sk-skillhubs-你的API密钥"
      }
    }
  }
}
```

### 4. 重启 Claude

配置完成后，重启 Claude Code 或 Claude Desktop 以加载 MCP Server。

## 📖 使用示例

配置完成后，你可以在对话中直接使用 SkillHub：

### 搜索技能

```
你: "帮我找一个处理PDF的技能"
Claude: [调用 search_skills] 找到了3个相关技能...
```

### 获取技能详情

```
你: "告诉我 pdf-processor 技能的详细信息"
Claude: [调用 get_skill_detail] 这是详细信息...
```

### 安装技能

```
你: "安装 pdf-processor 技能"
Claude: [调用 install_skill] 这是安装命令...
```

### 浏览目录

```
你: "显示开发类别中评分最高的技能"
Claude: [调用 browse_catalog] 这是顶级开发技能...
```

### 获取推荐

```
你: "我正在做一个代码审查自动化项目"
Claude: [调用 recommend_skills] 基于你的项目，我推荐...
```

## 🛠️ 可用工具

| 工具 | 描述 |
|------|------|
| `search_skills` | 使用自然语言搜索技能 |
| `get_skill_detail` | 获取技能的详细信息、评估和内容 |
| `install_skill` | 生成安装命令或直接安装技能 |
| `browse_catalog` | 浏览技能目录，支持过滤和排序 |
| `recommend_skills` | 基于上下文获取技能推荐（使用MMR算法） |

## 📚 可用资源

| 资源 | 描述 |
|------|------|
| `skillhub://categories` | 所有技能分类列表 |
| `skillhub://popular` | 热门技能 Top 10 |
| `skillhub://recent` | 最近添加的技能 |

## 🔧 环境变量

| 变量 | 描述 | 必需 |
|------|------|------|
| `SKILLHUB_API_KEY` | 你的 SkillHub API Key | ✅ 是 |
| `SKILLHUB_API_URL` | SkillHub API 基础 URL | ❌ 否（默认: `https://skillhub.club/api/v1`） |
| `SKILLHUB_DEFAULT_AGENT` | 默认安装目标（claude/codex/gemini/opencode） | ❌ 否 |

## 🐛 故障排除

### MCP Server 无法启动

1. 检查 API Key 是否正确
2. 确保 Node.js 版本 >= 18
3. 检查网络连接
4. 查看 Claude 的错误日志

### 无法安装技能

1. 确保有写入权限
2. 检查目标目录是否存在
3. 确认 API Key 有足够权限

### 搜索无结果

1. 尝试不同的关键词
2. 检查网络连接
3. 确认 API Key 有效

## 📝 更新日志

### v1.0.6
- ✨ 更新推荐功能使用新的 MMR API
- 📊 添加工具调用追踪
- 🐛 修复类型错误

### v1.0.5
- 初始发布

## 🔗 相关链接

- [SkillHub 官网](https://www.skillhub.club)
- [开发者文档](https://www.skillhub.club/docs)
- [GitHub 仓库](https://github.com/skillhub-club/mcp-server)
