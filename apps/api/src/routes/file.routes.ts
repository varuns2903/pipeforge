import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.middleware';
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

router.post('/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const filePath = `/uploads/${req.file.filename}`;
    res.json({ filePath, originalName: req.file.originalname, size: req.file.size });
  });
});

export const fileRouter = router;
