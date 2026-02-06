import { AzureOpenAI } from 'openai';

let client: AzureOpenAI | null = null;

function getClient(): AzureOpenAI {
  if (!client) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;

    if (!endpoint || !apiKey) {
      throw new Error('Azure OpenAI credentials not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in .env');
    }

    client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion: '2024-08-01-preview',
    });
  }
  return client;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const azureClient = getClient();
  const deploymentName = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small';

  const response = await azureClient.embeddings.create({
    model: deploymentName,
    input: text,
  });

  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const azureClient = getClient();
  const deploymentName = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small';

  // Process in batches of 16
  const batchSize = 16;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await azureClient.embeddings.create({
      model: deploymentName,
      input: batch,
    });
    allEmbeddings.push(...response.data.map(d => d.embedding));
  }

  return allEmbeddings;
}

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string> {
  const azureClient = getClient();
  const deploymentName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4o';

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
    { role: 'user', content: userMessage },
  ];

  const response = await azureClient.chat.completions.create({
    model: deploymentName,
    messages,
    temperature: 0.3,
    max_tokens: 2000,
  });

  return response.choices[0]?.message?.content || 'No response generated.';
}

export async function extractDatesFromText(text: string, className: string): Promise<Array<{
  title: string;
  description: string;
  date: string;
  time: string;
  eventType: string;
}>> {
  const azureClient = getClient();
  const deploymentName = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4o';

  const systemPrompt = `You are an expert at extracting important dates and deadlines from academic syllabi. 
Extract ALL important dates including exams, assignments, project deadlines, quizzes, presentations, holidays, and any other dated events.

Return ONLY a valid JSON array with objects in this exact format:
[
  {
    "title": "Midterm Exam",
    "description": "Covers chapters 1-5",
    "date": "2026-03-15",
    "time": "09:00",
    "eventType": "exam"
  }
]

Valid eventType values: exam, assignment, deadline, quiz, project, holiday, other

If no dates are found, return an empty array: []
Do NOT include any text outside the JSON array.`;

  const userMessage = `Extract all important dates from this ${className} syllabus:\n\n${text}`;

  const response = await azureClient.chat.completions.create({
    model: deploymentName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.1,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || '[]';

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch {
    console.error('Failed to parse dates JSON:', content);
    return [];
  }
}
