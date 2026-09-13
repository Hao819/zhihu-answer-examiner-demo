import { counts, score } from './core.js';

export const HISTORY_STORAGE_KEY = 'zhihu-answer-examiner:reports:v1';
export const MAX_HISTORY_ITEMS = 30;

function text(value, max = 7000) {
  return String(value ?? '').trim().slice(0, max);
}

function safePoints(points) {
  return (Array.isArray(points) ? points : []).slice(0, 10).map((point) => ({
    id: text(point?.id, 80), title: text(point?.title, 300), label: text(point?.label, 80),
    status: text(point?.status, 30), user: text(point?.user, 1200), feedback: text(point?.feedback, 1800),
    quote: text(point?.quote, 1200), sourceTitle: text(point?.sourceTitle, 300), author: text(point?.author, 120),
    url: text(point?.url, 1000), sourceType: text(point?.sourceType, 80),
    sourceRelevance: Number.isFinite(point?.sourceRelevance) ? point.sourceRelevance : 0, prompt: text(point?.prompt, 600)
  }));
}

export function createReportRecord({ topic, mode = 'exam', answer = '', before = 0, points = [], createdAt = Date.now(), id = '' } = {}) {
  const safe = safePoints(points);
  const normalizedTopic = typeof topic === 'object'
    ? { id: text(topic.id, 80), title: text(topic.title, 300), tag: text(topic.tag, 100) }
    : { id: '', title: text(topic, 300), tag: '' };
  return {
    id: text(id, 100) || `report-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(), mode: mode === 'learn' ? 'learn' : 'exam',
    topic: normalizedTopic, answer: text(answer), before: Number.isFinite(before) ? before : 0,
    after: score(safe), counts: counts(safe), points: safe
  };
}

export function readHistory(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === 'object' && item.id && item.topic?.title && Array.isArray(item.points)).slice(0, MAX_HISTORY_ITEMS);
  } catch { return []; }
}

export function upsertHistory(records, record) {
  const current = Array.isArray(records) ? records : [];
  return [record, ...current.filter((item) => item?.id !== record?.id)].slice(0, MAX_HISTORY_ITEMS);
}

export function removeHistory(records, id) {
  return (Array.isArray(records) ? records : []).filter((item) => item?.id !== id);
}
