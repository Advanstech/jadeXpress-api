const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiOCR() {
  const geminiKey = 'AIzaSyDjBz14Vi-LSujtr8syCJLmJxBnAvrC6LU';
  const file1 = '/Users/nana/.gemini/antigravity-ide/brain/8c0f2de1-25cd-4d18-ad2e-d6bead4dee8b/.user_uploaded/media_1787834171226.jpg';
  
  if (!fs.existsSync(file1)) {
    console.log("File not found:", file1);
    return;
  }
  
  const base64Image = fs.readFileSync(file1, { encoding: 'base64' });
  const mimeType = 'image/jpeg';

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

  const prompt = `Extract the supplier invoice from this image into a clean JSON object ONLY (no markdown, no code blocks, no explanation). Use this exact shape:
{
  "vendor": "supplier or company name",
  "invoiceNumber": "invoice number",
  "date": "YYYY-MM-DD",
  "lineItems": [
    { "description": "product name", "quantity": 0, "unitCost": 0, "total": 0 }
  ],
  "subtotal": 0,
  "tax": 0,
  "total": 0
}
Return monetary values as integer Ghanaian pesewas (1 GHS = 100 pesewas). For a price of GH₵10.40, return 1040. If a value is missing, use 0 or an empty string.`;

  console.log("Sending payload to Gemini...");
  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType } }
    ]);
    const text = result.response.text();
    console.log("RAW OUTPUT:");
    console.log(text);
  } catch (err) {
    console.error("Error from Gemini:", err.message);
  }
}

testGeminiOCR();
