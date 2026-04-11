#!/usr/bin/env node
/**
 * Mock Data CLI Tool
 * 
 * A developer tool for managing mock data in Convex.
 * 
 * Usage:
 *   npx tsx scripts/mock-data.ts <command> [options]
 * 
 * Commands:
 *   seed     - Add mock data to the database
 *   clear    - Remove all leads and events from the database
 *   reset    - Clear and re-seed the database
 *   help     - Show this help message
 * 
 * Options:
 *   --leads, -l    Number of leads to create (default: 20)
 *   --events, -e   Number of events to create (default: 10)
 *   --yes, -y      Skip confirmation prompts
 * 
 * Examples:
 *   npx tsx scripts/mock-data.ts seed
 *   npx tsx scripts/mock-data.ts seed --leads 50 --events 25
 *   npx tsx scripts/mock-data.ts clear --yes
 *   npx tsx scripts/mock-data.ts reset -l 30 -e 15 -y
 */

import { config } from "dotenv";
import { execSync } from "child_process";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const CONVEX_DEPLOYMENT = process.env.CONVEX_DEPLOYMENT;

if (!CONVEX_DEPLOYMENT) {
  console.error("❌ Error: CONVEX_DEPLOYMENT environment variable is not set");
  console.error("   Make sure you're in the project root and Convex is configured");
  process.exit(1);
}

type Command = "seed" | "clear" | "reset" | "help";

interface Options {
  leads: number;
  events: number;
  yes: boolean;
  userId: string;
}

function parseArgs(): { command: Command; options: Options } {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    return { command: "help", options: { leads: 20, events: 10, yes: false, userId: "" } };
  }

  const command = args[0] as Command;
  const options: Options = {
    leads: 20,
    events: 10,
    yes: false,
    userId: "",
  };
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    switch (arg) {
      case "--leads":
      case "-l":
        if (nextArg) {
          options.leads = parseInt(nextArg, 10);
          i++;
        }
        break;
      case "--events":
      case "-e":
        if (nextArg) {
          options.events = parseInt(nextArg, 10);
          i++;
        }
        break;
      case "--yes":
      case "-y":
        options.yes = true;
        break;
      case "--user-id":
      case "-u":
        if (nextArg) {
          options.userId = nextArg;
          i++;
        }
        break;
    }
  }
  
  return { command, options };
}

function showHelp(): void {
  console.log(`
🛠️  Mock Data CLI Tool for RealEase

Usage:
  npx tsx scripts/mock-data.ts <command> [options]

Commands:
  seed     Add mock data to the database
  clear    Remove all leads and events from the database
  reset    Clear and re-seed the database
  help     Show this help message

Options:
  --leads, -l    Number of leads to create (default: 20)
  --events, -e   Number of events to create (default: 10)
  --yes, -y      Skip confirmation prompts

Examples:
  npx tsx scripts/mock-data.ts seed
  npx tsx scripts/mock-data.ts seed --leads 50 --events 25
  npx tsx scripts/mock-data.ts clear --yes
  npx tsx scripts/mock-data.ts reset -l 30 -e 15 -y
`);
}

function runConvexAction(action: string, args: Record<string, unknown>): void {
  const argsJson = JSON.stringify(args);
  const command = `npx convex run devtools/mockData:${action} --no-push -- '${argsJson}'`;
  
  try {
    const result = execSync(command, { 
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    console.log(result);
  } catch (error: unknown) {
    if (error instanceof Error && "stderr" in error) {
      const execError = error as unknown as { stderr: Buffer; stdout: Buffer };
      console.error("❌ Error:", execError.stderr?.toString() || execError.stdout?.toString());
    } else {
      console.error("❌ Error:", error);
    }
    process.exit(1);
  }
}

function seed(options: Options): void {
  if (!options.userId) {
    console.error("❌ Error: --user-id is required for seed/reset commands");
    console.error("   Pass the Convex user ID that should own the seeded leads");
    process.exit(1);
  }
  console.log(`\n🌱 Seeding database with ${options.leads} leads and ${options.events} events...\n`);
  runConvexAction("seedData", {
    leads: options.leads,
    events: options.events,
    userId: options.userId,
  });
  console.log("\n✅ Seeding complete!");
}

function clear(options: Options): void {
  if (!options.yes) {
    console.log("\n⚠️  Warning: This will delete ALL leads and events from the database.");
    console.log("   This action cannot be undone.\n");
    console.log("   Run with --yes flag to skip this prompt.");
    process.exit(0);
  }
  
  console.log("\n🗑️  Clearing all mock data...\n");
  runConvexAction("clearData", { confirm: true });
  console.log("\n✅ Clear complete!");
}

function reset(options: Options): void {
  if (!options.userId) {
    console.error("❌ Error: --user-id is required for seed/reset commands");
    console.error("   Pass the Convex user ID that should own the seeded leads");
    process.exit(1);
  }
  if (!options.yes) {
    console.log("\n⚠️  Warning: This will delete ALL existing leads and events,");
    console.log("   then create new mock data.");
    console.log(`   New data: ${options.leads} leads, ${options.events} events\n`);
    console.log("   Run with --yes flag to skip this prompt.");
    process.exit(0);
  }

  console.log(`\n🔄 Resetting database with ${options.leads} leads and ${options.events} events...\n`);
  runConvexAction("resetData", {
    leads: options.leads,
    events: options.events,
    confirm: true,
    userId: options.userId,
  });
  console.log("\n✅ Reset complete!");
}

// Main
const { command, options } = parseArgs();

switch (command) {
  case "seed":
    seed(options);
    break;
  case "clear":
    clear(options);
    break;
  case "reset":
    reset(options);
    break;
  case "help":
  default:
    showHelp();
    break;
}
