export type { Database, Json, Tables, TablesInsert, TablesUpdate } from "./database.types";
import type { Json } from "./database.types";

/** Narrows an app-defined object shape (no index signature) to Postgres jsonb's Json type for insert/update calls. */
export function toJson(value: unknown): Json {
  return value as Json;
}
