import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import * as fsSync from 'fs'
import * as path from 'path'

import { SessionConfig } from "@/lib/types"

// Setup logging directory and path
const logDir = path.join(process.cwd(), 'outputs')
const logPath = path.join(logDir, 'fe_requests.log')
try { fsSync.mkdirSync(logDir, { recursive: true }); } catch {}

function appendLog(entry: any) { 
  try { 
    fsSync.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8'); 
  } catch(e) {} 
}

export async function GET() {
  try {
    // Log session request
    appendLog({ 
      ts: new Date().toISOString(), 
      event: 'session_get', 
      provider: process.env.RUN_PROVIDER || 'MOCK' 
    })
    
    // Try to load session config template
    const templatePath = path.join(process.cwd(), "../../docs/TEMPLATES/session_config_example.json")
    
    try {
      const templateContent = await fs.readFile(templatePath, "utf-8")
      const config = JSON.parse(templateContent)
      return NextResponse.json(config)
    } catch {
      // Fallback default config
      const defaultConfig: SessionConfig = {
        mode: "exploit",
        guardianProfileId: "default",
        searchLite: false,
        styleRulesPath: "docs/style_rules.yaml",
        strategyOverrides: {
          factuality: 1.0,
          format: 1.0,
          difficulty: 1.0,
          styleStrictness: 0.5
        }
      }
      
      return NextResponse.json(defaultConfig)
    }
  } catch (error) {
    console.error("Session API error:", error)
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}