import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import Syllabus from '../models/Syllabus';
import CalendarEvent from '../models/CalendarEvent';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { extractText } from '../services/textExtractor';
import { indexSyllabus, removeSyllabusFromIndex } from '../services/ragPipeline';
import { extractDatesFromText } from '../services/azureAI';

const router = Router();

// Use memory storage instead of disk
const storage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.pdf', '.docx', '.png', '.jpg', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} not supported. Allowed: PDF, DOCX, PNG, JPG`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// POST /api/syllabus/upload
router.post('/upload', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { className } = req.body;
    if (!className) {
      res.status(400).json({ error: 'Class name is required' });
      return;
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase().slice(1);
    const fileBuffer = req.file.buffer;

    // Extract text from file buffer
    let extractedText = '';
    try {
      extractedText = await extractText(fileBuffer, fileExt);
    } catch (err: any) {
      console.error('Text extraction error:', err);
      extractedText = '[Text extraction failed]';
    }

    // Save syllabus to MongoDB (including file binary)
    const syllabus = new Syllabus({
      userId: req.userId,
      className,
      fileName: req.file.originalname,
      fileType: fileExt,
      fileData: fileBuffer,
      extractedText,
    });
    await syllabus.save();

    const syllabusId = syllabus._id.toString();
    const userId = req.userId!;

    // Index in RAG pipeline (synchronous - wait for it)
    let chunksIndexed = 0;
    console.log(`Extracted text length: ${extractedText.length}, first 200 chars: ${extractedText.substring(0, 200)}`);
    if (extractedText && extractedText !== '[Text extraction failed]') {
      try {
        chunksIndexed = await indexSyllabus(userId, syllabusId, className, extractedText);
        console.log(`Indexed ${chunksIndexed} chunks for syllabus ${syllabusId}`);
      } catch (err: any) {
        console.error('RAG indexing error:', err?.message || err);
        console.error('RAG indexing full error:', JSON.stringify(err, null, 2));
      }
    } else {
      console.log('Skipping RAG indexing - no extracted text or extraction failed');
    }

    // Extract dates (synchronous - wait for it)
    let datesExtracted = 0;
    if (extractedText && extractedText !== '[Text extraction failed]') {
      try {
        const dates = await extractDatesFromText(extractedText, className);
        if (dates.length > 0) {
          const events = dates.map(d => ({
            userId,
            syllabusId,
            title: d.title,
            description: d.description,
            date: new Date(d.date),
            time: d.time || '09:00',
            eventType: d.eventType,
            className,
          }));
          await CalendarEvent.insertMany(events);
          datesExtracted = dates.length;
          console.log(`Extracted ${datesExtracted} dates from syllabus ${syllabusId}`);
        }
      } catch (err) {
        console.error('Date extraction error:', err);
      }
    }

    res.status(201).json({
      id: syllabus._id,
      className: syllabus.className,
      fileName: syllabus.fileName,
      fileType: syllabus.fileType,
      uploadedAt: syllabus.uploadedAt,
      textLength: extractedText.length,
      chunksIndexed,
      datesExtracted,
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload syllabus' });
  }
});

// GET /api/syllabus - list all syllabi for user (without file data)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const syllabi = await Syllabus.find({ userId: req.userId })
      .select('-extractedText -fileData')
      .sort({ uploadedAt: -1 });

    res.json(syllabi);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch syllabi' });
  }
});

// GET /api/syllabus/:id - get specific syllabus (without file data)
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const syllabus = await Syllabus.findOne({ _id: req.params.id, userId: req.userId })
      .select('-fileData');
    if (!syllabus) {
      res.status(404).json({ error: 'Syllabus not found' });
      return;
    }
    res.json(syllabus);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch syllabus' });
  }
});

// DELETE /api/syllabus/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const syllabus = await Syllabus.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!syllabus) {
      res.status(404).json({ error: 'Syllabus not found' });
      return;
    }

    // Remove from vector store (MongoDB embeddings)
    try {
      await removeSyllabusFromIndex(req.userId!, syllabus._id.toString());
    } catch (err) {
      console.error('Error removing embeddings:', err);
    }

    // Remove associated calendar events
    await CalendarEvent.deleteMany({ syllabusId: syllabus._id });

    res.json({ message: 'Syllabus deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete syllabus' });
  }
});

export default router;
