import express from 'express';
import { db } from '../services/firebase.js';

const router = express.Router();

// Get receipts for user
router.get('/', async (req, res) => {
  try {
    const { uid } = req.user;
    const { limit = 20 } = req.query;

    const receiptsRef = db.collection('receipts')
      .where('userId', '==', uid)
      .orderBy('date', 'desc')
      .limit(parseInt(limit));

    const snapshot = await receiptsRef.get();
    const receipts = [];

    snapshot.forEach(doc => {
      receipts.push({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate()
      });
    });

    res.json({ receipts });
  } catch (error) {
    console.error('Get receipts error:', error);
    res.status(500).json({ error: 'Failed to get receipts' });
  }
});

// Upload receipt for processing
router.post('/upload', async (req, res) => {
  try {
    const { uid } = req.user;
    const { imageUrl, storeInfo } = req.body;

    const receipt = {
      userId: uid,
      imageUrl,
      storeInfo,
      processingStatus: 'pending',
      rawOCRText: '',
      processedItems: [],
      totalAmount: 0,
      date: new Date(),
      createdAt: new Date()
    };

    const receiptRef = await db.collection('receipts').add(receipt);

    // TODO: Trigger OCR processing workflow
    // This would integrate with N8N workflow for receipt processing

    res.status(201).json({
      message: 'Receipt uploaded for processing',
      receipt: {
        id: receiptRef.id,
        ...receipt
      }
    });
  } catch (error) {
    console.error('Upload receipt error:', error);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

export default router;
