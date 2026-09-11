import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { parsePageParams, toPage } from '../src/utils/pagination';

describe('parsePageParams', () => {
  it('defaults to no cursor and the default limit when the query is empty', () => {
    expect(parsePageParams({})).toEqual({ limit: 50, cursor: undefined });
  });

  it('respects a custom default/max limit', () => {
    expect(parsePageParams({}, 10, 20)).toEqual({ limit: 10, cursor: undefined });
  });

  it('parses a valid numeric limit', () => {
    expect(parsePageParams({ limit: '25' })).toEqual({ limit: 25, cursor: undefined });
  });

  it('clamps a limit above the max', () => {
    expect(parsePageParams({ limit: '9999' }, 50, 100)).toEqual({ limit: 100, cursor: undefined });
  });

  it('clamps a limit below 1', () => {
    expect(parsePageParams({ limit: '0' })).toEqual({ limit: 1, cursor: undefined });
    expect(parsePageParams({ limit: '-5' })).toEqual({ limit: 1, cursor: undefined });
  });

  it('falls back to the default limit for a non-numeric value', () => {
    expect(parsePageParams({ limit: 'not-a-number' })).toEqual({ limit: 50, cursor: undefined });
  });

  it('parses a valid ObjectId cursor', () => {
    const id = new mongoose.Types.ObjectId();
    const { cursor } = parsePageParams({ cursor: id.toString() });
    expect(cursor?.toString()).toBe(id.toString());
  });

  it('ignores an invalid cursor rather than erroring', () => {
    expect(parsePageParams({ cursor: 'not-an-object-id' }).cursor).toBeUndefined();
    expect(parsePageParams({ cursor: 12345 }).cursor).toBeUndefined();
  });
});

describe('toPage', () => {
  const makeDocs = (n: number) => Array.from({ length: n }, () => ({ _id: new mongoose.Types.ObjectId() }));

  it('returns all items and a null cursor when there are fewer than limit+1', () => {
    const docs = makeDocs(3);
    const { items, nextCursor } = toPage(docs, 5);
    expect(items).toHaveLength(3);
    expect(nextCursor).toBeNull();
  });

  it('returns exactly limit items and a null cursor when there are exactly limit', () => {
    const docs = makeDocs(5);
    const { items, nextCursor } = toPage(docs, 5);
    expect(items).toHaveLength(5);
    expect(nextCursor).toBeNull();
  });

  it('drops the extra doc and returns a cursor when there are more than limit', () => {
    const docs = makeDocs(6);
    const { items, nextCursor } = toPage(docs, 5);
    expect(items).toHaveLength(5);
    expect(items).toEqual(docs.slice(0, 5));
    expect(nextCursor).toBe(docs[4]._id.toString());
  });
});
