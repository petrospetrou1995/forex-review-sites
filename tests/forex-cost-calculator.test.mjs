import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateCost } from '../site1-dark-gradient/tools/forex-cost-calculator/cost-model.mjs';
test('round trip spread and commission',()=>{const c=estimateCost({lots:1,pipValue:10,spread:1,commission:3.5,swap:0,nights:0,other:0});assert.equal(c.total,17)});
test('fractional lots and financing credit',()=>{const c=estimateCost({lots:0.5,pipValue:10,spread:0.2,commission:3,swap:2,nights:2,other:1});assert.equal(c.total,1)});
test('negative swap is financing cost',()=>{const c=estimateCost({lots:1,pipValue:10,spread:0,commission:0,swap:-3,nights:3,other:0});assert.equal(c.total,9)});
test('invalid inputs rejected',()=>{assert.throws(()=>estimateCost({lots:0,pipValue:10,spread:1,commission:0,swap:0,nights:0,other:0}));assert.throws(()=>estimateCost({lots:1,pipValue:10,spread:-1,commission:0,swap:0,nights:0,other:0}));assert.throws(()=>estimateCost({lots:1,pipValue:10,spread:1,commission:0,swap:0,nights:1.5,other:0}))});
