const OWNER = 'BREXAtlas';
const REPO = 'WorldLeaderChat';
const API = 'https://api.github.com';
const START = '<!-- WLC_STORY_JSON_START -->';
const END = '<!-- WLC_STORY_JSON_END -->';
const lanes = [['new','New'],['drafting','Draft Recovery'],['ready','Ready for Approval'],['publishing','Publishing'],['published','Published'],['trash','🗑 Trash']];

let token = sessionStorage.getItem('wlc_editor_token') || '';
let issues = [];
let activeLane = 'ready';
let editorQuery = '';
let editorDesk = 'all';
let editorDate = 'all';
const busy = new Set();
const selectedTrash = new Set();

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
const BANNED_TEMPLATE_PATTERNS = [
  /the verified event is pinned the argument is about its consequence/,
  /i want the immediate consequence stated before anyone turns it into a victory lap/,
  /that is the fact pattern we have to answer/,
  /then my question on .* is who takes responsibility for what follows/,
  /i will not turn .* into a slogan the public still needs the decision the timing and the cost separated/,
  /my answer starts with this reported detail .* interpretation comes after that sentence not before it/,
  /that is where the announcement meets the people expected to live with it/,
  /i am not dodging .* i am saying the official line is shorter than the consequence/,
  /i want each institution here to answer that record without borrowing a different story/,
  /then answer the file we actually opened .* leave the substitute headline in drafts/,
  /the verified details stayed pinned the spin requested a longer deadline/
];
const THIRD_PERSON = /^(frames|signals|calls for|counts|emphasizes|notes|observes|suggests|underlines|warns|describes|argues|states|says|sees|insists|urges|highlights|points to|maintains|reiterates|characterizes|portrays|indicates|acknowledges)\b/i;
const META_NARRATION = /\b(imagined|hypothetical|would likely|would probably|plausible reaction|reaction consistent|response imagined|posture|style response|public-figure|voice would)\b/i;
const GENERIC_SPEAKER = /^(world leader|u\.?s\.? official|american official|european diplomat|government official|public figure|political observer|analyst|expert|commentator)$/i;
const STOCK_MEME = /\bdrake(?: meme)?\b|distracted boyfriend|two buttons|change my mind|expanding brain|this is fine dog|woman yelling at a cat/i;
const PERSON_NAME = /^[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\s+[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){0,3}(?:,.*)?$/;
const ORGANIZATION_WORD = /\b(?:administration|agency|analyst|association|board|bureau|coach|commission|committee|company|correspondent|council|department|desk|family|federation|government|group|league|ministry|network|nurse|office|organization|party|reporter|researcher|staff|team|university|voter)\b/i;

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalize = (value) => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

function selfReference(speaker, text) {
  const label = String(speaker || '').split(',')[0].trim();
  if (!label || /admin$/i.test(label)) return '';
  const line = normalize(text);
  const tokens = normalize(label).split(/\s+/).filter((token) => token.length >= 4);
  const person = PERSON_NAME.test(String(speaker || '').trim()) && !ORGANIZATION_WORD.test(label);
  const references = person ? tokens.slice(-1) : [normalize(label)];
  return references.find((reference) => reference && new RegExp(`\\b${reference.replace(/\s+/g, '\\s+')}\\b`, 'i').test(line)) || '';
}

function repeatsHeadline(bundle, text) {
  const haystack = normalize(text).split(/\s+/).filter(Boolean).join(' ');
  const candidates = [bundle?.event?.title, bundle?.event?.article?.headline, ...(bundle?.event?.sources || []).map((source) => source.label)];
  return candidates.some((candidate) => {
    const words = normalize(candidate).split(/\s+/).filter(Boolean);
    const run = Math.min(5, words.length);
    if (run < 3) return false;
    for (let start = 0; start <= words.length - run; start += 1) {
      if (haystack.includes(words.slice(start, start + run).join(' '))) return true;
    }
    return false;
  });
}

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

function canonicalIssueNumber(issue) {
  const match = String(issue?.body || '').match(/\*\*Canonical editorial file:\*\*\s*#(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function legacySource(issue) {
  const body = String(issue?.body || '');
  const field = (name) => body.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`, 'i'))?.[1]?.trim() || '';
  const note = body.match(/^>\s*\*\*(?:NOT PUBLISHED|MERGED COVERAGE):\*\*\s*(.+)$/im)?.[1]?.trim() || '';
  return {
    headline: field('Source headline') || String(issue?.title || '').replace(/^(?:NEWS CANDIDATE|CUSTOM ARTICLE):\s*/i, ''),
    publisher: field('Publisher') || 'Original source',
    url: field('Original report'),
    note
  };
}

function legacyBundle(issue) {
  const source = legacySource(issue);
  const fingerprint = String(issue?.body || '').match(/<!--\s*WLC_FINGERPRINT:\s*([a-f0-9]{64})\s*-->/i)?.[1]?.toLowerCase();
  if (!fingerprint || !/^https:\/\//i.test(source.url) || source.headline.length < 12) return null;
  const eventDate = chicagoDateKey(issue.created_at || new Date());
  const date = new Intl.DateTimeFormat('en-US', {timeZone:'UTC', year:'numeric', month:'long', day:'numeric'}).format(new Date(`${eventDate}T12:00:00Z`));
  const summary = source.note.length >= 50
    ? source.note
    : `This restored legacy source reports: ${source.headline}. The newsroom will reopen the linked report and rebuild the complete article and conversation before review.`;
  const category = 'World News';
  return {
    schemaVersion: 1,
    status: 'draft',
    ingestion: {
      fingerprint,
      ingestedAt: new Date().toISOString(),
      relevanceScore: 100,
      matchedKeywords: ['restored-legacy-source'],
      sourceId: 'restored-legacy-source',
      sourceDesk: category,
      newsroomDesk: category,
      sourcePublishedAt: issue.created_at || new Date().toISOString(),
      newsroomFormat: 1,
      coveragePublishers: [source.publisher],
      sourceDigests: [{publisher: source.publisher, excerpt: summary}]
    },
    event: {
      id: `${eventDate}-restored-${issue.number}`,
      eventDate,
      year: Number(eventDate.slice(0, 4)),
      date,
      title: `[EDITOR: REBUILD RESTORED SOURCE] ${source.headline}`,
      kicker: '[EDITOR: Explain the verified event and its World Leader Chat angle.]',
      category,
      summary,
      article: {
        headline: '[EDITOR: Write a specific factual headline.]',
        dek: '[EDITOR: Write a factual deck with a restrained sharp angle.]',
        body: ['[EDITOR: Rebuild a complete source-locked short report from the restored source.]'],
        sourceCredit: `[EDITOR: Credit ${source.publisher}.]`
      },
      sources: [{label: source.headline, url: source.url, publisher: source.publisher}],
      messages: [
        {speaker:'Newsroom', text:'[EDITOR: Generate the direct article-specific conversation.]', kind:'satire', reaction:''}
      ],
      meme: '[EDITOR: Write an original article-specific Last Word.]',
      quote: null,
      tone: 'comic'
    },
    factCheck: {
      sourceOpened:false, summaryVerified:false, namesAndTitlesVerified:false, publicQuotesVerified:false,
      satireTargetsPowerNotVictims:false, sensitiveEventReview:false, clearSatireLabel:true,
      articleMatchesSources:false, twoSourceRuleMet:false, singleSourceException:''
    },
    approval: {
      reviewNotes:'Legacy source restored from Trash. Automated drafting must finish before owner approval.',
      articleStyle:'truth-first-sarcastic-news', conversationStyle:'article-specific-direct-chat', targetMessageCount:'10-14'
    }
  };
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
    if (message?.kind !== 'system' && selfReference(speaker, text)) problems.push(`Message ${index + 1} makes ${speaker} refer to themselves by name.`);
    if (message?.kind === 'system' && index !== messages.length - 1) problems.push(`Message ${index + 1} is a system/admin line before the end of the chat.`);
    if (message?.kind !== 'system') {
      counts.set(speaker, (counts.get(speaker) || 0) + 1);
      if (previous === speaker) problems.push(`${speaker} appears twice in a row.`);
      previous = speaker;
    }
    if (THIRD_PERSON.test(text) || META_NARRATION.test(text)) problems.push(`Message ${index + 1} reads like commentary instead of a text message.`);
    if (BANNED_LINES.some((phrase) => line.includes(phrase))) problems.push(`Message ${index + 1} contains recycled stock dialogue.`);
    if (BANNED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(line))) problems.push(`Message ${index + 1} contains a recycled fill-in-the-headline template.`);
    if (repeatsHeadline(bundle, text)) problems.push(`Message ${index + 1} repeats the article headline instead of reacting naturally.`);
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
  const event = bundle?.event || {};
  const problems = [];
  const lengthRule = (label, value, minimum, maximum) => {
    const length = String(value || '').trim().length;
    if (length < minimum || length > maximum) problems.push(`${label} must be ${minimum}–${maximum} characters; this file has ${length}.`);
  };
  lengthRule('Display date', event.date, 6, 80);
  lengthRule('Title', event.title, 10, 240);
  lengthRule('Kicker', event.kicker, 10, 320);
  lengthRule('Category', event.category, 2, 80);
  lengthRule('Summary', event.summary, 50, 1200);
  lengthRule('Last Word', event.meme, 10, 220);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(event.eventDate || ''))) problems.push('Event date must use YYYY-MM-DD.');
  if (!['comic', 'sober'].includes(event.tone)) problems.push('Tone must be comic or sober.');
  return problems;
}

function laneOf(issue) {
  const labels = labelSet(issue);
  if (labels.has('deleted-permanently') || labels.has('daily-overflow') || /<!--\s*WLC_DELETED\s*-->/i.test(issue.body || '')) return null;
  if (labels.has('published')) return 'published';
  if (!parseBundle(issue.body || '') && canonicalIssueNumber(issue)) return 'trash';
  if (labels.has('rejected')) return 'trash';
  if (issue.state === 'closed') return null;
  if (busy.has(issue.number) || labels.has('editorial-approved')) return 'publishing';
  if (labels.has('publication-failed') || labels.has('regenerate-requested') || labels.has('redraft-requested') || labels.has('drafting') || labels.has('needs-editor')) return 'drafting';
  if (labels.has('ready-for-approval')) {
    const readyBundle = parseBundle(issue.body || '');
    if (!readyBundle || eventProblems(readyBundle).length || articleProblems(readyBundle).length || dialogueProblems(readyBundle).length) return 'drafting';
    return 'ready';
  }
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
    const deskIssues = todayIssues.filter((issue) => deskOf(issue) === desk && laneOf(issue) !== 'trash');
    const publishedCount = deskIssues.filter((issue) => laneOf(issue) === 'published').length;
    const publishingCount = deskIssues.filter((issue) => laneOf(issue) === 'publishing').length;
    const reviewCount = deskIssues.filter((issue) => ['new','drafting','ready'].includes(laneOf(issue))).length;
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
  const [open, closed, rejected] = await Promise.all([
    api(`/repos/${OWNER}/${REPO}/issues?state=open&labels=news-candidate&per_page=100`),
    api(`/repos/${OWNER}/${REPO}/issues?state=closed&labels=published&per_page=100`),
    api(`/repos/${OWNER}/${REPO}/issues?state=closed&labels=rejected&per_page=100`)
  ]);
  issues = [...open.filter((item) => !item.pull_request), ...closed.filter((item) => !item.pull_request), ...rejected.filter((item) => !item.pull_request)];
  const available = new Set(issues.map(laneOf).filter(Boolean));
  if (!available.has(activeLane)) activeLane = ['publishing','ready','drafting','new','published','trash'].find((lane) => available.has(lane)) || 'new';
  render();
}

function render() {
  for (const number of [...selectedTrash]) {
    const issue = issues.find((item) => item.number === number);
    if (!issue || laneOf(issue) !== 'trash') selectedTrash.delete(number);
  }
  const counts = Object.fromEntries(lanes.map(([key]) => [key, issues.filter((issue) => laneOf(issue) === key && visibleInEditor(issue)).length]));
  $('#tabs').innerHTML = lanes.map(([key,name]) => `<button class="tab ${key === activeLane ? 'active' : ''}" data-lane="${key}">${name}<span class="count">${counts[key]}</span></button>`).join('');
  $('#board').innerHTML = lanes.map(([key,name]) => `<section class="lane ${key === activeLane ? 'show' : ''}" data-lane="${key}"><h2>${name}</h2>${key === 'trash' ? trashToolbar() : ''}${cards(key)}</section>`).join('');
  document.querySelectorAll('.tab').forEach((button) => button.onclick = () => {
    activeLane = button.dataset.lane;
    render();
  });
  document.querySelectorAll('[data-action]').forEach((button) => button.onclick = () => act(button.dataset.action, Number(button.dataset.issue)));
  document.querySelectorAll('[data-trash-select]').forEach((input) => input.onchange = () => {
    const number = Number(input.dataset.trashSelect);
    if (input.checked) selectedTrash.add(number);
    else selectedTrash.delete(number);
    render();
  });
  const selectAll = $('#selectAllTrash');
  if (selectAll) {
    const visible = visibleTrashIssues();
    selectAll.checked = visible.length > 0 && visible.every((issue) => selectedTrash.has(issue.number));
    selectAll.indeterminate = visible.some((issue) => selectedTrash.has(issue.number)) && !selectAll.checked;
    selectAll.onchange = () => {
      for (const issue of visible) {
        if (selectAll.checked) selectedTrash.add(issue.number);
        else selectedTrash.delete(issue.number);
      }
      render();
    };
  }
  document.querySelectorAll('[data-bulk-action]').forEach((button) => button.onclick = () => {
    const allTrash = issues.filter((issue) => laneOf(issue) === 'trash');
    const numbers = button.dataset.bulkAction === 'delete-all'
      ? allTrash.map((issue) => issue.number)
      : [...selectedTrash];
    bulkPurge(numbers, button.dataset.bulkAction === 'delete-all' ? 'all' : 'selected');
  });
  renderCoverage();
}

function visibleTrashIssues() {
  return issues.filter((issue) => laneOf(issue) === 'trash' && visibleInEditor(issue));
}

function trashToolbar() {
  const visible = visibleTrashIssues();
  const allTrash = issues.filter((issue) => laneOf(issue) === 'trash');
  const selectedCount = [...selectedTrash].filter((number) => allTrash.some((issue) => issue.number === number)).length;
  if (!allTrash.length) return '';
  return `<div class="trash-bulk" role="group" aria-label="Bulk trash actions">
    <label class="trash-select-all"><input id="selectAllTrash" type="checkbox"> Select all ${visible.length} visible</label>
    <span>${selectedCount} selected</span>
    <button class="btn danger" type="button" data-bulk-action="delete-selected" ${selectedCount ? '' : 'disabled'}>Delete Selected (${selectedCount})</button>
    <button class="btn danger" type="button" data-bulk-action="delete-all">Delete All Trash (${allTrash.length})</button>
  </div>`;
}

function cards(lane) {
  const set = issues.filter((issue) => laneOf(issue) === lane && visibleInEditor(issue)).sort((a,b) => Number(b.number) - Number(a.number));
  if (!set.length) return '<div class="empty">Nothing here.</div>';
  const today = chicagoDateKey();
  const batchWriterActive = issues.some((issue) => eventOf(issue)?.eventDate === today
    && labelSet(issue).has('draft-batch-requested'));
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
    const activelyDrafting = labels.has('drafting');
    const queuedForWriting = !activelyDrafting && (
      labels.has('regenerate-requested')
      || labels.has('redraft-requested')
      || (batchWriterActive && eventOf(issue)?.eventDate === today && ['new', 'drafting'].includes(laneOf(issue)))
    );
    const blocked = labels.has('needs-editor') || problems.length > 0;
    const needsRedraft = eventIssues.length > 0 || articleIssues.length > 0;
    const cardDesk = deskOf(issue);
    const legacy = legacySource(issue);
    const canonicalNumber = canonicalIssueNumber(issue);

    let actions = bundle?.event?.featured
      ? `<span class="tag featured">Featured in ${esc(cardDesk)}</span>`
      : `<button class="btn feature" data-action="feature" data-issue="${issue.number}" ${issue.number ? '' : 'disabled'}>Feature in ${esc(cardDesk)} Carousel</button>`;
    if (lane === 'trash') {
      const restoreAction = canonicalNumber
        ? `<button class="btn ghost" data-action="show-canonical" data-issue="${canonicalNumber}">View Canonical Article #${canonicalNumber}</button>`
        : `<button class="btn ghost" data-action="restore" data-issue="${issue.number}">${bundle ? 'Restore to Review' : 'Restore & Rebuild'}</button>`;
      actions = `${restoreAction}<button class="btn danger" data-action="purge" data-issue="${issue.number}">Permanently Delete File</button><span class="action-note">${canonicalNumber ? `This source was merged into article #${canonicalNumber}; restoring a duplicate is blocked.` : 'Trash keeps rejected stories from returning to the newsroom feed.'}</span>`;
    } else if (lane !== 'published') {
      if (publishing) {
        actions = '<button class="btn pending" disabled>Publishing…</button><span class="action-note">Approval submitted once. No second tap is needed.</span>';
      } else if (activelyDrafting && !failed) {
        actions = '<button class="btn pending" disabled>Newsroom writing…</button><span class="action-note">The newsroom is correcting the headline, report and chat. No owner writing is needed.</span>';
      } else if (queuedForWriting && !failed) {
        actions = '<button class="btn pending" disabled>Queued for writer…</button><span class="action-note">This draft is waiting for its turn. No owner writing or editing is needed.</span>';
      } else if (failed) {
        actions = `<button class="btn success" data-action="retry" data-issue="${issue.number}" ${blocked ? 'disabled' : ''}>Retry Publish</button><button class="btn ghost" data-action="${needsRedraft ? 'redraft' : 'regenerate'}" data-issue="${issue.number}">${needsRedraft ? 'Regenerate Article + Chat' : 'Rewrite Chat'}</button><button class="btn danger" data-action="reject" data-issue="${issue.number}">Reject</button>`;
      } else if (blocked) {
        actions = `<button class="btn ghost" data-action="${needsRedraft ? 'redraft' : 'regenerate'}" data-issue="${issue.number}">Finish Draft</button><button class="btn danger" data-action="reject" data-issue="${issue.number}">Reject</button><span class="action-note">This restarts the automated writer; you do not need to write or edit it.</span>`;
      } else {
        actions = `<button class="btn success" data-action="approve" data-issue="${issue.number}">Approve & Publish</button><button class="btn ghost" data-action="regenerate" data-issue="${issue.number}">Rewrite Chat</button><button class="btn danger" data-action="reject" data-issue="${issue.number}">Reject</button>`;
      }
    }

    const articlePreview = article
      ? `<div class="article-preview"><div class="article-preview-label"><b>COMPLETE SHORT REPORT</b><span>${(article.body || []).length} paragraphs • ${globalThis.WLC_ARTICLE_STANDARD?.wordCount(article.body || []) || 0} words</span></div><strong>${esc(article.headline)}</strong><p class="article-dek">${esc(article.dek)}</p>${(article.body || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}<div class="article-credit">${esc(article.sourceCredit || '')}</div></div>`
      : '';
    const quality = lane === 'trash' && canonicalNumber
      ? `<div class="smart"><b>GROUPED SOURCE RECORD</b><br>This source is already attached to canonical article #${canonicalNumber}. Use View Canonical Article instead of restoring a duplicate.</div>`
      : lane === 'trash' && !bundle
      ? '<div class="smart"><b>LEGACY SOURCE RECORD</b><br>Restore & Rebuild will create a valid source-locked draft before this file returns to review.</div>'
      : activelyDrafting
      ? '<div class="smart"><b>NEWSROOM PRODUCTION IN PROGRESS</b><br>The automated desk is finishing this file. It will move to Ready for Approval only after the headline, report and chat pass validation.</div>'
      : queuedForWriting
      ? '<div class="smart"><b>NEWSROOM WRITING QUEUE</b><br>This file is waiting for the controlled writer. It will say Writing only when its drafting work has actually started.</div>'
      : labels.has('needs-editor')
      ? `<div class="smart" style="background:#fee2e2;border-color:#b91c1c"><b>AUTOMATIC DRAFT RECOVERY NEEDED</b><br>The writer did not finish this file. The next newsroom sweep retries it automatically, or Finish Draft can restart it now.<br>${problems.map(esc).join('<br>')}</div>`
      : problems.length
      ? `<div class="smart" style="background:#fee2e2;border-color:#b91c1c"><b>FILE NEEDS ATTENTION</b><br>${problems.map(esc).join('<br>')}</div>`
      : `<div class="smart"><b>S-M-A-R REVIEW</b><br>${esc(smartText(bundle))}<br><b>Chat quality:</b> article-specific, direct and ready.</div>`;

    const sourceLinks = (sources.length ? sources : (legacy.url ? [{url:legacy.url, publisher:legacy.publisher}] : []))
      .map((source) => `<a class="source" target="_blank" rel="noopener" href="${esc(source.url)}">Open source: ${esc(source.publisher)}</a>`).join('');
    const chatPreview = `<details class="chat-preview"><summary>Conversation (${(bundle?.event?.messages || []).length} messages)</summary><div class="chat">${messages}</div></details>`;
    const laneTag = lane === 'ready' ? 'ready' : lane === 'new' ? 'new' : lane === 'publishing' ? 'publishing' : lane === 'trash' ? 'trash' : 'draft';
    const statusText = lane === 'trash' ? 'Rejected' : publishing ? 'Publishing' : failed ? 'Publication failed' : activelyDrafting ? 'Writing' : queuedForWriting ? 'Queued' : labels.has('needs-editor') ? 'Recovery needed' : lane;
    const selection = lane === 'trash'
      ? `<label class="trash-card-select"><input type="checkbox" data-trash-select="${issue.number}" ${selectedTrash.has(issue.number) ? 'checked' : ''}> Select article #${issue.number}</label>`
      : '';
    return `<article id="issue-card-${issue.number}" class="card" data-desk="${esc(cardDesk)}">${selection}<div class="meta">ISSUE #${issue.number} • ${esc(bundle?.event?.date || '')}</div><span class="tag ${laneTag}">${statusText}</span><span class="tag desk-tag">${esc(cardDesk)}</span><h3>${esc(bundle?.event?.title || legacy.headline || issue.title)}</h3><p class="summary">${esc(bundle?.event?.summary || legacy.note || '')}</p><div class="source-list">${sourceLinks}</div>${articlePreview}${chatPreview}<div class="meme"><b>LAST WORD</b>${esc(bundle?.event?.meme || '')}</div>${quality}<div class="actions">${actions}</div></article>`;
  }).join('');
}

async function setIssueLabels(issue, additions = [], removals = []) {
  const labels = labelSet(issue);
  additions.forEach((label) => labels.add(label));
  removals.forEach((label) => labels.delete(label));
  return api(`/repos/${OWNER}/${REPO}/issues/${issue.number}`, {method:'PATCH', body:JSON.stringify({labels:[...labels]})});
}

async function finishTodaysDrafts() {
  const button = $('#finishToday');
  const today = chicagoDateKey();
  const unfinished = issues.filter((issue) => eventOf(issue)?.eventDate === today
    && ['new', 'drafting'].includes(laneOf(issue)));
  if (!unfinished.length) {
    notice('Every current-day article is already ready, publishing, published or rejected.', 'success');
    return;
  }

  button.disabled = true;
  button.textContent = 'Starting writer…';
  try {
    const alreadyQueued = unfinished.find((issue) => labelSet(issue).has('draft-batch-requested'));
    if (alreadyQueued) {
      notice(`The batch writer is already queued from article #${alreadyQueued.number}.`, 'info');
      return;
    }
    const trigger = [...unfinished].sort((left, right) => Number(right.number) - Number(left.number))[0];
    const queued = await setIssueLabels(trigger, ['draft-batch-requested']);
    replaceLocalIssue(trigger.number, queued);
    activeLane = 'drafting';
    render();
    notice(`The automated writer is finishing ${unfinished.length} current-day article${unfinished.length === 1 ? '' : 's'}. Completed files will move to Ready for Approval.`, 'success');
  } catch (error) {
    notice(`The batch writer could not be started: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Finish Today’s Drafts';
  }
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

function replaceLocalIssue(number, nextIssue) {
  issues = issues.map((issue) => issue.number === number ? nextIssue : issue);
}

async function rejectIssue(number) {
  const previous = issues.find((issue) => issue.number === number);
  if (!previous) {
    notice('That candidate is no longer in the review queue.', 'warn');
    return;
  }
  if (!confirm('Move this candidate to Trash? It will disappear from Ready for Approval immediately and stay blocked from future ingestion.')) return;

  const rejected = {
    ...previous,
    state: 'closed',
    state_reason: 'not_planned',
    labels: [{name:'news-candidate'}, {name:'rejected'}]
  };
  replaceLocalIssue(number, rejected);
  render();
  notice('Moved to Trash. Saving the rejection…', 'info');

  try {
    const saved = await api(`/repos/${OWNER}/${REPO}/issues/${number}`, {
      method:'PATCH',
      body:JSON.stringify({state:'closed', state_reason:'not_planned', labels:['news-candidate','rejected']})
    });
    replaceLocalIssue(number, saved);
    render();
    notice('Candidate rejected and saved in Trash. It will not return to the review queue.', 'success');
  } catch (error) {
    replaceLocalIssue(number, previous);
    render();
    notice(`The rejection could not be saved, so the candidate was restored: ${error.message}`, 'error');
  }
}

function purgePayload(issue) {
  const fingerprint = String(issue?.body || '').match(/<!--\s*WLC_FINGERPRINT:\s*([a-f0-9]{64})\s*-->/i)?.[1];
  if (!fingerprint) return null;
  const tombstone = `<!-- WLC_FINGERPRINT: ${fingerprint.toLowerCase()} -->\n<!-- WLC_DELETED -->\n\nThis rejected editorial file was permanently deleted from the editor. A minimal hidden fingerprint remains only to prevent the same feed item from being recreated.`;
  return {
    title:`DELETED EDITORIAL FILE #${issue.number}`,
    body:tombstone,
    state:'closed',
    state_reason:'not_planned',
    labels:['news-candidate','rejected']
  };
}

async function bulkPurge(numbers, mode = 'selected') {
  const unique = [...new Set(numbers.map(Number))];
  const targets = unique.map((number) => issues.find((issue) => issue.number === number))
    .filter((issue) => issue && laneOf(issue) === 'trash');
  if (!targets.length) {
    notice('Select at least one Trash article first.', 'warn');
    return;
  }
  const unsafe = targets.filter((issue) => !purgePayload(issue));
  if (unsafe.length) {
    notice(`Nothing was deleted. ${unsafe.length} selected file${unsafe.length === 1 ? ' has' : 's have'} no safe deduplication fingerprint.`, 'error');
    return;
  }
  const description = mode === 'all' ? `all ${targets.length} Trash files` : `${targets.length} selected Trash file${targets.length === 1 ? '' : 's'}`;
  if (!confirm(`Permanently delete the headline, report, chat and source links from ${description}? This cannot be undone. Hidden fingerprints will remain only to stop rejected feed items from returning.`)) return;

  const originals = new Map(targets.map((issue) => [issue.number, issue]));
  issues = issues.filter((issue) => !originals.has(issue.number));
  for (const number of originals.keys()) selectedTrash.delete(number);
  render();
  notice(`Deleting ${description}…`, 'info');

  const failures = [];
  for (let start = 0; start < targets.length; start += 5) {
    const batch = targets.slice(start, start + 5);
    const results = await Promise.allSettled(batch.map((issue) => api(`/repos/${OWNER}/${REPO}/issues/${issue.number}`, {
      method:'PATCH',
      body:JSON.stringify(purgePayload(issue))
    })));
    results.forEach((result, index) => {
      if (result.status === 'rejected') failures.push(batch[index]);
    });
    notice(`Deleted ${Math.min(start + batch.length, targets.length) - failures.length} of ${targets.length} Trash files…`, 'info');
  }

  await load();
  if (failures.length) {
    notice(`${targets.length - failures.length} files were permanently deleted. ${failures.length} could not be deleted and remain in Trash.`, 'error');
  } else {
    notice(`${targets.length} Trash file${targets.length === 1 ? '' : 's'} permanently deleted. Only hidden deduplication fingerprints remain.`, 'success');
  }
}

async function act(action, number) {
  if (busy.has(number)) {
    notice('That story is already processing. No second tap is needed.', 'warn');
    return;
  }

  if (action === 'reject') {
    await rejectIssue(number);
    return;
  }

  try {
    const currentIssue = await api(`/repos/${OWNER}/${REPO}/issues/${number}`);
    const labels = labelSet(currentIssue);
    if (action === 'show-canonical') {
      const existing = issues.find((issue) => issue.number === number);
      if (existing) replaceLocalIssue(number, currentIssue);
      else issues.push(currentIssue);
      activeLane = laneOf(currentIssue) || (labels.has('published') ? 'published' : 'ready');
      editorQuery = '';
      editorDesk = 'all';
      editorDate = 'all';
      $('#editorSearch').value = '';
      $('#editorDesk').value = 'all';
      $('#editorDate').value = 'all';
      render();
      document.querySelector(`#issue-card-${number}`)?.scrollIntoView({behavior:'smooth', block:'start'});
      notice(`Showing canonical article #${number} inside the editor. The rejected source record remains grouped with it.`, 'success');
      return;
    }
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


    if (action === 'restore') {
      if (!confirm('Restore this rejected candidate to the newsroom review queue?')) return;
      const canonical = canonicalIssueNumber(currentIssue);
      if (canonical) throw new Error(`This is merged source coverage, not a separate article. Open canonical article #${canonical} instead.`);
      const existingBundle = parseBundle(currentIssue.body || '');
      const restoreBundle = existingBundle || legacyBundle(currentIssue);
      if (!restoreBundle) throw new Error('This legacy record cannot be rebuilt safely because its original source link or deduplication fingerprint is missing. It remains in Trash.');
      const ready = restoreBundle
        && !JSON.stringify(restoreBundle).includes('[EDITOR:')
        && !eventProblems(restoreBundle).length
        && !articleProblems(restoreBundle).length
        && !dialogueProblems(restoreBundle).length;
      const restoreLabels = ['news-candidate', ready ? 'ready-for-approval' : 'redraft-requested'];
      replaceLocalIssue(number, {...currentIssue, state:'open', state_reason:'reopened', labels:restoreLabels.map((name) => ({name}))});
      selectedTrash.delete(number);
      render();
      notice(`Restored to ${ready ? 'Ready for Approval' : 'the rebuild queue'}. Saving…`, 'info');
      const saved = await api(`/repos/${OWNER}/${REPO}/issues/${number}`, {
        method:'PATCH',
        body:JSON.stringify({
          state:'open',
          state_reason:'reopened',
          labels:restoreLabels,
          body:existingBundle ? currentIssue.body : replaceBundle(currentIssue.body || '', restoreBundle)
        })
      });
      replaceLocalIssue(number, saved);
      render();
      notice(`Candidate restored to ${ready ? 'Ready for Approval' : 'Drafting; its rebuild is queued'}.`, 'success');
      return;
    }

    if (action === 'purge') {
      await bulkPurge([number], 'selected');
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
      notice('This source-locked report and article-specific chat are queued for the controlled batch writer.', 'success');
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
$('#finishToday').addEventListener('click', finishTodaysDrafts);
$('#customArticleForm').addEventListener('submit', submitCustomArticle);
if (token) { $('#token').value = token; connect(); }
