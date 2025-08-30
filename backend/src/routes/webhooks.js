import express from 'express';
import webhookService from '../services/webhookService.js';

const router = express.Router();

// Test webhook endpoint
router.post('/test', async (req, res) => {
  try {
    const { eventType, data, metadata } = req.body;
    
    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    const result = await webhookService.sendCustomEvent(
      eventType, 
      data || {}, 
      req.user, 
      metadata || {}
    );

    res.json({
      message: 'Test webhook sent successfully',
      eventType,
      result
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: 'Failed to send test webhook' });
  }
});

// Get webhook configuration status
router.get('/status', async (req, res) => {
  try {
    const status = {
      enabled: webhookService.enabled,
      configured: !!webhookService.n8nWebhookUrl,
      webhookUrl: webhookService.n8nWebhookUrl ? 'configured' : 'not configured'
    };

    res.json(status);
  } catch (error) {
    console.error('Webhook status error:', error);
    res.status(500).json({ error: 'Failed to get webhook status' });
  }
});

// Send custom event
router.post('/event', async (req, res) => {
  try {
    const { eventType, data, metadata } = req.body;
    
    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    const result = await webhookService.sendCustomEvent(
      eventType, 
      data || {}, 
      req.user, 
      metadata || {}
    );

    res.json({
      message: 'Custom event sent successfully',
      eventType,
      result
    });
  } catch (error) {
    console.error('Custom event error:', error);
    res.status(500).json({ error: 'Failed to send custom event' });
  }
});

export default router;
