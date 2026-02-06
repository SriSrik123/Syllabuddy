import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { queryRAG } from '../services/ragPipeline';
import { chatCompletion } from '../services/azureAI';
import { AzureOpenAI } from 'openai';

const router = Router();

// POST /api/ai/chat
router.post('/chat', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { question, chatHistory = [] } = req.body;

    if (!question) {
      res.status(400).json({ error: 'Question is required' });
      return;
    }

    const userId = req.userId!;

    // Step 1: Query RAG for relevant chunks
    const relevantChunks = await queryRAG(userId, question, 6);

    if (relevantChunks.length === 0) {
      res.json({
        answer: "I don't have any syllabus information to reference yet. Please upload your syllabi first, and then I can answer questions about them.",
        sources: [],
      });
      return;
    }

    // Step 2: Build context from retrieved chunks
    const contextParts = relevantChunks.map((chunk, i) => 
      `[Source ${i + 1} - ${chunk.className}]:\n${chunk.text}`
    );
    const context = contextParts.join('\n\n---\n\n');

    // Step 3: Build system prompt
    const systemPrompt = `You are a helpful academic assistant for a college student. You answer questions based ONLY on the provided syllabus excerpts from the student's classes.

IMPORTANT RULES:
- Only use information from the provided syllabus excerpts below
- Always cite which class the information comes from (e.g., "According to your CS 101 syllabus...")
- If the information isn't in the provided excerpts, say so clearly
- Be concise but thorough
- If the question spans multiple classes, organize your answer by class
- For date-related questions, be specific about dates and deadlines

SYLLABUS EXCERPTS:
${context}`;

    // Step 4: Generate response
    const formattedHistory = chatHistory.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const answer = await chatCompletion(systemPrompt, question, formattedHistory);

    // Step 5: Compile unique sources
    const uniqueSources = [...new Set(relevantChunks.map(c => c.className))];

    res.json({
      answer,
      sources: uniqueSources,
    });
  } catch (err: any) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'Failed to generate response. Check your Azure AI configuration.' });
  }
});

// POST /api/ai/extract-assignments - parse text and extract assignments/events
router.post('/extract-assignments', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    if (!endpoint || !apiKey) {
      res.status(500).json({ error: 'Azure OpenAI credentials not configured' });
      return;
    }

    const azureClient = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion: '2024-08-01-preview',
    });

    const deploymentName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4o';

    const systemPrompt = `You are an expert at extracting assignments, deadlines, exams, quizzes, projects, and other academic tasks from student-provided text. The text may be copied from a course website, an email, a syllabus, lecture notes, or typed casually by the student.

Your job:
1. Extract every identifiable task or event.
2. Infer the course/class name if it's mentioned or can be determined from context. If not, use "General" as the class name.
3. Parse dates intelligently. The current year is ${new Date().getFullYear()}. If only a day of the week or relative date is given (e.g., "due Friday", "next Tuesday"), estimate the most likely upcoming date.
4. Identify the event type: assignment, exam, quiz, project, deadline, or other.

Return ONLY a valid JSON array. Each object must have this exact shape:
[
  {
    "title": "Homework 3",
    "description": "Chapters 4-5 problems",
    "date": "2026-02-13",
    "time": "23:59",
    "eventType": "assignment",
    "className": "CS 101"
  }
]

Rules:
- If a time is not specified, default to "23:59" for assignments/deadlines and "09:00" for exams/quizzes.
- eventType must be one of: exam, assignment, deadline, quiz, project, holiday, other
- Always return an array, even if it has one or zero items.
- Do NOT include any text outside the JSON array.`;

    const response = await azureClient.chat.completions.create({
      model: deploymentName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract all assignments and events from the following text:\n\n${text}` },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '[]';

    let extracted: any[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.error('Failed to parse AI response:', content);
    }

    res.json({ assignments: extracted });
  } catch (err: any) {
    console.error('Extract assignments error:', err);
    res.status(500).json({ error: 'Failed to extract assignments. Check your Azure AI configuration.' });
  }
});

export default router;
