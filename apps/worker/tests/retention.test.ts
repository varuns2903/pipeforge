import { describe, it, expect, vi, beforeEach } from 'vitest';

const fakeFileModel = vi.hoisted(() => ({
  find: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock('mongoose', () => ({
  default: {
    model: vi.fn(() => fakeFileModel),
    Schema: vi.fn().mockImplementation(function (this: any) { return this; }),
  },
}));

vi.mock('fs', () => ({
  default: { promises: { unlink: vi.fn().mockResolvedValue(undefined) } },
}));

import fs from 'fs';
import { runRetentionSweep } from '../src/retention';

describe('runRetentionSweep', () => {
  beforeEach(() => {
    fakeFileModel.find.mockReset();
    fakeFileModel.deleteMany.mockReset();
    (fs.promises.unlink as any).mockClear();
  });

  it('deletes only finished (COMPLETED/FAILED) executions older than the retention window', async () => {
    const executionModel = { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 3 }) };
    fakeFileModel.find.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
    fakeFileModel.deleteMany.mockResolvedValue({ deletedCount: 0 });

    const result = await runRetentionSweep({
      executionModel: executionModel as any,
      executionRetentionDays: 90,
      fileRetentionDays: 180,
    });

    expect(executionModel.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $in: ['COMPLETED', 'FAILED'] },
        createdAt: { $lt: expect.any(Date) },
      })
    );
    expect(result.executionsDeleted).toBe(3);
  });

  it('best-effort unlinks each old file\'s disk path before deleting its record, skipping rows with no filePath', async () => {
    const executionModel = { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }) };
    fakeFileModel.find.mockReturnValue({
      select: vi.fn().mockResolvedValue([{ filePath: '/uploads/real-file.csv' }, { filePath: null }]),
    });
    fakeFileModel.deleteMany.mockResolvedValue({ deletedCount: 2 });

    const result = await runRetentionSweep({
      executionModel: executionModel as any,
      executionRetentionDays: 90,
      fileRetentionDays: 180,
    });

    expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
    expect((fs.promises.unlink as any).mock.calls[0][0]).toMatch(/real-file\.csv$/);
    expect(result.filesDeleted).toBe(2);
  });

  it('never touches PENDING/RUNNING executions regardless of age (not in the status filter)', async () => {
    const executionModel = { deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }) };
    fakeFileModel.find.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
    fakeFileModel.deleteMany.mockResolvedValue({ deletedCount: 0 });

    await runRetentionSweep({ executionModel: executionModel as any, executionRetentionDays: 1, fileRetentionDays: 1 });

    const filter = executionModel.deleteMany.mock.calls[0][0];
    expect(filter.status.$in).not.toContain('PENDING');
    expect(filter.status.$in).not.toContain('RUNNING');
  });
});
