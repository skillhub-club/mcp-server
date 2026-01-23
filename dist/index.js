#!/usr/bin/env node
/**
 * SkillHub MCP Server
 *
 * Provides Claude/GPT with direct access to SkillHub for discovering,
 * searching, and installing Claude Code Skills.
 *
 * MCP Tools:
 *   - search_skills: Semantic search for skills
 *   - get_skill_detail: Get detailed skill information
 *   - install_skill: Generate installation commands
 *   - browse_catalog: Browse skill catalog with filters
 *   - recommend_skills: Get context-based recommendations
 *
 * MCP Resources:
 *   - skillhub://categories: List of skill categories
 *   - skillhub://popular: Popular skills
 *   - skillhub://recent: Recently added skills
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createClient } from "@skill-hub/sdk";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
// =============================================================================
// Configuration
// =============================================================================
const SKILLHUB_API_BASE = process.env.SKILLHUB_API_URL || "https://skillhub.club/api/v1";
const SKILLHUB_API_KEY = process.env.SKILLHUB_API_KEY;
function detectCurrentAgent() {
    // 1. Check explicit environment variable
    const envAgent = process.env.SKILLHUB_DEFAULT_AGENT;
    if (envAgent && ["claude", "codex", "gemini", "opencode"].includes(envAgent)) {
        return envAgent;
    }
    // 2. Check CLI-specific environment variables
    if (process.env.CLAUDE_CODE || process.env.ANTHROPIC_API_KEY) {
        return "claude";
    }
    if (process.env.CODEX_HOME || process.env.OPENAI_API_KEY) {
        return "codex";
    }
    if (process.env.GEMINI_API_KEY) {
        return "gemini";
    }
    // 3. Check which config directories exist
    const homeDir = os.homedir();
    const checks = [
        ["claude", path.join(homeDir, ".claude")],
        ["codex", path.join(homeDir, ".codex")],
        ["gemini", path.join(homeDir, ".gemini")],
        ["opencode", path.join(homeDir, ".opencode")],
    ];
    for (const [agent, dir] of checks) {
        try {
            const stats = require("fs").statSync(dir);
            if (stats.isDirectory()) {
                return agent;
            }
        }
        catch {
            // Directory doesn't exist, continue
        }
    }
    // 4. Default to claude
    return "claude";
}
// Detect agent at startup
const DETECTED_AGENT = detectCurrentAgent();
console.error(`[SkillHub MCP] Detected agent: ${DETECTED_AGENT}`);
// Initialize SDK client
const client = createClient({
    baseUrl: SKILLHUB_API_BASE,
    token: SKILLHUB_API_KEY,
});
// Allowed install directories (security: only write to these paths)
const ALLOWED_INSTALL_DIRS = {
    claude: path.join(os.homedir(), ".claude", "skills"),
    codex: path.join(os.homedir(), ".codex", "skills"),
    gemini: path.join(os.homedir(), ".gemini", "skills"),
    opencode: path.join(os.homedir(), ".opencode", "skills"),
};
// =============================================================================
// Tool Schemas
// =============================================================================
const SearchSkillsSchema = z.object({
    query: z.string().describe("Natural language search query"),
    limit: z.number().min(1).max(20).default(5).describe("Number of results"),
    category: z.string().optional().describe("Filter by category"),
    min_score: z.number().min(0).max(100).optional().describe("Minimum quality score"),
});
const GetSkillDetailSchema = z.object({
    skill_id: z.string().describe("Skill ID or slug"),
    include_content: z.boolean().default(false).describe("Include SKILL.md content"),
});
const InstallSkillSchema = z.object({
    skill_id: z.string().describe("Skill ID or slug to install"),
    agents: z
        .array(z.enum(["claude", "codex", "gemini", "opencode"]))
        .optional()
        .describe("Target agents for installation. Defaults to SKILLHUB_DEFAULT_AGENT env or 'claude'."),
    confirm: z
        .boolean()
        .default(false)
        .describe("Set to true to confirm installation. First call without confirm to preview, then call with confirm=true to install."),
});
const BrowseCatalogSchema = z.object({
    category: z.string().optional().describe("Filter by category"),
    sort: z
        .enum(["score", "stars", "recent", "composite"])
        .default("composite")
        .describe("Sort order"),
    limit: z.number().min(1).max(50).default(10).describe("Number of results"),
    offset: z.number().min(0).default(0).describe("Pagination offset"),
    min_score: z.number().min(0).max(100).optional().describe("Minimum score"),
});
const RecommendSkillsSchema = z.object({
    context: z.string().describe("Description of what you're working on"),
    current_skills: z
        .array(z.string())
        .default([])
        .describe("Already installed skill IDs to avoid"),
    limit: z.number().min(1).max(10).default(5).describe("Number of recommendations"),
});
// =============================================================================
// Tool Handlers
// =============================================================================
async function searchSkills(args) {
    const results = await client.search(args.query, {
        limit: args.limit,
        category: args.category,
        min_score: args.min_score,
        method: "hybrid",
    });
    if (results.length === 0) {
        return `No skills found for "${args.query}". Try different keywords or browse the catalog.`;
    }
    const formatted = results
        .map((s, i) => {
        const score = s.simple_score ? `Score: ${s.simple_score}` : "";
        const category = s.category ? `[${s.category}]` : "";
        return `${i + 1}. **${s.name}** (${s.slug}) ${category}
   ${s.description || s.description_zh || "No description"}
   ${score} | Relevance: ${(s.similarity_score * 100).toFixed(0)}%`;
    })
        .join("\n\n");
    return `Found ${results.length} skills for "${args.query}":\n\n${formatted}\n\nUse \`get_skill_detail\` for more info or \`install_skill\` to install.`;
}
async function getSkillDetail(args) {
    const data = await client.getSkill(args.skill_id, {
        includeContent: args.include_content,
    });
    const { skill, evaluation, token_stats } = data;
    let output = `# ${skill.name}

**Author:** ${skill.author}
**Category:** ${skill.category || "Uncategorized"}
**Tags:** ${skill.tags?.join(", ") || "None"}
**Rating:** ${skill.simple_rating || "N/A"} (Score: ${skill.simple_score ?? "N/A"})
**GitHub Stars:** ${skill.github_stars ?? "N/A"}
**Repository:** ${skill.repo_url}
**Token Usage:** ~${token_stats.total_tokens} tokens

## Description
${skill.description || skill.description_zh || "No description available."}`;
    if (evaluation) {
        output += `

## Evaluation
**Overall:** ${evaluation.overall_rating || "N/A"} (${evaluation.overall_score ?? "N/A"}/100)
**Target Audience:** ${evaluation.target_audience || "General"}

**Summary:** ${evaluation.summary || "No summary available."}`;
        if (evaluation.pros?.length) {
            output += `

**Pros:**
${evaluation.pros.map((p) => `- ${p}`).join("\n")}`;
        }
        if (evaluation.cons?.length) {
            output += `

**Cons:**
${evaluation.cons.map((c) => `- ${c}`).join("\n")}`;
        }
    }
    if (args.include_content && skill.skill_md_raw) {
        output += `

---

## SKILL.md Content

\`\`\`markdown
${skill.skill_md_raw}
\`\`\``;
    }
    output += `

---
Install with: \`install_skill({ skill_id: "${skill.slug}" })\``;
    return output;
}
async function installSkill(args) {
    // Use detected agent if not specified
    const targetAgents = args.agents || [DETECTED_AGENT];
    const data = await client.getInstallInfo(args.skill_id, targetAgents);
    const { skill, install, one_liners } = data;
    // If confirm is false, show preview and ask for confirmation
    if (!args.confirm) {
        const installPaths = targetAgents.map((agent) => {
            const baseDir = ALLOWED_INSTALL_DIRS[agent];
            const isDetected = agent === DETECTED_AGENT && !args.agents;
            return `- **${agent}**${isDetected ? " (auto-detected)" : ""}: \`${path.join(baseDir, skill.slug, "SKILL.md")}\``;
        }).join("\n");
        return `# Install ${skill.name}?

## Target Environment
Detected CLI: **${DETECTED_AGENT}**

## This will create:
${installPaths}

## Skill Preview
- **Name:** ${skill.name}
- **Repository:** ${skill.repo_url}
- **Content size:** ${install.content.length} characters

---

**To confirm installation, call again with \`confirm: true\`:**
\`\`\`
install_skill({ skill_id: "${skill.slug}", confirm: true })
\`\`\`

Or use one-liner commands:

### macOS / Linux
\`\`\`bash
${one_liners.unix}
\`\`\`

### Windows (PowerShell)
\`\`\`powershell
${one_liners.windows}
\`\`\``;
    }
    // Execute installation directly
    const installed = [];
    const errors = [];
    for (const agent of targetAgents) {
        const baseDir = ALLOWED_INSTALL_DIRS[agent];
        if (!baseDir) {
            errors.push(`Unknown agent: ${agent}`);
            continue;
        }
        const skillDir = path.join(baseDir, skill.slug);
        const skillFile = path.join(skillDir, "SKILL.md");
        // Security check: ensure we're writing within allowed directory
        const resolvedDir = path.resolve(skillDir);
        const resolvedBase = path.resolve(baseDir);
        if (!resolvedDir.startsWith(resolvedBase)) {
            errors.push(`Security error: Invalid path for ${agent}`);
            continue;
        }
        try {
            // Create directory
            await fs.mkdir(skillDir, { recursive: true });
            // Write SKILL.md
            await fs.writeFile(skillFile, install.content, "utf-8");
            installed.push(`✅ **${agent}**: \`${skillFile}\``);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`❌ **${agent}**: ${msg}`);
        }
    }
    let output = `# ✅ Installed: ${skill.name}\n\n`;
    if (installed.length > 0) {
        output += `## Successfully Installed\n${installed.join("\n")}\n\n`;
        output += `> **Note:** Restart your AI agent or start a new conversation to load the skill.\n\n`;
    }
    if (errors.length > 0) {
        output += `## Errors\n${errors.join("\n")}\n\n`;
    }
    output += `## Skill Info
- **Repository:** ${skill.repo_url}
- **Slug:** ${skill.slug}`;
    return output;
}
async function browseCatalog(args) {
    const data = await client.getCatalog({
        sort: args.sort,
        limit: args.limit,
        offset: args.offset,
        status: "published",
        category: args.category,
        min_score: args.min_score,
    });
    if (data.skills.length === 0) {
        return "No skills found with the specified filters.";
    }
    const skills = data.skills
        .map((s, i) => {
        const idx = args.offset + i + 1;
        const rating = s.simple_rating ? `[${s.simple_rating}]` : "";
        const stars = s.github_stars ? `${s.github_stars}` : "-";
        const category = s.category ? `(${s.category})` : "";
        return `${idx}. **${s.name}** ${rating} ${category}
   By ${s.author} | Stars: ${stars}
   ${s.description || "No description"}`;
    })
        .join("\n\n");
    const pagination = data.pagination.has_more
        ? `\n\n_Showing ${args.offset + 1}-${args.offset + data.skills.length} of ${data.pagination.total}. Use offset=${args.offset + args.limit} for more._`
        : "";
    return `# Skill Catalog\n\n${skills}${pagination}`;
}
async function recommendSkills(args) {
    // Use new publicRecommend API with MMR
    const recommendations = await client.publicRecommend({
        query: args.context,
        limit: args.limit + args.current_skills.length,
        mmr_lambda: 0.7,
    });
    // Filter out current skills and limit
    const filtered = recommendations
        .filter((r) => !args.current_skills.includes(r.id) && !args.current_skills.includes(r.slug))
        .slice(0, args.limit);
    if (filtered.length === 0) {
        return `No new skill recommendations found for your context. Try browsing the catalog or searching with different keywords.`;
    }
    const results = filtered
        .map((s, i) => {
        const score = s.simple_score ? `Score: ${s.simple_score}` : "";
        const category = s.category ? `[${s.category}]` : "";
        const match = s.similarity ? `${(s.similarity * 100).toFixed(0)}%` : "N/A";
        return `${i + 1}. **${s.name}** (${s.slug}) ${category}
   ${s.description || s.description_zh || "No description"}
   ${score} | Match: ${match}`;
    })
        .join("\n\n");
    return `# Recommended Skills for Your Context

Based on: "${args.context.slice(0, 100)}${args.context.length > 100 ? "..." : ""}"

${results}

Use \`install_skill\` to install any of these skills.`;
}
// =============================================================================
// Resource Handlers
// =============================================================================
async function getCategories() {
    const categories = await client.getCategories();
    const formatted = categories
        .map(({ name, count }) => `- **${name}**: ${count} skills`)
        .join("\n");
    return `# SkillHub Categories\n\n${formatted}\n\nUse \`browse_catalog({ category: "CategoryName" })\` to explore.`;
}
async function getPopularSkills() {
    const skills = await client.getPopular(10);
    const formatted = skills
        .map((s, i) => {
        const rating = s.simple_rating ? `[${s.simple_rating}]` : "";
        return `${i + 1}. **${s.name}** ${rating} - ${s.description || "No description"}`;
    })
        .join("\n");
    return `# Popular Skills on SkillHub\n\n${formatted}\n\nUse \`get_skill_detail\` for more info.`;
}
async function getRecentSkills() {
    const skills = await client.getRecent(10);
    const formatted = skills
        .map((s, i) => {
        const category = s.category ? `[${s.category}]` : "";
        return `${i + 1}. **${s.name}** ${category} - ${s.description || "No description"}`;
    })
        .join("\n");
    return `# Recently Added Skills\n\n${formatted}\n\nUse \`search_skills\` to find specific skills.`;
}
// =============================================================================
// MCP Server Setup
// =============================================================================
const server = new Server({
    name: "skillhub",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
        resources: {},
    },
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "search_skills",
                description: "Search for Claude Code Skills using natural language. Returns relevant skills based on semantic matching.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Natural language search query (e.g., 'PDF processing', 'code review', 'git workflow')",
                        },
                        limit: {
                            type: "number",
                            description: "Number of results (1-20, default: 5)",
                            default: 5,
                        },
                        category: {
                            type: "string",
                            description: "Filter by category (optional)",
                        },
                        min_score: {
                            type: "number",
                            description: "Minimum quality score 0-100 (optional)",
                        },
                    },
                    required: ["query"],
                },
            },
            {
                name: "get_skill_detail",
                description: "Get detailed information about a specific skill including evaluation, pros/cons, and optionally the full SKILL.md content.",
                inputSchema: {
                    type: "object",
                    properties: {
                        skill_id: {
                            type: "string",
                            description: "Skill ID or slug (e.g., 'pdf-processor' or UUID)",
                        },
                        include_content: {
                            type: "boolean",
                            description: "Include full SKILL.md content (default: false)",
                            default: false,
                        },
                    },
                    required: ["skill_id"],
                },
            },
            {
                name: "install_skill",
                description: `Install a skill to the local filesystem. First call shows a preview, then call with confirm=true to install. Auto-detects current CLI environment (detected: ${DETECTED_AGENT}).`,
                inputSchema: {
                    type: "object",
                    properties: {
                        skill_id: {
                            type: "string",
                            description: "Skill ID or slug to install",
                        },
                        agents: {
                            type: "array",
                            items: {
                                type: "string",
                                enum: ["claude", "codex", "gemini", "opencode"],
                            },
                            description: `Target agents. Auto-detected: ${DETECTED_AGENT}. Override to install for multiple agents.`,
                        },
                        confirm: {
                            type: "boolean",
                            description: "Set to true to confirm and execute installation. First call without confirm to preview.",
                            default: false,
                        },
                    },
                    required: ["skill_id"],
                },
            },
            {
                name: "browse_catalog",
                description: "Browse the skill catalog with filtering and sorting options. Good for discovering skills by category or popularity.",
                inputSchema: {
                    type: "object",
                    properties: {
                        category: {
                            type: "string",
                            description: "Filter by category (optional)",
                        },
                        sort: {
                            type: "string",
                            enum: ["score", "stars", "recent", "composite"],
                            description: "Sort order (default: composite)",
                            default: "composite",
                        },
                        limit: {
                            type: "number",
                            description: "Number of results (1-50, default: 10)",
                            default: 10,
                        },
                        offset: {
                            type: "number",
                            description: "Pagination offset (default: 0)",
                            default: 0,
                        },
                        min_score: {
                            type: "number",
                            description: "Minimum quality score 0-100 (optional)",
                        },
                    },
                },
            },
            {
                name: "recommend_skills",
                description: "Get skill recommendations based on what you're working on. Uses semantic matching to find relevant skills.",
                inputSchema: {
                    type: "object",
                    properties: {
                        context: {
                            type: "string",
                            description: "Description of your current task or project",
                        },
                        current_skills: {
                            type: "array",
                            items: { type: "string" },
                            description: "Already installed skill IDs/slugs to exclude",
                            default: [],
                        },
                        limit: {
                            type: "number",
                            description: "Number of recommendations (1-10, default: 5)",
                            default: 5,
                        },
                    },
                    required: ["context"],
                },
            },
        ],
    };
});
// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: "skillhub://categories",
                name: "Skill Categories",
                description: "List of all skill categories with counts",
                mimeType: "text/markdown",
            },
            {
                uri: "skillhub://popular",
                name: "Popular Skills",
                description: "Top 10 most popular skills",
                mimeType: "text/markdown",
            },
            {
                uri: "skillhub://recent",
                name: "Recent Skills",
                description: "10 most recently added skills",
                mimeType: "text/markdown",
            },
        ],
    };
});
// Handle resource reads
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    let content;
    switch (uri) {
        case "skillhub://categories":
            content = await getCategories();
            break;
        case "skillhub://popular":
            content = await getPopularSkills();
            break;
        case "skillhub://recent":
            content = await getRecentSkills();
            break;
        default:
            throw new Error(`Unknown resource: ${uri}`);
    }
    return {
        contents: [
            {
                uri,
                mimeType: "text/markdown",
                text: content,
            },
        ],
    };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const startTime = Date.now();
    // Track MCP tool call
    const trackMCPCall = async (success, error, metadata) => {
        try {
            const apiBase = SKILLHUB_API_BASE.replace("/api/v1", "");
            await fetch(`${apiBase}/api/v1/desktop/track`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": `skillhub-mcp-server/${process.env.npm_package_version || "unknown"}`,
                },
                body: JSON.stringify({
                    event_type: `mcp.${name}`,
                    event_data: {
                        tool: name,
                        args: args || {},
                        success,
                        error,
                        duration_ms: Date.now() - startTime,
                        ...metadata,
                    },
                    source: "mcp_server",
                    timestamp: Date.now(),
                }),
            }).catch(() => {
                // Silently fail - tracking should never break MCP
            });
        }
        catch {
            // Silently fail
        }
    };
    try {
        let result;
        switch (name) {
            case "search_skills": {
                const parsedArgs = SearchSkillsSchema.parse(args);
                result = await searchSkills(parsedArgs);
                await trackMCPCall(true, undefined, { query: parsedArgs.query });
                break;
            }
            case "get_skill_detail": {
                const parsedArgs = GetSkillDetailSchema.parse(args);
                result = await getSkillDetail(parsedArgs);
                await trackMCPCall(true, undefined, { skill_id: parsedArgs.skill_id });
                break;
            }
            case "install_skill": {
                const parsedArgs = InstallSkillSchema.parse(args);
                result = await installSkill(parsedArgs);
                await trackMCPCall(true, undefined, { skill_id: parsedArgs.skill_id });
                break;
            }
            case "browse_catalog": {
                const parsedArgs = BrowseCatalogSchema.parse(args);
                result = await browseCatalog(parsedArgs);
                await trackMCPCall(true, undefined, {
                    category: parsedArgs.category,
                    sort: parsedArgs.sort,
                });
                break;
            }
            case "recommend_skills": {
                const parsedArgs = RecommendSkillsSchema.parse(args);
                result = await recommendSkills(parsedArgs);
                await trackMCPCall(true, undefined, {
                    context: parsedArgs.context?.substring(0, 100),
                });
                break;
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
        return {
            content: [{ type: "text", text: result }],
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await trackMCPCall(false, message);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
});
// =============================================================================
// Main
// =============================================================================
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("SkillHub MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map