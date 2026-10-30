import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthCells,shiftedMonth} from '../public/calendar.js';
test('calendar lays out Monday-first months, including leap days and six-week months',()=>{
  const leap=monthCells(2024,1);assert.equal(leap.filter(Boolean).length,29);assert.equal(leap[3],'2024-02-01');assert.equal(leap.filter(Boolean).at(-1),'2024-02-29');
  const six=monthCells(2025,2);assert.equal(six.length,42);assert.equal(six[5],'2025-03-01');assert.equal(new Set(six.filter(Boolean)).size,31);
  assert.equal(monthCells(2026,1).filter(Boolean).length,28);
});
test('calendar month navigation crosses year boundaries in both directions',()=>{assert.deepEqual(shiftedMonth(2026,11,1),[2027,0]);assert.deepEqual(shiftedMonth(2026,0,-1),[2025,11]);});
