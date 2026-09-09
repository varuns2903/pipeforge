import { describe, it, expect } from 'vitest';
import { compileFilterCondition } from '../src/safeFilter.js';

describe('compileFilterCondition', () => {
  const row = { age: 28, name: 'Alice', country: 'US', active: true };

  it('evaluates comparisons on row fields', () => {
    expect(compileFilterCondition('row.age >= 18')(row)).toBe(true);
    expect(compileFilterCondition('row.age < 18')(row)).toBe(false);
    expect(compileFilterCondition("row.country = 'US'")(row)).toBe(true);
    expect(compileFilterCondition("row.country = 'UK'")(row)).toBe(false);
  });

  it('supports bare field names without the row. prefix', () => {
    expect(compileFilterCondition('age >= 18')(row)).toBe(true);
  });

  it('supports AND / OR / NOT and parentheses', () => {
    expect(compileFilterCondition("row.age >= 18 AND row.country = 'US'")(row)).toBe(true);
    expect(compileFilterCondition("row.age >= 18 AND row.country = 'UK'")(row)).toBe(false);
    expect(compileFilterCondition("row.country = 'UK' OR row.age >= 18")(row)).toBe(true);
    expect(compileFilterCondition('NOT row.active')(row)).toBe(false);
    expect(compileFilterCondition("(row.age >= 18 AND row.country = 'UK') OR row.active")(row)).toBe(true);
  });

  it('does not execute arbitrary JavaScript', () => {
    const malicious = "row.constructor.constructor('return process')().exit()";
    expect(() => compileFilterCondition(malicious)()).toThrow();

    // Even syntactically-parseable attempts to reach globals just resolve to
    // undefined field access, never a call to real JS APIs.
    const looksLikeCall = 'row.age; console.log(1)';
    expect(() => compileFilterCondition(looksLikeCall)).toThrow();
  });

  it('throws on malformed conditions instead of silently passing', () => {
    expect(() => compileFilterCondition('row.age >=')).toThrow();
    expect(() => compileFilterCondition('((row.age >= 18')).toThrow();
  });
});
