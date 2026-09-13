import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES, evaluate, score, counts } from '../src/core.js';
import { normalizeSearchResponse, attachSources, filterByTopic, relevance, tokenize, sourceStats, buildSearchQuery, mergeSources, SOURCE_TYPE_SEARCH, SOURCE_TYPE_FIXTURE, SOURCE_TYPE_DIRECT, parseDirectAnswerContent, normalizeDirectEvaluation, normalizeLearningGuide } from '../src/zhihu.js';
import { createReportRecord, readHistory, upsertHistory, removeHistory, MAX_HISTORY_ITEMS } from '../src/history.js';

const TOPIC = 'AI 会替代初级程序员吗？';

const RELEVANT_SOURCES = [
  { title: 'AI 会替代初级程序员吗？规则清晰的任务最先被自动化', author: '答主A', quote: '越是边界清晰、可以拆分验收的初级任务，越容易被代码生成工具先接管。', url: 'https://www.zhihu.com/answer/1' },
  { title: '程序员的业务上下文与需求取舍无法被替代', author: '答主B', quote: '真实项目里需求澄清、跨团队协作和风险取舍决定了能否落地。', url: 'https://www.zhihu.com/answer/2' },
  { title: 'AI 写的代码出问题谁负责？交付责任仍在人', author: '答主C', quote: '模型可以给建议，但线上事故的责任与风险不会由模型承担。', url: 'https://www.zhihu.com/answer/3' }
];

// 取自真实检索：搜「数据分析怎么入门」时知乎返回的完全跑题结果。
const NOISE_SOURCES = [
  { title: '玉的魂魄——8:“善守者,藏于九地之下” - 知乎', author: '石头布', quote: '小戎俴收，五楘梁輈。游环胁驱，阴靷鋈续。', url: 'https://www.zhihu.com/answer/91' },
  { title: '这种弱弱的鱼,居然养活了半个海洋! - 知乎', author: '碗丸', quote: '沙丁鱼，在日语里为「鰯」（イワシ）。', url: 'https://www.zhihu.com/answer/92' },
  { title: 'AI创业的新趋势:2026年有哪些新的AI初创公司(二) - 知乎', author: '数据与AI爱好者', quote: '公司 成立/亮相 总部 方向 创始人背景 标志性融资。', url: 'https://www.zhihu.com/answer/93' }
];

test('离线 fixture 有 8 个可追溯知识点', () => {
  assert.equal(FIXTURES['ai-coder'].length, 8);
  assert.ok(FIXTURES['ai-coder'].every((p) => p.url.startsWith('https://www.zhihu.com/')));
});

test('提交短讲述时评分逻辑仍能稳定返回四类状态', () => {
  const points = evaluate(FIXTURES['ai-coder'], '这是一段很短的测试讲述');
  assert.deepEqual(counts(points), { accurate: 3, correction: 1, missing: 2, difference: 2 });
  assert.equal(score(points), 50);
});

test('补讲命中关键条件后会转为已掌握并提升分数', () => {
  const before = evaluate(FIXTURES['ai-coder'], '我认为 AI 会改变程序员工作，但沟通和验证仍很重要。');
  const target = before.find((p) => p.id === 'task');
  const after = evaluate([target], '规则清晰、可拆分、反馈短的任务更容易自动化。', true)[0];
  assert.equal(after.status, 'accurate');
  assert.ok(score([after]) > score([target]));
});

test('来源字段保留标题、作者、摘要和链接', () => {
  const point = FIXTURES['ai-coder'][0];
  assert.ok(point.sourceTitle && point.author && point.quote && point.url);
});

test('知乎搜索响应可标准化并绑定到相关知识点', () => {
  const sources = normalizeSearchResponse({ Data: { Items: [{ Title: 'AI 会替代初级程序员吗？规则清晰的任务最先被自动化', AuthorName: '答主', ContentText: '边界清晰、可拆分的初级任务更容易被代码生成接管。', Url: 'https://www.zhihu.com/a/1', VoteUpCount: 3 }] } });
  assert.equal(sources[0].title, 'AI 会替代初级程序员吗？规则清晰的任务最先被自动化');
  const points = attachSources(FIXTURES['ai-coder'].slice(0, 1), sources, { topic: TOPIC });
  assert.equal(points[0].sourceType, SOURCE_TYPE_SEARCH);
  assert.ok(points[0].sourceRelevance > 0);
});

test('完全跑题的检索结果不会被绑定为知识点证据', () => {
  const points = attachSources(FIXTURES['ai-coder'], NOISE_SOURCES, { topic: '数据分析应该怎么入门？' });
  assert.equal(sourceStats(points).matched, 0);
  assert.ok(points.every((p) => p.sourceType === SOURCE_TYPE_FIXTURE && p.sourceFallback === true));
  const noiseUrls = new Set(NOISE_SOURCES.map((s) => s.url));
  assert.ok(points.every((p) => !noiseUrls.has(p.url)), '跑题来源不得出现在任何知识点上');
});

test('相关来源按论点匹配，且一条来源不会被重复套用', () => {
  const points = attachSources(FIXTURES['ai-coder'], RELEVANT_SOURCES, { topic: TOPIC });
  const matched = points.filter((p) => p.sourceType === SOURCE_TYPE_SEARCH);
  assert.ok(matched.length >= 2, '相关来源应至少绑定 2 个知识点');
  const urls = matched.map((p) => p.url);
  assert.equal(new Set(urls).size, urls.length, '来源必须独占分配');
  assert.ok(matched.every((p) => p.sourceRelevance >= 0.3));
  // 论点与来源要真正对应：谈「责任」的来源应落在 responsibility 上。
  const responsibility = points.find((p) => p.id === 'responsibility');
  assert.equal(responsibility.url, 'https://www.zhihu.com/answer/3');
});

test('无来源或无主题时降级为离线资料并保持可展示', () => {
  const empty = attachSources(FIXTURES['ai-coder'], [], { topic: TOPIC });
  assert.deepEqual(sourceStats(empty), { total: 8, matched: 0, fallback: 8 });
  assert.ok(empty.every((p) => p.sourceTitle && p.author && p.url.startsWith('https://www.zhihu.com/')));
});

test('补讲复测后来源标注与链接保持不变', () => {
  const points = attachSources(evaluate(FIXTURES['ai-coder'], '我的初次讲述'), RELEVANT_SOURCES, { topic: TOPIC });
  const target = points.find((p) => p.id === 'task');
  assert.equal(target.sourceType, SOURCE_TYPE_SEARCH);
  const after = evaluate([target], '规则清晰、可拆分的任务更容易自动化。', true)[0];
  assert.equal(after.status, 'accurate');
  assert.equal(after.sourceType, target.sourceType);
  assert.equal(after.url, target.url);
});

test('相关性计算对跑题文本返回 0', () => {
  const query = tokenize(TOPIC);
  assert.equal(relevance(query, tokenize('沙丁鱼在日语里叫鰯')), 0);
  assert.ok(relevance(query, tokenize('AI 会替代初级程序员吗')) > 0.5);
  assert.equal(filterByTopic(NOISE_SOURCES, '数据分析应该怎么入门？').length, 0);
});

test('知乎直答 JSON 可解析并标准化为评估知识点', () => {
  const payload = { choices: [{ message: { content: '```json\n{"items":[{"status":"correction","title":"任务边界","match_terms":["规则清晰","自动化"],"user_claim":"我认为复杂工作最先被替代","feedback":"方向需要修正","quote_or_summary":"知乎资料显示标准化任务更易自动化","repair_prompt":"请补讲适用条件"}]}\n```' } }] };
  const parsed = parseDirectAnswerContent(payload.choices[0].message.content);
  assert.equal(parsed.items.length, 1);
  const points = normalizeDirectEvaluation(payload);
  assert.equal(points[0].status, 'correction');
  assert.equal(points[0].sourceType, SOURCE_TYPE_DIRECT);
  assert.deepEqual(points[0].matchTerms, ['规则清晰', '自动化']);
});

test('直答知识点没有匹配搜索来源时仍保留直答标签', () => {
  const payload = { choices: [{ message: { content: '{"items":[{"status":"missing","title":"完全不同的知识点","match_terms":["量子力学"],"feedback":"证据不足"}]}' } }] };
  const points = attachSources(normalizeDirectEvaluation(payload), RELEVANT_SOURCES, { topic: TOPIC });
  assert.equal(points[0].sourceType, SOURCE_TYPE_DIRECT);
  assert.equal(points[0].url, '');
});

test('知乎直答入门指南可标准化为零基础学习地图', () => {
  const payload = { choices: [{ message: { content: JSON.stringify({ overview: '先理解基本概念。', key_points: [
    { title: '定义', explanation: '这是一个定义。', example: '例子', match_terms: ['定义'] },
    { title: '框架', explanation: '这是一个框架。', match_terms: ['框架'] },
    { title: '边界', explanation: '这是一个边界。', match_terms: ['边界'] }
  ], misconceptions: ['不要把工具当结论'], starter_question: '你能解释定义吗？' }) } }] };
  const guide = normalizeLearningGuide(payload);
  assert.equal(guide.keyPoints.length, 3);
  assert.equal(guide.sourceType, SOURCE_TYPE_DIRECT);
  assert.equal(guide.starterQuestion, '你能解释定义吗？');
});

test('历史报告记录包含分数与必要的安全字段', () => {
  const record = createReportRecord({ topic: { id: 'ai-coder', title: TOPIC, tag: '职业与 AI' }, answer: '我的讲述', before: 25, points: FIXTURES['ai-coder'].slice(0, 2), createdAt: 1700000000000, id: 'report-test' });
  assert.equal(record.id, 'report-test');
  assert.equal(record.after, 0);
  assert.equal(record.points.length, 2);
  assert.equal(record.points[0].sourceType, '');
  assert.equal(record.topic.title, TOPIC);
});

test('历史报告可处理损坏 JSON、去重并限制数量', () => {
  assert.deepEqual(readHistory('{bad json'), []);
  let records = [];
  for (let i = 0; i < MAX_HISTORY_ITEMS + 3; i += 1) records = upsertHistory(records, { id: `r-${i}`, topic: { title: `主题 ${i}` }, points: [] });
  assert.equal(records.length, MAX_HISTORY_ITEMS);
  assert.equal(records[0].id, `r-${MAX_HISTORY_ITEMS + 2}`);
  records = upsertHistory(records, { id: 'r-10', topic: { title: '更新主题' }, points: [] });
  assert.equal(records[0].id, 'r-10');
  assert.equal(records.filter((item) => item.id === 'r-10').length, 1);
  assert.equal(removeHistory(records, 'r-10').some((item) => item.id === 'r-10'), false);
});
