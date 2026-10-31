import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync('site10-dashboard/data-api.js','utf8');
assert.match(source, /function escapeHTML\(/);
assert.match(source, /\$\{escapeHTML\(t\.name\)\}/);
assert.match(source, /\$\{escapeHTML\(t\.broker\)\}/);
assert.match(source, /\$\{escapeHTML\(JSON\.stringify\(t\.data\)\.substring\(0,50\)\)\}/);
assert.match(source, /function safeRating\(/);
console.log('Dashboard unsafe insertion regression checks passed');
