import path from "node:path";
import process from "node:process";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as XLSX from "xlsx";
import { formats } from "@/db/schema";
import {
  buildCostRows,
  buildFallbackClients,
  CATEGORY_LABELS,
  FORMAT_LABELS,
  PRICE_ROWS,
  PRODUCT_CATEGORIES,
  SETTINGS_SEED,
} from "@/db/seed-data";

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
        "INSERT INTO product_categories (id, name, label_es) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, label_es = excluded.label_es",
      )
      .run(id, categoryName, CATEGORY_LABELS[categoryName] ?? categoryName);
  });

  FORMAT_LABELS.forEach((formatLabel) => {
    sqlite.prepare("INSERT OR IGNORE INTO formats (label) VALUES (?)").run(formatLabel);
  });

  sqlite
    .prepare(
      "INSERT OR IGNORE INTO formats (label, width_inches, height_inches, is_active, is_system) VALUES (?, 0, 0, 1, 1)",
    )
    .run("Sin formato");

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

  sqlite.prepare("DELETE FROM cost_list").run();
  for (const row of buildCostRows()) {
    const formatId = formatIdByLabel.get(row.format);
    if (formatId === undefined) {
      continue;
    }
    sqlite
      .prepare(
        "INSERT INTO cost_list (work_type, format_id, unit_cost, is_active) VALUES (?, ?, ?, 1)",
      )
      .run(row.workType, formatId, row.unitCost);
  }

  const defaultRoles = [
    { name: "Laminador", description: "Trabajo de laminado de impresiones" },
    { name: "Enmarcador", description: "Trabajo de enmarcado de fotos" },
    { name: "Impresor", description: "Trabajo de impresión" },
    { name: "Recepcionista", description: "Recepción de pedidos y atención al cliente" },
    { name: "Otro", description: "Rol no clasificado" },
  ];
  for (const role of defaultRoles) {
    sqlite
      .prepare("INSERT OR IGNORE INTO employee_roles (name, description) VALUES (?, ?)")
      .run(role.name, role.description);
  }

  for (const [key, value] of Object.entries(SETTINGS_SEED)) {
    sqlite
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
      )
      .run(key, value);
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
  const costsCount = sqlite.prepare("SELECT COUNT(*) as count FROM cost_list").get() as {
    count: number;
  };

  console.log("Seed completed", {
    dbPath,
    clientsCount: clientsCount.count,
    categoriesCount: categoriesCount.count,
    pricesCount: pricesCount.count,
    costsCount: costsCount.count,
    source: fs.existsSync(excelPath) ? "excel" : "fallback",
  });

  sqlite.close();
}

main().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
