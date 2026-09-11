import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { PipelineEngine } from '../src/engine.js';

const _dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(_dirname, '../../../uploads');
const singleSheetPath = path.join(uploadsDir, '__test_excelInput_single.xlsx');
const multiSheetPath = path.join(uploadsDir, '__test_excelInput_multi.xlsx');

describe('PipelineEngine excel-input', () => {
  const engine = new PipelineEngine();

  beforeAll(async () => {
    fs.mkdirSync(uploadsDir, { recursive: true });

    const single = new ExcelJS.Workbook();
    const sheet = single.addWorksheet('Sheet1');
    sheet.addRow(['name', 'age', 'country']);
    sheet.addRow(['Alice', 28, 'US']);
    sheet.addRow(['Bob', 17, 'UK']);
    await single.xlsx.writeFile(singleSheetPath);

    const multi = new ExcelJS.Workbook();
    const first = multi.addWorksheet('Totals');
    first.addRow(['label', 'value']);
    first.addRow(['ignored sheet', 0]);
    const second = multi.addWorksheet('Detail');
    second.addRow(['id', 'amount']);
    second.addRow([1, 100]);
    second.addRow([2, 200]);
    await multi.xlsx.writeFile(multiSheetPath);
  });

  afterAll(() => {
    for (const f of [singleSheetPath, multiSheetPath]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it('reads rows keyed by the first row as headers', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'excel-input', label: 'In', config: { filePath: '__test_excelInput_single.xlsx' } } }],
      edges: []
    };
    const result = await engine.execute(pipeline);
    expect(result['1']).toEqual([
      { name: 'Alice', age: 28, country: 'US' },
      { name: 'Bob', age: 17, country: 'UK' },
    ]);
  });

  it('reads a specific sheet by name when the workbook has multiple sheets', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'excel-input', label: 'In', config: { filePath: '__test_excelInput_multi.xlsx', sheetName: 'Detail' } } }],
      edges: []
    };
    const result = await engine.execute(pipeline);
    expect(result['1']).toEqual([
      { id: 1, amount: 100 },
      { id: 2, amount: 200 },
    ]);
  });

  it('defaults to the first sheet when no sheetName is given', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'excel-input', label: 'In', config: { filePath: '__test_excelInput_multi.xlsx' } } }],
      edges: []
    };
    const result = await engine.execute(pipeline);
    expect(result['1']).toEqual([{ label: 'ignored sheet', value: 0 }]);
  });

  it('throws a clear error for a sheet name that does not exist', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'excel-input', label: 'In', config: { filePath: '__test_excelInput_single.xlsx', sheetName: 'Nope' } } }],
      edges: []
    };
    await expect(engine.execute(pipeline)).rejects.toThrow(/Sheet not found/);
  });

  it('rejects a filePath outside the uploads directory', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'excel-input', label: 'In', config: { filePath: '../../../.env' } } }],
      edges: []
    };
    await expect(engine.execute(pipeline)).rejects.toThrow(/uploads directory/);
  });
});
