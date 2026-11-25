// Synthetic, process-local Mongo subset. No sockets, files, or provider calls.
type Row = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const field = (row: Row, key: string): any => key.split(".").reduce((v, part) => v?.[part], row);
function matches(row: Row, query: Row = {}): boolean {
  return Object.entries(query).every(([key, value]) => {
    if (key === "$or") return value.some((q: Row) => matches(row, q));
    if (key === "$and") return value.every((q: Row) => matches(row, q));
    if (key === "$expr") return Boolean(expression(value, row));
    const actual = field(row, key);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.entries(value).every(([operator, expected]: [string, any]) => {
        if (operator === "$exists") return (actual !== undefined) === expected;
        if (operator === "$ne") return actual !== expected;
        if (operator === "$gte") return actual >= expected;
        if (operator === "$lte") return actual <= expected;
        if (operator === "$gt") return actual > expected;
        if (operator === "$lt") return actual < expected;
        if (operator === "$in") return expected.includes(actual);
        throw new Error("Unsupported synthetic query operator: " + operator);
      });
    }
    return actual === value;
  });
}
function expression(value: any, row: Row): any {
  if (typeof value === "string" && value.startsWith("$")) return field(row, value.slice(1));
  if (!value || typeof value !== "object") return value;
  const [key, argument] = Object.entries(value)[0] as [string, any];
  if (key === "$or") return argument.some((item: any) => expression(item, row));
  if (key === "$eq") return expression(argument[0], row) === expression(argument[1], row);
  if (key === "$lt") return expression(argument[0], row) < expression(argument[1], row);
  if (key === "$type") return expression(argument, row) === undefined ? "missing" : typeof expression(argument, row);
  if (key === "$ifNull") return expression(argument[0], row) ?? expression(argument[1], row);
  throw new Error("Unsupported synthetic expression: " + key);
}
function projected(row: Row, projection?: Row): Row {
  if (!projection) return copy(row);
  const inclusive = Object.entries(projection).some(([k, v]) => k !== "_id" && v === 1);
  if (inclusive) {
    const result: Row = {};
    for (const [key, include] of Object.entries(projection)) if (include && row[key] !== undefined) result[key] = copy(row[key]);
    return result;
  }
  const result = copy(row);
  for (const [key, include] of Object.entries(projection)) if (!include) delete result[key];
  return result;
}
class Cursor {
  private projection?: Row;
  private maximum = Infinity;
  constructor(private values: Row[], options?: Row) { this.projection = options?.projection; }
  project(value: Row) { this.projection = value; return this; }
  sort(order: Row) {
    this.values.sort((a, b) => {
      for (const [key, direction] of Object.entries(order)) {
        if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * Number(direction);
      }
      return 0;
    });
    return this;
  }
  limit(value: number) { this.maximum = value; return this; }
  async toArray() { return this.values.slice(0, this.maximum).map(v => projected(v, this.projection)); }
  async next() { return (await this.toArray())[0] ?? null; }
}
export class MemoryMongo {
  private tables = new Map<string, Row[]>();
  databaseCalls = 0;
  operations: { collection: string; operation: string; query?: Row }[] = [];
  seed(name: string, rows: Row[]) { this.tables.set(name, copy(rows)); }
  rows(name: string) { return copy(this.tables.get(name) ?? []); }
  reset() { this.tables.clear(); this.operations = []; this.databaseCalls = 0; }
  private table(name: string) {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }
  collection(name: string) {
    const table = this.table(name);
    const note = (operation: string, query?: Row) => this.operations.push({ collection: name, operation, ...(query ? { query: copy(query) } : {}) });
    return {
      find: (query: Row = {}, options?: Row) => { note("find", query); return new Cursor(table.filter(row => matches(row, query)).map(copy), options); },
      findOne: async (query: Row, options?: Row) => { note("findOne", query); const found = table.find(row => matches(row, query)); return found ? projected(found, options?.projection) : null; },
      countDocuments: async (query: Row) => { note("countDocuments", query); return table.filter(row => matches(row, query)).length; },
      insertOne: async (row: Row) => {
        note("insertOne");
        const duplicate = table.some(existing => row.id && existing.id === row.id || name === "orders" && row.checkout_request_id && existing.guest_id === row.guest_id && existing.checkout_request_id === row.checkout_request_id || name === "payment_events" && existing.provider === row.provider && existing.provider_event_id === row.provider_event_id);
        if (duplicate) throw Object.assign(new Error("Synthetic unique-index violation"), { code: 11000 });
        table.push(copy(row));
        return { insertedId: row.id ?? table.length };
      },
      updateOne: async (query: Row, update: Row, options: Row = {}) => {
        note("updateOne", query);
        let found = table.find(row => matches(row, query));
        const inserted = !found && options.upsert;
        if (!found && !inserted) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        if (!found) {
          found = Object.fromEntries(Object.entries(query).filter(([k, v]) => !k.startsWith("$") && (v === null || typeof v !== "object")));
          table.push(found);
        }
        const before = JSON.stringify(found);
        Object.assign(found, copy(update.$set ?? {}));
        if (inserted) Object.assign(found, copy(update.$setOnInsert ?? {}));
        for (const [key, value] of Object.entries(update.$inc ?? {})) found[key] = (found[key] ?? 0) + Number(value);
        for (const key of Object.keys(update.$unset ?? {})) delete found[key];
        return { matchedCount: inserted ? 0 : 1, modifiedCount: before !== JSON.stringify(found) ? 1 : 0, upsertedCount: inserted ? 1 : 0 };
      },
      deleteOne: async (query: Row) => { note("deleteOne", query); const index = table.findIndex(row => matches(row, query)); if (index < 0) return { deletedCount: 0 }; table.splice(index, 1); return { deletedCount: 1 }; },
      deleteMany: async (query: Row) => { note("deleteMany", query); let count = 0; for (let i = table.length - 1; i >= 0; i--) if (matches(table[i], query)) { table.splice(i, 1); count++; } return { deletedCount: count }; },
      createIndex: async () => "synthetic-index",
      aggregate: () => { throw new Error("Aggregation is outside this synthetic harness subset"); },
    };
  }
  client = {
    startSession: () => ({
      withTransaction: async (callback: () => Promise<void>) => {
        const before = copy([...this.tables.entries()]);
        try { await callback(); } catch (error) { this.tables = new Map(before); throw error; }
      },
      endSession: async () => undefined,
    }),
  };
}
