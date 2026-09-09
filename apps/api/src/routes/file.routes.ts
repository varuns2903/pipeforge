import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { File } from '../models/File';
import { MAX_USER_STORAGE_MB } from '../config/env';
import fs from 'fs';

const router = Router();
const uploadDir = path.join(__dirname, '../../../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const sanitizeFilename = (name: string) =>
  path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-200);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${sanitizeFilename(file.originalname)}`)
});

const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 50;
const MAX_USER_STORAGE_BYTES = MAX_USER_STORAGE_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.csv', '.json']);

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

router.post('/upload', requireAuth, (req: AuthRequest, res) => {
  upload.single('file')(req, res, async (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Storage quota is checked after the write (multer needs to see the file
    // to know its size) — if it pushes the user over quota, delete it again
    // rather than leaving an orphaned file with no File record.
    const { _sum } = (await File.aggregate([
      { $match: { ownerId: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: null, _sum: { $sum: '$size' } } }
    ]))[0] || { _sum: 0 };

    if (_sum + req.file.size > MAX_USER_STORAGE_BYTES) {
      fs.unlink(req.file.path, () => {});
      return res.status(413).json({
        error: `Uploading this file would exceed your ${MAX_USER_STORAGE_MB}MB storage quota.`
      });
    }

    await File.create({
      ownerId: req.user.id,
      filePath: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      size: req.file.size
    });

    const filePath = `/uploads/${req.file.filename}`;
    res.json({ filePath, originalName: req.file.originalname, size: req.file.size });
  });
});

export const fileRouter = router;
