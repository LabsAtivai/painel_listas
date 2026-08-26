import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = readFileSync(path.join(__dirname, "schema.sql"), "utf8");

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
  });

  try {
    await connection.query(sql);
    console.log("✔ schema.sql aplicado com sucesso");

    const [tables] = await connection.query("SHOW TABLES");
    console.log("Tabelas no banco:", tables.map((t) => Object.values(t)[0]));
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Erro ao aplicar schema:", err.message);
  process.exit(1);
});
