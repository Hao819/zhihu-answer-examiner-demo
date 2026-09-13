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

export function attachSources(points, sources) {
  if (!sources.length) return points;
  return points.map((point, index) => {
    const source = sources[index % sources.length];
    return {
      ...point,
      sourceTitle: source.title,
      author: source.author,
      url: source.url,
      quote: source.quote.slice(0, 420),
      sourceType: '真实搜索摘要'
    };
  });
}
