import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let db: Db | null = null;

// Lazy so the app can build without DATABASE_URL; it's only required
// once a request actually touches the database.
export function getDb(): Db {
  if (!db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set — add it to .env.local");
    }
    db = drizzle(neon(process.env.DATABASE_URL), { schema });
  }
  return db;
}
