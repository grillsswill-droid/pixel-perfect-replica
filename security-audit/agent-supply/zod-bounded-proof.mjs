// Audit-only bounded parser test; no network, database or application side effects.
import assert from 'node:assert/strict';
import { z } from 'zod';

let visited = 0;
const element = z.preprocess((value) => { visited += 1; return value; }, z.string().max(1));
const schema = z.array(element).max(2);
const result = schema.safeParse(Array.from({ length: 1000 }, () => 'xx'));
assert.equal(result.success, false);
assert.equal(visited, 1000);
assert.equal(result.error.issues.length, 1001);

const selections = z.record(z.array(z.string().max(40)).max(10));
const manyKeys = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`g${i}`, []]));
assert.equal(selections.safeParse(manyKeys).success, true);

console.log(JSON.stringify({
  test: 'bounded Zod collection processing and application-equivalent selections',
  input_elements: 1000,
  collection_maximum: 2,
  rejected: true,
  visited_elements: visited,
  allocated_validation_issues: result.error.issues.length,
  accepted_selection_record_keys: Object.keys(manyKeys).length,
  limitation: 'Demonstrates mechanism with bounded input; does not perform memory exhaustion or service denial.',
}));
