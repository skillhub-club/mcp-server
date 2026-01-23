# @skill-hub/mcp-server

MCP Server for [SkillHub](https://www.skillhub.club) - Discover, search, and install Claude Code Skills directly from your AI assistant.

## Features

### MCP Tools

| Tool | Description |
|------|-------------|
| `search_skills` | Semantic search for skills using natural language |
| `get_skill_detail` | Get detailed skill information, evaluation, and content |
| `install_skill` | Generate installation commands for bash/PowerShell |
| `browse_catalog` | Browse skill catalog with filters and sorting |
| `recommend_skills` | Get context-based skill recommendations |

### MCP Resources

| Resource | Description |
|----------|-------------|
| `skillhub://categories` | List of all skill categories |
| `skillhub://popular` | Top 10 popular skills |
| `skillhub://recent` | Recently added skills |

## Installation

### Prerequisites

1. Get your API Key from [SkillHub Developer Dashboard](https://www.skillhub.club/account/developer)
2. Configure Claude Code or Claude Desktop with your key

### Claude Code (CLI)

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "skillhub": {
      "command": "npx",
      "args": ["-y", "@skill-hub/mcp-server"],
      "env": {
        "SKILLHUB_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "skillhub": {
      "command": "npx",
      "args": ["-y", "@skill-hub/mcp-server"],
      "env": {
        "SKILLHUB_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Manual Installation

```bash
npm install -g @skill-hub/mcp-server
SKILLHUB_API_KEY=your-api-key skillhub-mcp
```

## Usage Examples

Once configured, you can use SkillHub directly in your AI conversations:

### Search for Skills

```
User: "Find me a skill for processing PDF files"
AI: [Calls search_skills] Found 3 relevant skills...
```

### Get Skill Details

```
User: "Tell me more about the pdf-processor skill"
AI: [Calls get_skill_detail] Here's the detailed information...
```

### Install a Skill

```
User: "Install the pdf-processor skill"
AI: [Calls install_skill] Here are the installation commands...
```

### Browse Catalog

```
User: "Show me the top-rated skills in the 'Development' category"
AI: [Calls browse_catalog] Here are the top development skills...
```

### Get Recommendations

```
User: "I'm working on a code review automation project"
AI: [Calls recommend_skills] Based on your context, I recommend...
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SKILLHUB_API_KEY` | Your SkillHub API Key | Yes |
| `SKILLHUB_API_URL` | SkillHub API base URL | No (default: `https://www.skillhub.club/api/v1`) |

## Get Your API Key

1. Visit [skillhub.club](https://www.skillhub.club)
2. Sign in or create an account
3. Go to [Developer Dashboard](https://www.skillhub.club/account/developer)
4. Click "New Key" to generate your API key
5. Copy the key and add it to your MCP configuration

## Development

```bash
# Clone the repo
cd packages/mcp-server

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## License

MIT
