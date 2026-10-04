export async function request(path, options = {}) {
  let response;
  try { response = await fetch(`/api${path}`, {headers: {'Content-Type': 'application/json'}, ...options, body: options.body ? JSON.stringify(options.body) : undefined}); }
  catch { throw new Error('Cannot reach PalForge. Check that the server is running. Your draft is still on this device.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The server could not complete this request. Try again.');
  return data;
}
export function history() { try { return JSON.parse(localStorage.getItem('palforge-history') || '[]'); } catch { return []; } }
export function remember(session, results) {
  results = results || session.results;
  const entry = {id: session._id, targetRole: session.targetRole, candidateName: session.candidateName, createdAt: session.createdAt, demo: session.demo, completed: Boolean(results), overallScore: results?.overallScore, weakest: results ? [...results.topicScores].sort((a, b) => a.score - b.score)[0]?.topic : ''};
  try { localStorage.setItem('palforge-history', JSON.stringify([entry, ...history().filter(e => e.id !== entry.id)].slice(0, 100))); } catch { /* Session is still persisted on the server. */ }
}
export function saveDraft(key, value) { try { localStorage.setItem(key, value); } catch { /* Browser storage can be disabled. */ } }
export function readDraft(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
export function clearDraft(key) { try { localStorage.removeItem(key); } catch { /* Optional cache. */ } }
