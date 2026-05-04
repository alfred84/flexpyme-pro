import path from "node:path";
import process from "node:process";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as XLSX from "xlsx";
import { formats } from "@/db/schema";
import { buildFallbackClients, FORMAT_LABELS, PRICE_ROWS, PRODUCT_CATEGORIES } from "@/db/seed-data";

function parseExcelClients(excelPath: string): { code: string; name: string }[] {
  const workbook = XLSX.readFile(excelPath);
  const baseSheet = workbook.Sheets.Base;

  if (!baseSheet) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(baseSheet, { defval: "" });

  return rows
    .map((row, index) => {
      const candidateCode = String(row.HV ?? row.No ?? "").trim();
      const candidateName = String(row.Cliente ?? "").trim().replace(/\s+/g, " ");
      if (!candidateName) {
        return null;
      }

      const numericCode = /^\d+$/.test(candidateCode)
        ? candidateCode
        : String(index + 1).padStart(3, "0");

      return {
        code: numericCode.padStart(3, "0"),
        name: candidateName,
      };
    })
    .filter((entry): entry is { code: string; name: string } => entry !== null);
}

async function main() {
  const dbPath = path.resolve(process.cwd(), ".local/flexpyme.db");
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);

  const migrationsFolder = path.resolve(process.cwd(), "src/db/migrations");
  migrate(db, { migrationsFolder });

  const categoryIdByName = new Map<string, number>();
  const formatIdByLabel = new Map<string, number>();

  PRODUCT_CATEGORIES.forEach((categoryName, index) => {
    const id = index + 1;
    categoryIdByName.set(categoryName, id);
    sqlite
      .prepare(
        "INSERT INTO product_categories (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name",
      )
      .run(id, categoryName);
  });

  FORMAT_LABELS.forEach((formatLabel) => {
    sqlite.prepare("INSERT OR IGNORE INTO formats (label) VALUES (?)").run(formatLabel);
  });

  const formatRows = await db.select().from(formats);
  sqlite.prepare("DELETE FROM price_list").run();

  formatRows.forEach((row) => {
    formatIdByLabel.set(row.label, row.id);
  });

  const excelPath = path.resolve(process.cwd(), "data/Reporte___TOTAL.xlsx");
  const clientRows = fs.existsSync(excelPath) ? parseExcelClients(excelPath) : buildFallbackClients();

  for (const client of clientRows) {
    sqlite
      .prepare(
        "INSERT INTO clients (code, name) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name, updated_at = datetime('now')",
      )
      .run(client.code, client.name);
  }

  for (const row of PRICE_ROWS) {
    const categoryId = categoryIdByName.get(row.category);
    const formatId = row.format ? formatIdByLabel.get(row.format) : null;

    if (!categoryId) {
      continue;
    }

    if (row.format === null || formatId !== undefined) {
      sqlite
        .prepare(
          `
          INSERT INTO price_list (category_id, format_id, finish, service, price, cost, is_active)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `,
        )
        .run(categoryId, formatId ?? null, row.finish, row.service, row.price, row.cost);
    }
  }

  const clientsCount = sqlite.prepare("SELECT COUNT(*) as count FROM clients").get() as {
    count: number;
  };
  const categoriesCount = sqlite.prepare("SELECT COUNT(*) as count FROM product_categories").get() as {
    count: number;
  };
  const pricesCount = sqlite.prepare("SELECT COUNT(*) as count FROM price_list").get() as {
    count: number;
  };

  console.log("Seed completed", {
    dbPath,
    clientsCount: clientsCount.count,
    categoriesCount: categoriesCount.count,
    pricesCount: pricesCount.count,
    source: fs.existsSync(excelPath) ? "excel" : "fallback",
  });

  sqlite.close();
}

main().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
