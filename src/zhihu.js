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

/** 命中的查询词个数，用于约束「词条少时靠单个词侥幸达标」。 */
export function hitCount(queryTokens, docTokens) {
  let hit = 0;
  for (const token of queryTokens) if (docTokens.has(token)) hit += 1;
  return hit;
}

// 除覆盖率外，至少要命中这么多查询 token 才认为来源真正谈到了该论点。
export const MIN_HIT_TOKENS = 2;

// 知乎摘要常在 300~1100 字，论点性内容多出现在中后段。
// 旧实现只取前 200 字，导致真实相关的回答匹配不上而被误降级。
const SOURCE_WINDOW = 1200;

function sourceTokens(source) {
  return tokenize(`${source.title || ''} ${(source.quote || '').slice(0, SOURCE_WINDOW)}`);
}

/**
 * 知识点查询词：以 matchTerms 为准。
 * title 是「结论式长句」，把它并入查询会引入大量与论点无关的 bigram，
 * 稀释覆盖率并压低真实相关来源的得分（实测绑定率 0/8 vs 7/8）。
 */
function pointQuery(point) {
  const terms = Array.isArray(point.matchTerms) ? point.matchTerms.join(' ') : '';
  return tokenize(terms || `${point.title || ''} ${point.label || ''}`);
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

  const fallbackPoint = (point) => point.sourceType === SOURCE_TYPE_DIRECT
    ? { ...point, sourceFallback: false, sourceRelevance: 0 }
    : { ...point, sourceType: SOURCE_TYPE_FIXTURE, sourceFallback: true, sourceRelevance: 0 };
  const fallbackAll = () => points.map(fallbackPoint);

  if (!candidates.length) return fallbackAll();

  const pairs = [];
  points.forEach((point, pointIndex) => {
    const query = pointQuery(point);
    candidates.forEach((candidate, sourceIndex) => {
      const docTokens = sourceTokens(candidate.source);
      const pointRelevance = relevance(query, docTokens);
      // 双重约束：覆盖率达标，且实际命中足够多的查询词，
      // 避免 matchTerms 较少时单个词侥幸让整条来源过关。
      const hits = hitCount(query, docTokens);
      const minHits = Math.min(MIN_HIT_TOKENS, query.size);
      if (pointRelevance >= pointThreshold && hits >= minHits) pairs.push({ pointIndex, sourceIndex, pointRelevance });
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
      return fallbackPoint(point);
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

/**
 * 构造补充检索 query：主题 + 少量高区分度 matchTerms。
 *
 * 实测表明，把全部 matchTerms 堆进 query 会把语义搜索带偏
 * （远程工作主题贴题结果 6 条 -> 3 条），因此这里只取有限个词，
 * 且仅作为「主题检索候选不足」时的补充，不替代主题检索。
 */
export function buildSearchQuery(topic, points = [], maxTerms = 3) {
  const topicTokens = tokenize(topic);
  const picked = [];
  for (const point of points) {
    for (const term of point.matchTerms || []) {
      if (picked.length >= maxTerms) break;
      // 已被主题覆盖的词不再重复，短词区分度低也跳过。
      const termTokens = tokenize(term);
      const covered = [...termTokens].every((t) => topicTokens.has(t));
      if (term.length >= 2 && !covered && !picked.includes(term)) picked.push(term);
    }
    if (picked.length >= maxTerms) break;
  }
  return picked.length ? `${topic} ${picked.join(' ')}` : topic;
}

/** 合并多次检索结果并按 url 去重，保持先到先得的顺序。 */
export function mergeSources(...lists) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const item of list || []) {
      if (!item?.url || seen.has(item.url)) continue;
      seen.add(item.url);
      merged.push(item);
    }
  }
  return merged;
}

export const SOURCE_TYPE_DIRECT = '知乎直答综合说明';

/** 从知乎直答返回的 JSON 中提取适合零基础用户的入门指南。 */
export function normalizeLearningGuide(payload) {
  const content = payload?.choices?.[0]?.message?.content || payload?.Data?.Content || payload?.data?.content || '';
  const parsed = typeof content === 'string' ? parseDirectAnswerContent(content) : content;
  const rawPoints = parsed.key_points || parsed.keyPoints || parsed['关键知识点'] || [];
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(rawPoints) || rawPoints.length < 3) return null;
  const keyPoints = rawPoints.slice(0, 8).map((point, index) => ({
    id: `guide-${index + 1}`,
    title: String(point.title || point.point || point['知识点'] || `关键点 ${index + 1}`).trim(),
    explanation: String(point.explanation || point.description || point['解释'] || '').trim(),
    example: String(point.example || point['例子'] || '').trim(),
    matchTerms: directTerms(point)
  })).filter((point) => point.title && point.explanation);
  if (keyPoints.length < 3) return null;
  return {
    overview: String(parsed.overview || parsed.summary || parsed['入门概览'] || '').trim(),
    keyPoints,
    misconceptions: (parsed.misconceptions || parsed.common_misconceptions || parsed['常见误区'] || [])
      .map((item) => String(item).trim()).filter(Boolean).slice(0, 5),
    starterQuestion: String(parsed.starter_question || parsed.starterQuestion || parsed['自测问题'] || '').trim(),
    sourceType: SOURCE_TYPE_DIRECT,
    sourceTitle: '知乎直答入门指南',
    author: '知乎直答',
    url: ''
  };
}

/** 从知乎直答的 JSON/SSE 外壳中提取模型返回的 JSON 对象。 */
export function parseDirectAnswerContent(content) {
  const text = String(content ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('知乎直答未返回 JSON');
  return JSON.parse(text.slice(start, end + 1));
}

function directStatus(value) {
  const status = String(value ?? '').toLowerCase();
  if (status === 'accurate' || status.includes('准确') || status.includes('覆盖')) return 'accurate';
  if (status === 'correction' || status.includes('修正') || status.includes('错误')) return 'correction';
  if (status === 'missing' || status.includes('遗漏') || status.includes('缺少')) return 'missing';
  if (status === 'difference' || status.includes('差异') || status.includes('分歧')) return 'difference';
  return 'difference';
}

function directTerms(item) {
  const raw = item.match_terms || item.matchTerms || item['关键词'] || item['关键条件'] || '';
  const terms = Array.isArray(raw) ? raw : String(raw).split(/[，、,；;|\\/]/);
  return terms.map((term) => String(term).trim()).filter((term) => term.length >= 2).slice(0, 8);
}

/** 将知乎直答的结构化考官结果统一为前端知识点字段。 */
export function normalizeDirectEvaluation(payload) {
  const content = payload?.choices?.[0]?.message?.content || payload?.Data?.Content || payload?.data?.content || '';
  const parsed = typeof content === 'string' ? parseDirectAnswerContent(content) : content;
  const rawItems = parsed.items || parsed.knowledge_points || parsed['知识点'] || [];
  if (!Array.isArray(rawItems)) return [];
  return rawItems.slice(0, 10).map((item, index) => {
    const title = item.title || item.point || item['知识点'] || `关键知识点 ${index + 1}`;
    const terms = directTerms(item);
    return {
      id: String(item.id || `direct-${index + 1}`),
      matchTerms: terms.length ? terms : [title],
      label: item.label || item.category || '知乎直答考点',
      status: directStatus(item.status || item['状态'] || item.verdict),
      title,
      user: item.user_claim || item.userClaim || item['用户原话'] || '（直答未返回原句）',
      feedback: item.feedback || item.assessment || item.explanation || item['考官点评'] || '知乎直答已完成判断。',
      quote: item.quote_or_summary || item.quote || item['来源摘要'] || item.summary || '知乎直答综合说明，具体证据请查看绑定的知乎搜索来源。',
      sourceTitle: '知乎直答综合说明',
      author: '知乎直答',
      url: '',
      sourceType: SOURCE_TYPE_DIRECT,
      sourceFallback: false,
      sourceRelevance: 0,
      prompt: item.repair_prompt || item.repairPrompt || item['补讲提示'] || ''
    };
  });
}
