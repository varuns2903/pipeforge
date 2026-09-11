import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { File } from '../models/File';
import { User } from '../models/User';
import { MAX_FILE_SIZE_MB } from '../config/env';
import { getPlanLimits } from '../config/plans';
import { projectService } from '../services/project.service';
import { activityLogService } from '../services/activityLog.service';
import fs from 'fs';

// mergeParams: mounted at /api/projects/:projectId/files (see project.routes.ts),
// needs the parent router's :projectId in req.params.
const router = Router({ mergeParams: true });
const uploadDir = path.join(__dirname, '../../../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const sanitizeFilename = (name: string) =>
  path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-200);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${sanitizeFilename(file.originalname)}`)
});

const ALLOWED_EXTENSIONS = new Set(['.csv', '.json', '.xlsx', '.tsv', '.txt']);

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error('Only .csv and .json files are allowed'));
    }
    cb(null, true);
  }
});

router.post('/upload', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    // Checked before multer touches the request body — uploading is a
    // mutation, so this needs editor+ on the project, same as creating a
    // pipeline or connection.
    await projectService.getById(req.params.projectId as string, req.user.id, 'editor');
  } catch (err: any) {
    if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
    return next(err);
  }

  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Storage quota is checked after the write (multer needs to see the file
    // to know its size) — if it pushes the user over quota, delete it again
    // rather than leaving an orphaned file with no File record. Charged to
    // the uploader personally, not the project — see models/File.ts.
    const [{ _sum } = { _sum: 0 }, user] = await Promise.all([
      File.aggregate([
        { $match: { uploadedBy: new mongoose.Types.ObjectId(req.user.id) } },
        { $group: { _id: null, _sum: { $sum: '$size' } } }
      ]).then(r => r[0]),
      User.findById(req.user.id).select('plan')
    ]);

    const { maxStorageMB } = getPlanLimits(user?.plan);
    if (_sum + req.file.size > maxStorageMB * 1024 * 1024) {
      fs.unlink(req.file.path, () => {});
      return res.status(413).json({
        error: `Uploading this file would exceed your ${maxStorageMB}MB storage quota.`
      });
    }

    await File.create({
      projectId: req.params.projectId as string,
      uploadedBy: req.user.id,
      filePath: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      size: req.file.size
    });
    await activityLogService.log(
      req.params.projectId as string, req.user.id, 'file.uploaded',
      `Uploaded "${req.file.originalname}"`, { size: req.file.size }
    );

    const filePath = `/uploads/${req.file.filename}`;
    res.json({ filePath, originalName: req.file.originalname, size: req.file.size });
  });
});

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await projectService.getById(req.params.projectId as string, req.user.id, 'viewer');
    const files = await File.find({ projectId: req.params.projectId }).sort({ createdAt: -1 }).limit(200);
    res.json(files.map(f => ({
      id: f._id.toString(),
      filePath: f.filePath,
      originalName: f.originalName,
      size: f.size,
      createdAt: f.createdAt.toISOString(),
    })));
  } catch (err: any) {
    if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
    next(err);
  }
});

router.delete('/:fileId', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await projectService.getById(req.params.projectId as string, req.user.id, 'editor');

    const file = await File.findOneAndDelete({ _id: req.params.fileId, projectId: req.params.projectId });
    if (!file) return res.status(404).json({ error: 'File not found' });

    // path.basename strips any directory components a malformed filePath
    // might contain, so this can never unlink outside uploadDir.
    const diskPath = path.join(uploadDir, path.basename(file.filePath));
    fs.unlink(diskPath, () => {}); // best-effort — the File record is the source of truth for quota either way
    await activityLogService.log(
      req.params.projectId as string, req.user.id, 'file.deleted',
      `Deleted "${file.originalName}"`
    );

    res.status(204).send();
  } catch (err: any) {
    if (err.message === 'Project not found') return res.status(404).json({ error: err.message });
    next(err);
  }
});

export const fileRouter = router;
