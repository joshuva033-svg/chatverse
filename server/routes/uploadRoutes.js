import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';

import fs from 'node:fs';

const router = Router();
const uploadDirectory = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDirectory),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File upload failed.' });
  }

  const rawProtocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : req.protocol) || 'http';
  const host = req.get('host') || '';
  const protocol = host.includes('onrender.com') || host.includes('vercel.app') ? 'https' : rawProtocol;

  const url = `${protocol}://${host}/uploads/${req.file.filename}`;
  res.json({
    url,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

export default router;
