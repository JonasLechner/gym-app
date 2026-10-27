import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePlateLoads, formatPlateWeight, PLATE_SIZES } from './plates';

test('plate weights retain quarter kilograms without padding whole or half kilograms', () => {
  assert.deepEqual(PLATE_SIZES.map(formatPlateWeight), [
    '25',
    '20',
    '15',
    '10',
    '5',
    '2.5',
    '1.25',
  ]);
  assert.equal(formatPlateWeight(0), '0');
  assert.equal(formatPlateWeight(21.25), '21.25');
  assert.equal(formatPlateWeight(1.2500000000000002), '1.25');
});

test('a single pair of 1.25 kg plates displays its exact weight per side', () => {
  const load = calculatePlateLoads(22.5, 20).exact!;
  assert.equal(formatPlateWeight(load.total), '22.5');
  assert.equal(formatPlateWeight(load.perSide), '1.25');
  assert.equal(formatPlateWeight(load.plates[0]!.weight), '1.25');
});

test('quarter-kilogram custom bars and totals are preserved', () => {
  const load = calculatePlateLoads(3.75, 1.25).exact!;
  assert.equal(formatPlateWeight(load.total), '3.75');
  assert.equal(formatPlateWeight(load.perSide), '1.25');
});
