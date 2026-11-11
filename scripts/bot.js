import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY; // e.g. "BANSAFAn/meowproject"
const GITHUB_EVENT_NAME = process.env.GITHUB_EVENT_NAME || 'push';
const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const STEP_SUMMARY_PATH = process.env.GITHUB_STEP_SUMMARY;

const RATING_REGEX = /(?:\[rating\]\(\s*(100|[1-9]?\d)\s*\)|\[rating:\s*(100|[1-9]?\d)(?:\s*\/\s*100)?\s*\]|rating:\s*(100|[1-9]?\d))/i;

const SUPPORTED_LANGS = ['uk', 'en', 'de', 'pl', 'be', 'kk'];
const LANG_METADATA = {
  uk: { flag: '🇺🇦', name: 'Українська' },
  en: { flag: '🇬🇧', name: 'English' },
  pl: { flag: '🇵🇱', name: 'Polski' },
  de: { flag: '🇩🇪', name: 'Deutsch' },
  be: { flag: '🇧🇾', name: 'Беларуская' },
  kk: { flag: '🇰🇿', name: 'Қазақша' }
};

function appendSummary(text) {
  console.log(text);
  if (STEP_SUMMARY_PATH && fs.existsSync(path.dirname(STEP_SUMMARY_PATH))) {
    try {
      fs.appendFileSync(STEP_SUMMARY_PATH, text + '\n', 'utf8');
    } catch (_) {}
  }
}

async function githubApi(endpoint, options = {}) {
  const url = `https://api.github.com${endpoint}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'MeowProject-Bot',
    ...(GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

function extractSection(text, title) {
  const reg = new RegExp('(?:^|\\n)###\\s+' + title + '\\s*\\n([\\s\\S]*?)(?=\\n###\\s+|$)', 'i');
  const m = text.match(reg);
  return m ? m[1].trim() : '';
}

async function downloadImage(url, destPath) {
  try {
    const rawUrl = url
      .replace('github.com/', 'raw.githubusercontent.com/')
      .replace('/blob/', '/');
    const res = await fetch(rawUrl);
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, buffer);
      return true;
    }
  } catch (_) {}
  return false;
}

// -----------------------------------------------------------------------------
// A. REVIEW COMPILER (issues comments -> static reviews.json)
// -----------------------------------------------------------------------------
async function compileReviews(issues, slugs, projectsDir) {
  appendSummary('### 💬 Compiling Community Reviews & Ratings into static reviews.json');
  
  const reviewsData = {
    updatedAt: new Date().toISOString(),
    projects: {}
  };

  for (const slug of slugs) {
    const metaPath = path.join(projectsDir, slug, 'project.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    const issue = issues.find(iss => {
      if (iss.pull_request) return false;
      const t = (iss.title || '').toLowerCase();
      return t.includes(meta.name.toLowerCase()) || t.includes(slug.toLowerCase()) || iss.number === meta.issueThreadNumber;
    });

    if (!issue) {
      reviewsData.projects[slug] = {
        issueNumber: meta.issueThreadNumber || null,
        issueUrl: null,
        averageRating: null,
        totalRatings: 0,
        commentsCount: 0,
        reviews: []
      };
      continue;
    }

    let comments = [];
    if (issue.comments > 0) {
      const cRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments?per_page=100`);
      if (cRes.ok && Array.isArray(cRes.data)) {
        comments = cRes.data;
      }
    }

    const ratings = [];
    const reviewsList = [];

    for (const c of comments) {
      const rawBody = (c.body || '').trim();
      const match = rawBody.match(RATING_REGEX);
      let score = null;
      if (match) {
        const val = Number(match[1] || match[2] || match[3]);
        if (!isNaN(val) && val >= 0 && val <= 100) {
          score = val;
          ratings.push(score);
        }
      }
      const cleanedBody = rawBody.replace(RATING_REGEX, '').trim();

      reviewsList.push({
        id: c.id,
        author: c.user?.login || 'community-user',
        avatar: c.user?.avatar_url || '',
        date: (c.created_at || '').slice(0, 10),
        body: cleanedBody,
        score,
        url: c.html_url || issue.html_url,
        issueNum: issue.number
      });
    }

    const avg = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;

    reviewsData.projects[slug] = {
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      averageRating: avg,
      totalRatings: ratings.length,
      commentsCount: reviewsList.length,
      reviews: reviewsList
    };

    appendSummary(`- **${meta.name}** (#${issue.number}): ${reviewsList.length} comments, avg rating: ${avg !== null ? `${avg}/100` : 'none'}`);
  }

  const outDir = path.resolve('public/data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'reviews.json');
  fs.writeFileSync(outPath, JSON.stringify(reviewsData, null, 2) + '\n', 'utf8');
  appendSummary('✅ Successfully updated `public/data/reviews.json`');
  return true;
}

// -----------------------------------------------------------------------------
// B. HANDLE PUSH / DISPATCH
// -----------------------------------------------------------------------------
async function handlePushOrDispatch() {
  appendSummary('## 🐾 MeowProject Bot: Syncing Discussion Issues');
  
  const projectsDir = path.resolve('src/projects');
  if (!fs.existsSync(projectsDir)) {
    appendSummary('❌ `src/projects` directory not found.');
    return;
  }

  const { status, ok, data: issues } = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues?state=all&per_page=100`);
  if (!ok) {
    appendSummary(`❌ Failed to fetch issues (HTTP ${status}): ${JSON.stringify(issues)}`);
    return;
  }

  appendSummary(`Found ${issues.length} existing issues in repository.`);

  const preferredOrder = ['xmcl', 'hmcl', 'atm9', 'sodium', 'lunarclient'];
  const allFolders = fs.readdirSync(projectsDir).filter(f => {
    return fs.statSync(path.join(projectsDir, f)).isDirectory() && fs.existsSync(path.join(projectsDir, f, 'project.json'));
  });

  const slugs = [
    ...preferredOrder.filter(s => allFolders.includes(s)),
    ...allFolders.filter(s => !preferredOrder.includes(s))
  ];

  appendSummary(`Catalog projects to check: \`${slugs.join(', ')}\``);

  let modifiedMeta = false;

  for (const slug of slugs) {
    const metaPath = path.join(projectsDir, slug, 'project.json');
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const expectedTitle = `${meta.category}: ${meta.name}`;

    const existing = issues.find(iss => {
      if (iss.pull_request) return false;
      const t = (iss.title || '').toLowerCase();
      return t.includes(meta.name.toLowerCase()) || t.includes(slug.toLowerCase()) || iss.number === meta.issueThreadNumber;
    });

    let targetIssueNumber = existing ? existing.number : null;

    if (!existing) {
      appendSummary(`Creating discussion issue for **${meta.name}**...`);
      let ukDesc = '';
      let enDesc = '';
      const ukPath = path.join(projectsDir, slug, 'locales', 'uk.json');
      const enPath = path.join(projectsDir, slug, 'locales', 'en.json');
      if (fs.existsSync(ukPath)) {
        try { ukDesc = JSON.parse(fs.readFileSync(ukPath, 'utf8')).description || ''; } catch (_) {}
      }
      if (fs.existsSync(enPath)) {
        try { enDesc = JSON.parse(fs.readFileSync(enPath, 'utf8')).description || ''; } catch (_) {}
      }

      const issueBody = [
        `### ${meta.category.toUpperCase()}: ${meta.name}`,
        ``,
        `Official discussion and community review thread for **${meta.name}**.`,
        ``,
        `- **Website:** ${meta.website || 'N/A'}`,
        `- **Country:** ${meta.country}`,
        `- **License:** ${meta.license}`,
        `- **Platforms:** ${(meta.platforms || []).join(', ')}`,
        ``,
        `---`,
        `#### Description (UK)`,
        ukDesc || 'N/A',
        ``,
        `#### Description (EN)`,
        enDesc || 'N/A',
        ``,
        `---`,
        `### How to leave a review / rating`,
        `Write your feedback in a comment below! Adding \`[rating](0-100)\` at the end (e.g. \`[rating](95)\`) is completely optional and will be automatically displayed on the MeowProject directory card.`,
      ].join('\n');

      let createRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: expectedTitle,
          body: issueBody,
          labels: [meta.category, 'verified-submission', 'discussion']
        })
      });

      if (!createRes.ok && createRes.status === 422) {
        createRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: expectedTitle,
            body: issueBody
          })
        });
      }

      if (createRes.ok) {
        targetIssueNumber = createRes.data.number;
        issues.push(createRes.data);
        appendSummary(`✅ Created Issue #${targetIssueNumber}: [${expectedTitle}](${createRes.data.html_url})`);
      } else {
        appendSummary(`❌ Failed to create issue for ${meta.name} (HTTP ${createRes.status}): ${JSON.stringify(createRes.data)}`);
      }
    } else {
      appendSummary(`ℹ️ Issue already exists: #${existing.number} ([${existing.title}](${existing.html_url}))`);
    }

    if (targetIssueNumber && meta.issueThreadNumber !== targetIssueNumber) {
      meta.issueThreadNumber = targetIssueNumber;
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
      modifiedMeta = true;
    }
  }

  // Compile reviews.json from real comments!
  await compileReviews(issues, slugs, projectsDir);

  try {
    const status = execSync('git status --porcelain').toString().trim();
    if (status.length > 0) {
      execSync('git config user.name "github-actions[bot]"');
      execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
      execSync('git add public/data/reviews.json src/projects/*/project.json');
      execSync('git commit -m "chore(bot): sync issues and update community reviews"');
      execSync('git push origin main');
      appendSummary('✅ Successfully committed changes to main branch.');
    } else {
      appendSummary('ℹ️ No repository changes needed.');
    }
  } catch (e) {
    appendSummary(`⚠️ Note: Git sync status: ${e.message}`);
  }
}

async function handleComment() {
  appendSummary('## 💬 MeowProject Bot: New Comment Detected');
  await handlePushOrDispatch();
}

// -----------------------------------------------------------------------------
// C. PROJECT PROPOSAL -> AUTOMATED PULL REQUEST
// -----------------------------------------------------------------------------
async function handleProjectSubmission(issue, matchedPrefix) {
  const title = (issue.title || '').trim();
  const body = (issue.body || '').trim();

  appendSummary(`### 🚀 Processing New Project Proposal from Issue #${issue.number}: "${title}"`);

  const category = matchedPrefix.replace(':', '').trim().toLowerCase();
  let rawName = title.replace(new RegExp('^' + matchedPrefix, 'i'), '').trim();
  if (!rawName) {
    const fromSection = extractSection(body, 'Type & Name');
    rawName = fromSection.replace(/^`?.*:\s*|`?$/g, '').trim();
  }
  const name = rawName || 'Untitled Project';
  const slug = name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

  const country = extractSection(body, 'Country') || 'GLOBAL';
  const platformsRaw = extractSection(body, 'Platforms');
  const platforms = platformsRaw
    ? platformsRaw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
    : ['Windows'];

  const website = extractSection(body, 'Website');

  // Source code links
  const sourceSection = extractSection(body, 'Source code');
  const sourceLinks = [];
  for (const line of sourceSection.split('\n')) {
    const clean = line.replace(/^[-*]\s*/, '').trim();
    const m = clean.match(/^([a-z0-9_-]+)\s*:\s*(https?:\/\/\S+)/i);
    if (m) {
      sourceLinks.push({
        host: m[1].toLowerCase(),
        label: m[1].charAt(0).toUpperCase() + m[1].slice(1),
        url: m[2]
      });
    } else if (/^https?:\/\//i.test(clean)) {
      sourceLinks.push({
        host: 'git',
        label: 'Repository',
        url: clean
      });
    }
  }

  // Captions & Features
  const featureLines = extractSection(body, 'Key Features')
    .split('\n')
    .map(s => s.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  const captionLines = extractSection(body, 'Screenshot Captions')
    .split('\n')
    .map(s => s.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  // Parse multi-language descriptions
  const descSection = extractSection(body, 'Description') || body;
  const langRegex = /(?:^|\n)####\s+([A-Za-z]{2})\s*\n([\s\S]*?)(?=\n####\s+[A-Za-z]{2}|$)/gi;
  
  const parsedDescriptions = {};
  let lMatch;
  while ((lMatch = langRegex.exec(descSection)) !== null) {
    const code = lMatch[1].toLowerCase();
    parsedDescriptions[code] = lMatch[2].trim();
  }

  // Fallback if no language tags were used
  if (Object.keys(parsedDescriptions).length === 0 && descSection.length >= 20) {
    parsedDescriptions['en'] = descSection;
  }

  const validLangs = [];
  const invalidLangs = [];
  const missingLangs = [];
  const langTableRows = [];

  for (const code of SUPPORTED_LANGS) {
    const text = parsedDescriptions[code];
    const meta = LANG_METADATA[code] || { flag: '🌐', name: code.toUpperCase() };
    const label = `${meta.flag} **${code.toUpperCase()}** (${meta.name})`;

    if (text && text.length >= 20 && text.length <= 2000) {
      validLangs.push(code);
      langTableRows.push(`| ${label} | ${text.length} chars | ✅ **Included in PR** |`);
    } else if (text) {
      invalidLangs.push(code);
      langTableRows.push(`| ${label} | ${text.length} chars | ⚠️ **Out of bounds** (20–2,000 chars required) |`);
    } else {
      missingLangs.push(code);
      langTableRows.push(`| ${label} | — | ⚪ **Not provided** (can be added later via issue) |`);
    }
  }

  if (validLangs.length === 0) {
    await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: [
          `### [MeowProject Bot] Description Required ❌`,
          ``,
          `Could not find a valid description in any supported language. Each description must have at least 20 characters (up to 2,000).`,
          ``,
          `#### 🌐 Current Verification Status:`,
          `| Language | Length | Status |`,
          `|:---|:---|:---|`,
          ...langTableRows,
          ``,
          `Please edit your issue description and add language headers like:`,
          `\`\`\`markdown`,
          `### Description`,
          `#### UK`,
          `Ваш опис українською мовою...`,
          ``,
          `#### EN`,
          `Your description in English...`,
          `\`\`\``
        ].join('\n')
      })
    });
    return;
  }

  // Images handling
  const projectDir = path.resolve('src/projects', slug);
  const localesDir = path.join(projectDir, 'locales');
  const publicDir = path.resolve('public/projects', slug);

  if (!fs.existsSync(localesDir)) fs.mkdirSync(localesDir, { recursive: true });
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  let iconFinal = '/favicon.svg';
  const iconRaw = extractSection(body, 'Icon');
  if (iconRaw && /^https?:\/\//i.test(iconRaw)) {
    const ext = iconRaw.endsWith('.svg') ? '.svg' : iconRaw.endsWith('.webp') ? '.webp' : '.png';
    const localIconPath = path.join(publicDir, `icon${ext}`);
    const downloaded = await downloadImage(iconRaw, localIconPath);
    if (downloaded) {
      iconFinal = `/projects/${slug}/icon${ext}`;
    } else {
      iconFinal = iconRaw.replace('github.com/', 'raw.githubusercontent.com/').replace('/blob/', '/');
    }
  }

  // Screenshots handling
  const screenshotLines = extractSection(body, 'Screenshots')
    .split('\n')
    .map(s => s.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  const screenshotsFinal = [];
  let sIdx = 1;
  for (const sUrl of screenshotLines) {
    if (/^https?:\/\//i.test(sUrl)) {
      const ext = sUrl.endsWith('.webp') ? '.webp' : '.png';
      const localScreenPath = path.join(publicDir, `screen-${sIdx}${ext}`);
      const downloaded = await downloadImage(sUrl, localScreenPath);
      if (downloaded) {
        screenshotsFinal.push(`/projects/${slug}/screen-${sIdx}${ext}`);
      } else {
        screenshotsFinal.push(sUrl.replace('github.com/', 'raw.githubusercontent.com/').replace('/blob/', '/'));
      }
      sIdx++;
    }
  }

  // Write locales
  for (const lang of validLangs) {
    const localeFile = path.join(localesDir, `${lang}.json`);
    const localeContent = {
      tagline: featureLines[0] || name,
      description: parsedDescriptions[lang],
      features: featureLines,
      screenshotCaptions: captionLines
    };
    fs.writeFileSync(localeFile, JSON.stringify(localeContent, null, 2) + '\n', 'utf8');
  }

  // Write project.json
  const projectJsonPath = path.join(projectDir, 'project.json');
  const projectMeta = {
    slug,
    name,
    shortName: name,
    category,
    icon: iconFinal,
    country,
    developer: sourceLinks[0]?.label || 'Community',
    license: 'Open Source',
    platforms,
    website: website || sourceLinks[0]?.url || '',
    sourceLinks,
    issueThreadNumber: issue.number,
    issueSearchTerm: name,
    tags: [category, ...platforms, country].filter(Boolean),
    screenshots: screenshotsFinal
  };
  fs.writeFileSync(projectJsonPath, JSON.stringify(projectMeta, null, 2) + '\n', 'utf8');

  // Git Branch & Commit & Push
  const branchName = `add-project-${slug}-issue-${issue.number}`;
  try {
    execSync('git config user.name "github-actions[bot]"');
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
    execSync(`git checkout -B ${branchName}`);
    execSync(`git add src/projects/${slug}/ public/projects/${slug}/`);
    execSync(`git commit -m "feat(catalog): propose ${category} ${name} from issue #${issue.number}"`);
    execSync(`git push origin ${branchName} --force`);
    appendSummary(`✅ Created & pushed branch: \`${branchName}\``);

    // Create GitHub Pull Request
    const prRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `feat(catalog): add ${category} ${name} (#${issue.number})`,
        head: branchName,
        base: 'main',
        body: [
          `### 🚀 New Project Proposal: ${name} (${category})`,
          ``,
          `Automated Pull Request generated by **MeowProject Bot** from issue #${issue.number}.`,
          ``,
          `#### 📋 Project Details:`,
          `- **Name:** **${name}**`,
          `- **Category:** \`${category}\``,
          `- **Country:** ${country}`,
          `- **Platforms:** ${platforms.join(', ')}`,
          `- **Website:** ${website || 'N/A'}`,
          ``,
          `#### 🌐 Localization Status:`,
          `| Language | Characters | Status |`,
          `|:---|:---|:---|`,
          ...langTableRows,
          ``,
          `#### 📁 Files Added:`,
          `- \`src/projects/${slug}/project.json\``,
          ...validLangs.map(l => `- \`src/projects/${slug}/locales/${l}.json\``),
          ...(fs.existsSync(publicDir) ? [`- Assets in \`public/projects/${slug}/\``] : []),
          ``,
          `---`,
          `Closes #${issue.number}`
        ].join('\n')
      })
    });

    const prUrl = prRes.data?.html_url || `branch \`${branchName}\``;
    const prNumber = prRes.data?.number ? `#${prRes.data.number}` : '';

    // Comment back on the Issue
    await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: [
          `### [MeowProject Bot] Project Submission Analyzed & Pull Request Created! 🎉`,
          ``,
          `Thank you for contributing **${name}** to MeowProject!`,
          ``,
          `- **Project:** **${name}** (\`${category}\`)`,
          `- **Country:** ${country}`,
          `- **Platforms:** ${platforms.join(', ')}`,
          `- **Pull Request:** ${prNumber} ([View Pull Request](${prUrl}))`,
          ``,
          `#### 🌐 Language Verification Breakdown:`,
          `| Language | Length | Status |`,
          `|:---|:---|:---|`,
          ...langTableRows,
          ``,
          `---`,
          `> 💡 **Next steps:** The repository maintainer can review and merge the Pull Request (${prUrl}). Once merged into \`main\`, the project will automatically appear on the live website!`
        ].join('\n')
      })
    });

    appendSummary(`🎉 Pull Request created successfully: ${prUrl}`);
  } catch (err) {
    appendSummary(`❌ Failed creating PR: ${err.message}`);
  } finally {
    try {
      execSync('git checkout main');
    } catch (_) {}
  }
}

// -----------------------------------------------------------------------------
// D. MAIN DISPATCHER
// -----------------------------------------------------------------------------
async function handleIssues(eventPayload) {
  const issue = eventPayload.issue;
  if (!issue) return;

  const action = eventPayload.action;
  const title = (issue.title || '').trim();
  const lowerTitle = title.toLowerCase();

  appendSummary(`Processing issue #${issue.number} ("${title}") [action: ${action}]`);

  // 1. Translation Contribution: [i18n: <slug>]
  const i18nMatch = lowerTitle.match(/^(?:\[i18n:\s*([a-z0-9_-]+)\]|translate:\s*([a-z0-9_-]+))/i);
  if (i18nMatch) {
    const slug = (i18nMatch[1] || i18nMatch[2]).toLowerCase().trim();
    const projectDir = path.resolve('src/projects', slug);

    if (!fs.existsSync(projectDir)) {
      await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: `### [MeowProject Bot] Project Not Found\n\nCould not find a project with slug \`${slug}\` in \`src/projects/\`. Please verify the project slug.`
        })
      });
      return;
    }

    const langRegex = /####\s+([A-Z]{2})\s*\n([\s\S]*?)(?=(?:####\s+[A-Z]{2}|$))/gi;
    let match;
    const submittedTranslations = {};
    while ((match = langRegex.exec(issue.body || '')) !== null) {
      const langCode = match[1].toLowerCase();
      const descText = match[2].trim();
      if (descText.length >= 20) {
        submittedTranslations[langCode] = descText;
      }
    }

    const detectedCodes = Object.keys(submittedTranslations);
    if (detectedCodes.length === 0) {
      await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: `### [MeowProject Bot] Translation Template Needed\n\nPlease structure your description using language headers like:\n\n\`\`\`markdown\n#### EN\nYour English description here (at least 20 chars)...\n\n#### DE\nIhre deutsche Beschreibung hier...\n\`\`\``
        })
      });
      return;
    }

    await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels: ['i18n', 'automated-pr'] })
    });

    if (action === 'opened' || action === 'edited') {
      const localesDir = path.join(projectDir, 'locales');
      if (!fs.existsSync(localesDir)) fs.mkdirSync(localesDir, { recursive: true });

      for (const [code, desc] of Object.entries(submittedTranslations)) {
        const filePath = path.join(localesDir, `${code}.json`);
        let existing = {
          tagline: '',
          description: desc,
          features: [],
          screenshotCaptions: []
        };
        if (fs.existsSync(filePath)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            existing = { ...existing, ...parsed, description: desc };
          } catch (_) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
      }

      const branchName = `i18n-${slug}-issue-${issue.number}`;
      execSync('git config user.name "github-actions[bot]"');
      execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
      execSync(`git checkout -B ${branchName}`);
      execSync(`git add src/projects/${slug}/locales/`);
      execSync(`git commit -m "i18n: add/update ${detectedCodes.join(', ')} translation for ${slug} (#${issue.number})"`);
      execSync(`git push origin ${branchName} --force`);

      const prRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/pulls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `i18n: ${slug} translations (${detectedCodes.join(', ')})`,
          head: branchName,
          base: 'main',
          body: `Automated PR generated from translation submission issue #${issue.number}.\n\nLanguages updated: \`${detectedCodes.join(', ')}\`\nCloses #${issue.number}`
        })
      });

      const prUrl = prRes.data ? prRes.data.html_url : `branch ${branchName}`;
      await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: `### [MeowProject Bot] Automated PR Created!\n\nThank you for contributing translations for **${slug}**! 🎉\n\n- **Target Languages:** \`${detectedCodes.join(', ')}\`\n- **Pull Request:** ${prUrl}\n\nOnce reviewed and merged, the site will automatically update!`
        })
      });

      execSync('git checkout main');
    }
    return;
  }

  // 2. New Project Submission: prefix check
  const validPrefixes = ['launcher:', 'modpack:', 'mod:', 'client:', 'service:', 'website:', 'project:'];
  const matchedPrefix = validPrefixes.find(p => lowerTitle.startsWith(p));

  if (!matchedPrefix) {
    await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: `### [MeowProject Bot] Title Format Verification Required\n\nPlease start the issue title with a valid project type prefix:\n- \`launcher: Name\`\n- \`modpack: Name\`\n- \`mod: Name\`\n- \`client: Name\`\n- \`service: Name\`\n- \`website: Name\`\n- \`project: Name\``
      })
    });
    return;
  }

  const typeLabel = matchedPrefix.replace(':', '');
  await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels: [typeLabel, 'verified-submission', 'automated-pr'] })
  });

  // Handle proposal and create PR!
  await handleProjectSubmission(issue, matchedPrefix);
}

async function main() {
  console.log(`Starting MeowProject Bot (Event: ${GITHUB_EVENT_NAME}, Repo: ${GITHUB_REPOSITORY})`);

  let eventPayload = {};
  if (GITHUB_EVENT_PATH && fs.existsSync(GITHUB_EVENT_PATH)) {
    try {
      eventPayload = JSON.parse(fs.readFileSync(GITHUB_EVENT_PATH, 'utf8'));
    } catch (_) {}
  }

  if (GITHUB_EVENT_NAME === 'push' || GITHUB_EVENT_NAME === 'workflow_dispatch') {
    await handlePushOrDispatch();
  } else if (GITHUB_EVENT_NAME === 'issue_comment') {
    await handleComment();
  } else if (GITHUB_EVENT_NAME === 'issues') {
    await handleIssues(eventPayload);
  } else {
    console.log(`Event ${GITHUB_EVENT_NAME} does not require action.`);
  }
}

main().catch(err => {
  appendSummary(`❌ Fatal error in bot execution: ${err.message}\n\`\`\`\n${err.stack}\n\`\`\``);
  process.exit(1);
});
