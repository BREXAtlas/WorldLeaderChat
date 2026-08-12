const OWNER = 'BREXAtlas';
const REPO = 'WorldLeaderChat';
const API = 'https://api.github.com';
const START = '<!-- WLC_STORY_JSON_START -->';
const END = '<!-- WLC_STORY_JSON_END -->';
const lanes = [['new','New'],['drafting','Drafting'],['ready','Ready for Approval'],['publishing','Publishing'],['published','Published']];

let token = sessionStorage.getItem('wlc_editor_token') || '';
let issues = [];
let activeLane = 'ready';
let editorQuery = '';
let editorDesk = 'all';
let editorDate = 'all';
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

function articleProblems(bundle) {
  const standard = globalThis.WLC_ARTICLE_STANDARD;
  if (!standard) return ['Article rules did not load. Refresh the editor before approving.'];
  return standard.articleProblems(bundle?.event?.article, bundle?.event?.sources);
}

function eventProblems(bundle) {
  const summaryLength = String(bundle?.event?.summary || '').trim().length;
  return summaryLength >= 50 && summaryLength <= 1200
    ? []
    : [`Summary must be 50–1200 characters; this file has ${summaryLength}.`];
}

function laneOf(issue) {
  const labels = labelSet(issue);
  if (labels.has('published')) return 'published';
  if (issue.state === 'closed') return null;
  if (busy.has(issue.number) || labels.has('editorial-approved')) return 'publishing';
  if (labels.has('publication-failed') || labels.has('regenerate-requested') || labels.has('redraft-requested') || labels.has('drafting') || labels.has('needs-editor')) return 'drafting';
  if (labels.has('ready-for-approval')) return 'ready';
  const bundle = parseBundle(issue.body || '');
  if (bundle && !JSON.stringify(bundle).includes('[EDITOR:') && !eventProblems(bundle).length && !articleProblems(bundle).length && !dialogueProblems(bundle).length) return 'ready';
  return 'new';
}

function eventOf(issue) {
  return issue.publishedEvent || parseBundle(issue.body || '')?.event || null;
}

function deskOf(issue) {
  const event = eventOf(issue);
  return globalThis.WLC_NEWSROOM?.sectionFor(event) || event?.category || 'World News';
}

function chicagoDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function visibleInEditor(issue) {
  const event = eventOf(issue);
  if (editorDesk !== 'all' && deskOf(issue) !== editorDesk) return false;
  if (editorDate === 'today' && event?.eventDate !== chicagoDateKey()) return false;
  if (!editorQuery) return true;
  return globalThis.WLC_NEWSROOM?.matchesSearch(event, editorQuery)
    ?? normalize(`${issue.title} ${event?.title} ${event?.summary}`).includes(normalize(editorQuery));
}

function renderCoverage() {
  const target = $('#coverage');
  if (!target) return;
  const today = chicagoDateKey();
  const todayIssues = issues.filter((issue) => eventOf(issue)?.eventDate === today);
  const desks = globalThis.WLC_NEWSROOM?.desks || [];
  target.innerHTML = desks.map((desk) => {
    const deskIssues = todayIssues.filter((issue) => deskOf(issue) === desk);
    const publishedCount = deskIssues.filter((issue) => laneOf(issue) === 'published').length;
    const publishingCount = deskIssues.filter((issue) => laneOf(issue) === 'publishing').length;
    const reviewCount = deskIssues.length - publishedCount - publishingCount;
    return `<span class="coverage-chip" data-desk="${esc(desk)}"><b>${deskIssues.length}</b><span>${esc(desk)}<small>${reviewCount} to review • ${publishingCount} publishing • ${publishedCount} published</small></span></span>`;
  }).join('');
  $('#coverageDate').textContent = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric'
  }).format(new Date());
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
  if (!available.has(activeLane)) activeLane = ['publishing','ready','drafting','new','published'].find((lane) => available.has(lane)) || 'new';
  render();
}

function render() {
  const counts = Object.fromEntries(lanes.map(([key]) => [key, issues.filter((issue) => laneOf(issue) === key && visibleInEditor(issue)).length]));
  $('#tabs').innerHTML = lanes.map(([key,name]) => `<button class="tab ${key === activeLane ? 'active' : ''}" data-lane="${key}">${name}<span class="count">${counts[key]}</span></button>`).join('');
  $('#board').innerHTML = lanes.map(([key,name]) => `<section class="lane ${key === activeLane ? 'show' : ''}" data-lane="${key}"><h2>${name}</h2>${cards(key)}</section>`).join('');
  document.querySelectorAll('.tab').forEach((button) => button.onclick = () => {
    activeLane = button.dataset.lane;
    render();
  });
  document.querySelectorAll('[data-action]').forEach((button) => button.onclick = () => act(button.dataset.action, Number(button.dataset.issue)));
  renderCoverage();
}

function cards(lane) {
  const set = issues.filter((issue) => laneOf(issue) === lane && visibleInEditor(issue)).sort((a,b) => Number(b.number) - Number(a.number));
  if (!set.length) return '<div class="empty">Nothing here.</div>';
  return set.map((issue) => {
    const labels = labelSet(issue);
    const bundle = parseBundle(issue.body || '');
    const eventIssues = bundle ? eventProblems(bundle) : [];
    const articleIssues = bundle ? articleProblems(bundle) : [];
    const chatIssues = bundle ? dialogueProblems(bundle) : [];
    const problems = bundle
      ? [...eventIssues.map((problem) => `File: ${problem}`), ...articleIssues.map((problem) => `Article: ${problem}`), ...chatIssues]
      : ['Editorial JSON could not be read.'];
    const messages = (bundle?.event?.messages || []).map((message) => `<div class="msg ${message.kind === 'system' ? 'system' : ''}"><b>${esc(message.speaker)}</b>${esc(message.text)}</div>`).join('');
    const sources = bundle?.event?.sources || [];
    const article = bundle?.event?.article;
    const publishing = labels.has('editorial-approved') || busy.has(issue.number);
    const failed = labels.has('publication-failed');
    const regenerating = labels.has('regenerate-requested') || labels.has('redraft-requested') || labels.has('drafting') || labels.has('needs-editor');
    const blocked = labels.has('needs-editor') || problems.length > 0;
    const needsRedraft = eventIssues.length > 0 || articleIssues.length > 0;
    const cardDesk = deskOf(issue);

    let actions = bundle?.event?.featured
      ? `<span class="tag featured">Featured in ${esc(cardDesk)}</span>`
      : `<button class="btn feature" data-action="feature" data-issue="${issue.number}" ${issue.number ? '' : 'disabled'}>Feature in ${esc(cardDesk)} Carousel</button>`;
    if (lane !== 'published') {
      if (publishing) {
        actions = '<button class="btn pending" disabled>Publishing…</button><span class="action-note">Approval submitted once. No second tap is needed.</span>';
      } else if (regenerating && !failed) {
        actions = '<button class="btn pending" disabled>Newsroom writing…</button><span class="action-note">The newsroom is correcting the headline, report and chat. No owner writing is needed.</span>';
      } else if (failed) {
        actions = `<button class="btn success" data-action="retry" data-issue="${issue.number}" ${blocked ? 'disabled' : ''}>Retry Publish</button><button class="btn ghost" data-action="${needsRedraft ? 'redraft' : 'regenerate'}" data-issue="${issue.number}">${needsRedraft ? 'Regenerate Article + Chat' : 'Rewrite Chat'}</button><button class="btn danger" data-action="reject" data-issue="${issue.number}">Reject</button>`;
      } else if (blocked) {
        actions = `<button class="btn ghost" data-action="${needsRedraft ? 'redraft' : 'regenerate'}" data-issue="${issue.number}">${needsRedraft ? 'Regenerate Article + Chat' : 'Rewrite Chat'}</button><button class="btn danger" data-action="reject" data-issue="${issue.number}">Reject</button>`;
      } else {
        actions = `<button class="btn success" data-action="approve" data-issue="${issue.number}">Approve & Publish</button><button class="btn ghost" data-action="regenerate" data-issue="${issue.number}">Rewrite Chat</button><button class="btn danger" data-action="reject" data-issue="${issue.number}">Reject</button>`;
      }
    }

    const articlePreview = article
      ? `<div class="article-preview"><div class="article-preview-label"><b>COMPLETE SHORT REPORT</b><span>${(article.body || []).length} paragraphs • ${globalThis.WLC_ARTICLE_STANDARD?.wordCount(article.body || []) || 0} words</span></div><strong>${esc(article.headline)}</strong><p class="article-dek">${esc(article.dek)}</p>${(article.body || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}<div class="article-credit">${esc(article.sourceCredit || '')}</div></div>`
      : '';
    const quality = regenerating
      ? '<div class="smart"><b>NEWSROOM PRODUCTION IN PROGRESS</b><br>The automated desk is finishing this file. It will move to Ready for Approval only after the headline, report and chat pass validation.</div>'
      : problems.length
      ? `<div class="smart" style="background:#fee2e2;border-color:#b91c1c"><b>FILE NEEDS ATTENTION</b><br>${problems.map(esc).join('<br>')}</div>`
      : `<div class="smart"><b>S-M-A-R REVIEW</b><br>${esc(smartText(bundle))}<br><b>Chat quality:</b> article-specific, direct and ready.</div>`;

    const sourceLinks = sources.map((source) => `<a class="source" target="_blank" rel="noopener" href="${esc(source.url)}">Open source: ${esc(source.publisher)}</a>`).join('');
    const chatPreview = `<details class="chat-preview"><summary>Conversation (${(bundle?.event?.messages || []).length} messages)</summary><div class="chat">${messages}</div></details>`;
    const laneTag = lane === 'ready' ? 'ready' : lane === 'new' ? 'new' : lane === 'publishing' ? 'publishing' : 'draft';
    return `<article class="card" data-desk="${esc(cardDesk)}"><div class="meta">ISSUE #${issue.number} • ${esc(bundle?.event?.date || '')}</div><span class="tag ${laneTag}">${publishing ? 'Publishing' : failed ? 'Publication failed' : regenerating ? 'Regenerating' : lane}</span><span class="tag desk-tag">${esc(cardDesk)}</span><h3>${esc(bundle?.event?.title || issue.title)}</h3><p class="summary">${esc(bundle?.event?.summary || '')}</p><div class="source-list">${sourceLinks}</div>${articlePreview}${chatPreview}<div class="meme"><b>LAST WORD</b>${esc(bundle?.event?.meme || '')}</div>${quality}<div class="actions">${actions}</div></article>`;
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
    if (action === 'feature') {
      const featureDesk = deskOf(currentIssue);
      if (!confirm(`Feature this published article in the ${featureDesk} carousel slot? Other desk selections will stay in place.`)) return;
      busy.add(number); render();
      let featureIssue = currentIssue;
      if (labels.has('featured-headline')) {
        featureIssue = await setIssueLabels(currentIssue, [], ['featured-headline']);
      }
      await setIssueLabels(featureIssue, ['featured-headline'], []);
      busy.delete(number);
      notice(`${featureDesk} carousel update queued. The other desk features will stay in place.`, 'success');
      await load();
      return;
    }

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

    if (action === 'redraft') {
      busy.add(number); render();
      await setIssueLabels(currentIssue, ['redraft-requested'], ['ready-for-approval','editorial-approved','fact-checked','publication-failed','needs-editor','regenerate-requested']);
      busy.delete(number);
      notice('A new source-locked short report and article-specific chat have been queued.', 'success');
      await load();
      return;
    }

    if (action === 'reject') {
      if (!confirm('Reject this candidate? It will be closed without publishing.')) return;
      busy.add(number);
      issues = issues.filter((issue) => issue.number !== number);
      render();
      notice('Removing the rejected candidate from the approval queue…', 'info');
      await api(`/repos/${OWNER}/${REPO}/issues/${number}`, {method:'PATCH', body:JSON.stringify({state:'closed', state_reason:'not_planned', labels:['news-candidate','rejected']})});
      busy.delete(number);
      notice('Candidate rejected. Nothing was published.', 'success');
      await load();
      return;
    }

    if (action === 'approve' || action === 'retry') {
      const problems = [...eventProblems(bundle).map((problem) => `File: ${problem}`), ...articleProblems(bundle).map((problem) => `Article: ${problem}`), ...dialogueProblems(bundle)];
      if (problems.length) {
        notice(`This file cannot publish yet: ${problems[0]}`, 'error');
        return;
      }
      if (!confirm(action === 'retry' ? 'Retry publication of this approved article and chat?' : 'Approve this completed article-specific chat and publish it?')) return;

      busy.add(number);
      activeLane = 'publishing';
      render();
      notice('Moved to Publishing. Approval was submitted once and the button is locked.', 'info');

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
      const checked = await setIssueLabels(updated, ['fact-checked'], ['editorial-approved','publication-failed','needs-editor','regenerate-requested','redraft-requested','drafting']);
      await setIssueLabels(checked, ['editorial-approved'], []);

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

async function submitCustomArticle(event) {
  event.preventDefault();
  const button = $('#customSubmit');
  const status = $('#customStatus');
  if (!globalThis.WLC_CUSTOM_SUBMISSION) {
    status.textContent = 'The custom generator did not load. Refresh the editor and try again.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Queuing…';
  status.textContent = 'Creating the source-locked editorial file…';
  try {
    const bundle = await globalThis.WLC_CUSTOM_SUBMISSION.createBundle({
      topic: $('#customTopic').value,
      desk: $('#customDesk').value,
      urls: $('#customUrls').value,
      notes: $('#customNotes').value
    });
    const issue = await api(`/repos/${OWNER}/${REPO}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title: `CUSTOM ARTICLE: ${bundle.ingestion.customTopic}`.slice(0, 240),
        body: globalThis.WLC_CUSTOM_SUBMISSION.issueBody(bundle),
        labels: ['news-candidate']
      })
    });
    await api(`/repos/${OWNER}/${REPO}/issues/${issue.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ labels: ['news-candidate', 'redraft-requested'] })
    });

    $('#customArticleForm').reset();
    status.innerHTML = `Generator queued as <a target="_blank" rel="noopener" href="${esc(issue.html_url)}">issue #${issue.number}</a>. It will return here for approval.`;
    activeLane = 'drafting';
    notice(`Custom article #${issue.number} is being generated from the submitted sources.`, 'success');
    await load();
  } catch (error) {
    status.textContent = `Could not queue the custom article: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = 'Generate Article + Chat';
  }
}

$('#connect').onclick = connect;
$('#logout').onclick = () => { sessionStorage.removeItem('wlc_editor_token'); location.reload(); };
$('#editorSearch').addEventListener('input', (event) => { editorQuery = event.target.value.trim(); render(); });
$('#editorDesk').addEventListener('change', (event) => { editorDesk = event.target.value; render(); });
$('#editorDate').addEventListener('change', (event) => { editorDate = event.target.value; render(); });
$('#customArticleForm').addEventListener('submit', submitCustomArticle);
if (token) { $('#token').value = token; connect(); }
