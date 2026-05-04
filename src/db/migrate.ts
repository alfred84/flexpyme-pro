import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

/**
 * Applies pending Drizzle SQL migrations to `.local/flexpyme.db`.
 */
function main() {
  const dbPath = path.resolve(process.cwd(), ".local/flexpyme.db");
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");

  migrate(db, { migrationsFolder });
  sqlite.close();

  console.log("Migrations applied", { dbPath, migrationsFolder });
}

main();
