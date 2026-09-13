export const TOPICS = [
  { id: 'ai-coder', title: 'AI 会替代初级程序员吗？', tag: '职业与 AI', description: '从任务类型、上下文判断和协作能力出发，讲清你的判断。' },
  { id: 'data-start', title: '数据分析应该怎么入门？', tag: '学习方法', description: '解释工具、业务问题与统计思维之间的关系。' },
  { id: 'remote-work', title: '远程工作如何保持效率？', tag: '职场实践', description: '从沟通、节奏和边界谈一套可执行的方法。' }
];

const aiPoints = [
  { id: 'task', matchTerms: ['自动化', '初级任务', '规则', '拆分', '替代', '代码生成'], label: '任务类型', status: 'correction', title: '规则清晰、可拆分的初级任务更容易先被自动化', user: 'AI 主要会替代需要长期项目经验的复杂工作。', feedback: '这点与资料结论的方向相反。当前更容易自动化的是规则清晰、可拆分、反馈周期短的任务；复杂工作仍依赖上下文判断。', quote: '越是边界清晰、可以被验收的任务，越容易被工具先接管。', sourceTitle: 'AI 时代，程序员的核心竞争力是什么？', author: 'vczh', url: 'https://www.zhihu.com/question/547407528', prompt: '请用自己的话补充：哪些类型的任务更容易被自动化？复杂任务为什么暂时不等于不会被影响？' },
  { id: 'context', matchTerms: ['业务上下文', '需求', '协作', '取舍', '项目', '落地'], label: '上下文', status: 'missing', title: '复杂工作仍需要业务上下文与取舍', user: '（你的讲述没有覆盖这一点）', feedback: '你提到了效率，但还缺少一个关键前提：真实项目中的需求澄清、风险取舍和跨团队协作很难只靠代码生成完成。', quote: '写出代码只是交付链路的一环，理解为什么写、为谁写，决定了结果能不能落地。', sourceTitle: '现在的 AI 编程，离替代程序员还有多远？', author: '张亮', url: 'https://www.zhihu.com/question/588017434', prompt: '请补讲：除了写代码，复杂项目还需要哪些上下文判断？' },
  { id: 'collab', matchTerms: ['沟通', '拆解', '验证', '协作', '能力'], label: '协作能力', status: 'accurate', title: '沟通、拆解和验证能力会变得更重要', user: '我认为沟通需求、拆解问题和验证结果仍然重要。', feedback: '这点讲得很清楚，与你引用的社区观点一致。', quote: '工具会把“写”变快，但不会替你完成对问题的定义和结果的负责。', sourceTitle: 'AI 会让程序员失业吗？', author: '左耳朵耗子', url: 'https://www.zhihu.com/question/264036632', prompt: '' },
  { id: 'productivity', matchTerms: ['效率', '生产力', '岗位', '分工', '工具'], label: '效率', status: 'accurate', title: 'AI 更像放大器，而不是单一的替代开关', user: 'AI 会提高个人效率，让一个人完成过去几个人的工作。', feedback: '你抓住了生产力变化，但要注意效率提升通常伴随岗位职责变化，而不是简单消失。', quote: '生产力工具的普及会重排分工，先改变工作内容，再改变岗位数量。', sourceTitle: '人工智能会取代程序员吗？', author: '刘润', url: 'https://www.zhihu.com/question/602144257', prompt: '' },
  { id: 'boundary', matchTerms: ['替代', '岗位', '时间', '定义', '边界'], label: '适用边界', status: 'difference', title: '不同答主对“替代”的时间尺度有不同判断', user: '我觉得五年内不会有明显影响。', feedback: '这是观点差异，不直接判错。不同答主对时间尺度和“替代”的定义并不一致，建议把判断条件说清楚。', quote: '讨论替代之前，要先定义是替代任务、岗位，还是替代承担责任的人。', sourceTitle: '程序员会被 AI 取代吗？', author: '临风', url: 'https://www.zhihu.com/question/446754633', prompt: '请补充你的时间尺度和“替代”定义：你讨论的是任务、岗位，还是责任？' },
  { id: 'learning', matchTerms: ['学习', '基础', '原理', '成长', '验证'], label: '学习方式', status: 'missing', title: '学习基础原理仍是长期护城河', user: '（你的讲述没有覆盖这一点）', feedback: '资料反复强调，工具越强，越需要知道它什么时候会错。基础知识帮助你审查和修正生成结果。', quote: '不会因为有了计算器就不需要数学，判断输入和结果仍然需要能力。', sourceTitle: 'AI 编程时代，初级程序员该如何成长？', author: '四火', url: 'https://www.zhihu.com/question/626534261', prompt: '请补讲：为什么基础原理和验证能力在 AI 时代仍重要？' },
  { id: 'responsibility', matchTerms: ['责任', '交付', '负责', '事故', '风险'], label: '责任', status: 'accurate', title: '最终交付责任仍由人承担', user: '出了问题，还是需要有人理解并承担结果。', feedback: '准确覆盖。你把“能生成”与“能负责”区分开了。', quote: '模型可以给建议，但线上事故的责任不会由模型签字。', sourceTitle: 'AI 写的代码，出了问题谁负责？', author: '阿秀', url: 'https://www.zhihu.com/question/598243850', prompt: '' },
  { id: 'view', matchTerms: ['行业', '团队', '速度', '分歧', '影响'], label: '观点差异', status: 'difference', title: '社区对变化速度存在分歧', user: '我认为变化会发生，但速度取决于行业和团队。', feedback: '这是有依据的观点差异。把行业、团队成熟度等条件说出来，会让结论更可靠。', quote: '同一工具在不同组织里的边际收益，取决于流程、数据和风险容忍度。', sourceTitle: 'AI 对软件行业的影响会有多大？', author: '黄海均', url: 'https://www.zhihu.com/question/611025845', prompt: '请补充：哪些行业或团队条件会让变化更快或更慢？' }
];

// 派生主题沿用 ai-coder 的知识点骨架，但检索匹配词必须按各自领域替换，
// 否则会拿「代码生成 / 岗位」这类词去匹配数据分析、远程工作的来源。
const DERIVED_TERMS = {
  'data-start': [
    ['数据分析', '入门', '基础', '学习', '路径'],
    ['业务', '问题', '需求', '场景', '落地'],
    ['沟通', '汇报', '表达', '协作', '结论'],
    ['效率', '工具', 'Excel', 'SQL', 'Python'],
    ['统计', '指标', '口径', '定义', '边界'],
    ['学习', '原理', '统计', '基础', '成长'],
    ['结论', '负责', '误读', '风险', '验证'],
    ['行业', '团队', '方向', '分歧', '差异']
  ],
  'remote-work': [
    ['远程办公', '自律', '节奏', '时间管理', '安排'],
    ['沟通', '异步', '协作', '信息同步', '团队'],
    ['会议', '表达', '文档', '协作', '反馈'],
    ['效率', '专注', '工具', '产出', '干扰'],
    ['边界', '加班', '时间', '定义', '分离'],
    ['习惯', '学习', '成长', '自驱', '基础'],
    ['责任', '交付', '结果', '信任', '考核'],
    ['行业', '团队', '文化', '分歧', '差异']
  ]
};

const derive = (prefix, terms, mapTitle, mapLabel) => aiPoints.map((p, i) => ({
  ...p,
  id: `${prefix}-${i}`,
  title: mapTitle(p.title),
  label: mapLabel(p.label, i),
  matchTerms: terms[i] || p.matchTerms
}));

export const FIXTURES = {
  'ai-coder': aiPoints,
  'data-start': derive('data', DERIVED_TERMS['data-start'], (t) => t.replace('AI', '数据分析'), (l, i) => (i % 2 ? '方法' : l)),
  'remote-work': derive('remote', DERIVED_TERMS['remote-work'], (t) => t.replace(/AI|程序员/g, '远程工作'), (l, i) => (i % 2 ? '实践' : l))
};

export function evaluate(points, answer, isReteach = false) {
  const text = answer.trim();
  return points.map((point) => {
    if (isReteach && (point.status === 'missing' || point.status === 'correction' || point.status === 'difference')) {
      const keywords = point.id === 'task' ? ['规则', '拆分', '自动化'] : point.id === 'context' ? ['上下文', '协作', '需求'] : point.id === 'learning' ? ['基础', '验证', '原理'] : ['任务', '岗位', '责任', '行业'];
      if (keywords.some((word) => text.includes(word))) return { ...point, status: 'accurate', user: text, feedback: '补讲已覆盖关键条件，这一点现在讲清楚了。' };
    }
    return point;
  });
}

export function score(points) {
  const values = { accurate: 2, difference: 1, correction: 0, missing: 0 };
  return Math.round(points.reduce((sum, p) => sum + values[p.status], 0) / (points.length * 2) * 100);
}

export function counts(points) {
  return points.reduce((acc, p) => { acc[p.status] += 1; return acc; }, { accurate: 0, correction: 0, missing: 0, difference: 0 });
}
