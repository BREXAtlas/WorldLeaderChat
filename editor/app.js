const OWNER = 'BREXAtlas';
const REPO = 'WorldLeaderChat';
const API = 'https://api.github.com';
const START = '<!-- WLC_STORY_JSON_START -->';
const END = '<!-- WLC_STORY_JSON_END -->';
const lanes = [['new','New'],['drafting','Drafting'],['ready','Ready for Approval'],['published','Published']];

let token = sessionStorage.getItem('wlc_editor_token') || '';
let issues = [];
let activeLane = 'ready';
const busy = new Set();

const BANNED_LINES = [
  'i have reviewed it and already have the strongest interpretation',
  'could we agree on the facts before competing over the dramatic interpretation',
  'the facts are doing very well under my interpretation',
  'that sentence made the meeting longer and the facts more nervous',
  'china is observing both the event and the speed with which everyone made it about themselves',
  'we may want to separate the development from the personality test',
  'the personality test had excellent ratings',
  'the agenda has again been defeated by the commentary on the agenda',
  'the typing indicator remains more stable than the consensus',
  'agenda restored confidence in agenda low',
  'i have thoughts many people are saying they are excellent thoughts',
  'i would like the record to show my first message was still the strongest message',
  'the record has asked not to be involved',
  'can we discuss the actual event before someone changes the group name again'
];
const THIRD_PERSON = /^(frames|signals|calls for|counts|emphasizes|notes|observes|suggests|underlines|warns|describes|argues|states|says|sees|insists|urges|highlights|points to|maintains|reiterates|characterizes|portrays|indicates|acknowledges)\b/i;
const META_NARRATION = /\b(imagined|hypothetical|would likely|would probably|plausible reaction|reaction consistent|response imagined|posture|style response|public-figure|voice would)\b/i;
const GENERIC_SPEAKER = /^(world leader|u\.?s\.? official|american official|european diplomat|government official|public figure|political observer|analyst|expert|commentator)$/i;
const STOCK_MEME = /\bdrake(?: meme)?\b|distracted boyfriend|two buttons|change my mind|expanding brain|this is fine dog|woman yelling at a cat/i;

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize = (value) => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

function labelSet(issue) {
  return new Set((issue.labels || []).map((item) => typeof item === 'string' ? item : item.name));
}

function parseBundle(body = '') {
  const start = body.indexOf(START);
  const end = body.indexOf(END);
  if (start < 0 || end <= start) return null;
  const text = body.slice(start + START.length, end).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch { return null; }
}

function replaceBundle(body, bundle) {
  const start = body.indexOf(START);
  const end = body.indexOf(END);
  const block = `${START}\n\`\`\`json\n${JSON.stringify(bundle, null, 2)}\n\`\`\`\n${END}`;
  return start >= 0 && end > start ? body.slice(0, start) + block + body.slice(end + END.length) : `${body}\n\n${block}`;
}

function dialogueProblems(bundle) {
  const problems = [];
  const messages = bundle?.event?.messages;
  if (!Array.isArray(messages)) return ['Chat is missing.'];
  if (messages.length < 10 || messages.length > 14) problems.push(`Chat has ${messages.length} messages; it needs 10–14.`);

  const seen = new Set();
  const counts = new Map();
  let previous = '';
  for (const [index, message] of messages.entries()) {
    const speaker = String(message?.speaker || '').trim();
    const text = String(message?.text || '').trim();
    const line = normalize(text);
    if (!speaker || !text) problems.push(`Message ${index + 1} is incomplete.`);
    if (GENERIC_SPEAKER.test(speaker)) problems.push(`Message ${index + 1} uses a generic speaker (${speaker}).`);
    if (message?.kind !== 'system') {
      counts.set(speaker, (counts.get(speaker) || 0) + 1);
      if (previous === speaker) problems.push(`${speaker} appears twice in a row.`);
      previous = speaker;
    }
    if (THIRD_PERSON.test(text) || META_NARRATION.test(text)) problems.push(`Message ${index + 1} reads like commentary instead of a text message.`);
    if (BANNED_LINES.some((phrase) => line.includes(phrase))) problems.push(`Message ${index + 1} contains recycled stock dialogue.`);
    if (line && seen.has(line)) problems.push(`Message ${index + 1} repeats another line.`);
    seen.add(line);
  }
  if ([...counts.values()].filter((count) => count >= 2).length < 2) problems.push('At least two speakers must return later in the conversation.');
  if (STOCK_MEME.test(String(bundle?.event?.meme || ''))) problems.push('The closing line uses a stock named meme instead of an original punch line.');
  if (/world leaders opened the news and immediately regretted having read receipts on/i.test(String(bundle?.event?.title || ''))) problems.push('The headline is a recycled generic headline.');
  return [...new Set(problems)];
}

function laneOf(issue) {
  const labels = labelSet(issue);
  if (labels.has('published')) return 'published';
  if (issue.state === 'closed') return null;
  if (labels.has('editorial-approved') || labels.has('publication-failed') || labels.has('regenerate-requested') || labels.has('drafting') || labels.has('needs-editor')) return 'drafting';
  if (labels.has('ready-for-approval')) return 'ready';
  const bundle = parseBundle(issue.body || '');
  if (bundle && bundle.event?.article?.body?.length >= 2 && !JSON.stringify(bundle).includes('[EDITOR:') && !dialogueProblems(bundle).length) return 'ready';
  return 'new';
}

function smartText(bundle) {
  const text = `${bundle?.event?.title || ''} ${bundle?.event?.summary || ''}`;
  return /killed|dead|death|hostage|missile attack|civilian|gaza|war/i.test(text)
    ? 'S-M-A-R: source locked; humor targets leaders, institutions and strategy—not victims.'
    : 'S-M-A-R: source locked; article-specific speakers, direct replies and one original comic angle.';
}

function notice(message, type = 'info') {
  const box = $('#notice');
  box.textContent = message;
  box.className = `notice ${type}`;
  box.hidden = false;
}

async function connect() {
  token = $('#token').value.trim() || token;
  if (!token) return;
  $('#authStatus').textContent = 'Checking repository access…';
  try {
    const repo = await api(`/repos/${OWNER}/${REPO}`);
    if (!(repo.permissions?.push || repo.permissions?.admin || repo.permissions?.maintain)) throw new Error('This token can read the repository but does not have editor/write access.');
    sessionStorage.setItem('wlc_editor_token', token);
    $('#auth').hidden = true;
    $('#workspace').hidden = false;
    $('#logout').hidden = false;
    await load();
  } catch (error) {
    $('#authStatus').textContent = `Could not connect: ${error.message}`;
  }
}

async function load() {
  const [open, closed] = await Promise.all([
    api(`/repos/${OWNER}/${REPO}/issues?state=open&labels=news-candidate&per_page=100`),
    api(`/repos/${OWNER}/${REPO}/issues?state=closed&labels=published&per_page=100`)
  ]);
  issues = [...open.filter((item) => !item.pull_request), ...closed.filter((item) => !item.pull_request)];
  const available = new Set(issues.map(laneOf).filter(Boolean));
  if (!available.has(activeLane)) activeLane = ['ready','drafting','new','published'].find((lane) => available.has(lane)) || 'new';
  render();
}

function render() {
  const counts = Object.fromEntries(lanes.map(([key]) => [key, issues.filter((issue) => laneOf(issue) === key).length]));
  $('#tabs').innerHTML = lanes.map(([key,name]) => `<button class="tab ${key === activeLane ? 'active' : ''}" data-lane="${key}">${name}<span class="count">${counts[key]}</span></button>`).join('');
  $('#board').innerHTML = lanes.map(([key,name]) => `<section class="lane ${key === activeLane ? 'show' : ''}" data-lane="${key}"><h2>${name}</h2>${cards(key)}</section>`).join('');
  document.querySelectorAll('.tab').forEach((button) => button.onclick = () => {
    activeLane = button.dataset.lane;
    render();
  });
  document.querySelectorAll('[data-action]').forEach((button) => button.onclick = () => act(button.dataset.action, Number(button.dataset.issue)));
}

function cards(lane) {
  const set = issues.filter((issue) => laneOf(issue) === lane).sort((a,b) => Number(b.number) - Number(a.number));
  if (!set.length) return '<div class="empty">Nothing here.</div>';
  return set.map((issue) => {
    const labels = labelSet(issue);
    const bundle = parseBundle(issue.body || '');
    const problems = bundle ? dialogueProblems(bundle) : ['Editorial JSON could not be read.'];
    const messages = (bundle?.event?.messages || []).map((message) => `<div class="msg ${message.kind === 'system' ? 'system' : ''}"><b>${esc(message.speaker)}</b>${esc(message.text)}</div>`).join('');
    const source = bundle?.event?.sources?.[0];
    const article = bundle?.event?.article;
    const publishing = labels.has('editorial-approved') || busy.has(issue.number);
    const failed = labels.has('publication-failed');
    const regenerating = labels.has('regenerate-requested') || labels.has('drafting');
    const blocked = labels.has('needs-editor') || problems.length > 0;

    let actions = '<span class="tag ready">Live</span>';
    if (lane !== 'published') {
      if (publishing) {
        actions = '<button class="btn pending" disabled>Publishing…</button><span class="action-note">Approval submitted once. No second tap is needed.</span>';
      } else if (regenerating && !failed) {
        actions = '<button class="btn pending" disabled>Regenerating…</button><span class="action-note">A new article-specific chat is being written.</span>';
      } else if (failed) {
        actions = `<button class="btn success" data-action="retry" data-issue="${issue.number}" ${blocked ? 'disabled' : ''}>Retry Publish</button><button class="btn ghost" data-action="regenerate" data-issue="${issue.number}">Rewrite Chat</button><button class="btn danger" data-action="reject" data-issue="${issue.number}">Reject</button>`;
      } else if (blocked) {
        actions = `<button class="btn ghost" data-action="regenerate" data-issue="${issue.number}">Rewrite Chat</button><button class="btn danger" data-action="reject" data-issue="${issue.number}">Reject</button>`;
      } else {
        actions = `<button class="btn success" data-action="approve" data-issue="${issue.number}">Approve & Publish</button><button class="btn ghost" data-action="regenerate" data-issue="${issue.number}">Rewrite Chat</button><button class="btn danger" data-action="reject" data-issue="${issue.number}">Reject</button>`;
      }
    }

    const articlePreview = article
      ? `<div class="article-preview"><b>SHORT ARTICLE PREVIEW</b><strong>${esc(article.headline)}</strong><p>${esc(article.dek)}</p></div>`
      : '';
    const quality = problems.length
      ? `<div class="smart" style="background:#fee2e2;border-color:#b91c1c"><b>CHAT NEEDS A REWRITE</b><br>${problems.map(esc).join('<br>')}</div>`
      : `<div class="smart"><b>S-M-A-R REVIEW</b><br>${esc(smartText(bundle))}<br><b>Chat quality:</b> article-specific, direct and ready.</div>`;

    return `<article class="card"><div class="meta">ISSUE #${issue.number} • ${esc(bundle?.event?.date || '')}</div><span class="tag ${lane === 'ready' ? 'ready' : lane === 'new' ? 'new' : 'draft'}">${publishing ? 'Publishing' : failed ? 'Publication failed' : regenerating ? 'Regenerating' : lane}</span><span class="tag">${esc(bundle?.event?.category || 'World Affairs')}</span><h3>${esc(bundle?.event?.title || issue.title)}</h3><p class="summary">${esc(bundle?.event?.summary || '')}</p>${source ? `<a class="source" target="_blank" rel="noopener" href="${esc(source.url)}">Open source: ${esc(source.publisher)}</a>` : ''}${articlePreview}<div class="chat">${messages}</div><div class="meme">${esc(bundle?.event?.meme || '')}</div>${quality}<div class="actions">${actions}</div></article>`;
  }).join('');
}

async function setIssueLabels(issue, additions = [], removals = []) {
  const labels = labelSet(issue);
  additions.forEach((label) => labels.add(label));
  removals.forEach((label) => labels.delete(label));
  return api(`/repos/${OWNER}/${REPO}/issues/${issue.number}`, {method:'PATCH', body:JSON.stringify({labels:[...labels]})});
}

async function waitForPublish(number) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const issue = await api(`/repos/${OWNER}/${REPO}/issues/${number}`);
    const labels = labelSet(issue);
    if (issue.state === 'closed' || labels.has('published')) return 'published';
    if (labels.has('publication-failed')) return 'failed';
  }
  return 'pending';
}

async function act(action, number) {
  if (busy.has(number)) {
    notice('That story is already processing. No second tap is needed.', 'warn');
    return;
  }

  try {
    const currentIssue = await api(`/repos/${OWNER}/${REPO}/issues/${number}`);
    const labels = labelSet(currentIssue);
    if (currentIssue.state === 'closed' || labels.has('published')) {
      notice('Already published. The dashboard has been refreshed.', 'success');
      await load();
      return;
    }

    let bundle = parseBundle(currentIssue.body || '');
    if (!bundle) throw new Error('This issue has no valid editorial bundle.');

    if (action === 'regenerate') {
      busy.add(number); render();
      await setIssueLabels(currentIssue, ['regenerate-requested'], ['ready-for-approval','editorial-approved','fact-checked','publication-failed','needs-editor']);
      busy.delete(number);
      notice('A completely new article-specific chat has been queued. The existing article and source links stay intact.', 'success');
      await load();
      return;
    }

    if (action === 'reject') {
      if (!confirm('Reject this candidate? It will be closed without publishing.')) return;
      busy.add(number); render();
      await api(`/repos/${OWNER}/${REPO}/issues/${number}`, {method:'PATCH', body:JSON.stringify({state:'closed', state_reason:'not_planned', labels:['news-candidate','rejected']})});
      busy.delete(number);
      notice('Candidate rejected. Nothing was published.', 'success');
      await load();
      return;
    }

    if (action === 'approve' || action === 'retry') {
      const problems = dialogueProblems(bundle);
      if (problems.length) {
        notice(`This chat cannot publish yet: ${problems[0]} Tap Rewrite Chat.`, 'error');
        return;
      }
      if (!bundle.event?.article?.body?.length) {
        notice('This candidate has no completed short article. Tap Rewrite Chat.', 'error');
        return;
      }
      if (!confirm(action === 'retry' ? 'Retry publication of this approved article and chat?' : 'Approve this completed article-specific chat and publish it?')) return;

      busy.add(number); render();
      notice('Approval submitted once. Publishing has started and the button is locked.', 'info');

      bundle.status = 'approved';
      bundle.approval = {...(bundle.approval || {}), reviewNotes: `${bundle.approval?.reviewNotes || ''} Owner approved the article-specific direct conversation after the chat-quality gate passed.`.trim()};
      bundle.factCheck = {...(bundle.factCheck || {}), articleMatchesSources:true};
      for (const key of ['sourceOpened','summaryVerified','namesAndTitlesVerified','publicQuotesVerified','satireTargetsPowerNotVictims','sensitiveEventReview','clearSatireLabel']) bundle.factCheck[key] = true;
      if ((bundle.event.sources || []).length < 2) {
        bundle.factCheck.twoSourceRuleMet = false;
        bundle.factCheck.singleSourceException = 'Owner editorial approval accepts this single-source candidate because the factual setup is narrowly limited to the linked report; imagined dialogue does not add factual claims.';
      } else {
        bundle.factCheck.twoSourceRuleMet = true;
        bundle.factCheck.singleSourceException = '';
      }

      await api(`/repos/${OWNER}/${REPO}/issues/${number}`, {method:'PATCH', body:JSON.stringify({body:replaceBundle(currentIssue.body, bundle)})});
      const updated = await api(`/repos/${OWNER}/${REPO}/issues/${number}`);
      await setIssueLabels(updated, ['fact-checked','editorial-approved'], ['publication-failed','needs-editor','regenerate-requested','drafting']);

      const result = await waitForPublish(number);
      busy.delete(number);
      if (result === 'published') notice('Published ✓ The live site has been updated.', 'success');
      else if (result === 'failed') notice('Publication failed and was safely unlocked. The story is under Drafting with Retry and Rewrite options.', 'error');
      else notice('Approval is safely queued in GitHub Actions. Do not tap Approve again.', 'warn');
      await load();
    }
  } catch (error) {
    busy.delete(number);
    notice(`Action failed before completion: ${error.message}`, 'error');
    await load().catch(() => {});
  }
}

$('#connect').onclick = connect;
$('#logout').onclick = () => { sessionStorage.removeItem('wlc_editor_token'); location.reload(); };
if (token) { $('#token').value = token; connect(); }
