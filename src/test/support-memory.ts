// Process-local MongoDB subset for support tests. No networking or external state.
// Transactions model rollback, not replica-set isolation or transaction retries.
type Row = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);
const less = (left: unknown, right: unknown) =>
  (typeof left === "string" && typeof right === "string" && left < right) ||
  (typeof left === "number" && typeof right === "number" && left < right);

function matches(row: Row, query: Row = {}): boolean {
  return Object.entries(query).every(([key, value]) => {
    if (key === "$or" && Array.isArray(value)) return value.some((part) => matches(row, part));
    if (key === "$and" && Array.isArray(value)) return value.every((part) => matches(row, part));
    const actual = row[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.entries(value).every(([operator, expected]) => {
        if (operator === "$exists") return (actual !== undefined) === expected;
        if (operator === "$ne") return actual !== expected;
        if (operator === "$lt") return less(actual, expected);
        if (operator === "$lte") return actual === expected || less(actual, expected);
        if (operator === "$gt") return less(expected, actual);
        if (operator === "$gte") return actual === expected || less(expected, actual);
        if (operator === "$in" && Array.isArray(expected)) return expected.includes(actual);
        throw new Error(`Unsupported synthetic operator: ${operator}`);
      });
    }
    return actual === value;
  });
}

class Cursor {
  private maximum = Infinity;
  constructor(private values: Row[]) {}
  sort(order: Record<string, number>) {
    this.values.sort((left, right) => {
      for (const [key, direction] of Object.entries(order)) {
        if (left[key] !== right[key]) return (less(left[key], right[key]) ? -1 : 1) * direction;
      }
      return 0;
    });
    return this;
  }
  limit(maximum: number) {
    this.maximum = maximum;
    return this;
  }
  async toArray() {
    return clone(this.values.slice(0, this.maximum));
  }
}

export class SupportMemoryMongo {
  private tables = new Map<string, Row[]>();
  private sequence = 0;
  operations: { collection: string; operation: string }[] = [];
  seed(name: string, rows: Row[]) {
    this.tables.set(name, clone(rows));
  }
  rows(name: string) {
    return clone(this.tables.get(name) ?? []);
  }
  private table(name: string) {
    let rows = this.tables.get(name);
    if (!rows) {
      rows = [];
      this.tables.set(name, rows);
    }
    return rows;
  }
  collection(name: string) {
    const note = (operation: string) => this.operations.push({ collection: name, operation });
    return {
      find: (query: Row = {}) => {
        note("find");
        return new Cursor(
          this.table(name)
            .filter((row) => matches(row, query))
            .map(clone),
        );
      },
      findOne: async (query: Row) => {
        note("findOne");
        return clone(this.table(name).find((row) => matches(row, query)) ?? null);
      },
      countDocuments: async (query: Row) => {
        note("countDocuments");
        return this.table(name).filter((row) => matches(row, query)).length;
      },
      insertOne: async (row: Row) => {
        note("insertOne");
        const stored = { ...clone(row), _id: row._id ?? `synthetic-${++this.sequence}` };
        if (this.table(name).some((existing) => existing._id === stored._id)) {
          throw Object.assign(new Error("Synthetic primary-key conflict"), { code: 11000 });
        }
        this.table(name).push(stored);
        return { insertedId: stored._id };
      },
      updateOne: async (query: Row, update: Row, options: { upsert?: boolean } = {}) => {
        note("updateOne");
        let row = this.table(name).find((candidate) => matches(candidate, query));
        const inserted = !row && options.upsert;
        if (!row && !inserted) return { matchedCount: 0, modifiedCount: 0 };
        if (!row) {
          row = Object.fromEntries(
            Object.entries(query).filter(
              ([key, value]) =>
                !key.startsWith("$") && (value === null || typeof value !== "object"),
            ),
          );
          this.table(name).push(row);
        }
        const before = JSON.stringify(row);
        Object.assign(row, clone(update.$set ?? {}));
        for (const [key, value] of Object.entries(update.$inc ?? {}))
          row[key] = Number(row[key] ?? 0) + Number(value);
        for (const key of Object.keys(update.$unset ?? {})) delete row[key];
        return {
          matchedCount: inserted ? 0 : 1,
          modifiedCount: before === JSON.stringify(row) ? 0 : 1,
        };
      },
    };
  }
  client = {
    startSession: () => ({
      withTransaction: async <T>(callback: () => Promise<T>): Promise<T> => {
        const snapshot = clone([...this.tables]);
        try {
          return await callback();
        } catch (error) {
          this.tables = new Map(snapshot);
          throw error;
        }
      },
      endSession: async () => undefined,
    }),
  };
}
