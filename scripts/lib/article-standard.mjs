import "../../newsroom-contract.js";

const standard = globalThis.WLC_ARTICLE_STANDARD;

export const articleProblems = standard.articleProblems;
export const expectedSourceCredit = standard.expectedSourceCredit;
export const isCreditParagraph = standard.isCreditParagraph;
export const wordCount = standard.wordCount;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeArticle(article, sources) {
  const result = structuredClone(article || {});
  const body = (Array.isArray(result.body) ? result.body : [])
    .map(clean)
    .filter(Boolean)
    .filter((paragraph) => !isCreditParagraph(paragraph));

  while (body.length > globalThis.WLC_NEWSROOM_CONTRACT.article.maximumParagraphs) {
    body[body.length - 2] = `${body[body.length - 2]} ${body.at(-1)}`;
    body.pop();
  }

  result.headline = clean(result.headline).slice(0, 240);
  result.dek = clean(result.dek).slice(0, 420);
  result.body = body.map((paragraph) => paragraph.slice(0, 1400));
  result.sourceCredit = expectedSourceCredit(sources);
  return result;
}
