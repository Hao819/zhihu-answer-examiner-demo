import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES, evaluate, score, counts } from '../src/core.js';
import { normalizeSearchResponse, attachSources } from '../src/zhihu.js';

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

test('知乎搜索响应可标准化并绑定到知识点', () => {
  const sources = normalizeSearchResponse({ Data: { Items: [{ Title: '真实回答', AuthorName: '答主', ContentText: '摘要内容', Url: 'https://www.zhihu.com/a/1', VoteUpCount: 3 }] } });
  assert.equal(sources[0].title, '真实回答');
  assert.equal(attachSources(FIXTURES['ai-coder'].slice(0, 1), sources)[0].sourceType, '真实搜索摘要');
});
