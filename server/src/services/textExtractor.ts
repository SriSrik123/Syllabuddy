export async function extractText(buffer: Buffer, fileType: string): Promise<string> {
  const ext = fileType.toLowerCase();

  if (ext === 'pdf') {
    return extractFromPdf(buffer);
  } else if (ext === 'docx') {
    return extractFromDocx(buffer);
  } else if (['png', 'jpg', 'jpeg'].includes(ext)) {
    return extractFromImage(buffer);
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v1 uses a simple function call
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractFromImage(_buffer: Buffer): Promise<string> {
  try {
    const Tesseract = await import('tesseract.js' as string);
    const result = await Tesseract.recognize(_buffer, 'eng');
    return result.data.text;
  } catch {
    return '[Image uploaded - OCR processing requires tesseract.js. Install with: npm install tesseract.js]';
  }
}
