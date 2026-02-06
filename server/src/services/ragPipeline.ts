import Embedding from '../models/Embedding';
import { generateEmbedding, generateEmbeddings } from './azureAI';

// Split text into chunks with overlap
export function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  if (words.length <= chunkSize) {
    return [text];
  }

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// Index a syllabus: chunk, embed, and store in MongoDB
export async function indexSyllabus(
  userId: string,
  syllabusId: string,
  className: string,
  text: string
): Promise<number> {
  const chunks = chunkText(text);

  if (chunks.length === 0) return 0;

  // Generate embeddings for all chunks
  const embeddings = await generateEmbeddings(chunks);

  // Bulk insert all chunks with embeddings
  const docs = chunks.map((chunk, i) => ({
    userId,
    syllabusId,
    className,
    chunkIndex: i,
    text: chunk,
    vector: embeddings[i],
  }));

  await Embedding.insertMany(docs);

  return chunks.length;
}

// Remove all chunks for a given syllabus
export async function removeSyllabusFromIndex(userId: string, syllabusId: string): Promise<void> {
  await Embedding.deleteMany({ userId, syllabusId });
}

// Query the vector store and return relevant chunks
export async function queryRAG(
  userId: string,
  question: string,
  topK: number = 5
): Promise<Array<{ text: string; className: string; syllabusId: string; score: number }>> {
  // Get all embeddings for this user
  const allEmbeddings = await Embedding.find({ userId }).lean();

  if (allEmbeddings.length === 0) {
    return [];
  }

  // Embed the question
  const queryEmbedding = await generateEmbedding(question);

  // Compute similarity for each chunk
  const scored = allEmbeddings.map((emb) => ({
    text: emb.text,
    className: emb.className,
    syllabusId: emb.syllabusId.toString(),
    score: cosineSimilarity(queryEmbedding, emb.vector),
  }));

  // Sort by score descending and return top K
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}
