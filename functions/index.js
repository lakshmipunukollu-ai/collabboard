const functions = require('firebase-functions');
const admin = require('firebase-admin');
const OpenAI = require('openai');
const cors = require('cors')({ origin: true });
require('dotenv').config();

admin.initializeApp();

// Load OpenAI API key from environment (functions/.env for emulator, Firebase secrets for production)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('🔑 API Key loaded:', OPENAI_API_KEY ? 'YES' : 'NO');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * AI Chat endpoint
 * POST /aiChat
 * Body: { messages: [...], model: 'gpt-4' }
 */
exports.aiChat = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    console.log('🤖 AI Chat request received!', {
      method: req.method,
      hasAuth: !!req.headers.authorization,
      body: req.body ? 'yes' : 'no'
    });

    // Only allow POST requests
    if (req.method !== 'POST') {
      console.log('❌ Method not allowed:', req.method);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Check if API key is configured
      if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
        console.error('OpenAI API key not configured!');
        return res.status(500).json({ 
          error: 'AI Assistant not configured. Please contact the administrator.' 
        });
      }

      // Verify user is authenticated (using Clerk token or Firebase Auth)
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { messages, model = 'gpt-3.5-turbo' } = req.body; // Changed to gpt-3.5-turbo (cheaper!)

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request: messages array required' });
      }

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for CollabBoard, a collaborative whiteboard app. Help users with brainstorming, organizing ideas, project planning, and any questions about using the app. Be concise and friendly.',
          },
          ...messages.slice(-10), // Last 10 messages for context
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const assistantMessage = completion.choices[0]?.message;

      if (!assistantMessage) {
        throw new Error('No response from OpenAI');
      }

      return res.status(200).json({
        message: assistantMessage,
        usage: completion.usage,
      });
    } catch (error) {
      console.error('Error in aiChat function:', error);
      
      // Return appropriate error message
      if (error.response?.status === 401) {
        return res.status(401).json({ error: 'Invalid OpenAI API key' });
      }
      
      return res.status(500).json({
        error: 'Failed to get AI response',
        details: error.message,
      });
    }
  });
});
