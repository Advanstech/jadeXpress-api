const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const geminiKey = 'AIzaSyDjBz14Vi-LSujtr8syCJLmJxBnAvrC6LU';
  const genAI = new GoogleGenerativeAI(geminiKey);

  console.log("Listing available models...");
  try {
    // The SDK might not have a direct listModels, we can fetch it via REST.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
    const data = await response.json();
    if (data.models) {
      data.models.forEach(m => console.log(m.name, '-', m.supportedGenerationMethods));
    } else {
      console.log(data);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

listModels();
