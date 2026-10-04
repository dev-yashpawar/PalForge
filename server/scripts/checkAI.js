import 'dotenv/config';
import {getAIConfiguration} from '../services/gemmaService.js';

const config = getAIConfiguration();
console.log(`Provider: ${config.provider}; model: ${config.model}`);
try {
  if (!config.configured) throw new Error(config.issue);
  const google = config.provider === 'google';
  const base = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '').replace(/\/api$/, '');
  const url = google ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}` : `${base}/api/tags`;
  const headers = google ? {'x-goog-api-key': process.env.GEMMA_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY} : process.env.OLLAMA_API_KEY ? {Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`} : {};
  const response = await fetch(url, {headers, signal: AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}. Check ${response.status === 404 ? 'GEMMA_MODEL' : response.status === 429 ? 'your quota' : 'the API key and model access'}.`);
  const data = await response.json();
  if (google && !data.supportedGenerationMethods?.includes('generateContent')) throw new Error('This model does not advertise generateContent support. Choose a text-generation Gemma model.');
  if (!google && !data.models?.some(model => model.name === config.model || model.model === config.model)) throw new Error('The configured model is not installed on the Ollama server. Pull it or change GEMMA_MODEL.');
  console.log('Provider connection and model lookup succeeded. No resume or answers were sent. Generation quota and output quality still need a real interview check.');
} catch (error) {
  console.error(error.name === 'TypeError' || error.name === 'TimeoutError' ? 'Cannot reach the AI provider. Check the server connection and provider URL.' : error.message);
  process.exitCode = 1;
}
