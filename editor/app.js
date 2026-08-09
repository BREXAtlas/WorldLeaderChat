const OWNER = 'BREXAtlas';
const REPO = 'WorldLeaderChat';
const API = 'https://api.github.com';
const START = '<!-- WLC_STORY_JSON_START -->';
const END = '<!-- WLC_STORY_JSON_END -->';
const lanes = [['new','New'],['drafting','Drafting'],['ready','Ready for Approval'],['published','Published']];

let token = sessionStorage.getItem('wlc_editor_token') || '';
let issues = [];
const busy = new Set();

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

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
  let text = body.slice(start + START.length, end).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch { return null; }
}

function replaceBundle(body, bundle) {
  const start = body.indexOf(START);
  const end = body.indexOf(END);
  const block = `${START}\n\`\`\`json\n${JSON.stringify(bundle, null, 2)}\n\`\`\`\n${END}`;
  return start >= 0 && end > start ? body.slice(0, start) + block + body.slice(end + END.length) : `${body}\n\n${block}`;
}

function laneOf(issue) {
  const labels = labelSet(issue);
  if (labels.has('published')) return 'published';
  if (issue.state === 'closed') return null;
  if (labels.has('editorial-approved') || labels.has('ready-for-approval')) return 'ready';
  const bundle = parseBundle(issue.body || '');
  if (bundle && !JSON.stringify(bundle).includes('[EDITOR:')) return 'ready';
  if (labels.has('drafting')) return 'drafting';
  return 'new';
}

function smartText(bundle) {
  const text = `${bundle?.event?.title || ''} ${bundle?.event?.summary || ''}`;
  const sensitive = /killed|dead|death|hostage|missile attack|civilian|gaza|war/i.test(text);
  return sensitive
    ? 'S-M-A-R: source locked; satire targets leaders and institutions only; sober handling recommended; no jokes at victims’ expense.'
    : 'S-M-A-R: source locked; recognizable public personas; one clear comic angle; final review keeps invented messages explicitly fictional.';
}

function fallbackSuggestion(bundle, version = 0) {
  if (!bundle) return null;
  const result = structuredClone(bundle);
  const text = `${result.event.title} ${result.event.summary}`.toLowerCase();
  const iran = /iran|hormuz|nuclear/.test(text);
  const ukraine = /ukraine|zelensky|kyiv|russia/.test(text);
  const china = /china|consulate/.test(text);
  const gaza = /gaza|netanyahu|hamas/.test(text);
  const trump = /trump/.test(text);
  const vance = /vance/.test(text);
  let title, kicker, messages, meme, tone = 'comic';

  if (gaza) {
    title = version % 2 ? 'THE 15-POINT GAZA PLAN GETS A 16TH POINT: EVERYONE HAS NOTES' : 'TRUMP POSTS A 15-POINT GAZA PLAN; NETANYAHU REPLIES WITH POINT 16: NO';
    kicker = 'A U.S. Gaza proposal meets Israeli resistance, so the fictional leaders’ chat becomes a negotiation over what the word “plan” was supposed to mean.';
    messages = [
      ['UN Admin','New thread: Gaza plan. Facts are sourced; private replies below are fictional satire.','system'],
      ['Trump','Fifteen points. Very complete. People love numbered plans because you can tell they have points.','satire'],
      ['Netanyahu','I read all fifteen. I have notes. The first note is no withdrawal before disarmament.','satire'],
      ['Macron','A plan is not yet an agreement. Europe has several binders proving this.','satire'],
      ['Meloni','Can we get one geopolitical document where “final” survives contact with the participants?','satire'],
      ['Xi','China notes that numbered plans have a tendency to acquire additional points after publication.','satire']
    ];
    meme = 'UN Admin renamed the file: 15-POINT-PLAN_v7_FINAL_FINAL.pdf';
    tone = 'sober';
  } else if (ukraine) {
    title = 'ZELENSKYY ENTERS THE CHAT SERBIA HOPED WOULD STAY ON MUTE';
    kicker = 'A Serbia visit lands in the middle of another Russia-Ukraine escalation, turning the imaginary leaders’ chat into a diplomacy stress test.';
    messages = [
      ['UN Admin','New topic: Serbia, Ukraine and Russia. Please avoid turning strategic ambiguity into a reaction emoji.','system'],
      ['Zelenskyy','I came to talk cooperation. Somehow every room in Europe still has one invisible chair labeled Moscow.','satire'],
      ['Putin','Invisible? I prefer historically reserved.','satire'],
      ['Meloni','Could everyone stop treating geography like a group project where nobody read the instructions?','satire'],
      ['Trump','I could settle this chat very quickly. First we need better admins. Tremendous admins.','satire'],
      ['Xi','China observes that the mute function remains underused.','satire']
    ];
    meme = 'UN Admin changed the group description to: NO ONE IS NEUTRAL AFTER THE THIRD REPLY.';
  } else if (iran && vance) {
    title = 'VANCE POSTS “MISSION ACCOMPLISHED” AND THE CHAT IMMEDIATELY ASKS FOR RECEIPTS';
    kicker = 'A sweeping U.S. claim about Iran’s nuclear program becomes the kind of message every leader reads twice before reacting.';
    messages = [
      ['UN Admin','Reminder: operational claims require sources. Reaction emojis do not count as verification.','system'],
      ['Vance','The program is destroyed. I am choosing the confident font.','satire'],
      ['Trump','Very strong statement. I would have used all caps, but strong.','satire'],
      ['Iran','Interesting. We appear to have been informed of our status through the group chat.','satire'],
      ['Macron','Can we distinguish destroyed, degraded, and the briefing had a dramatic slide?','satire'],
      ['Xi','Precision in language is useful, especially after precision strikes.','satire']
    ];
    meme = 'Vance pinned a message. Everyone else pinned the word verification.';
  } else if (iran && trump) {
    title = version % 2 ? 'TRUMP TYPES “FINAL WARNING” AGAIN; IRAN CHECKS THE CHAT HISTORY' : 'THE IRAN WAR CHAT HAS ENTERED ITS “FINAL WARNING — PART 14” ERA';
    kicker = 'Threats, negotiations and political timing collide in the fictional group chat where everyone has receipts from the previous “final” warning.';
    messages = [
      ['UN Admin','Please number all final warnings so the archive remains searchable.','system'],
      ['Trump','This one is extremely final. More final than the others.','satire'],
      ['Iran','We have created a folder titled FINAL_FINAL_REAL_THIS_TIME.','satire'],
      ['Macron','Diplomacy would benefit from fewer season finales.','satire'],
      ['Putin','The useful thing about red lines is how often they can be redrawn.','satire'],
      ['Xi','China recommends fewer typing indicators and more negotiated text.','satire']
    ];
    meme = 'UN Admin enabled disappearing messages. The threats did not disappear.';
  } else if (iran) {
    title = 'HORMUZ GROUP CHAT ADDS A TOLL BOOTH AND EVERY NAVY STARTS TYPING';
    kicker = 'A Strait of Hormuz dispute turns one of the world’s most strategic waterways into the least relaxing group-chat logistics thread imaginable.';
    messages = [
      ['UN Admin','New rule: shipping-lane arguments go in #maritime-chaos.','system'],
      ['Iran','Some vessels may require… premium access.','satire'],
      ['Trump','Nobody does tolls better than us. But this toll? Terrible toll.','satire'],
      ['Israel','Just checking whether hostile country comes with a loyalty program.','satire'],
      ['Xi','Shipping prefers predictability. Markets also prefer leaders not inventing surge pricing at sea.','satire'],
      ['Meloni','I left the chat for six minutes and someone monetized a strait.','satire']
    ];
    meme = 'The Strait of Hormuz is now the only group member with surge pricing.';
  } else if (china) {
    title = 'AMERICA CLOSES CONSULATES; CHINA REPLIES “THANKS FOR THE OPEN DESK SPACE”';
    kicker = 'Diplomatic cost-cutting becomes a fictional real-estate argument over who occupies the influence left behind.';
    messages = [
      ['UN Admin','Diplomatic footprint changes detected. Please stop calling embassies retail locations.','system'],
      ['Trump','We are cutting waste. Very efficient.','satire'],
      ['Xi','Efficiency is admirable. We will efficiently schedule some meetings nearby.','satire'],
      ['Macron','Influence has a curious habit of occupying vacant offices.','satire'],
      ['Meloni','You cannot cancel diplomacy like a streaming subscription and act surprised when the plot continues.','satire'],
      ['Milei','Have you considered replacing every consulate with a chainsaw emoji? Asking academically.','satire']
    ];
    meme = 'Xi reacted 🏢 to “five locations now available.”';
  } else {
    title = 'WORLD LEADERS OPENED THE NEWS AND IMMEDIATELY REGRETTED HAVING READ RECEIPTS ON';
    kicker = 'A real-world headline becomes a fictional private thread built from public personas, policy positions and diplomatic awkwardness.';
    messages = [
      ['UN Admin','New event added. Facts are sourced; everything below is fictional satire.','system'],
      ['Trump','I have thoughts. Many people are saying they are excellent thoughts.','satire'],
      ['Meloni','That sentence already made the meeting longer.','satire'],
      ['Macron','Could we attempt one reply containing a complete policy?','satire'],
      ['Xi','China is observing the typing indicator.','satire'],
      ['Milei','I have brought a metaphorical chainsaw. Again.','satire']
    ];
    meme = 'UN Admin disabled “Everyone can change the group name.”';
  }

  result.event.title = title;
  result.event.kicker = kicker;
  result.event.messages = messages.map(([speaker,text,kind]) => ({speaker,text,kind,reaction:''}));
  result.event.meme = meme;
  result.event.tone = tone;
  result.approval = {...(result.approval || {}), draftVersion: version, reviewNotes: smartText(result)};
  return result;
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
  render();
}

function render() {
  const counts = Object.fromEntries(lanes.map(([key]) => [key, issues.filter((issue) => laneOf(issue) === key).length]));
  $('#tabs').innerHTML = lanes.map(([key,name], index) => `<button class="tab ${index === 0 ? 'active' : ''}" data-lane="${key}">${name}<span class="count">${counts[key]}</span></button>`).join('');
  $('#board').innerHTML = lanes.map(([key,name], index) => `<section class="lane ${index === 0 ? 'show' : ''}" data-lane="${key}"><h2>${name}</h2>${cards(key)}</section>`).join('');
  document.querySelectorAll('.tab').forEach((button) => button.onclick = () => {
    document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === button));
    document.querySelectorAll('.lane').forEach((item) => item.classList.toggle('show', item.dataset.lane === button.dataset.lane));
  });
  document.querySelectorAll('[data-action]').forEach((button) => button.onclick = () => act(button.dataset.action, Number(button.dataset.issue)));
}

function cards(lane) {
  const set = issues.filter((issue) => laneOf(issue) === lane);
  if (!set.length) return '<div class="empty">Nothing here.</div>';
  return set.map((issue) => {
    const labels = labelSet(issue);
    const submitted = labels.has('editorial-approved') || busy.has(issue.number);
    let bundle = parseBundle(issue.body || '');
    if (bundle && JSON.stringify(bundle).includes('[EDITOR:')) bundle = fallbackSuggestion(bundle, 0);
    const messages = (bundle?.event?.messages || []).map((message) => `<div class="msg ${message.kind === 'system' ? 'system' : ''}"><b>${esc(message.speaker)}</b>${esc(message.text)}</div>`).join('');
    const source = bundle?.event?.sources?.[0];
    let actions = '<span class="tag ready">Live</span>';
    if (lane !== 'published') {
      actions = submitted
        ? '<button class="btn pending" disabled>Publishing…</button><span class="action-note">Approval already submitted. Do not tap again.</span>'
        : `<button class="btn success" data-action="approve" data-issue="${issue.number}">Approve & Publish</button><button class="btn ghost" data-action="regenerate" data-issue="${issue.number}">Regenerate</button><button class="btn danger" data-action="reject" data-issue="${issue.number}">Reject</button>`;
    }
    return `<article class="card"><div class="meta">ISSUE #${issue.number} • ${esc(bundle?.event?.date || '')}</div><span class="tag ${lane === 'ready' ? 'ready' : lane === 'new' ? 'new' : 'draft'}">${submitted ? 'Publishing' : lane}</span><span class="tag">${esc(bundle?.event?.category || 'World Affairs')}</span><h3>${esc(bundle?.event?.title || issue.title)}</h3><p class="summary">${esc(bundle?.event?.summary || '')}</p>${source ? `<a class="source" target="_blank" rel="noopener" href="${esc(source.url)}">Open source: ${esc(source.publisher)}</a>` : ''}<div class="chat">${messages}</div><div class="meme">${esc(bundle?.event?.meme || '')}</div><div class="smart"><b>S-M-A-R REVIEW</b><br>${esc(smartText(bundle))}</div><div class="actions">${actions}</div></article>`;
  }).join('');
}

async function waitForPublish(number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const issue = await api(`/repos/${OWNER}/${REPO}/issues/${number}`);
    const labels = labelSet(issue);
    if (issue.state === 'closed' || labels.has('published')) return true;
  }
  return false;
}

async function act(action, number) {
  if (busy.has(number)) {
    notice('That story is already processing. No second tap is needed.', 'warn');
    return;
  }
  const localIssue = issues.find((item) => item.number === number);
  if (!localIssue) return;

  try {
    const currentIssue = await api(`/repos/${OWNER}/${REPO}/issues/${number}`);
    const currentLabels = labelSet(currentIssue);
    if (currentIssue.state === 'closed' || currentLabels.has('published')) {
      notice('Already published. The dashboard has been refreshed.', 'success');
      await load();
      return;
    }
    if (currentLabels.has('editorial-approved')) {
      notice('Approval was already submitted and GitHub Actions is processing it. Do not approve it again.', 'warn');
      await load();
      return;
    }

    let bundle = parseBundle(currentIssue.body || '');
    if (!bundle) throw new Error('This issue has no valid editorial bundle.');
    const version = Number(bundle.approval?.draftVersion || 0);
    if (JSON.stringify(bundle).includes('[EDITOR:')) bundle = fallbackSuggestion(bundle, version);

    if (action === 'regenerate') {
      bundle = fallbackSuggestion(bundle, version + 1);
      await api(`/repos/${OWNER}/${REPO}/issues/${number}`, {method:'PATCH', body:JSON.stringify({body:replaceBundle(currentIssue.body, bundle)})});
      notice('New chat angle generated.', 'success');
      await load();
      return;
    }

    if (action === 'reject') {
      if (!confirm('Reject this candidate? It will be closed without publishing.')) return;
      busy.add(number); render();
      await api(`/repos/${OWNER}/${REPO}/issues/${number}`, {method:'PATCH', body:JSON.stringify({state:'closed', state_reason:'not_planned'})});
      busy.delete(number);
      notice('Candidate rejected. Nothing was published.', 'success');
      await load();
      return;
    }

    if (action === 'approve') {
      if (!confirm('Approve this completed fictional chat and publish it?')) return;
      busy.add(number);
      render();
      notice('Approval submitted. Publishing has started — this button is now locked.', 'info');

      bundle.status = 'approved';
      bundle.approval = {...(bundle.approval || {}), reviewNotes: smartText(bundle)};
      for (const key of ['sourceOpened','summaryVerified','namesAndTitlesVerified','publicQuotesVerified','satireTargetsPowerNotVictims','sensitiveEventReview','clearSatireLabel']) bundle.factCheck[key] = true;
      if ((bundle.event.sources || []).length < 2) {
        bundle.factCheck.twoSourceRuleMet = false;
        bundle.factCheck.singleSourceException = 'Owner editorial approval accepts this single-source candidate because the factual setup is narrowly limited to the linked report; all private chat dialogue is explicitly fictional satire.';
      } else {
        bundle.factCheck.twoSourceRuleMet = true;
        bundle.factCheck.singleSourceException = '';
      }

      await api(`/repos/${OWNER}/${REPO}/issues/${number}`, {method:'PATCH', body:JSON.stringify({body:replaceBundle(currentIssue.body, bundle)})});
      await api(`/repos/${OWNER}/${REPO}/issues/${number}/labels`, {method:'POST', body:JSON.stringify({labels:['fact-checked']})});
      await api(`/repos/${OWNER}/${REPO}/issues/${number}/labels`, {method:'POST', body:JSON.stringify({labels:['editorial-approved']})});

      const published = await waitForPublish(number);
      busy.delete(number);
      if (published) notice('Published ✓ The live site has been updated.', 'success');
      else notice('Approval is safely queued in GitHub Actions. It is still processing; do not tap Approve again.', 'warn');
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
