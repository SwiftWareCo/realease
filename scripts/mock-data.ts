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
 *   seed-all - Add mock data for every Clerk-synced Convex user
 *   clear    - Remove seeded app data for one Clerk-synced user
 *   clear-all - Remove seeded app data for every Clerk-synced Convex user
 *   reset    - Clear and re-seed app data for one Clerk-synced user
 *   reset-all - Clear and re-seed app data for every Clerk-synced Convex user
 *   help     - Show this help message
 * 
 * Options:
 *   --leads, -l    Number of leads to create (default: 20)
 *   --events, -e   Number of events to create (default: 10)
 *   --email        Email of the Clerk-synced user to seed for
 *   --user-id, -u  Convex users table id to seed for
 *   --prod         Run against the production Convex deployment
 *   --deployment   Run against a specific Convex deployment reference
 *   --yes, -y      Skip confirmation prompts
 * 
 * Examples:
 *   npx tsx scripts/mock-data.ts seed --email swiftwareco@gmail.com
 *   npx tsx scripts/mock-data.ts seed --email swiftwareco@gmail.com --leads 50 --events 25
 *   npx tsx scripts/mock-data.ts seed-all --leads 20 --events 10 --yes
 *   npx tsx scripts/mock-data.ts clear --email swiftwareco@gmail.com --yes
 *   npx tsx scripts/mock-data.ts reset --email swiftwareco@gmail.com -l 30 -e 15 -y
 *   npx tsx scripts/mock-data.ts reset-all -l 30 -e 15 -y
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

type Command = "seed" | "seed-all" | "clear" | "clear-all" | "reset" | "reset-all" | "help";

interface Options {
  leads: number;
  events: number;
  yes: boolean;
  prod: boolean;
  deployment?: string;
  userId?: string;
  userEmail?: string;
}

const DEFAULT_SEED_EMAIL =
  process.env.MOCK_USER_EMAIL ?? process.env.SEED_USER_EMAIL;

function parseArgs(): { command: Command; options: Options } {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    return {
      command: "help",
      options: {
        leads: 20,
        events: 10,
        yes: false,
        prod: false,
        userEmail: DEFAULT_SEED_EMAIL,
      },
    };
  }

  const command = args[0] as Command;
  const options: Options = {
    leads: 20,
    events: 10,
    yes: false,
    prod: false,
    userEmail: DEFAULT_SEED_EMAIL,
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
      case "--prod":
        options.prod = true;
        break;
      case "--deployment":
        if (nextArg) {
          options.deployment = nextArg;
          i++;
        }
        break;
      case "--user-id":
      case "-u":
        if (nextArg) {
          options.userId = nextArg;
          i++;
        }
        break;
      case "--email":
      case "--user-email":
        if (nextArg) {
          options.userEmail = nextArg;
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
  seed       Add mock data to the database
  seed-all   Add mock data for every Clerk-synced Convex user
  clear      Remove seeded app data for one Clerk-synced user
  clear-all  Remove seeded app data for every Clerk-synced Convex user
  reset      Clear and re-seed app data for one Clerk-synced user
  reset-all  Clear and re-seed app data for every Clerk-synced Convex user
  help       Show this help message

Options:
  --leads, -l    Number of leads to create (default: 20)
  --events, -e   Number of events to create (default: 10)
  --email        Email of an existing Clerk-synced user
  --user-id, -u  Convex users table id
  --prod         Run against the production Convex deployment
  --deployment   Run against a specific Convex deployment reference
  --yes, -y      Skip confirmation prompts

Examples:
  npx tsx scripts/mock-data.ts seed --email swiftwareco@gmail.com
  npx tsx scripts/mock-data.ts seed --email swiftwareco@gmail.com --leads 50 --events 25
  npx tsx scripts/mock-data.ts seed-all --leads 20 --events 10 --yes
  npx tsx scripts/mock-data.ts reset-all --prod --yes
  npx tsx scripts/mock-data.ts clear --email swiftwareco@gmail.com --yes
  npx tsx scripts/mock-data.ts reset --email swiftwareco@gmail.com -l 30 -e 15 -y
  npx tsx scripts/mock-data.ts reset-all -l 30 -e 15 -y
`);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function runConvexAction(
  action: string,
  args: Record<string, unknown>,
  options: Options,
): void {
  const argsJson = JSON.stringify(args);
  const targetArgs = options.prod
    ? " --prod"
    : options.deployment
      ? ` --deployment ${shellQuote(options.deployment)}`
      : "";
  const command = `npx convex run${targetArgs} devtools/mockData:${action} --no-push -- ${shellQuote(argsJson)}`;
  
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
  if (!options.userId && !options.userEmail) {
    console.error("❌ Error: --email or --user-id is required for seed commands");
    console.error("   The user must already exist in Convex via the Clerk webhook");
    process.exit(1);
  }
  console.log(`\n🌱 Seeding database with ${options.leads} leads and ${options.events} events...\n`);
  runConvexAction("seedData", {
    leads: options.leads,
    events: options.events,
    userId: options.userId,
    userEmail: options.userEmail,
  }, options);
  console.log("\n✅ Seeding complete!");
}

function seedAll(options: Options): void {
  if (!options.yes) {
    console.log("\n⚠️  Warning: This will add seeded app data for every Clerk-synced Convex user.");
    console.log(`   New data per user: ${options.leads} leads, ${options.events} events\n`);
    console.log("   Run with --yes flag to skip this prompt.");
    process.exit(0);
  }

  console.log(`\n🌱 Seeding all synced users with ${options.leads} leads and ${options.events} events each...\n`);
  runConvexAction("seedAllData", {
    leads: options.leads,
    events: options.events,
    confirm: true,
  }, options);
  console.log("\n✅ Bulk seeding complete!");
}

function clear(options: Options): void {
  if (!options.userId && !options.userEmail) {
    console.error("❌ Error: --email or --user-id is required for clear commands");
    console.error("   This keeps clear/reset scoped to one Clerk-synced user");
    process.exit(1);
  }
  if (!options.yes) {
    console.log("\n⚠️  Warning: This will delete seeded app data for one user.");
    console.log("   This action cannot be undone.\n");
    console.log("   Run with --yes flag to skip this prompt.");
    process.exit(0);
  }
  
  console.log("\n🗑️  Clearing all mock data...\n");
  runConvexAction("clearData", {
    confirm: true,
    userId: options.userId,
    userEmail: options.userEmail,
  }, options);
  console.log("\n✅ Clear complete!");
}

function clearAll(options: Options): void {
  if (!options.yes) {
    console.log("\n⚠️  Warning: This will delete seeded app data for every Clerk-synced Convex user.");
    console.log("   This action cannot be undone.\n");
    console.log("   Run with --yes flag to skip this prompt.");
    process.exit(0);
  }

  console.log("\n🗑️  Clearing seeded app data for all synced users...\n");
  runConvexAction("clearAllUsersData", {
    confirm: true,
  }, options);
  console.log("\n✅ Bulk clear complete!");
}

function reset(options: Options): void {
  if (!options.userId && !options.userEmail) {
    console.error("❌ Error: --email or --user-id is required for reset commands");
    console.error("   The user must already exist in Convex via the Clerk webhook");
    process.exit(1);
  }
  if (!options.yes) {
    console.log("\n⚠️  Warning: This will delete seeded app data for one user,");
    console.log("   then create new mock data for that same user.");
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
    userEmail: options.userEmail,
  }, options);
  console.log("\n✅ Reset complete!");
}

function resetAll(options: Options): void {
  if (!options.yes) {
    console.log("\n⚠️  Warning: This will delete seeded app data for every Clerk-synced Convex user,");
    console.log("   then create new mock data for each of them.");
    console.log(`   New data per user: ${options.leads} leads, ${options.events} events\n`);
    console.log("   Run with --yes flag to skip this prompt.");
    process.exit(0);
  }

  console.log(`\n🔄 Resetting all synced users with ${options.leads} leads and ${options.events} events each...\n`);
  runConvexAction("resetAllData", {
    leads: options.leads,
    events: options.events,
    confirm: true,
  }, options);
  console.log("\n✅ Bulk reset complete!");
}

// Main
const { command, options } = parseArgs();

switch (command) {
  case "seed":
    seed(options);
    break;
  case "seed-all":
    seedAll(options);
    break;
  case "clear":
    clear(options);
    break;
  case "clear-all":
    clearAll(options);
    break;
  case "reset":
    reset(options);
    break;
  case "reset-all":
    resetAll(options);
    break;
  case "help":
  default:
    showHelp();
    break;
}
