#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ProjectCommandsServer {
  constructor() {
    this.server = new Server({
      name: 'project-commands',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'sync',
          description: 'Sync project changes to git repository',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'commit',
          description: 'Commit and push changes',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'dev',
          description: 'Run the multi-agent QA system',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'status',
          description: 'Check system status',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name } = request.params;

      try {
        let command;
        switch (name) {
          case 'sync':
            command = 'git add . && git commit -m "sync: update with latest changes - 🤖 Generated with Claude Code\\n\\nCo-Authored-By: Claude <noreply@anthropic.com>" && git push && echo "✅ 프로젝트 동기화 완료"';
            break;
          case 'commit':
            command = 'git add . && git commit -m "feat: automated commit - 🤖 Generated with Claude Code\\n\\nCo-Authored-By: Claude <noreply@anthropic.com>" && git push';
            break;
          case 'dev':
            command = 'npm run dev';
            break;
          case 'status':
            command = 'echo "🔍 Git Status:" && git status --short && echo "" && echo "🔧 TypeScript Check:" && npm run typecheck';
            break;
          default:
            throw new Error(`Unknown command: ${name}`);
        }

        const { stdout, stderr } = await execAsync(command);

        return {
          content: [
            {
              type: 'text',
              text: `Command executed successfully:\\n\\nSTDOUT:\\n${stdout}${stderr ? `\\n\\nSTDERR:\\n${stderr}` : ''}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Command failed: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Project Commands MCP server running on stdio');
  }
}

const server = new ProjectCommandsServer();
server.run().catch(console.error);