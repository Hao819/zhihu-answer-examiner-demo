export function normalizeSearchResponse(payload) {
  const items = payload?.Data?.Items || payload?.data?.items || [];
  return items.map((item) => ({
    title: item.Title || item.title || '知乎内容',
    author: item.AuthorName || item.author || '未知作者',
    quote: item.ContentText || item.Content || item.summary || '',
    url: item.Url || item.url || '',
    contentType: item.ContentType || item.contentType || 'Answer',
    voteCount: Number.isFinite(item.VoteUpCount) ? item.VoteUpCount : undefined,
    commentCount: Number.isFinite(item.CommentCount) ? item.CommentCount : undefined
  })).filter((item) => item.url);
}

export const SOURCE_TYPE_SEARCH = '真实搜索摘要';
export const SOURCE_TYPE_FIXTURE = '离线演示资料';

// 主题级门槛：只拦「完全跑题」的结果，精准判断交给知识点级门槛。
export const TOPIC_THRESHOLD = 0.08;
// 知识点级门槛：来源必须与该论点实质重合，否则该点保留离线资料。
// 实测真实噪声误配分布在 0.10~0.22，正确匹配在 0.55 以上，取 0.3 分隔。
export const POINT_THRESHOLD = 0.3;

const STOPWORDS = new Set([
  '的', '了', '是', '在', '和', '与', '吗', '呢', '吧', '我', '你', '他', '会', '要', '对',
  '就', '都', '也', '很', '有', '这', '那', '怎么', '什么', '如何', '应该', '可以', '一个',
  '为什么', '知乎', '一些', '我们', '他们', '不是', '没有', '这个', '那个', '以及', '还是',
  'com', 'www', 'http', 'https'
]);

/**
 * 中文没有空格分词，这里用「英文词 + 中文 bigram」构造可比较的词集合。
 * bigram 对短标题和长摘要都稳定，不引入额外依赖。
 */
export function tokenize(text) {
  const lower = String(text ?? '').toLowerCase();
  const tokens = new Set();
  for (const word of lower.match(/[a-z0-9][a-z0-9+#.]*/g) || []) {
    if (word.length >= 2 && !STOPWORDS.has(word)) tokens.add(word);
  }
  for (const seg of lower.replace(/[^\u4e00-\u9fa5]+/g, ' ').split(' ')) {
    if (seg.length < 2) continue;
    for (let i = 0; i + 2 <= seg.length; i += 1) {
      const bigram = seg.slice(i, i + 2);
      if (!STOPWORDS.has(bigram)) tokens.add(bigram);
    }
  }
  return tokens;
}

/** 覆盖率：查询词有多少比例出现在来源文本中。0 表示完全无关。 */
export function relevance(queryTokens, docTokens) {
  if (!queryTokens.size) return 0;
  let hit = 0;
  for (const token of queryTokens) if (docTokens.has(token)) hit += 1;
  return hit / queryTokens.size;
}

function sourceTokens(source) {
  // 摘要过长会稀释判断，取前 200 字参与匹配即可。
  return tokenize(`${source.title || ''} ${(source.quote || '').slice(0, 200)}`);
}

function pointQuery(point) {
  const terms = Array.isArray(point.matchTerms) ? point.matchTerms.join(' ') : '';
  return tokenize(`${point.title || ''} ${point.label || ''} ${terms}`);
}

/**
 * 过滤掉与主题无关的检索结果，返回带 topicRelevance 的候选列表（降序）。
 */
export function filterByTopic(sources, topicText, threshold = TOPIC_THRESHOLD) {
  const topicTokens = tokenize(topicText);
  if (!topicTokens.size) return [];
  return sources
    .map((source) => ({ source, topicRelevance: relevance(topicTokens, sourceTokens(source)) }))
    .filter((entry) => entry.topicRelevance >= threshold)
    .sort((a, b) => b.topicRelevance - a.topicRelevance);
}

/**
 * 按相关性把检索结果绑定到知识点：
 * - 先做主题级过滤，剔除完全跑题的结果；
 * - 再按「知识点 ↔ 来源」相关性贪心独占分配，避免一条来源被反复套用；
 * - 匹配不上的知识点保留离线 fixture 来源，并标注为演示资料。
 * 不再使用 index % sources.length 轮换，防止把无关回答标成某个论点的证据。
 */
export function attachSources(points, sources = [], options = {}) {
  const topicText = options.topic || '';
  const pointThreshold = options.pointThreshold ?? POINT_THRESHOLD;
  const candidates = topicText
    ? filterByTopic(sources, topicText, options.topicThreshold ?? TOPIC_THRESHOLD)
    : sources.map((source) => ({ source, topicRelevance: 1 }));

  const fallbackAll = () => points.map((point) => ({
    ...point,
    sourceType: SOURCE_TYPE_FIXTURE,
    sourceFallback: true,
    sourceRelevance: 0
  }));

  if (!candidates.length) return fallbackAll();

  const pairs = [];
  points.forEach((point, pointIndex) => {
    const query = pointQuery(point);
    candidates.forEach((candidate, sourceIndex) => {
      const pointRelevance = relevance(query, sourceTokens(candidate.source));
      if (pointRelevance >= pointThreshold) pairs.push({ pointIndex, sourceIndex, pointRelevance });
    });
  });

  pairs.sort((a, b) => b.pointRelevance - a.pointRelevance);
  const usedPoints = new Set();
  const usedSources = new Set();
  const assigned = new Map();
  for (const pair of pairs) {
    if (usedPoints.has(pair.pointIndex) || usedSources.has(pair.sourceIndex)) continue;
    usedPoints.add(pair.pointIndex);
    usedSources.add(pair.sourceIndex);
    assigned.set(pair.pointIndex, pair);
  }

  if (!assigned.size) return fallbackAll();

  return points.map((point, pointIndex) => {
    const pair = assigned.get(pointIndex);
    if (!pair) {
      return { ...point, sourceType: SOURCE_TYPE_FIXTURE, sourceFallback: true, sourceRelevance: 0 };
    }
    const { source } = candidates[pair.sourceIndex];
    return {
      ...point,
      sourceTitle: source.title,
      author: source.author,
      url: source.url,
      quote: (source.quote || '').slice(0, 420),
      sourceType: SOURCE_TYPE_SEARCH,
      sourceFallback: false,
      sourceRelevance: Number(pair.pointRelevance.toFixed(3)),
      voteCount: source.voteCount,
      commentCount: source.commentCount
    };
  });
}

/** 供前端展示降级提示：统计有多少知识点用到了真实检索来源。 */
export function sourceStats(points) {
  const matched = points.filter((point) => point.sourceType === SOURCE_TYPE_SEARCH).length;
  return { total: points.length, matched, fallback: points.length - matched };
}
