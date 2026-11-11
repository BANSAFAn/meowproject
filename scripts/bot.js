import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY; // e.g. "BANSAFAn/meowproject"
const GITHUB_EVENT_NAME = process.env.GITHUB_EVENT_NAME || 'push';
const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const STEP_SUMMARY_PATH = process.env.GITHUB_STEP_SUMMARY;

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

async function handlePushOrDispatch() {
  appendSummary('## 🐾 MeowProject Bot: Syncing Discussion Issues');
  
  const projectsDir = path.resolve('src/projects');
  if (!fs.existsSync(projectsDir)) {
    appendSummary('❌ `src/projects` directory not found.');
    return;
  }

  // 1. Fetch all existing issues
  const { status, ok, data: issues } = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues?state=all&per_page=100`);
  if (!ok) {
    appendSummary(`❌ Failed to fetch issues (HTTP ${status}): ${JSON.stringify(issues)}`);
    if (status === 403) {
      appendSummary('> ⚠️ **Permission notice**: Please ensure GitHub Actions has **Read and write permissions** in:\n> `Repository Settings -> Actions -> General -> Workflow permissions`.');
    }
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
      return t.includes(meta.name.toLowerCase()) || t.includes(slug.toLowerCase());
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

      // Try with labels first
      let createRes = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: expectedTitle,
          body: issueBody,
          labels: [meta.category, 'verified-submission', 'discussion']
        })
      });

      // If failed due to non-existent labels (422), retry without labels
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
        appendSummary(`✅ Created Issue #${targetIssueNumber}: [${expectedTitle}](${createRes.data.html_url})`);
      } else {
        appendSummary(`❌ Failed to create issue for ${meta.name} (HTTP ${createRes.status}): ${JSON.stringify(createRes.data)}`);
        if (createRes.status === 403) {
          appendSummary('> ⚠️ **Action Required**: GITHUB_TOKEN has insufficient permissions to write issues. Please enable **Read and write permissions** under **Settings -> Actions -> General -> Workflow permissions**.');
        }
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

  if (modifiedMeta) {
    try {
      execSync('git config user.name "github-actions[bot]"');
      execSync('git config user.email "github-actions[bot]@users.noreply.github.com"');
      execSync('git add src/projects/*/project.json');
      execSync('git commit -m "chore(bot): sync issueThreadNumber for catalog projects"');
      execSync('git push origin main');
      appendSummary('✅ Successfully committed synced `issueThreadNumber` values to main branch.');
    } catch (e) {
      appendSummary(`⚠️ Note: Could not commit updated issueThreadNumber: ${e.message}`);
    }
  }
}

async function handleIssues(eventPayload) {
  const issue = eventPayload.issue;
  if (!issue) return;

  const action = eventPayload.action;
  const title = (issue.title || '').trim();
  const body = (issue.body || '').trim();
  const lowerTitle = title.toLowerCase();

  appendSummary(`Processing issue #${issue.number} ("${title}") [action: ${action}]`);

  // 1. Translation Contribution: [i18n: <slug>] or translate: <slug>
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
    while ((match = langRegex.exec(body)) !== null) {
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

    // Add labels
    await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels: ['i18n', 'automated-pr'] })
    });

    if (action === 'opened') {
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
      execSync(`git checkout -b ${branchName}`);
      execSync(`git add src/projects/${slug}/locales/`);
      execSync(`git commit -m "i18n: add/update ${detectedCodes.join(', ')} translation for ${slug} (#${issue.number})"`);
      execSync(`git push origin ${branchName}`);

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
    }
    return;
  }

  // 2. New Project Submission Issue
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
    body: JSON.stringify({ labels: [typeLabel, 'verified-submission'] })
  });

  if (action === 'opened') {
    await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: `### [MeowProject Bot] Submission Verified (${matchedPrefix})\n\n- **Title Format:** Confirmed (\`${title}\`)\n- **Body Length:** ${body.length} characters (limit up to 2,000 chars)\n- **Community Reviews & Ratings:** Community members can leave feedback in comments below. Adding \`[rating](0-100)\` at the end (e.g. \`[rating](95)\`) is completely optional.`
      })
    });
  }
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
