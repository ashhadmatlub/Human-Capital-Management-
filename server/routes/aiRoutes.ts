import { Router } from 'express';
import { aiService } from '../services/aiService';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Ask the AI Assistant (Functionality 19)
router.post('/ai/chat', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt string is required.' });
      return;
    }

    const response = await aiService.handleChat(prompt, req.user!);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: 'AI processing failed. Please try again.' });
  }
});

// Smart Leave Parser (Functionality 21)
router.post('/ai/smart-leave', requireAuth, (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Sentence text is required.' });
      return;
    }

    const parsed = aiService.parseSmartLeave(text);
    res.json(parsed);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Dashboard AI Summary (Functionality 20)
router.post('/ai/summarize', requireAuth, (req, res) => {
  try {
    const { kpis } = req.body;
    if (!kpis) {
      res.status(400).json({ error: 'KPIs object is required.' });
      return;
    }

    const bullets = aiService.generateDashboardSummary(kpis);
    res.json({ bullets });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
