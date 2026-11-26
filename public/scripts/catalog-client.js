/* Extracted from CatalogPage.astro — shared cached client bundle */
(function () {
  let repo, repoUrl, emptyReviewsMsg, verifiedLabel, ratingLabel, noRatingLabel, openTabLabel;
  let uiLang, acceptedCountries, initialSlug, initialCat, tabTitles, categoryTitles, uiStrings;
  let compareCatalog = [], compareStrings = {}, discordStrings = {};

  function decodeB64UrlUtf8(str) {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function loadCatalogConfig() {
    const el = document.getElementById('meow-catalog-config');
    if (!el) return false;
    try {
      const cfg = JSON.parse(el.textContent || '{}');
      repo = cfg.repo;
      repoUrl = cfg.repoUrl;
      discordStrings = cfg.discordStrings || {};
      compareCatalog = cfg.compareCatalog || [];
      compareStrings = cfg.compareStrings || {};
      emptyReviewsMsg = cfg.emptyReviewsMsg;
      verifiedLabel = cfg.verifiedLabel;
      ratingLabel = cfg.ratingLabel;
      noRatingLabel = cfg.noRatingLabel;
      openTabLabel = cfg.openTabLabel;
      uiLang = cfg.uiLang;
      acceptedCountries = cfg.acceptedCountries || [];
      initialSlug = cfg.initialSlug || null;
      initialCat = cfg.initialCat || 'all';
      tabTitles = cfg.tabTitles || {};
      categoryTitles = cfg.categoryTitles || {};
      uiStrings = cfg.uiStrings || {};
      return true;
    } catch (_) {
      return false;
    }
  }
  loadCatalogConfig();

      // Anti-XSS & Script Sanitizer Function
      function sanitizePlainText(input) {
        if (!input || typeof input !== 'string') return '';
        return input
          .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
          .replace(/javascript\s*:/gi, '')
          .replace(/data\s*:\s*text\/html/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .replace(/[<>]/g, '');
      }

      function hasForbiddenScriptPayload(input) {
        if (!input || typeof input !== 'string') return false;
        return /(<script|javascript\s*:|onerror\s*=|onload\s*=|<iframe|<object|<embed)/i.test(input);
      }

      function setupPage() {
        if (!loadCatalogConfig()) return;
        const vcGuard = document.getElementById('view-catalog');
        if (vcGuard && vcGuard.dataset.meowInit === '1') return;
        if (vcGuard) vcGuard.dataset.meowInit = '1';
        // 1. Theme Toggle
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn && !themeBtn.dataset.bound) {
          themeBtn.dataset.bound = '1';
          themeBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('meow_theme', next);
          });
        }

        // Custom Language Dropdown Controller
        const langDropdown = document.getElementById('lang-dropdown');
        const langTrigger = document.getElementById('lang-dropdown-trigger');
        const langMenu = document.getElementById('lang-dropdown-menu');

        if (langTrigger && langDropdown && !langTrigger.dataset.bound) {
          langTrigger.dataset.bound = '1';

          const toggleDropdown = (show) => {
            const isOpen = show !== undefined ? show : !langDropdown.classList.contains('open');
            langDropdown.classList.toggle('open', isOpen);
            langTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (langMenu) langMenu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
          };

          langTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
          });

          document.addEventListener('click', (e) => {
            if (!langDropdown.contains(e.target)) {
              toggleDropdown(false);
            }
          });

          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && langDropdown.classList.contains('open')) {
              toggleDropdown(false);
              langTrigger.focus();
            }
          });
        }

        if (langMenu && !langMenu.dataset.choiceBound) {
          langMenu.dataset.choiceBound = '1';
          langMenu.querySelectorAll('[data-lang-choice]').forEach((item) => {
            item.addEventListener('click', () => {
              try {
                const chosen = item.getAttribute('data-lang-choice');
                if (chosen) localStorage.setItem('meow_lang_manual', chosen);
              } catch (_) {}
            });
          });
        }

        // 2. Top-Level Views & Dedicated Single-Project View Mode
        const viewButtons = document.querySelectorAll('[data-view-btn]');
        const viewPanels = {
          catalog: document.getElementById('view-catalog'),
          guide: document.getElementById('view-guide'),
          submit: document.getElementById('view-submit'),
          expenses: document.getElementById('view-expenses'),
          report: document.getElementById('view-report'),
          discussions: document.getElementById('view-discussions'),
          i10n: document.getElementById('view-i10n'),
        };
        const filterBar = document.getElementById('catalog-filter-bar');
        const singleBackBar = document.getElementById('single-project-back-bar');
        const exitSingleBtn = document.getElementById('btn-exit-single-project');
        const vcInit = document.getElementById('view-catalog');
        const domSlug = vcInit?.getAttribute('data-initial-slug') || null;
        const domCat = vcInit?.getAttribute('data-initial-cat') || 'all';
        let singleProjectSlug = domSlug || initialSlug;

        function updateBrowserTabIdentity(activeView, activeCat, activeSlug) {
          try {
            let nextTitle = `${tabTitles.catalog || 'MeowLab'} — MeowLab`;
            let svgData = null;

            const makeSvgDataUri = (bg, fg, inner) =>
              'data:image/svg+xml,' +
              encodeURIComponent(
                `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${bg}" stroke="#181615" stroke-width="2"/>${inner.replace(/CURRENT/g, fg)}</svg>`
              );

            if (activeSlug) {
              const card = document.querySelector(`[data-project-card="${activeSlug}"]`);
              const pName = card ? card.getAttribute('data-project-name') : activeSlug;
              const pIcon = card ? card.querySelector('.dossier-icon-frame img')?.getAttribute('src') : null;
              nextTitle = `${pName} — MeowLab`;
              if (pIcon) svgData = pIcon;
            } else if (activeView && activeView !== 'catalog') {
              const label = tabTitles[activeView] || activeView;
              nextTitle = `${label} — MeowLab`;
              const icons = {
                guide: makeSvgDataUri('#f59e0b', '#181615', '<path d="M9 7h10l4 4v14H9V7zm4 6h6v2h-6v-2zm0 4h6v2h-6v-2z" fill="CURRENT"/>'),
                submit: makeSvgDataUri('#22c55e', '#181615', '<path d="M14 7h4v7h7v4h-7v7h-4v-7H7v-4h7V7z" fill="CURRENT"/>'),
                expenses: makeSvgDataUri('#eab308', '#181615', '<rect x="6" y="9" width="20" height="14" rx="2" fill="none" stroke="CURRENT" stroke-width="2.5"/><line x1="6" y1="14" x2="26" y2="14" stroke="CURRENT" stroke-width="2.5"/>'),
                report: makeSvgDataUri('#dc2626', '#ffffff', '<polygon points="16,5 28,26 4,26" fill="none" stroke="CURRENT" stroke-width="2.4"/><rect x="15" y="12" width="2" height="7" fill="CURRENT"/><rect x="15" y="21" width="2" height="2" fill="CURRENT"/>'),
                discussions: makeSvgDataUri('#3b82f6', '#ffffff', '<path d="M6 7h20v13H13l-7 5V7z" fill="CURRENT"/>'),
                i10n: makeSvgDataUri('#38bdf8', '#0b0f17', '<circle cx="16" cy="16" r="9" fill="none" stroke="CURRENT" stroke-width="2.2"/><line x1="7" y1="16" x2="25" y2="16" stroke="CURRENT" stroke-width="2"/><line x1="16" y1="7" x2="16" y2="25" stroke="CURRENT" stroke-width="2"/>'),
              };
              svgData = icons[activeView] || '/favicon.svg';
            } else if (activeCat && activeCat !== 'all') {
              const catName = categoryTitles[activeCat] || activeCat;
              nextTitle = `${catName} — MeowLab`;
              const catLetter = String(activeCat).charAt(0).toUpperCase();
              svgData = makeSvgDataUri('#181615', '#f59e0b', `<text x="16" y="22" text-anchor="middle" font-family="monospace" font-weight="900" font-size="16" fill="CURRENT">${catLetter}</text>`);
            } else {
              svgData = '/favicon.svg';
            }

            document.title = nextTitle;
            if (svgData) {
              document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((lnk) => {
                lnk.setAttribute('href', svgData);
              });
            }
          } catch (_) {}
        }

        function updateSingleProjectView(slug) {
          singleProjectSlug = slug;
          const allCards = document.querySelectorAll('[data-project-card]');
          const catalogPanel = viewPanels.catalog;
          if (catalogPanel) catalogPanel.classList.toggle('is-single-project-page', Boolean(slug));
          if (filterBar) filterBar.style.display = slug ? 'none' : '';
          if (singleBackBar) singleBackBar.style.display = slug ? 'block' : 'none';
          const es = document.getElementById('empty-filter-state');
          if (es && slug) es.style.display = 'none';

          allCards.forEach((card) => {
            const cSlug = card.getAttribute('data-project-card');
            if (!slug || cSlug === slug) {
              card.style.display = '';
            } else {
              card.style.display = 'none';
            }
          });

          // Show all comments when in dedicated single-project tab, or preview 2 in catalog
          document.querySelectorAll('[data-review-extra-item]').forEach((item) => {
            const itemSlug = item.getAttribute('data-review-extra-item');
            item.style.display = slug === itemSlug ? 'flex' : 'none';
          });
          updateBrowserTabIdentity('catalog', domCat, slug);
        }

        if (singleProjectSlug) {
          updateSingleProjectView(singleProjectSlug);
        }

        function switchView(targetView, skipScroll) {
          if (!viewPanels[targetView]) return;
          if (targetView === 'catalog') {
            updateSingleProjectView(null);
          }
          Object.keys(viewPanels).forEach((key) => {
            if (viewPanels[key]) {
              viewPanels[key].classList.toggle('active', key === targetView);
            }
          });
          viewButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-view-btn') === targetView);
          });
          updateBrowserTabIdentity(targetView, initialCat, targetView === 'catalog' ? singleProjectSlug : null);
          try {
            sessionStorage.setItem(`meow_view_${window.location.pathname}`, targetView);
          } catch (_) {}
          if (!skipScroll) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }

        const heroToCatalogBtn = document.getElementById('hero-to-catalog-btn');
        if (heroToCatalogBtn && !heroToCatalogBtn.dataset.bound) {
          heroToCatalogBtn.dataset.bound = '1';
          heroToCatalogBtn.addEventListener('click', () => {
            const ws = document.getElementById('catalog-workspace');
            if (ws) ws.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
        updateBrowserTabIdentity('catalog', initialCat, singleProjectSlug);

        // Restore active view & scroll position on reload
        try {
          const savedView = sessionStorage.getItem(`meow_view_${window.location.pathname}`);
          if (savedView && viewPanels[savedView] && !singleProjectSlug) {
            switchView(savedView, true);
          }
          const savedY = Number(sessionStorage.getItem(`meow_scroll_${window.location.pathname}`) || 0);
          if (savedY > 0) {
            setTimeout(() => window.scrollTo(0, savedY), 60);
          }
          window.addEventListener('beforeunload', () => {
            try {
              sessionStorage.setItem(`meow_scroll_${window.location.pathname}`, String(window.scrollY));
            } catch (_) {}
          });
        } catch (_) {}

        const floatingDock = document.getElementById('floating-quick-dock');
        const updateFloatingDock = () => {
          if (!floatingDock) return;
          floatingDock.classList.toggle('is-visible', window.scrollY > 360);
        };
        window.addEventListener('scroll', updateFloatingDock, { passive: true });
        updateFloatingDock();

        const dockSearchBtn = document.getElementById('dock-search-btn');
        const dockTopBtn = document.getElementById('dock-top-btn');
        if (dockSearchBtn) {
          dockSearchBtn.addEventListener('click', () => {
            switchView('catalog', true);
            const bar = document.getElementById('catalog-filter-bar');
            const inp = document.getElementById('project-search');
            if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 260);
          });
        }
        if (dockTopBtn) {
          dockTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
        }

        viewButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            switchView(btn.getAttribute('data-view-btn'));
          });
        });

        document.querySelectorAll('[data-switch-view]').forEach((el) => {
          el.addEventListener('click', (e) => {
            const target = el.getAttribute('data-switch-view');
            if (target) {
              e.preventDefault();
              switchView(target);
            }
          });
        });

        document.querySelectorAll('[data-open-single-project]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const slug = btn.getAttribute('data-open-single-project');
            if (slug && !window.location.pathname.includes('/project/')) {
              e.preventDefault();
              const targetUrl = btn.getAttribute('href');
              if (targetUrl) history.pushState(null, '', targetUrl);
              updateSingleProjectView(slug);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          });
        });

        if (exitSingleBtn) {
          exitSingleBtn.addEventListener('click', (e) => {
            if (window.location.pathname.includes('/project/')) {
              return;
            }
            e.preventDefault();
            history.pushState(null, '', exitSingleBtn.getAttribute('href') || '/');
            updateSingleProjectView(null);
          });
        }

        // Copy Server IP Handler
        document.querySelectorAll('[data-copy-ip]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const ip = btn.getAttribute('data-copy-ip');
            if (ip) {
              try {
                await navigator.clipboard.writeText(ip);
                const txt = btn.querySelector('.copy-text');
                if (txt) {
                  const orig = txt.textContent;
                  txt.textContent = uiStrings.copiedToast;
                  setTimeout(() => { txt.textContent = orig; }, 2000);
                }
              } catch (_) {}
            }
          });
        });

        // DevTools Console Cat + `meowlab` BSOD command (print once per session)
        if (!window.__meowConsoleCatPrinted) {
          window.__meowConsoleCatPrinted = true;
          try {
            console.log(
              '%c  /\\_/\\  \n ( o.o ) \n  > ^ <   MeowProject — Meow!',
              'color: #f59e0b; font-weight: bold; font-family: monospace; font-size: 13px; line-height: 1.3;'
            );
          } catch (_) {}
        }

        function triggerMeowBsod() {
          const overlay = document.getElementById('meow-bsod-overlay');
          const pctEl = document.getElementById('meow-bsod-pct');
          if (!overlay) return;
          overlay.classList.add('is-active');
          overlay.setAttribute('aria-hidden', 'false');
          if (window.__meowBsodTimer) clearInterval(window.__meowBsodTimer);
          let pct = 0;
          if (pctEl) pctEl.textContent = '0%';
          window.__meowBsodTimer = setInterval(() => {
            pct = Math.min(100, pct + Math.floor(Math.random() * 14) + 5);
            if (pctEl) pctEl.textContent = pct + '%';
            if (pct >= 100) {
              clearInterval(window.__meowBsodTimer);
              window.__meowBsodTimer = null;
            }
          }, 140);
        }

        if (!window.__meowBsodBound) {
          window.__meowBsodBound = true;
          try {
            Object.defineProperty(window, 'meowlab', {
              configurable: true,
              get() {
                triggerMeowBsod();
                return 'CRITICAL_MEOWLAB_CURIOSITY_BSOD';
              },
            });
            Object.defineProperty(window, 'meow', {
              configurable: true,
              get() {
                if (window.__meowEncounterRunning) return 'MEOW_FIGHT_ALREADY_STARTING...';
                window.__meowEncounterRunning = true;
                const pathMatch = window.location.pathname.match(/^\/(uk|en|de|pl|be|kk)(\/|$)/);
                const lang = (pathMatch && pathMatch[1]) || document.documentElement.lang || 'uk';

                // Play classic Undertale 3-beep encounter sound
                try {
                  const AC = window.AudioContext || window.webkitAudioContext;
                  if (AC) {
                    const ac = new AC();
                    const beep = (t, freq, dur) => {
                      const o = ac.createOscillator();
                      const g = ac.createGain();
                      o.type = 'square';
                      o.frequency.setValueAtTime(freq, ac.currentTime + t);
                      g.gain.setValueAtTime(0.12, ac.currentTime + t);
                      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + dur);
                      o.connect(g); g.connect(ac.destination);
                      o.start(ac.currentTime + t); o.stop(ac.currentTime + t + dur);
                    };
                    beep(0.05, 620, 0.07);
                    beep(0.24, 620, 0.07);
                    beep(0.43, 620, 0.07);
                    beep(0.65, 280, 0.28);
                  }
                } catch (_) {}

                // Fullscreen Undertale encounter overlay
                const ov = document.createElement('div');
                ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;opacity:0;pointer-events:all;transition:opacity 0.08s linear;display:flex;align-items:center;justify-content:center;';
                const heart = document.createElement('div');
                heart.innerHTML = '<svg width="34" height="30" viewBox="0 0 14 12" style="image-rendering:pixelated;shape-rendering:crispEdges"><path fill="#ff0000" d="M2 0h3v1h1v1h2V1h1V0h3v1h1v1h1v4h-1v1h-1v1h-1v1h-1v1H9v1H8v1H6v-1H5v-1H4V9H3V8H2V7H1V6H0V2h1V1h1z"/></svg>';
                heart.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(1.2);transition:transform 0.55s cubic-bezier(0.22,1,0.36,1), top 0.55s cubic-bezier(0.22,1,0.36,1), left 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease;opacity:0;';
                ov.appendChild(heart);
                document.body.appendChild(ov);

                // 3 dramatic black/visible Undertale flashes + blinking red soul
                const flash = (on, ms) => setTimeout(() => {
                  ov.style.opacity = on ? '1' : '0';
                  heart.style.opacity = on ? '1' : '0';
                }, ms);
                flash(true, 40);
                flash(false, 135);
                flash(true, 230);
                flash(false, 325);
                flash(true, 420);
                flash(false, 515);

                // Hold solid black, then glide the soul down to the battle menu position
                setTimeout(() => {
                  ov.style.transition = 'opacity 0.25s ease';
                  ov.style.opacity = '1';
                  heart.style.opacity = '1';
                }, 610);

                setTimeout(() => {
                  heart.style.left = '24%';
                  heart.style.top = '86%';
                  heart.style.transform = 'translate(-50%,-50%) scale(0.95)';
                }, 780);

                setTimeout(() => {
                  heart.style.opacity = '0';
                }, 1360);

                setTimeout(() => {
                  window.location.href = `/meow-fight/?lang=${encodeURIComponent(lang)}`;
                }, 1580);

                return 'MEOW_FIGHT_INITIALIZED...';
              },
            });
          } catch (_) {}
        }

        // Live Minecraft Server Pinger (queued + cached to prevent 429)
        (async function pingServersSequentially() {
          const badges = Array.from(document.querySelectorAll('[data-live-server-ip]'));
          const applyStatus = (badge, data) => {
            if (!data) return;
            const onlineText = badge.querySelector('.online-text');
            const dot = badge.querySelector('.online-dot');
            if (data.online) {
              const count = data.players?.online ?? 0;
              if (onlineText) onlineText.textContent = `${count.toLocaleString()} ${uiStrings.onlineSuffix}`;
              if (dot) dot.style.background = '#2ecc71';
            } else {
              if (onlineText) onlineText.textContent = uiStrings.offlineLabel;
              if (dot) dot.style.background = '#e74c3c';
            }
          };

          for (const badge of badges) {
            const rawIp = badge.getAttribute('data-live-server-ip');
            if (!rawIp) continue;
            const host = rawIp.trim();
            const cacheKey = `mcstatus_v1_${host}`;
            try {
              const cached = sessionStorage.getItem(cacheKey);
              if (cached) {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.ts < 120000) {
                  applyStatus(badge, parsed.data);
                  continue;
                }
              }
            } catch (_) {}

            try {
              const res = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}`);
              if (res.status === 429) {
                break;
              }
              if (res.ok) {
                const data = await res.json();
                applyStatus(badge, data);
                try {
                  sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
                } catch (_) {}
              }
            } catch (_) {}

            await new Promise((r) => setTimeout(r, 450));
          }
        })();

        // 3. Animated Tutorial Loop in Tab 02
        const animSteps = document.querySelectorAll('[data-anim-step]');
        const animProgress = document.getElementById('anim-progress-bar');
        const animCounter = document.getElementById('anim-step-counter');
        const animTerminal = document.getElementById('anim-terminal-text');
        const terminalLines = [
          '[КРОК 01] Обираєте категорію (launcher, mod, server тощо), вказуєте назву та заповнюєте опис мовами спільноти',
          '[КРОК 02] Валідатор перевіряє правильність посилання, платформу коду та формати логотипу (.svg, .png, .jpg)',
          '[КРОК 03] Натискаєте кнопку переходу -> на GitHub відкривається повністю сформована та готова заявка',
          '[КРОК 04] GitHub-бот перевіряє заявку, створює Pull Request і проєкт зʼявляється наживо в каталозі MeowProject',
        ];
        let currentAnimStep = 0;

        function setAnimStep(idx) {
          currentAnimStep = idx % 4;
          animSteps.forEach((card, i) => {
            card.classList.toggle('active', i === currentAnimStep);
          });
          if (animProgress) animProgress.style.width = `${(currentAnimStep + 1) * 25}%`;
          if (animCounter) animCounter.textContent = `STEP 0${currentAnimStep + 1} / 04`;
          if (animTerminal) animTerminal.textContent = terminalLines[currentAnimStep];
        }

        animSteps.forEach((card) => {
          card.addEventListener('click', () => {
            setAnimStep(Number(card.getAttribute('data-anim-step') || 0));
          });
        });

        if (window._meowAnimInterval) clearInterval(window._meowAnimInterval);
        window._meowAnimInterval = setInterval(() => {
          setAnimStep(currentAnimStep + 1);
        }, 3200);

        // 4. Live Submission Validator & GitHub Link Generator (strict checks + Anti-XSS)
        const subPrefix = document.getElementById('sub-prefix');
        const subName = document.getElementById('sub-name');
        const subCountry = document.getElementById('sub-country');
        const subSourceHost = document.getElementById('sub-source-host');
        const subSite = document.getElementById('sub-site');
        const subRepo = document.getElementById('sub-repo');
        const subRepoGroup = document.getElementById('sub-repo-group');
        const subPlatforms = document.getElementById('sub-platforms');
        const subCaptions = document.getElementById('sub-captions');
        const subFeatures = document.getElementById('sub-features');
        const subIcon = document.getElementById('sub-icon');
        const subScreens = document.getElementById('sub-screens');
        const subCharCount = document.getElementById('sub-char-count');
        const previewTitle = document.getElementById('preview-issue-title');
        const proceedBtn = document.getElementById('proceed-github-issue-btn');
        const descAreas = document.querySelectorAll('[data-desc-area]');
        const descTabs = document.querySelectorAll('[data-desc-lang]');
        const filledListEl = document.getElementById('desc-filled-list');
        const countrySet = new Set(acceptedCountries);
        let activeDescLang = uiLang;

        const HOST_DOMAINS = {
          github: ['github.com'],
          gitlab: ['gitlab.com'],
          gitea: ['gitea.com', 'gitea.io', 'codeberg.org'],
          sourceforge: ['sourceforge.net'],
          gitee: ['gitee.com'],
          cnb: ['cnb.cool'],
        };

        function parseHttpsUrl(value) {
          try {
            const u = new URL(value);
            if (u.protocol !== 'https:') return null;
            if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return null;
            if (u.username || u.password) return null;
            return u;
          } catch (_) {
            return null;
          }
        }

        function hostMatches(urlObj, domains) {
          const h = urlObj.hostname.toLowerCase();
          return domains.some((d) => h === d || h.endsWith(`.${d}`));
        }

        function hasExt(urlObj, exts) {
          const path = decodeURIComponent(urlObj.pathname).toLowerCase();
          return exts.some((e) => path.endsWith(e));
        }

        function showError(id, show, text) {
          const el = document.getElementById(id);
          if (!el) return;
          if (typeof text === 'string') el.textContent = text;
          el.classList.toggle('visible', !!show);
        }

        function setCheckState(id, ok) {
          const el = document.getElementById(id);
          if (!el) return;
          el.classList.toggle('valid', ok);
          const box = el.querySelector('.check-box-mark');
          if (box) box.textContent = ok ? '[x]' : '[ ]';
        }

        const CAT_GUIDE_MAP = uiStrings.catHints;

        function updateCategoryFieldsUI(prefix) {
          const isYt = prefix === 'youtuber';
          const cfg = CAT_GUIDE_MAP[prefix] || (isYt
            ? { guide: 'Для додавання ютубера достатньо вказати назву, країну та посилання на YouTube-канал (<code>https://www.youtube.com/@handle</code>). Аватарка, банер і 3 останні звичайні відео підтягнуться автоматично.', namePh: 'Назва каналу або @handle', platPh: 'YouTube' }
            : CAT_GUIDE_MAP.project);
          const guideEl = document.getElementById('sub-cat-guide');
          if (guideEl) guideEl.innerHTML = cfg.guide;
          if (subName) subName.placeholder = cfg.namePh;
          if (subPlatforms) subPlatforms.placeholder = cfg.platPh;
          if (subSite) subSite.placeholder = isYt ? 'https://www.youtube.com/@handle' : 'https://...';
          document.querySelectorAll('[data-cat-group]').forEach((grp) => {
            const list = (grp.getAttribute('data-cat-group') || '').split(/\s+/);
            grp.style.display = list.includes(prefix) ? 'grid' : 'none';
          });
        }

        // Prefix stamp picker
        document.querySelectorAll('[data-prefix-value]').forEach((pill) => {
          pill.addEventListener('click', () => {
            document.querySelectorAll('[data-prefix-value]').forEach((p) => {
              p.classList.remove('active');
              p.setAttribute('aria-checked', 'false');
            });
            pill.classList.add('active');
            pill.setAttribute('aria-checked', 'true');
            const nextPref = pill.getAttribute('data-prefix-value') || 'project';
            if (subPrefix) subPrefix.value = nextPref;
            updateCategoryFieldsUI(nextPref);
            validateSubmissionForm();
          });
        });
        updateCategoryFieldsUI((subPrefix && subPrefix.value) || 'launcher');
        document.querySelectorAll('#sub-category-fields input').forEach((inp) => {
          inp.addEventListener('input', validateSubmissionForm);
        });

        // Region quick select
        document.querySelectorAll('[data-region-value]').forEach((pill) => {
          pill.addEventListener('click', () => {
            if (subCountry) subCountry.value = pill.getAttribute('data-region-value') || '';
            validateSubmissionForm();
          });
        });

        // Description language toggles & tabs
        const langCheckboxes = document.querySelectorAll('[data-lang-checkbox]');
        function updateActiveLanguages() {
          let firstChecked = null;
          langCheckboxes.forEach((cb) => {
            const code = cb.getAttribute('data-lang-checkbox');
            const isChecked = cb.checked;
            const label = document.querySelector(`[data-lang-toggle-label="${code}"]`);
            if (label) label.classList.toggle('selected', isChecked);
            const tab = document.querySelector(`[data-desc-lang="${code}"]`);
            if (tab) tab.style.display = isChecked ? '' : 'none';
            if (isChecked && !firstChecked) firstChecked = code;
          });

          // Ensure activeDescLang is still among checked ones
          const activeCb = document.querySelector(`[data-lang-checkbox="${activeDescLang}"]`);
          if (!activeCb || !activeCb.checked) {
            activeDescLang = firstChecked || uiLang;
          }

          descTabs.forEach((x) => x.classList.toggle('active', x.getAttribute('data-desc-lang') === activeDescLang));
          descAreas.forEach((a) => {
            const code = a.getAttribute('data-desc-area');
            const cb = document.querySelector(`[data-lang-checkbox="${code}"]`);
            const isVisible = cb && cb.checked && code === activeDescLang;
            a.style.display = isVisible ? '' : 'none';
          });
          validateSubmissionForm();
        }

        langCheckboxes.forEach((cb) => {
          cb.addEventListener('change', updateActiveLanguages);
        });

        descTabs.forEach((tab) => {
          tab.addEventListener('click', () => {
            activeDescLang = tab.getAttribute('data-desc-lang');
            descTabs.forEach((x) => x.classList.toggle('active', x === tab));
            descAreas.forEach((a) => {
              const code = a.getAttribute('data-desc-area');
              const cb = document.querySelector(`[data-lang-checkbox="${code}"]`);
              a.style.display = (cb && cb.checked && code === activeDescLang) ? '' : 'none';
            });
            validateSubmissionForm();
          });
        });

        function validateSubmissionForm() {
          if (!subPrefix || !subName || !subCountry || !subSite) return;
          const prefix = sanitizePlainText(subPrefix.value);
          const name = sanitizePlainText(subName.value.trim());
          const countryRaw = subCountry.value.trim();
          const country = sanitizePlainText(countryRaw);
          const host = subSourceHost ? subSourceHost.value : 'proprietary';
          const isProprietary = host === 'proprietary';
          const siteRaw = subSite.value.trim();
          const repoRaw = subRepo ? subRepo.value.trim() : '';
          const iconRaw = subIcon ? subIcon.value.trim() : '';
          const screensRaw = subScreens ? subScreens.value.trim() : '';
          const platformsRaw = subPlatforms ? subPlatforms.value.trim() : '';
          const captionsRaw = subCaptions ? subCaptions.value.trim() : '';
          const featuresRaw = subFeatures ? subFeatures.value.trim() : '';

          if (subRepoGroup) subRepoGroup.style.visibility = isProprietary ? 'hidden' : 'visible';

          // Title preview
          if (previewTitle) previewTitle.textContent = `${prefix}: ${name || '[...]'}`;

          // Descriptions per language (only from enabled/checked languages)
          const descs = {};
          descAreas.forEach((a) => {
            const code = a.getAttribute('data-desc-area');
            const cb = document.querySelector(`[data-lang-checkbox="${code}"]`);
            if (cb && cb.checked) {
              descs[code] = a.value.trim();
            } else {
              descs[code] = '';
            }
            const dot = document.querySelector(`[data-desc-dot="${code}"]`);
            if (dot) dot.classList.toggle('filled', descs[code].length >= 20);
          });
          const activeLen = (descs[activeDescLang] || '').length;
          if (subCharCount) subCharCount.textContent = `${activeLen} / 2000`;
          const filledLangs = Object.keys(descs).filter((k) => descs[k].length > 0);
          if (filledListEl) filledListEl.textContent = filledLangs.length ? filledLangs.map((x) => x.toUpperCase()).join(', ') : '—';

          const allText = [name, countryRaw, siteRaw, repoRaw, iconRaw, screensRaw, platformsRaw, captionsRaw, featuresRaw, ...Object.values(descs)];
          const noScripts = allText.every((v) => !hasForbiddenScriptPayload(v));

          const isYtPrefix = prefix === 'youtuber';

          // 1. Name (for youtuber, can also be auto-derived from YouTube URL handle)
          const siteUrl = parseHttpsUrl(siteRaw);
          const isYtUrl = !!siteUrl && /(?:^|\.)(?:youtube\.com|youtu\.be)$/i.test(siteUrl.hostname);
          const autoYtHandle = isYtUrl ? (siteUrl.pathname.match(/\/(@[a-zA-Z0-9_.-]+)/)?.[1] || siteUrl.pathname.replace(/^\/+|\/+$/g, '')) : '';
          const effectiveName = name.length >= 2 ? name : (isYtPrefix && autoYtHandle ? autoYtHandle : name);
          const okName = effectiveName.length >= 2 && noScripts;

          // 2. Country: real country (any supported language / ISO) or region (optional for youtuber -> defaults to Global)
          const okCountry = (isYtPrefix && !country) ? true : countrySet.has(country.toLowerCase());
          showError('err-country', country.length > 0 && !okCountry);

          // 3. Website + repository domain must match the selected host
          showError('err-site', siteRaw.length > 0 && (!siteUrl || (isYtPrefix && !isYtUrl)));
          let okRepo = true;
          if (!isProprietary && !isYtPrefix) {
            const repoUrl = parseHttpsUrl(repoRaw);
            const domains = HOST_DOMAINS[host] || [];
            okRepo = !!repoUrl && hostMatches(repoUrl, domains) && repoUrl.pathname.length > 1;
            const errTpl = document.getElementById('err-repo');
            if (errTpl && !errTpl.dataset.tpl) errTpl.dataset.tpl = errTpl.textContent;
            showError('err-repo', repoRaw.length > 0 && !okRepo, (errTpl?.dataset.tpl || '').replace('{host}', domains.join(' / ')));
          } else {
            showError('err-repo', false);
          }
          const okLink = !!siteUrl && (!isYtPrefix || isYtUrl) && okRepo && noScripts;

          // 4. Media: icon (.svg/.png/.jpg) optional, screenshots (.png/.jpg) optional
          let okIcon = true;
          if (iconRaw) {
            const iu = parseHttpsUrl(iconRaw);
            okIcon = !!iu && hasExt(iu, ['.svg', '.png', '.jpg', '.jpeg']);
          }
          showError('err-icon', !okIcon);

          const screenList = screensRaw ? screensRaw.split(/[\s,]+/).filter(Boolean) : [];
          const badScreens = screenList.filter((s) => {
            const su = parseHttpsUrl(s);
            return !su || !hasExt(su, ['.png', '.jpg', '.jpeg']);
          });
          const errScreensEl = document.getElementById('err-screens');
          showError(
            'err-screens',
            badScreens.length > 0,
            (errScreensEl?.getAttribute('data-template') || '').replace('{list}', badScreens.slice(0, 3).map(sanitizePlainText).join(', ')),
          );
          const okMedia = okIcon && badScreens.length === 0 && screenList.length <= 10;

          // 5. Descriptions: at least one language 20–2000 chars (for youtuber, optional — bot auto-fetches from YouTube)
          const okDesc = isYtPrefix && filledLangs.length === 0
            ? noScripts
            : (
              filledLangs.length > 0 &&
              filledLangs.every((k) => descs[k].length >= 20 && descs[k].length <= 2000) &&
              noScripts
            );

          const extraCatLines = [];
          let okCatExtra = true;
          if (prefix === 'launcher' || prefix === 'client') {
            const fFork = (document.getElementById('sub-cat-fork')?.value || '').trim();
            const fAuth = (document.getElementById('sub-cat-auth')?.value || '').trim();
            if (fFork) extraCatLines.push(`- Fork of: ${sanitizePlainText(fFork)}`);
            if (fAuth) extraCatLines.push(`- Auth: ${sanitizePlainText(fAuth)}`);
          } else if (prefix === 'mod' || prefix === 'modpack') {
            const fLoaders = (document.getElementById('sub-cat-loaders')?.value || '').trim();
            const fMcVer = (document.getElementById('sub-cat-mcver')?.value || '').trim();
            okCatExtra = fLoaders.length > 0 && fMcVer.length > 0;
            if (fLoaders) extraCatLines.push(`- Loaders: ${sanitizePlainText(fLoaders)}`);
            if (fMcVer) extraCatLines.push(`- Minecraft Versions: ${sanitizePlainText(fMcVer)}`);
          } else if (prefix === 'server') {
            const fIp = (document.getElementById('sub-cat-server-ip')?.value || '').trim();
            const fLic = (document.getElementById('sub-cat-server-license')?.value || '').trim();
            const fLang = (document.getElementById('sub-cat-server-lang')?.value || '').trim();
            okCatExtra = fIp.length >= 3;
            if (fIp) extraCatLines.push(`- Server IP: ${sanitizePlainText(fIp)}`);
            if (fLic) extraCatLines.push(`- Access: ${sanitizePlainText(fLic)}`);
            if (fLang) extraCatLines.push(`- Primary Language: ${sanitizePlainText(fLang)}`);
          } else {
            const fPurp = (document.getElementById('sub-cat-web-purpose')?.value || '').trim();
            const fApi = (document.getElementById('sub-cat-web-api')?.value || '').trim();
            if (fPurp) extraCatLines.push(`- Purpose: ${sanitizePlainText(fPurp)}`);
            if (fApi) extraCatLines.push(`- Stack / API: ${sanitizePlainText(fApi)}`);
          }

          setCheckState('check-name', okName);
          setCheckState('check-country', okCountry);
          setCheckState('check-link', okLink && okCatExtra);
          setCheckState('check-media', okMedia);
          setCheckState('check-desc', okDesc);

          const allValid = okName && okCountry && okLink && okCatExtra && okMedia && okDesc;
          if (!proceedBtn) return;
          proceedBtn.classList.toggle('disabled', !allValid);
          proceedBtn.setAttribute('aria-disabled', allValid ? 'false' : 'true');
          if (!allValid) return;

          const descSections = filledLangs.flatMap((k) => [
            `#### ${k.toUpperCase()}`,
            sanitizePlainText(descs[k]),
            '',
          ]);
          const sourceLine = (isProprietary || isYtPrefix)
            ? '- Proprietary (closed source)'
            : `- ${host}: ${repoRaw}`;
          const finalName = effectiveName || name;
          const finalCountry = country || (isYtPrefix ? 'Global' : '');
          const issueBody = [
            '### Type & Name',
            `\`${prefix}: ${finalName}\``,
            '',
            '### Country',
            finalCountry,
            '',
            '### Platforms',
            platformsRaw || (isYtPrefix ? 'YouTube' : 'Windows, macOS, Linux'),
            '',
            ...(extraCatLines.length ? ['### Category Details', ...extraCatLines, ''] : []),
            '### Website',
            siteRaw,
            '',
            '### Source code',
            sourceLine,
            '',
            '### Icon',
            iconRaw || '—',
            '',
            '### Screenshots',
            screenList.length ? screenList.map((s) => `- ${s}`).join('\n') : '—',
            '',
            '### Screenshot Captions',
            captionsRaw ? captionsRaw.split('\n').filter(Boolean).map((c) => `- ${c.trim()}`).join('\n') : '—',
            '',
            '### Key Features',
            featuresRaw ? featuresRaw.split('\n').filter(Boolean).map((f) => `- ${f.trim()}`).join('\n') : '—',
            '',
            '### Description',
            ...descSections,
          ].join('\n');

          proceedBtn.href = `${repoUrl}/issues/new?title=${encodeURIComponent(`${prefix}: ${name}`)}&body=${encodeURIComponent(issueBody)}`;
        }

        [subName, subCountry, subSourceHost, subSite, subRepo, subIcon, subScreens, subPlatforms, subCaptions, subFeatures, ...descAreas].forEach((el) => {
          if (el) {
            el.addEventListener('input', validateSubmissionForm);
            el.addEventListener('change', validateSubmissionForm);
          }
        });
        validateSubmissionForm();

        // 6. Category, Search & Tag Filtering
        const searchInput = document.getElementById('project-search');
        const tabButtons = document.querySelectorAll('.tab-btn');
        const cards = document.querySelectorAll('.project-dossier');
        const emptyState = document.getElementById('empty-filter-state');
        const sortSelect = document.getElementById('catalog-sort-select');
        const tagClearBtn = document.getElementById('btn-clear-tag');
        let activeCategory = domCat || ((typeof initialCat !== 'undefined' && initialCat) ? initialCat : 'all');
        const activeTags = new Set();

        const licenseSelect = document.getElementById('catalog-license-select');
        const verifiedSelect = document.getElementById('catalog-verified-select');

        function updateSidebarRecommendations() {
          const recItems = Array.from(document.querySelectorAll('[data-rec-item]'));
          if (recItems.length === 0) return;
          let recShown = 0;
          recItems.forEach((item) => {
            const rCat = item.getAttribute('data-rec-cat') || '';
            const rTags = (item.getAttribute('data-rec-tags') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
            const okCat = activeCategory === 'all' || rCat === activeCategory;
            const okTags = activeTags.size === 0 || Array.from(activeTags).every((t) => rTags.includes(t));
            if (okCat && okTags && recShown < 5) {
              item.style.display = '';
              recShown++;
            } else {
              item.style.display = 'none';
            }
          });
          const recBox = document.getElementById('sidebar-recommended-box');
          if (recBox) recBox.style.display = recShown > 0 ? '' : 'none';
        }

        function filterProjects() {
          if (singleProjectSlug) {
            if (emptyState) emptyState.style.display = 'none';
            return;
          }
          const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
          const licMode = licenseSelect ? licenseSelect.value : 'all';
          const verMode = verifiedSelect ? verifiedSelect.value : 'all';
          let shown = 0;
          cards.forEach((card) => {
            const cat = card.getAttribute('data-category');
            const hay = card.getAttribute('data-search') || '';
            const rawTags = card.getAttribute('data-tags') || '';
            const cardTags = rawTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
            const cardLic = (card.getAttribute('data-license') || '').toLowerCase();
            const isOs = card.getAttribute('data-opensource') === 'true';
            const isVer = card.getAttribute('data-verified') === 'true';
            const isDanger = card.getAttribute('data-danger') === 'true';

            const okCat = activeCategory === 'all' || cat === activeCategory;
            const okQuery = !q || hay.includes(q);
            const okTag = activeTags.size === 0 || Array.from(activeTags).every((t) => cardTags.includes(t));

            let okLic = true;
            if (licMode === 'permissive') {
              okLic = /\b(mit|apache|bsd|isc|unlicense|cc0|zlib|wtfpl)\b/.test(cardLic);
            } else if (licMode === 'copyleft') {
              okLic = /\b(gpl|agpl|lgpl|mpl|epl|eupl|cddl)\b/.test(cardLic);
            } else if (licMode === 'proprietary') {
              okLic = !isOs || cardLic.includes('proprietary') || cardLic.includes('closed') || cardLic.includes('commercial');
            }

            let okVer = true;
            if (verMode === 'verified') okVer = isVer;
            else if (verMode === 'unverified') okVer = !isVer;
            else if (verMode === 'danger') okVer = isDanger;

            if (okCat && okQuery && okTag && okLic && okVer) {
              card.style.display = '';
              shown++;
            } else {
              card.style.display = 'none';
            }
          });
          if (emptyState) {
            emptyState.style.display = shown === 0 ? 'block' : 'none';
          }
          updateSidebarRecommendations();
        }

        if (licenseSelect) licenseSelect.addEventListener('change', filterProjects);
        if (verifiedSelect) verifiedSelect.addEventListener('change', filterProjects);

        const tagSearchInput = document.getElementById('tag-filter-search');
        const tagToggleBtn = document.getElementById('btn-toggle-all-tags');
        const tagsContainer = document.getElementById('tags-scroll-container');
        const toggleTagsLabel = document.getElementById('toggle-tags-label');
        const toggleTagsArrow = document.getElementById('toggle-tags-arrow');
        const activeTagChip = document.getElementById('active-tag-chip');
        const activeTagDisplay = document.getElementById('active-tag-display');
        const tagsEmptySearch = document.getElementById('tags-empty-search');

        if (tagToggleBtn && tagsContainer) {
          tagToggleBtn.addEventListener('click', () => {
            const isCollapsed = tagsContainer.classList.contains('collapsed');
            tagsContainer.classList.toggle('collapsed', !isCollapsed);
            tagsContainer.classList.toggle('expanded', isCollapsed);
            if (toggleTagsLabel) toggleTagsLabel.textContent = isCollapsed ? uiStrings.collapseTagsBtn : uiStrings.expandTagsBtn;
            if (toggleTagsArrow) toggleTagsArrow.textContent = isCollapsed ? '▲' : '▼';
          });
        }

        if (tagSearchInput && tagsContainer) {
          tagSearchInput.addEventListener('input', () => {
            const q = tagSearchInput.value.trim().toLowerCase();
            tagsContainer.classList.remove('collapsed');
            tagsContainer.classList.add('expanded');
            if (toggleTagsLabel) toggleTagsLabel.textContent = uiStrings.collapseTagsBtn;
            if (toggleTagsArrow) toggleTagsArrow.textContent = '▲';

            let visibleCount = 0;
            document.querySelectorAll('.tag-filter-btn').forEach((btn) => {
              const tag = (btn.getAttribute('data-tag') || '').toLowerCase();
              if (tag === 'all') {
                btn.style.display = q ? 'none' : '';
                return;
              }
              const matches = !q || tag.includes(q);
              btn.style.display = matches ? '' : 'none';
              if (matches) visibleCount++;
            });
            if (tagsEmptySearch) {
              tagsEmptySearch.style.display = visibleCount === 0 && q ? 'block' : 'none';
            }
          });
        }

        function setActiveTag(tag) {
          const norm = (tag || 'all').toLowerCase();
          if (norm === 'all') {
            activeTags.clear();
          } else if (activeTags.has(norm)) {
            activeTags.delete(norm);
          } else {
            activeTags.add(norm);
          }
          document.querySelectorAll('.tag-filter-btn').forEach((btn) => {
            const btnTag = (btn.getAttribute('data-tag') || 'all').toLowerCase();
            if (btnTag === 'all') {
              btn.classList.toggle('active', activeTags.size === 0);
            } else {
              btn.classList.toggle('active', activeTags.has(btnTag));
            }
          });
          if (activeTagChip && activeTagDisplay) {
            if (activeTags.size > 0) {
              activeTagDisplay.textContent = Array.from(activeTags).map((t) => `#${t}`).join(' + ');
              activeTagChip.style.display = 'inline-flex';
            } else {
              activeTagChip.style.display = 'none';
            }
          }
          filterProjects();
        }

        document.querySelectorAll('.tag-filter-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-tag') || 'all';
            setActiveTag(tag);
          });
        });

        document.querySelectorAll('.tag-item-clickable').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const tag = btn.getAttribute('data-click-tag');
            if (tag) setActiveTag(tag);
          });
        });

        if (tagClearBtn) {
          tagClearBtn.addEventListener('click', () => {
            setActiveTag('all');
          });
        }

        // Catalog Sorting
        function applySort() {
          const mode = sortSelect ? sortSelect.value : 'featured';
          const container = document.querySelector('.projects-stack');
          if (!container) return;
          const projectCards = Array.from(document.querySelectorAll('[data-project-card]'));
          projectCards.sort((a, b) => {
            if (mode === 'rating-desc') {
              const scoreA = Number(a.getAttribute('data-project-score') || a.dataset.projectScore || 0);
              const scoreB = Number(b.getAttribute('data-project-score') || b.dataset.projectScore || 0);
              if (scoreB !== scoreA) return scoreB - scoreA;
              return Number(a.dataset.projectIndex || 0) - Number(b.dataset.projectIndex || 0);
            }
            if (mode === 'name-asc') {
              const nameA = (a.dataset.projectName || '').toLowerCase();
              const nameB = (b.dataset.projectName || '').toLowerCase();
              return nameA.localeCompare(nameB);
            }
            if (mode === 'newest-desc' || mode === 'updated-desc') {
              const addedA = Number(a.dataset.addedAt || 0);
              const addedB = Number(b.dataset.addedAt || 0);
              if (addedB !== addedA) return addedB - addedA;
              return Number(a.dataset.projectIndex || 0) - Number(b.dataset.projectIndex || 0);
            }
            // featured / default: sponsors first
            const spA = a.getAttribute('data-sponsor') === 'true' ? 1 : 0;
            const spB = b.getAttribute('data-sponsor') === 'true' ? 1 : 0;
            if (spB !== spA) return spB - spA;
            return Number(a.dataset.projectIndex || 0) - Number(b.dataset.projectIndex || 0);
          });
          projectCards.forEach((c) => container.appendChild(c));
        }

        if (sortSelect) {
          sortSelect.addEventListener('change', applySort);
        }

        if (searchInput) {
          searchInput.addEventListener('input', filterProjects);
        }

        function updateVisibleTagsForCategory(cat) {
          const categoryTags = new Set();
          cards.forEach((card) => {
            const cardCat = card.getAttribute('data-category');
            if (cat === 'all' || cardCat === cat) {
              const rawTags = card.getAttribute('data-tags') || '';
              rawTags.split(',').forEach((t) => {
                const trimmed = t.trim().toLowerCase();
                if (trimmed) categoryTags.add(trimmed);
              });
            }
          });

          let visibleTagsCount = 0;
          document.querySelectorAll('.tag-filter-btn').forEach((btn) => {
            const btnTag = (btn.getAttribute('data-tag') || 'all').toLowerCase();
            if (btnTag === 'all') {
              btn.style.display = '';
              return;
            }
            if (categoryTags.has(btnTag)) {
              btn.style.display = '';
              visibleTagsCount++;
            } else {
              btn.style.display = 'none';
            }
          });

          const counter = document.querySelector('.tags-counter');
          if (counter) {
            counter.textContent = `(${visibleTagsCount})`;
          }

          const removed = [];
          Array.from(activeTags).forEach((t) => {
            if (!categoryTags.has(t)) {
              activeTags.delete(t);
              removed.push(t);
            }
          });
          if (removed.length > 0) {
            document.querySelectorAll('.tag-filter-btn').forEach((btn) => {
              const btnTag = (btn.getAttribute('data-tag') || 'all').toLowerCase();
              btn.classList.toggle('active', btnTag === 'all' ? activeTags.size === 0 : activeTags.has(btnTag));
            });
            if (activeTagChip && activeTagDisplay) {
              if (activeTags.size > 0) {
                activeTagDisplay.textContent = Array.from(activeTags).map((t) => `#${t}`).join(' + ');
                activeTagChip.style.display = 'inline-flex';
              } else {
                activeTagChip.style.display = 'none';
              }
            }
            filterProjects();
          }
        }

        tabButtons.forEach((btn) => {
          btn.addEventListener('click', (e) => {
            if (!window.location.pathname.includes('/project/') && cards.length > 1) {
              e.preventDefault();
              e.stopPropagation();
              tabButtons.forEach((b) => b.classList.remove('active'));
              btn.classList.add('active');
              activeCategory = btn.getAttribute('data-category') || 'all';
              const href = btn.getAttribute('href');
              if (href) history.pushState(null, '', href);
              updateVisibleTagsForCategory(activeCategory);
              filterProjects();
            }
          });
        });

        // Initialize category tags
        updateVisibleTagsForCategory(activeCategory);
        try {
          const initialQ = new URLSearchParams(window.location.search).get('q');
          if (initialQ && searchInput) searchInput.value = initialQ;
        } catch (_) {}
        filterProjects();

        // 7. Lightbox
        const modal = document.getElementById('lightbox-modal');
        const modalImg = document.getElementById('lightbox-img');
        const modalCap = document.getElementById('lightbox-caption');
        const modalClose = document.getElementById('lightbox-close');

        document.querySelectorAll('[data-lightbox-src]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const src = btn.getAttribute('data-lightbox-src');
            const cap = btn.getAttribute('data-lightbox-caption');
            if (modal && modalImg && src) {
              modalImg.src = src;
              modalImg.alt = cap || '';
              if (modalCap) modalCap.textContent = cap || '';
              modal.classList.add('open');
              modal.setAttribute('aria-hidden', 'false');
            }
          });
        });

        function closeModal() {
          if (modal) {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
          }
        }

        if (modalClose) modalClose.addEventListener('click', closeModal);
        if (modal) {
          modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
          });
        }

        // Generic Modal Handler
        function bindGenericModal(modalId, closeBtnId, triggerSelector) {
          const m = document.getElementById(modalId);
          const closeBtn = document.getElementById(closeBtnId);
          if (!m) return;
          const open = () => {
            m.classList.add('open');
            m.setAttribute('aria-hidden', 'false');
          };
          const close = () => {
            m.classList.remove('open');
            m.setAttribute('aria-hidden', 'true');
          };
          if (triggerSelector) {
            document.querySelectorAll(triggerSelector).forEach((btn) => {
              btn.addEventListener('click', (e) => {
                e.preventDefault();
                open();
              });
            });
          }
          if (closeBtn) closeBtn.addEventListener('click', close);
          m.addEventListener('click', (e) => {
            if (e.target === m) close();
          });
        }

        bindGenericModal('verified-modal', 'verified-close', '[data-open-verified-modal]');
        bindGenericModal('privacy-modal', 'privacy-close', '#open-privacy-btn');
        bindGenericModal('confidentiality-modal', 'confidentiality-close', '#open-confidentiality-btn');
        bindGenericModal('roadmap-modal', 'roadmap-close', '#open-roadmap-btn');
        bindGenericModal('terms-modal', 'terms-close', '#open-terms-btn');

        const sponsorModal = document.getElementById('sponsor-modal');
        const sponsorModalClose = document.getElementById('sponsor-modal-close');
        const sponsorModalTitle = document.getElementById('sponsor-modal-title');
        if (sponsorModal) {
          document.querySelectorAll('[data-open-sponsor-modal]').forEach((btn) => {
            if (btn.dataset.spBound === '1') return;
            btn.dataset.spBound = '1';
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const pName = btn.getAttribute('data-sponsor-name') || '';
              if (sponsorModalTitle && pName) {
                sponsorModalTitle.textContent = `${pName} — ${sponsorModalTitle.textContent.split('—').pop().trim()}`;
              }
              sponsorModal.classList.add('open');
              sponsorModal.setAttribute('aria-hidden', 'false');
            });
          });
          if (sponsorModalClose && sponsorModalClose.dataset.spCloseBound !== '1') {
            sponsorModalClose.dataset.spCloseBound = '1';
            sponsorModalClose.addEventListener('click', () => {
              sponsorModal.classList.remove('open');
              sponsorModal.setAttribute('aria-hidden', 'true');
            });
          }
          if (sponsorModal.dataset.spBackdropBound !== '1') {
            sponsorModal.dataset.spBackdropBound = '1';
            sponsorModal.addEventListener('click', (e) => {
              if (e.target === sponsorModal) {
                sponsorModal.classList.remove('open');
                sponsorModal.setAttribute('aria-hidden', 'true');
              }
            });
          }
        }

        // Dynamic License Modal Controller
        const licenseModal = document.getElementById('license-modal');
        const licenseClose = document.getElementById('license-modal-close');
        const licenseBadge = document.getElementById('license-modal-badge');
        const licenseType = document.getElementById('license-modal-type');
        const licenseTitle = document.getElementById('license-modal-title');
        const licenseDesc = document.getElementById('license-modal-desc');
        const licensePerms = document.getElementById('license-modal-permissions');
        const licenseConds = document.getElementById('license-modal-conditions');
        const licenseLimits = document.getElementById('license-modal-limitations');

        const LICENSE_DB = {
          'gpl-3.0': {
            badge: 'GPL-3.0',
            type: 'Сильний копілефт (Copyleft)',
            title: 'GNU General Public License v3.0',
            desc: 'Вільна копілефт-ліцензія. Дозволяє вільно використовувати, вивчати, модифікувати та поширювати код, але зобов’язує відкривати вихідний код будь-яких форків і похідних робіт під цією ж ліцензією GPL-3.0.',
            permissions: [
              'Комерційне використання (дозволено для комерційних цілей)',
              'Модифікація вихідного коду без обмежень',
              'Поширення оригінальних або змінених копій',
              'Патентні права надаються безкоштовно'
            ],
            conditions: [
              'Обов’язкове відкриття вихідного коду (Disclose source)',
              'Та сама ліцензія GPL-3.0 для будь-яких похідних проектів',
              'Збереження всіх повідомлень про копірайт та авторів',
              'Фіксація та опис внесених змін у файлах коду'
            ],
            limitations: [
              'Відсутність гарантій працездатності (As is)',
              'Автори не несуть юридичної чи фінансової відповідальності',
              'Не надає прав на використання торгових марок чи логотипів'
            ]
          },
          'mit': {
            badge: 'MIT',
            type: 'Пермісивна (Вільна)',
            title: 'MIT License',
            desc: 'Ультра-лаконічна та максимально ліберальна вільна ліцензія. Дозволяє робити з кодом практично все, включаючи використання у комерційних та закритих пропрієтарних проектах, за єдиної умови збереження рядка копірайту автора.',
            permissions: [
              'Комерційне використання без відрахувань',
              'Модифікація коду на власний розсуд',
              'Поширення, копіювання та субліцензування коду',
              'Включення у закриті комерційні програми'
            ],
            conditions: [
              'Збереження тексту ліцензії MIT та копірайту автора у всіх копіях'
            ],
            limitations: [
              'Програмне забезпечення надається «як є», без жодних гарантій',
              'Автори не несуть відповідальності за можливі збитки'
            ]
          },
          'apache-2.0': {
            badge: 'Apache-2.0',
            type: 'Пермісивна з патентами',
            title: 'Apache License 2.0',
            desc: 'Гнучка пермісивна ліцензія від Apache Software Foundation. Надає широкі права на використання коду та містить чітке положення про безоплатну передачу патентних прав від учасників розробки.',
            permissions: [
              'Комерційне та приватне використання',
              'Модифікація та створення похідних робіт',
              'Поширення коду та субліцензування',
              'Патентна ліцензія від авторів'
            ],
            conditions: [
              'Збереження тексту ліцензії та копірайту',
              'Зазначення списку змін у змінених файлах',
              'Збереження файлу NOTICE при наявності'
            ],
            limitations: [
              'Не надає прав на торговельні марки та логотипи',
              'Відсутність гарантій та відповідальності авторів'
            ]
          },
          'lgpl-3.0': {
            badge: 'LGPL-3.0',
            type: 'Мʼякий копілефт (Library)',
            title: 'GNU Lesser General Public License v3.0',
            desc: 'Дозволяє динамічно підключати бібліотеку до закритих або комерційних програм без необхідності відкривати код основної програми, проте вимагає відкриття змін до самої бібліотеки.',
            permissions: [
              'Використання у закритому софті через динамічне лінкування',
              'Модифікація коду самої бібліотеки',
              'Комерційне використання та розповсюдження'
            ],
            conditions: [
              'Відкриття коду будь-яких змін до самої бібліотеки під LGPL',
              'Збереження копірайтів та тексту ліцензії',
              'Користувач повинен мати змогу замінити версію бібліотеки'
            ],
            limitations: [
              'Відсутність гарантій та відповідальності'
            ]
          },
          'bsd-3-clause': {
            badge: 'BSD-3-Clause',
            type: 'Пермісивна (Вільна)',
            title: 'BSD 3-Clause "New" or "Revised" License',
            desc: 'Вільна пермісивна ліцензія. Дозволяє необмежене використання, зміну та поширення коду як у відкритих, так і у закритих комерційних продуктах за умови збереження повідомлення про копірайт і заборони використання імені автора у рекламі без згоди.',
            permissions: [
              'Комерційне використання без відрахувань',
              'Модифікація вихідного коду на власний розсуд',
              'Поширення та субліцензування коду',
              'Приватне використання'
            ],
            conditions: [
              'Збереження тексту ліцензії BSD та копірайту автора',
              'Збереження списку умов та відмови від відповідальності'
            ],
            limitations: [
              'Заборонено використовувати імʼя автора або розробників для реклами без згоди',
              'Відсутність будь-яких гарантій та відповідальності'
            ]
          },
          'polyform shield 1.0.0': {
            badge: 'PolyForm Shield',
            type: 'Source-Available (Захист від хмарних клонів)',
            title: 'PolyForm Shield License 1.0.0',
            desc: 'Ліцензія з відкритим кодом, яка захищає розробника від недобросовісної конкуренції. Дозволяє вільно використовувати, вивчати та покращувати код, але забороняє перепродавати програму як конкуруючий комерційний хмарний сервіс.',
            permissions: [
              'Вільне персональне та внутрішнє використання',
              'Вивчення та модифікація вихідного коду',
              'Виправлення помилок та некомерційні форки'
            ],
            conditions: [
              'Збереження оригінального копірайту та умов ліцензії'
            ],
            limitations: [
              'Заборонено створювати прямий конкуруючий комерційний сервіс',
              'Відсутність гарантій'
            ]
          },
          'proprietary': {
            badge: 'Proprietary',
            type: 'Захищено авторським правом',
            title: 'Пропрієтарне ПЗ / Всі права захищено',
            desc: 'Продукт є інтелектуальною власністю розробника. Вихідний код закритий або надається лише для ознайомлення. Будь-які модифікації, декомпіляція чи несанкціоноване поширення суворо заборонені.',
            permissions: [
              'Запуск та використання програми кінцевим користувачем згідно з EULA'
            ],
            conditions: [
              'Дотримання правил користувацької угоди (EULA)',
              'Завантаження лише з офіційних сайтів'
            ],
            limitations: [
              'Заборонено декомпілювати, змінювати або зламувати продукт',
              'Заборонено поширення сторонніх збірок',
              'Заборонено комерційне перепродавання'
            ]
          },
          'потрібна ліцензія': {
            badge: 'Офіційна ліцензія',
            type: 'Minecraft Java Edition',
            title: 'Сервер вимагає ліцензійний акаунт Mojang / Microsoft',
            desc: 'Для входу на цей сервер обовʼязково потрібен придбаний ліцензійний обліковий запис Minecraft Java Edition (minecraft.net або Xbox Game Pass).',
            permissions: [
              'Офіційна синхронізація скінів та плащів',
              'Захист облікового запису через Microsoft 2FA',
              'Повний доступ до всіх режимів сервера'
            ],
            conditions: [
              'Вхід через лаунчер з офіційною авторизацією Microsoft',
              'Дотримання правил поведінки та спільноти сервера'
            ],
            limitations: [
              'Вхід з піратських або неофіційних лаунчерів неможливий',
              'Бан за порушення правил поширюється на ліцензійний UUID'
            ]
          },
          'без ліцензії': {
            badge: 'Ліцензія + Піратка',
            type: 'Вільний доступ для всіх',
            title: 'Сервер доступний для ліцензійних і безліцензійних лаунчерів',
            desc: 'Сервер працює в режимі online-mode=false або має власний авторизаційний шлюз (наприклад /register /login або лаунчер спільноти). Грати можуть усі охочі.',
            permissions: [
              'Вільний вхід з будь-якого лаунчера без обов’язкової покупки гри',
              'Реєстрація пароля всередині гри'
            ],
            conditions: [
              'Встановлення надійного пароля через /register',
              'Дотримання правил сервера'
            ],
            limitations: [
              'Офіційні скіни Mojang можуть вимагати спеціальних плагінів (/skin)',
              'Гравець самостійно відповідає за безпеку свого ігрового пароля'
            ]
          }
        };

        function openLicenseModal(licenseKey) {
          if (!licenseModal) return;
          const raw = (licenseKey || '').toLowerCase().trim();
          let data = LICENSE_DB[raw];
          if (!data) {
            if (raw.includes('gpl')) data = LICENSE_DB['gpl-3.0'];
            else if (raw.includes('mit')) data = LICENSE_DB['mit'];
            else if (raw.includes('bsd')) data = LICENSE_DB['bsd-3-clause'];
            else if (raw.includes('apache')) data = LICENSE_DB['apache-2.0'];
            else if (raw.includes('shield') || raw.includes('polyform')) data = LICENSE_DB['polyform shield 1.0.0'];
            else if (raw.includes('потрібна') || raw.includes('ліцензійний')) data = LICENSE_DB['потрібна ліцензія'];
            else if (raw.includes('без') || raw.includes('піратка')) data = LICENSE_DB['без ліцензії'];
            else if (raw.includes('proprietary') || raw.includes('rights reserved') || raw.includes('захищено')) data = LICENSE_DB['proprietary'];
            else {
              data = {
                badge: licenseKey || 'License',
                type: 'Авторські умови',
                title: licenseKey || 'Ліцензійна угода',
                desc: 'Проект поширюється на особливих авторських або комбінованих умовах. Детальний юридичний текст доступний на офіційному сайті або в репозиторії.',
                permissions: ['Використання згідно з інструкцією автора'],
                conditions: ['Збереження інформації про розробника'],
                limitations: ['Регулюється правилами правовласника']
              };
            }
          }

          if (licenseBadge) licenseBadge.textContent = data.badge;
          if (licenseType) licenseType.textContent = data.type;
          if (licenseTitle) licenseTitle.textContent = data.title;
          if (licenseDesc) licenseDesc.textContent = data.desc;

          if (licensePerms) {
            licensePerms.innerHTML = data.permissions.map((p) => `<li style="margin-bottom: 0.25rem;">${p}</li>`).join('');
          }
          if (licenseConds) {
            licenseConds.innerHTML = data.conditions.map((c) => `<li style="margin-bottom: 0.25rem;">${c}</li>`).join('');
          }
          if (licenseLimits) {
            licenseLimits.innerHTML = data.limitations.map((l) => `<li style="margin-bottom: 0.25rem;">${l}</li>`).join('');
          }

          licenseModal.classList.add('open');
          licenseModal.setAttribute('aria-hidden', 'false');
        }

        document.querySelectorAll('[data-open-license-modal]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const lic = btn.getAttribute('data-license-name');
            openLicenseModal(lic);
          });
        });

        if (licenseClose) {
          licenseClose.addEventListener('click', () => {
            licenseModal.classList.remove('open');
            licenseModal.setAttribute('aria-hidden', 'true');
          });
        }
        if (licenseModal) {
          licenseModal.addEventListener('click', (e) => {
            if (e.target === licenseModal) {
              licenseModal.classList.remove('open');
              licenseModal.setAttribute('aria-hidden', 'true');
            }
          });
        }

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            document.querySelectorAll('.lightbox.open').forEach((m) => {
              m.classList.remove('open');
              m.setAttribute('aria-hidden', 'true');
            });
            const cmpModal = document.getElementById('modal-compare');
            if (cmpModal && cmpModal.classList.contains('is-open')) {
              cmpModal.classList.remove('is-open');
              cmpModal.setAttribute('aria-hidden', 'true');
            }
          }
        });

        // 8. Real Community Reviews & [rating](0-100) Parser
        async function loadRealReviews() {
          const panels = document.querySelectorAll('[data-real-reviews-panel]');
          if (!panels.length) return;

          const ratingRegex = /(?:\[rating\]\(\s*(100|[1-9]?\d)\s*\)|\[rating:\s*(100|[1-9]?\d)(?:\s*\/\s*100)?\s*\]|rating:\s*(100|[1-9]?\d))/i;

          // STEP 1: Load static reviews.json first (Zero rate limit, ultra-fast, offline-friendly)
          let staticData = null;
          try {
            const resStatic = await fetch('/data/reviews.json?v=' + Date.now());
            if (resStatic.ok) {
              staticData = await resStatic.json();
            }
          } catch (_) {}

          // STEP 2: Progressive live fetch from GitHub & GitLab Issues if rate limit permits
          let allIssues = null;
          try {
            const res = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=100`, {
              headers: { Accept: 'application/vnd.github.v3+json' },
            });
            if (res.ok) {
              allIssues = await res.json();
            }
          } catch (_) {}

          let allGitlabIssues = null;
          try {
            const glRes = await fetch('https://gitlab.com/api/graphql', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: `{ project(fullPath: "banernotfake/meowproject") { issues(state: opened, first: 100) { nodes { iid title webUrl notes(first: 100) { nodes { id body system createdAt url author { username name avatarUrl } } } } } } }`,
              }),
            });
            if (glRes.ok) {
              const glJson = await glRes.json();
              allGitlabIssues = glJson?.data?.project?.issues?.nodes || null;
            }
          } catch (_) {}

          let allCodebergIssues = null;
          try {
            const cbRes = await fetch('https://codeberg.org/api/v1/repos/Baneronetwo/meowlab/issues?state=open&limit=50');
            if (cbRes.ok) {
              allCodebergIssues = await cbRes.json();
            }
          } catch (_) {}

          for (const panel of panels) {
            const slug = panel.getAttribute('data-project-slug');
            const listEl = panel.querySelector('[data-reviews-list]');
            const statusEl = panel.querySelector('[data-reviews-status]');
            const reviewBtn = panel.querySelector(`[data-review-action-btn="${slug}"]`);
            const openSingleLabel = panel.querySelector(`[data-open-single-label="${slug}"]`);
            const ratingValueEl = document.querySelector(`[data-rating-value="${slug}"]`);
            const ratingTopBadgeEl = document.querySelector(`[data-rating-top-badge="${slug}"]`);
            const issueNumber = Number(panel.getAttribute('data-issue-number'));
            const searchTerm = (panel.getAttribute('data-search-term') || '').toLowerCase();

            if (!listEl) continue;

            const collectedItems = [];
            const ratings = [];

            // A. Populate from static reviews.json (always reliable)
            const projStatic = staticData?.projects?.[slug];
            if (projStatic) {
              if (projStatic.issueUrl && reviewBtn) {
                reviewBtn.dataset.hasBotIssue = '1';
                reviewBtn.href = `${projStatic.issueUrl}#issuecomment-new`;
              }
              if (Array.isArray(projStatic.reviews)) {
                projStatic.reviews.forEach((r) => {
                  collectedItems.push({
                    author: sanitizePlainText(r.author || 'github-user'),
                    avatar: r.avatar || '',
                    date: sanitizePlainText(r.date || ''),
                    body: sanitizePlainText(r.body || ''),
                    score: typeof r.score === 'number' ? r.score : null,
                    url: r.url || projStatic.issueUrl,
                    issueNum: projStatic.issueNumber || issueNumber,
                    source: r.source || (String(r.url || '').includes('gitlab.com') ? 'gitlab' : 'github'),
                  });
                  if (typeof r.score === 'number') {
                    ratings.push(r.score);
                  }
                });
              }
            }

            // B. If live GitHub API is available and not rate limited, merge live comments
            if (Array.isArray(allIssues)) {
              const matchingIssues = allIssues.filter(
                (iss) =>
                  !iss.pull_request &&
                  iss.state === 'open' &&
                  (issueNumber ? iss.number === issueNumber : (iss.title && iss.title.toLowerCase().includes(searchTerm)))
              );

              if (matchingIssues.length > 0 && reviewBtn) {
                reviewBtn.dataset.hasBotIssue = '1';
                reviewBtn.href = `${matchingIssues[0].html_url}#issuecomment-new`;
              }

              for (const iss of matchingIssues) {
                if (iss.comments > 0 && iss.comments_url) {
                  try {
                    const cRes = await fetch(iss.comments_url, {
                      headers: { Accept: 'application/vnd.github.v3+json' },
                    });
                    if (cRes.ok) {
                      const comments = await cRes.json();
                      if (Array.isArray(comments) && comments.length > 0) {
                        collectedItems.length = 0;
                        ratings.length = 0;
                        comments.forEach((c) => {
                          const authorLogin = (c.user?.login || '').toLowerCase();
                          const isBot =
                            authorLogin.includes('[bot]') ||
                            authorLogin.includes('github-actions') ||
                            c.user?.type === 'Bot' ||
                            (c.body || '').includes('[MeowProject Bot]');
                          if (isBot) return;

                          const rawComment = String(c.body || '');
                          const repoOwner = String(repo || 'BANSAFAn/meowproject').split('/')[0].toLowerCase();
                          const trustedDiscordPosters = [repoOwner, 'banikikikikiai'];
                          let discordMeta = null;
                          const dm = rawComment.match(/<!--\s*meowlab-discord:([A-Za-z0-9_-]+)\s*-->/);
                          if (dm && trustedDiscordPosters.includes(authorLogin)) {
                            try {
                              const parsed = JSON.parse(decodeB64UrlUtf8(dm[1]));
                              if (parsed && /^\d{15,22}$/.test(String(parsed.id || ''))) {
                                discordMeta = parsed;
                              }
                            } catch (_) {}
                          }

                          const strippedRaw = rawComment
                            .replace(/<!--\s*meowlab-discord:[A-Za-z0-9_-]+\s*-->/g, '')
                            .replace(/\n*— via MeowLab · Discord: [^\n]+\s*$/i, '');
                          const rawBody = sanitizePlainText(strippedRaw);
                          const match = rawBody.match(ratingRegex);
                          let score = null;
                          if (match) {
                            const val = Number(match[1] || match[2] || match[3]);
                            if (!isNaN(val) && val >= 0 && val <= 100) {
                              score = val;
                              ratings.push(score);
                            }
                          }
                          const cleanedBody = rawBody.replace(ratingRegex, '').trim();

                          const rawReactions = c.reactions || {};
                          const reactions = {};
                          ['+1', '-1', 'laugh', 'confused', 'heart', 'hooray', 'rocket', 'eyes'].forEach((rk) => {
                            if (typeof rawReactions[rk] === 'number' && rawReactions[rk] > 0) {
                              reactions[rk] = rawReactions[rk];
                            }
                          });

                          const discordAvatar = discordMeta
                            ? (discordMeta.avatar && /^(a_)?[0-9a-f]{32}$/.test(String(discordMeta.avatar))
                                ? `https://cdn.discordapp.com/avatars/${discordMeta.id}/${discordMeta.avatar}.png?size=64`
                                : `https://cdn.discordapp.com/embed/avatars/${Number(String(discordMeta.id).slice(-2)) % 5}.png`)
                            : '';

                          collectedItems.push({
                            author: discordMeta ? sanitizePlainText(String(discordMeta.name || 'discord-user').slice(0, 40)) : sanitizePlainText(c.user?.login || 'github-user'),
                            avatar: discordMeta ? discordAvatar : (c.user?.avatar_url || ''),
                            date: sanitizePlainText((c.created_at || '').slice(0, 10)),
                            body: cleanedBody,
                            score,
                            reactions,
                            url: c.html_url || iss.html_url,
                            issueNum: iss.number,
                            source: discordMeta ? 'discord' : 'github',
                          });
                        });
                      }
                    }
                  } catch (_) {}
                }
              }
            }

            // C. Merge live comments from GitLab Issues via GraphQL (publicly readable without auth)
            if (Array.isArray(allGitlabIssues) && searchTerm) {
              const glMatching = allGitlabIssues.filter(
                (iss) => iss.title && iss.title.toLowerCase().includes(searchTerm)
              );
              for (const glIss of glMatching) {
                const notes = glIss.notes?.nodes || [];
                notes.forEach((n) => {
                  if (n.system) return;
                  const noteUrl = n.url || glIss.webUrl;
                  if (collectedItems.some((item) => item.url === noteUrl)) return;

                  const rawBody = sanitizePlainText(n.body || '');
                  const match = rawBody.match(ratingRegex);
                  let score = null;
                  if (match) {
                    const val = Number(match[1] || match[2] || match[3]);
                    if (!isNaN(val) && val >= 0 && val <= 100) {
                      score = val;
                      ratings.push(score);
                    }
                  }
                  const cleanedBody = rawBody.replace(ratingRegex, '').trim();
                  const rawAvatar = n.author?.avatarUrl || '';
                  const avatar = rawAvatar.startsWith('/') ? `https://gitlab.com${rawAvatar}` : rawAvatar;

                  collectedItems.push({
                    author: sanitizePlainText(n.author?.username || n.author?.name || 'gitlab-user'),
                    avatar,
                    date: sanitizePlainText((n.createdAt || '').slice(0, 10)),
                    body: cleanedBody,
                    score,
                    reactions: {},
                    url: noteUrl,
                    issueNum: Number(glIss.iid) || glIss.iid,
                    source: 'gitlab',
                  });
                });
              }
            }

            // D. Merge live comments from Codeberg Issues
            if (Array.isArray(allCodebergIssues) && searchTerm) {
              const cbMatching = allCodebergIssues.filter(
                (iss) => iss.title && iss.title.toLowerCase().includes(searchTerm)
              );
              for (const cbIss of cbMatching) {
                if (cbIss.comments > 0) {
                  try {
                    const cRes = await fetch(`https://codeberg.org/api/v1/repos/Baneronetwo/meowlab/issues/${cbIss.number}/comments?limit=50`);
                    if (cRes.ok) {
                      const cbComments = await cRes.json();
                      if (Array.isArray(cbComments)) {
                        cbComments.forEach((c) => {
                          const cUrl = c.html_url || cbIss.html_url;
                          if (collectedItems.some((item) => item.url === cUrl)) return;
                          const rawBody = sanitizePlainText(c.body || '');
                          const match = rawBody.match(ratingRegex);
                          let score = null;
                          if (match) {
                            const val = Number(match[1] || match[2] || match[3]);
                            if (!isNaN(val) && val >= 0 && val <= 100) {
                              score = val;
                              ratings.push(score);
                            }
                          }
                          const cleanedBody = rawBody.replace(ratingRegex, '').trim();
                          collectedItems.push({
                            author: sanitizePlainText(c.user?.login || c.user?.username || 'codeberg-user'),
                            avatar: c.user?.avatar_url || '',
                            date: sanitizePlainText((c.created_at || '').slice(0, 10)),
                            body: cleanedBody,
                            score,
                            reactions: {},
                            url: cUrl,
                            issueNum: cbIss.number,
                            source: 'codeberg',
                          });
                        });
                      }
                    }
                  } catch (_) {}
                }
              }
            }

            // Update Project Average Rating (0-100)
            if (ratings.length > 0) {
              const avg = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
              const scoreText = `${ratingLabel}: ${avg} / 100 (${ratings.length})`;
              const ratingStampEl = document.querySelector(`[data-rating-stamp="${slug}"]`);
              if (ratingValueEl) ratingValueEl.textContent = scoreText;
              if (ratingStampEl) ratingStampEl.style.display = '';
              if (ratingTopBadgeEl) ratingTopBadgeEl.textContent = scoreText;

              const cardEl = document.querySelector(`[data-project-card="${slug}"], [data-project-slug="${slug}"]`);
              if (cardEl) {
                cardEl.dataset.projectScore = String(avg);
                cardEl.setAttribute('data-project-score', String(avg));
              }
            }

            // Dedicated project tab appears only when there are more than 2 comments
            const openSingleBtn = panel.querySelector(`[data-open-single-project="${slug}"]`);
            if (openSingleBtn) openSingleBtn.style.display = collectedItems.length > 2 ? '' : 'none';
            if (openSingleLabel && collectedItems.length > 2) {
              openSingleLabel.textContent = `${openTabLabel} (${collectedItems.length})`;
            }

            if (collectedItems.length === 0) {
              if (statusEl) {
                statusEl.textContent = emptyReviewsMsg;
              }
            } else {
              listEl.innerHTML = '';
              collectedItems.forEach((item, idx) => {
                const card = document.createElement('div');
                card.className = 'review-item';
                if (idx >= 2) {
                  card.setAttribute('data-review-extra-item', slug);
                  if (singleProjectSlug !== slug) {
                    card.style.display = 'none';
                  }
                }

                const head = document.createElement('div');
                head.className = 'review-item-head';

                const userLink = document.createElement('a');
                userLink.className = 'review-user';
                userLink.href = item.url;
                userLink.target = '_blank';
                userLink.rel = 'noopener noreferrer';

                if (item.avatar && /^https:\/\/(avatars\.githubusercontent\.com|gitlab\.com|secure\.gravatar\.com|www\.gravatar\.com|cdn\.discordapp\.com)\//.test(item.avatar)) {
                  const img = document.createElement('img');
                  img.src = item.avatar;
                  img.alt = item.author;
                  img.width = 28;
                  img.height = 28;
                  img.loading = 'lazy';
                  img.style.width = '28px';
                  img.style.height = '28px';
                  img.style.minWidth = '28px';
                  img.style.minHeight = '28px';
                  img.style.maxWidth = '28px';
                  img.style.maxHeight = '28px';
                  img.style.borderRadius = '4px';
                  img.style.objectFit = 'cover';
                  img.style.border = '1px solid var(--border-ink)';
                  img.style.flexShrink = '0';
                  img.style.display = 'inline-block';
                  userLink.appendChild(img);
                }

                const isDiscord = item.source === 'discord';
                const isGitlab = !isDiscord && (item.source === 'gitlab' || String(item.url || '').includes('gitlab.com'));
                const isCodeberg = !isDiscord && (item.source === 'codeberg' || String(item.url || '').includes('codeberg.org'));
                const srcIcon = document.createElement('span');
                srcIcon.title = isDiscord ? 'Discord' : isCodeberg ? 'Codeberg' : isGitlab ? 'GitLab' : 'GitHub';
                srcIcon.style.display = 'inline-flex';
                srcIcon.style.alignItems = 'center';
                srcIcon.style.flexShrink = '0';
                srcIcon.innerHTML = isDiscord
                  ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.1 14.1 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.1.246.198.373.292a.077.077 0 0 1-.006.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z"/></svg>'
                  : isCodeberg
                  ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="#2185D0" aria-hidden="true"><path d="M11.955.49A12 12 0 0 0 0 12.49a12 12 0 0 0 1.832 6.372L11.836 5.955a.208.208 0 0 1 .328 0l10.004 12.907A12 12 0 0 0 24 12.49a12 12 0 0 0-12-12c-.015 0-.03 0-.045 0zm.375 6.473l4.426 16.59A12 12 0 0 0 21.842 19.3z"/></svg>'
                  : isGitlab
                    ? '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="#FC6D26" d="M12 21.5L16.4 8H7.6L12 21.5z"/><path fill="#E24329" d="M12 21.5L7.6 8H1.5L12 21.5z"/><path fill="#FCA326" d="M1.5 8L.1 12.3c-.1.4 0 .9.4 1.1L12 21.5 1.5 8z"/><path fill="#E24329" d="M1.5 8h6.1L5 1.9c-.1-.3-.6-.3-.7 0L1.5 8z"/><path fill="#E24329" d="M12 21.5L16.4 8h6.1L12 21.5z"/><path fill="#FCA326" d="M22.5 8l1.4 4.3c.1.4 0 .9-.4 1.1L12 21.5 22.5 8z"/><path fill="#E24329" d="M22.5 8h-6.1L19 1.9c.1-.3.6-.3.7 0L22.5 8z"/></svg>'
                    : '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
                userLink.appendChild(srcIcon);

                const nameSpan = document.createElement('span');
                nameSpan.textContent = `@${item.author}`;
                nameSpan.style.color = 'var(--amber)';
                nameSpan.style.fontWeight = '700';
                userLink.appendChild(nameSpan);

                const rightMeta = document.createElement('div');
                rightMeta.style.display = 'flex';
                rightMeta.style.alignItems = 'center';
                rightMeta.style.gap = '0.5rem';

                if (item.score !== null) {
                  const scoreBadge = document.createElement('span');
                  scoreBadge.className = 'stamp stamp-alpha';
                  scoreBadge.textContent = `[rating: ${item.score}/100]`;
                  scoreBadge.style.fontSize = '0.75rem';
                  scoreBadge.style.fontWeight = '700';
                  scoreBadge.style.padding = '2px 7px';
                  scoreBadge.style.background = 'rgba(46, 204, 113, 0.12)';
                  scoreBadge.style.color = '#2ecc71';
                  scoreBadge.style.border = '1px solid rgba(46, 204, 113, 0.35)';
                  scoreBadge.style.borderRadius = '3px';
                  rightMeta.appendChild(scoreBadge);
                }

                const dateSpan = document.createElement('span');
                dateSpan.textContent = `${verifiedLabel} #${item.issueNum} · ${item.date}`;
                dateSpan.style.color = 'var(--ink-muted)';
                dateSpan.style.fontSize = '0.75rem';
                rightMeta.appendChild(dateSpan);

                head.appendChild(userLink);
                head.appendChild(rightMeta);

                const bodyP = document.createElement('p');
                bodyP.className = 'review-body';
                bodyP.textContent = item.body;
                bodyP.style.margin = '0';
                bodyP.style.fontSize = '0.92rem';
                bodyP.style.lineHeight = '1.55';
                bodyP.style.color = 'var(--ink)';

                card.appendChild(head);
                card.appendChild(bodyP);

                // Render comment reactions if present
                const rObj = item.reactions || {};
                const rKeys = Object.keys(rObj).filter((k) => Number(rObj[k]) > 0);
                if (rKeys.length > 0) {
                  const rRow = document.createElement('div');
                  rRow.className = 'review-reactions-row';
                  const REACTION_LABELS = {
                    '+1': '\uD83D\uDC4D',
                    '-1': '\uD83D\uDC4E',
                    'heart': '\u2764\uFE0F',
                    'rocket': '\uD83D\uDE80',
                    'eyes': '\uD83D\uDC40',
                    'laugh': '\uD83D\uDE04',
                    'hooray': '\uD83C\uDF89',
                    'confused': '\uD83D\uDE15'
                  };
                  const REACTION_TITLES = {
                    '+1': '+1',
                    '-1': '-1',
                    'heart': 'Heart',
                    'rocket': 'Rocket',
                    'eyes': 'Eyes',
                    'laugh': 'Laugh',
                    'hooray': 'Hooray',
                    'confused': 'Confused'
                  };
                  rKeys.forEach((k) => {
                    const pill = document.createElement('a');
                    pill.className = 'review-reaction-pill';
                    pill.href = item.url;
                    pill.target = '_blank';
                    pill.rel = 'noopener noreferrer';
                    pill.title = REACTION_TITLES[k] || k;
                    const sym = document.createElement('span');
                    sym.textContent = REACTION_LABELS[k] || k;
                    const cnt = document.createElement('span');
                    cnt.textContent = String(rObj[k]);
                    pill.appendChild(sym);
                    pill.appendChild(cnt);
                    rRow.appendChild(pill);
                  });
                  card.appendChild(rRow);
                }

                listEl.appendChild(card);
              });
            }
          }

          if (sortSelect && sortSelect.value === 'rating-desc') {
            applySort();
          }
        }

        loadRealReviews();

        // 9. Suggest Edit / Update Flow (Multilingual 6 Languages)
        const suggestModal = document.getElementById('suggest-edit-modal');
        const suggestClose = document.getElementById('suggest-modal-close');
        const suggestCancel = document.getElementById('btn-cancel-suggest');
        const suggestForm = document.getElementById('suggest-edit-form');
        const suggestTitle = document.getElementById('suggest-modal-title');
        const suggestServerIpField = document.getElementById('suggest-server-ip-field');

        // Multilingual Tab Switcher in Suggest Modal
        const suggestLangTabs = document.querySelectorAll('[data-suggest-tab]');
        if (suggestLangTabs.length) {
          suggestLangTabs.forEach((tab) => {
            tab.addEventListener('click', () => {
              const targetLang = tab.getAttribute('data-suggest-tab');
              suggestLangTabs.forEach((t) => t.classList.toggle('active', t === tab));
              document.querySelectorAll('.suggest-lang-pane').forEach((pane) => {
                pane.classList.toggle('active', pane.id === `suggest-pane-${targetLang}`);
              });
            });
          });
        }

        function toggleSuggestCategoryFields(cat) {
          const isYt = cat === 'youtuber';
          document.querySelectorAll('[data-suggest-non-yt]').forEach((el) => {
            el.style.display = isYt ? 'none' : '';
          });
          const webLbl = document.getElementById('suggest-website-label');
          const webInp = document.getElementById('suggest-website');
          if (webLbl) {
            if (!webLbl.dataset.origLabel) webLbl.dataset.origLabel = webLbl.textContent || '';
            webLbl.textContent = isYt ? 'YouTube-канал (посилання):' : webLbl.dataset.origLabel;
          }
          if (webInp) {
            webInp.placeholder = isYt ? 'https://www.youtube.com/@handle' : 'https://project.org';
          }
          if (suggestServerIpField) {
            suggestServerIpField.style.display = cat === 'server' ? 'block' : 'none';
          }
        }

        const suggestCatSelect = document.getElementById('suggest-category');
        if (suggestCatSelect) {
          suggestCatSelect.addEventListener('change', (e) => {
            toggleSuggestCategoryFields(e.target.value);
          });
        }

        function openSuggestEditModal(slug, name, cat, country, license, isOpen, repoUrl, website, platforms, tags, serverIp, captions, descUk, descEn, descDe, descPl, descBe, descKk) {
          if (!suggestModal) return;
          if (document.getElementById('suggest-project-slug')) document.getElementById('suggest-project-slug').value = slug || '';
          if (document.getElementById('suggest-name')) document.getElementById('suggest-name').value = name || '';
          if (document.getElementById('suggest-category')) document.getElementById('suggest-category').value = cat || 'launcher';
          if (document.getElementById('suggest-action')) document.getElementById('suggest-action').value = 'edit';
          if (document.getElementById('suggest-country')) document.getElementById('suggest-country').value = country || '';
          if (document.getElementById('suggest-license')) document.getElementById('suggest-license').value = license || '';
          if (document.getElementById('suggest-is-open-source')) document.getElementById('suggest-is-open-source').value = isOpen || 'yes';
          if (document.getElementById('suggest-repo-url')) document.getElementById('suggest-repo-url').value = repoUrl || '';
          if (document.getElementById('suggest-website')) document.getElementById('suggest-website').value = website || '';
          if (document.getElementById('suggest-platforms')) document.getElementById('suggest-platforms').value = platforms || '';
          if (document.getElementById('suggest-tags')) document.getElementById('suggest-tags').value = tags || '';
          if (document.getElementById('suggest-server-ip')) document.getElementById('suggest-server-ip').value = serverIp || '';
          if (document.getElementById('suggest-screenshot-captions')) document.getElementById('suggest-screenshot-captions').value = captions || '';
          if (document.getElementById('suggest-desc-uk')) document.getElementById('suggest-desc-uk').value = descUk || '';
          if (document.getElementById('suggest-desc-en')) document.getElementById('suggest-desc-en').value = descEn || '';
          if (document.getElementById('suggest-desc-de')) document.getElementById('suggest-desc-de').value = descDe || '';
          if (document.getElementById('suggest-desc-pl')) document.getElementById('suggest-desc-pl').value = descPl || '';
          if (document.getElementById('suggest-desc-be')) document.getElementById('suggest-desc-be').value = descBe || '';
          if (document.getElementById('suggest-desc-kk')) document.getElementById('suggest-desc-kk').value = descKk || '';

          if (suggestTitle) {
            suggestTitle.textContent = `${uiStrings.suggestTitlePrefix} ${name || slug}`;
          }
          toggleSuggestCategoryFields(cat || 'launcher');
          suggestModal.classList.add('open');
          suggestModal.setAttribute('aria-hidden', 'false');
        }

        function closeSuggestEditModal() {
          if (suggestModal) {
            suggestModal.classList.remove('open');
            suggestModal.setAttribute('aria-hidden', 'true');
          }
        }

        document.querySelectorAll('[data-open-suggest-edit]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const slug = btn.getAttribute('data-suggest-slug');
            const name = btn.getAttribute('data-suggest-name');
            const cat = btn.getAttribute('data-suggest-cat');
            const country = btn.getAttribute('data-suggest-country');
            const license = btn.getAttribute('data-suggest-license');
            const isOpen = btn.getAttribute('data-suggest-is-open');
            const repoUrl = btn.getAttribute('data-suggest-repo');
            const website = btn.getAttribute('data-suggest-website');
            const platforms = btn.getAttribute('data-suggest-platforms');
            const tags = btn.getAttribute('data-suggest-tags');
            const serverIp = btn.getAttribute('data-suggest-server-ip');
            const captions = btn.getAttribute('data-suggest-captions') || '';
            const descUk = btn.getAttribute('data-suggest-desc-uk') || '';
            const descEn = btn.getAttribute('data-suggest-desc-en') || '';
            const descDe = btn.getAttribute('data-suggest-desc-de') || '';
            const descPl = btn.getAttribute('data-suggest-desc-pl') || '';
            const descBe = btn.getAttribute('data-suggest-desc-be') || '';
            const descKk = btn.getAttribute('data-suggest-desc-kk') || '';
            openSuggestEditModal(slug, name, cat, country, license, isOpen, repoUrl, website, platforms, tags, serverIp, captions, descUk, descEn, descDe, descPl, descBe, descKk);
          });
        });

        if (suggestClose) suggestClose.addEventListener('click', closeSuggestEditModal);
        if (suggestCancel) suggestCancel.addEventListener('click', closeSuggestEditModal);
        if (suggestModal) {
          suggestModal.addEventListener('click', (e) => {
            if (e.target === suggestModal) closeSuggestEditModal();
          });
        }

        if (suggestForm) {
          suggestForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const slug = (document.getElementById('suggest-project-slug')?.value || '').trim();
            const name = (document.getElementById('suggest-name')?.value || '').trim();
            const cat = (document.getElementById('suggest-category')?.value || '').trim();
            const actionType = (document.getElementById('suggest-action')?.value || 'edit').trim();
            const country = (document.getElementById('suggest-country')?.value || '').trim();
            const license = (document.getElementById('suggest-license')?.value || '').trim();
            const isOpen = (document.getElementById('suggest-is-open-source')?.value || '').trim();
            const repoUrl = (document.getElementById('suggest-repo-url')?.value || '').trim();
            const website = (document.getElementById('suggest-website')?.value || '').trim();
            const platforms = (document.getElementById('suggest-platforms')?.value || '').trim();
            const tags = (document.getElementById('suggest-tags')?.value || '').trim();
            const serverIp = (document.getElementById('suggest-server-ip')?.value || '').trim();
            const screens = (document.getElementById('suggest-screenshots')?.value || '').trim();
            const captions = (document.getElementById('suggest-screenshot-captions')?.value || '').trim();
            const descUk = (document.getElementById('suggest-desc-uk')?.value || '').trim();
            const descEn = (document.getElementById('suggest-desc-en')?.value || '').trim();
            const descDe = (document.getElementById('suggest-desc-de')?.value || '').trim();
            const descPl = (document.getElementById('suggest-desc-pl')?.value || '').trim();
            const descBe = (document.getElementById('suggest-desc-be')?.value || '').trim();
            const descKk = (document.getElementById('suggest-desc-kk')?.value || '').trim();
            const notes = (document.getElementById('suggest-notes')?.value || '').trim();

            if (!slug) return;

            let body = `### Project Name\n${name}\n\n`;
            body += `### Category\n${cat}\n\n`;
            if (actionType === 'delete') body += `### Action\nDELETE\n\n`;
            if (country) body += `### Country\n${country}\n\n`;
            if (cat !== 'youtuber') {
              if (license) body += `### License\n${license}\n\n`;
              body += `### Open Source\n${isOpen === 'yes' ? 'Так' : 'Ні'}\n\n`;
              if (repoUrl) body += `### Repository URL\n${repoUrl}\n\n`;
              if (platforms) body += `### Platforms\n${platforms}\n\n`;
              if (screens) body += `### Screenshots\n${screens}\n\n`;
              if (captions) body += `### Screenshot Captions\n${captions}\n\n`;
            }
            if (website) body += `### Website\n${website}\n\n`;
            if (tags) body += `### Tags\n${tags}\n\n`;
            if (cat === 'server' && serverIp) body += `### Server IP\n\`${serverIp}\`\n\n`;
            if (descUk || descEn || descDe || descPl || descBe || descKk) {
              body += `### Description\n\n`;
              if (descUk) body += `#### UK\n${descUk}\n\n`;
              if (descEn) body += `#### EN\n${descEn}\n\n`;
              if (descDe) body += `#### DE\n${descDe}\n\n`;
              if (descPl) body += `#### PL\n${descPl}\n\n`;
              if (descBe) body += `#### BE\n${descBe}\n\n`;
              if (descKk) body += `#### KK\n${descKk}\n\n`;
            }
            if (notes) body += `### Notes\n${notes}\n\n`;

            const title = `[update: ${slug}] ${name || slug}`;
            const issueUrl = `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
            window.open(issueUrl, '_blank');
            closeSuggestEditModal();
          });
        }

        // 10. Danger Report Modal & Security Report Form (up to 20,000 chars Markdown)
        function escapeHtml(str) {
          return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        }

        function renderSafeMarkdown(md) {
          let html = escapeHtml(md || '');
          // Code blocks
          html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
          // Inline code
          html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
          // Images ![alt](https://...)
          html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
          // Links [label](https://...)
          html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
          // Headings
          html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
          html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
          html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
          // Bold & Italic
          html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
          // Paragraphs / line breaks
          html = html.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br />');
          return `<p>${html}</p>`;
        }

        const dangerModal = document.getElementById('danger-report-modal');
        const dangerModalClose = document.getElementById('danger-modal-close');
        const dangerModalTitle = document.getElementById('danger-modal-title');
        const dangerModalMeta = document.getElementById('danger-modal-meta');
        const dangerModalSummary = document.getElementById('danger-modal-summary');
        const dangerModalBody = document.getElementById('danger-modal-body');
        const dangerModalLinksWrap = document.getElementById('danger-modal-links-wrap');
        const dangerModalLinks = document.getElementById('danger-modal-links');

        function extractYoutubeId(url) {
          try {
            const u = new URL(url);
            if (u.hostname.includes('youtu.be')) {
              return u.pathname.replace(/^\//, '').split('/')[0] || null;
            }
            if (u.hostname.includes('youtube.com')) {
              if (u.searchParams.get('v')) return u.searchParams.get('v');
              const m = u.pathname.match(/\/(?:shorts|embed|live)\/([^/?#]+)/);
              if (m) return m[1];
            }
          } catch (_) {}
          return null;
        }

        document.querySelectorAll('[data-yt-play-id]').forEach((box) => {
          box.addEventListener('click', () => {
            const vid = box.getAttribute('data-yt-play-id');
            const vtitle = box.getAttribute('data-yt-play-title') || 'YouTube Video';
            if (!vid || box.querySelector('iframe')) return;
            box.innerHTML = '';
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid)}?autoplay=1&rel=0`;
            iframe.title = vtitle;
            iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            box.appendChild(iframe);
          });
        });

        function closeDangerModal() {
          if (dangerModal) {
            dangerModal.classList.remove('open');
            dangerModal.setAttribute('aria-hidden', 'true');
            if (dangerModalLinks) dangerModalLinks.innerHTML = '';
          }
        }

        document.querySelectorAll('[data-open-danger-modal]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!dangerModal) return;
            const pName = btn.getAttribute('data-danger-name') || '';
            const summary = btn.getAttribute('data-danger-summary') || '';
            const rType = btn.getAttribute('data-danger-type') || '';
            const reason = btn.getAttribute('data-danger-reason') || '';
            const rDate = btn.getAttribute('data-danger-date') || '';
            const issueNum = btn.getAttribute('data-danger-issue') || '';
            let links = [];
            try { links = JSON.parse(btn.getAttribute('data-danger-links') || '[]'); } catch (_) {}

            if (dangerModalTitle) dangerModalTitle.textContent = `${uiStrings.dangerPrefix}: ${pName}`;
            if (dangerModalMeta) {
              const parts = [];
              if (rType) parts.push(`${uiStrings.dangerTypeLabel}: ${rType}`);
              if (rDate) parts.push(`${uiStrings.dangerDateLabel}: ${rDate}`);
              if (issueNum) parts.push(`GitHub Issue #${issueNum}`);
              dangerModalMeta.textContent = parts.join(' · ');
            }
            if (dangerModalSummary) {
              dangerModalSummary.textContent = summary || uiStrings.dangerSummaryDefault;
            }
            if (dangerModalBody) {
              dangerModalBody.innerHTML = renderSafeMarkdown(reason);
            }
            if (dangerModalLinks && dangerModalLinksWrap) {
              dangerModalLinks.innerHTML = '';
              dangerModalLinks.classList.add('danger-evidence-list');
              const combinedLinks = Array.isArray(links) ? [...links] : [];
              const extraUrls = reason.match(/https?:\/\/[^\s)>"']+/gi) || [];
              extraUrls.forEach((u) => {
                if (!combinedLinks.includes(u)) combinedLinks.push(u);
              });
              if (combinedLinks.length > 0) {
                combinedLinks.forEach((u) => {
                  if (/^https?:\/\//i.test(u)) {
                    const li = document.createElement('li');
                    const ytId = extractYoutubeId(u);
                    if (ytId) {
                      const card = document.createElement('div');
                      card.className = 'danger-video-card';
                      const iframe = document.createElement('iframe');
                      iframe.className = 'danger-video-frame';
                      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?rel=0`;
                      iframe.title = `${pName} — YouTube Evidence`;
                      iframe.loading = 'lazy';
                      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
                      iframe.allowFullscreen = true;
                      card.appendChild(iframe);
                      const bar = document.createElement('div');
                      bar.style.cssText = 'padding: 0.45rem 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; border-top: 1px solid var(--border-ink);';
                      const a = document.createElement('a');
                      a.href = u;
                      a.target = '_blank';
                      a.rel = 'noopener noreferrer';
                      a.className = 'mono';
                      a.style.cssText = 'font-size: 0.74rem; color: var(--accent); font-weight: 700; text-decoration: none;';
                      a.textContent = `YouTube ↗`;
                      bar.appendChild(a);
                      card.appendChild(bar);
                      li.appendChild(card);
                    } else {
                      const a = document.createElement('a');
                      a.href = u;
                      a.target = '_blank';
                      a.rel = 'noopener noreferrer';
                      a.className = 'danger-link-pill';
                      a.textContent = `${u} ↗`;
                      li.appendChild(a);
                    }
                    dangerModalLinks.appendChild(li);
                  }
                });
                dangerModalLinksWrap.style.display = dangerModalLinks.children.length > 0 ? 'block' : 'none';
              } else {
                dangerModalLinksWrap.style.display = 'none';
              }
            }
            dangerModal.classList.add('open');
            dangerModal.setAttribute('aria-hidden', 'false');
          });
        });

        if (dangerModalClose) dangerModalClose.addEventListener('click', closeDangerModal);
        if (dangerModal) {
          dangerModal.addEventListener('click', (e) => {
            if (e.target === dangerModal) closeDangerModal();
          });
        }

        // Repo Fluffies (GitHub Stars, called "Пухнастики")
        const fluffiesCountEl = document.getElementById('repo-fluffies-count');
        if (fluffiesCountEl && repo) {
          const FLUFFIES_CACHE_KEY = 'meow_repo_fluffies_v1';
          const FLUFFIES_TTL_MS = 10 * 60 * 1000;
          const renderFluffies = (val) => {
            if (typeof val === 'number' && Number.isFinite(val)) {
              fluffiesCountEl.textContent = val.toLocaleString('uk-UA');
            }
          };
          let needFetch = true;
          try {
            const cachedRaw = localStorage.getItem(FLUFFIES_CACHE_KEY);
            if (cachedRaw) {
              const cached = JSON.parse(cachedRaw);
              if (cached && typeof cached.count === 'number') {
                renderFluffies(cached.count);
                if (Date.now() - (cached.ts || 0) < FLUFFIES_TTL_MS) {
                  needFetch = false;
                }
              }
            }
          } catch (_) {}
          if (needFetch) {
            const saveAndRender = (count) => {
              if (typeof count === 'number' && Number.isFinite(count)) {
                renderFluffies(count);
                try {
                  localStorage.setItem(FLUFFIES_CACHE_KEY, JSON.stringify({ count, ts: Date.now() }));
                } catch (_) {}
              }
            };
            fetch(`https://api.github.com/repos/${repo}`)
              .then((r) => (r.ok ? r.json() : Promise.reject(new Error('gh_api_err'))))
              .then((data) => {
                if (data && typeof data.stargazers_count === 'number') {
                  saveAndRender(data.stargazers_count);
                } else {
                  return Promise.reject(new Error('no_stars'));
                }
              })
              .catch(() => {
                fetch(`https://img.shields.io/github/stars/${repo}.json`)
                  .then((r) => (r.ok ? r.json() : null))
                  .then((s) => {
                    if (s && s.value !== undefined) {
                      const n = Number(String(s.value).replace(/[^\d]/g, ''));
                      if (Number.isFinite(n)) saveAndRender(n);
                    }
                  })
                  .catch(() => {});
              });
          }
        }

        // Custom Paper Select Dropdowns (with optional quick search)
        function closeAllPaperSelects(except) {
          document.querySelectorAll('.paper-select-dropdown.is-open').forEach((dd) => {
            if (dd === except) return;
            dd.classList.remove('is-open');
            const tr = dd.querySelector('.paper-select-trigger');
            if (tr) tr.setAttribute('aria-expanded', 'false');
          });
        }

        function setPaperSelectValue(inputId, val) {
          const dd = document.querySelector(`.paper-select-dropdown[data-paper-select="${inputId}"]`);
          const hidden = document.getElementById(inputId);
          if (!dd || !hidden) return;
          const opts = Array.from(dd.querySelectorAll('.paper-select-option'));
          const matched = opts.find((o) => o.getAttribute('data-value') === val) || opts[0];
          if (!matched) return;
          hidden.value = matched.getAttribute('data-value') || '';
          const txtEl = dd.querySelector('.paper-select-trigger-text');
          if (txtEl) txtEl.textContent = matched.getAttribute('data-label') || matched.textContent.trim();
          opts.forEach((o) => o.classList.toggle('is-selected', o === matched));
          hidden.dispatchEvent(new Event('change', { bubbles: true }));
        }

        document.querySelectorAll('.paper-select-dropdown').forEach((dd) => {
          if (dd.dataset.psBound === '1') return;
          dd.dataset.psBound = '1';
          const inputId = dd.getAttribute('data-paper-select');
          const trigger = dd.querySelector('.paper-select-trigger');
          const searchInput = dd.querySelector('.paper-select-search');
          const options = Array.from(dd.querySelectorAll('.paper-select-option'));
          const emptyEl = dd.querySelector('.paper-select-empty');

          if (trigger) {
            trigger.addEventListener('click', (e) => {
              e.stopPropagation();
              const willOpen = !dd.classList.contains('is-open');
              closeAllPaperSelects(dd);
              dd.classList.toggle('is-open', willOpen);
              trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
              if (willOpen && searchInput) {
                searchInput.value = '';
                options.forEach((o) => { o.style.display = ''; });
                if (emptyEl) emptyEl.style.display = 'none';
                setTimeout(() => searchInput.focus(), 30);
              }
            });
          }

          if (searchInput) {
            searchInput.addEventListener('click', (e) => e.stopPropagation());
            searchInput.addEventListener('input', () => {
              const q = searchInput.value.trim().toLowerCase();
              let visibleCount = 0;
              options.forEach((opt) => {
                const hay = (opt.getAttribute('data-search') || opt.textContent || '').toLowerCase();
                const show = !q || hay.includes(q);
                opt.style.display = show ? '' : 'none';
                if (show) visibleCount++;
              });
              if (emptyEl) emptyEl.style.display = visibleCount === 0 ? 'block' : 'none';
            });
          }

          options.forEach((opt) => {
            opt.addEventListener('click', (e) => {
              e.stopPropagation();
              const val = opt.getAttribute('data-value') || '';
              if (inputId) setPaperSelectValue(inputId, val);
              closeAllPaperSelects(null);
            });
          });
        });

        if (!window.__paperSelectDocBound) {
          window.__paperSelectDocBound = true;
          document.addEventListener('click', () => closeAllPaperSelects(null));
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAllPaperSelects(null);
          });
        }

        // Report Builder Form & Quick Report Switcher
        const reportForm = document.getElementById('report-danger-form');
        const reportProjectSelect = document.getElementById('report-project-select');
        const reportMdInput = document.getElementById('report-markdown');
        const reportCharCounter = document.getElementById('report-char-counter');

        if (reportMdInput && reportCharCounter) {
          const updateCounter = () => {
            const len = reportMdInput.value.length;
            reportCharCounter.textContent = `${len.toLocaleString('uk-UA')} / 20 000`;
            reportCharCounter.style.color = len > 19500 ? 'var(--stamp-red)' : 'var(--ink-muted)';
          };
          if (reportMdInput.dataset.counterBound !== '1') {
            reportMdInput.dataset.counterBound = '1';
            reportMdInput.addEventListener('input', updateCounter);
          }
          updateCounter();

          document.querySelectorAll('[data-md-insert]').forEach((toolBtn) => {
            if (toolBtn.dataset.mdBound === '1') return;
            toolBtn.dataset.mdBound = '1';
            toolBtn.addEventListener('click', () => {
              const snippet = (toolBtn.getAttribute('data-md-insert') || '').replace(/\\n/g, '\n');
              const start = reportMdInput.selectionStart || 0;
              const end = reportMdInput.selectionEnd || 0;
              const val = reportMdInput.value;
              reportMdInput.value = (val.slice(0, start) + snippet + val.slice(end)).slice(0, 20000);
              const nextCaret = Math.min(start + snippet.length, 20000);
              reportMdInput.focus();
              reportMdInput.setSelectionRange(nextCaret, nextCaret);
              updateCounter();
            });
          });
        }

        document.querySelectorAll('[data-quick-report]').forEach((btn) => {
          if (btn.dataset.qrBound === '1') return;
          btn.dataset.qrBound = '1';
          btn.addEventListener('click', () => {
            const slug = btn.getAttribute('data-quick-report');
            if (reportProjectSelect && slug) {
              setPaperSelectValue('report-project-select', slug);
            }
            const reportTabBtn = document.querySelector('[data-view-btn="report"]');
            if (reportTabBtn) reportTabBtn.click();
          });
        });

        if (reportForm && reportForm.dataset.rfBound !== '1') {
          reportForm.dataset.rfBound = '1';
          reportForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const slug = (document.getElementById('report-project-select')?.value || '').trim();
            const reasonType = (document.getElementById('report-reason-type')?.value || '').trim();
            const summary = (document.getElementById('report-summary')?.value || '').trim();
            const mdText = (document.getElementById('report-markdown')?.value || '').trim().slice(0, 20000);
            const linksText = (document.getElementById('report-links')?.value || '').trim();

            if (!slug) {
              const projTrigger = document.getElementById('report-project-trigger');
              if (projTrigger) {
                projTrigger.style.borderColor = 'var(--stamp-red)';
                projTrigger.click();
              }
              return;
            }
            if (!mdText) return;

            let body = `### Project\n${slug}\n\n`;
            body += `### Reason Type\n${reasonType}\n\n`;
            body += `### Summary\n${summary}\n\n`;
            body += `### Evidence Markdown\n${mdText}\n\n`;
            if (linksText) {
              body += `### Evidence Links\n${linksText}\n\n`;
            }

            const title = `[report: ${slug}] ${summary || reasonType}`;
            const issueUrl = `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
            window.open(issueUrl, '_blank');
          });
        }

        // Live YouTubers subscriber count & LIVE stream status refresher
        async function refreshYoutubersLiveStatus() {
          const subsNodes = document.querySelectorAll('[data-yt-subs]');
          const liveNodes = document.querySelectorAll('[data-yt-live]');
          if (subsNodes.length === 0 && liveNodes.length === 0) return;
          try {
            const res = await fetch('/data/youtubers.json?t=' + Date.now(), { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            const channels = data && data.channels ? data.channels : {};
            subsNodes.forEach((el) => {
              const slug = el.getAttribute('data-yt-subs');
              const ch = channels[slug];
              const valEl = el.querySelector('[data-yt-subs-val]');
              if (ch && ch.subscribers && valEl) {
                valEl.textContent = ch.subscribers;
                el.style.display = '';
              }
            });
            liveNodes.forEach((el) => {
              const slug = el.getAttribute('data-yt-live');
              const ch = channels[slug];
              if (ch && ch.isLive) {
                if (ch.liveVideoId) el.setAttribute('href', `https://www.youtube.com/watch?v=${ch.liveVideoId}`);
                if (ch.liveTitle) el.setAttribute('title', ch.liveTitle);
                el.style.display = '';
              } else {
                el.style.display = 'none';
              }
            });
          } catch (_) {}
        }

        refreshYoutubersLiveStatus();
        if (window.__meowYtLiveTimer) clearInterval(window.__meowYtLiveTimer);
        window.__meowYtLiveTimer = setInterval(() => {
          if (!document.hidden) refreshYoutubersLiveStatus();
        }, 120000);

        // 11. Compare Projects Feature (Bottom-Left FAB, 2 to 5 projects, Analysis & Table)
        (function initCompareTool() {
          const fab = document.getElementById('floating-compare-btn');
          const badge = document.getElementById('floating-compare-badge');
          const modal = document.getElementById('modal-compare');
          const stepSelect = document.getElementById('compare-step-select');
          const stepResult = document.getElementById('compare-step-result');
          const searchInput = document.getElementById('compare-search-input');
          const catChipsWrap = document.getElementById('compare-cat-chips');
          const gridEl = document.getElementById('compare-projects-grid');
          const countEl = document.getElementById('compare-selected-count');
          const clearBtn = document.getElementById('compare-clear-btn');
          const runBtn = document.getElementById('compare-run-btn');
          const backBtn = document.getElementById('compare-back-btn');
          const analysisEl = document.getElementById('compare-analysis-banner');
          const tableEl = document.getElementById('compare-result-table');
          if (!fab || !modal || !gridEl) return;

          let selectedSlugs = [];
          try {
            const saved = JSON.parse(sessionStorage.getItem('meow_compare_slugs') || '[]');
            if (Array.isArray(saved)) selectedSlugs = saved.slice(0, 5);
          } catch (_) {}

          let filterCat = 'all';
          let filterQuery = '';

          function esc(s) {
            return String(s || '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
          }

          function saveSelection() {
            try { sessionStorage.setItem('meow_compare_slugs', JSON.stringify(selectedSlugs)); } catch (_) {}
            if (countEl) countEl.textContent = String(selectedSlugs.length);
            if (badge) {
              badge.textContent = String(selectedSlugs.length);
              badge.style.display = selectedSlugs.length > 0 ? 'inline-flex' : 'none';
            }
            if (runBtn) {
              runBtn.disabled = selectedSlugs.length < 2 || selectedSlugs.length > 5;
            }
          }

          function renderCatChips() {
            if (!catChipsWrap) return;
            const cats = ['all', 'launcher', 'modpack', 'mod', 'client', 'server', 'website', 'youtuber', 'project'];
            catChipsWrap.innerHTML = cats.map((c) => {
              const lbl = c === 'all' ? (compareStrings.catAll || 'All') : (categoryTitles[c] || c);
              return `<button type="button" class="compare-cat-chip ${filterCat === c ? 'active' : ''}" data-cmp-cat="${c}">${esc(lbl)}</button>`;
            }).join('');
            catChipsWrap.querySelectorAll('[data-cmp-cat]').forEach((btn) => {
              btn.addEventListener('click', () => {
                filterCat = btn.getAttribute('data-cmp-cat') || 'all';
                renderCatChips();
                renderPickerGrid();
              });
            });
          }

          function renderPickerGrid() {
            const q = filterQuery.trim().toLowerCase();
            const filtered = compareCatalog.filter((p) => {
              if (filterCat !== 'all' && p.category !== filterCat) return false;
              if (q && !p.name.toLowerCase().includes(q) && !p.slug.toLowerCase().includes(q)) return false;
              return true;
            });

            gridEl.innerHTML = filtered.map((p) => {
              const isSel = selectedSlugs.includes(p.slug);
              const catName = categoryTitles[p.category] || p.category;
              return `
                <button type="button" class="compare-pick-card ${isSel ? 'selected' : ''}" data-cmp-slug="${esc(p.slug)}">
                  <img src="${esc(p.icon)}" alt="" loading="lazy" />
                  <div class="compare-pick-meta">
                    <span class="compare-pick-name">${esc(p.name)}</span>
                    <span class="compare-pick-cat">${esc(catName)}${p.verified ? ' · ✓' : ''}${p.danger ? ' · ⚠' : ''}</span>
                  </div>
                  <span class="compare-pick-check">${isSel ? '✓' : ''}</span>
                </button>
              `;
            }).join('');

            gridEl.querySelectorAll('[data-cmp-slug]').forEach((card) => {
              card.addEventListener('click', () => {
                const sl = card.getAttribute('data-cmp-slug');
                const idx = selectedSlugs.indexOf(sl);
                if (idx >= 0) {
                  selectedSlugs.splice(idx, 1);
                } else if (selectedSlugs.length < 5) {
                  selectedSlugs.push(sl);
                }
                saveSelection();
                renderPickerGrid();
              });
            });
          }

          function renderComparisonResult() {
            const items = selectedSlugs
              .map((sl) => compareCatalog.find((x) => x.slug === sl))
              .filter(Boolean);
            if (items.length < 2) return;

            const maxCommunity = Math.max(...items.map((x) => x.score || 0));
            const rankVal = (p) => (p.danger ? -1000 : 0) + (p.verified ? 30 : 0) + (p.isOpenSource ? 20 : 0) + (p.score || 0);
            const best = items.slice().sort((a, b) => rankVal(b) - rankVal(a))[0];
            const dangerousOnes = items.filter((x) => x.danger);
            const openOnes = items.filter((x) => x.isOpenSource);

            const summaryParts = [];
            summaryParts.push(`<strong>🏆 ${esc(compareStrings.winnerLabel || 'Аналіз MeowLab')}:</strong> <strong>${esc(best.name)}</strong>`);
            const reasons = [];
            if (best.verified) reasons.push(esc(compareStrings.verifiedBadge || 'VERIFIED'));
            if (best.isOpenSource) reasons.push(`${esc(compareStrings.openSourceBadge || 'Open Source')} (${esc(best.license)})`);
            if (best.score > 0) reasons.push(`${esc(compareStrings.ratingLabel)}: ${best.score}/100`);
            if (best.releaseTag) reasons.push(`${esc(compareStrings.latestVerLabel)}: ${esc(best.releaseTag)}`);
            if (reasons.length) summaryParts.push(`— ${reasons.join(' · ')}.`);
            if (dangerousOnes.length > 0) {
              summaryParts.push(`<br><span style="color:#ef4444;font-weight:800;">⚠️ ${esc(compareStrings.dangerBadge || 'DANGEROUS')}: ${dangerousOnes.map((d) => esc(d.name)).join(', ')}</span>`);
            } else if (openOnes.length > 0 && openOnes.length < items.length) {
              summaryParts.push(`<br><span style="color:var(--ink-muted);">${esc(compareStrings.openSourceBadge)}: ${openOnes.map((o) => esc(o.name)).join(', ')}</span>`);
            }
            if (analysisEl) analysisEl.innerHTML = summaryParts.join(' ');

            const headRow = `
              <tr>
                <th></th>
                ${items.map((p) => `
                  <td>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                      <img src="${esc(p.icon)}" alt="" style="width:30px;height:30px;border-radius:6px;object-fit:cover;" />
                      <div>
                        <a href="${esc(p.href)}" style="font-weight:900;color:var(--ink);text-decoration:underline;">${esc(p.name)}</a>
                        <div style="font-size:0.7rem;color:var(--ink-muted);text-transform:uppercase;">${esc(categoryTitles[p.category] || p.category)}</div>
                      </div>
                    </div>
                  </td>
                `).join('')}
              </tr>
            `;

            const ratingRow = `
              <tr>
                <th>${esc(compareStrings.ratingLabel)}</th>
                ${items.map((p) => `
                  <td class="${maxCommunity > 0 && p.score === maxCommunity ? 'compare-best-cell' : ''}">
                    ${p.score > 0 ? `<strong class="mono">★ ${p.score}/100</strong> <span style="color:var(--ink-muted);font-size:0.74rem;">(${p.reviewsCount})</span>` : `<span style="color:var(--ink-muted);">${esc(compareStrings.noRatingYet)}</span>`}
                  </td>
                `).join('')}
              </tr>
            `;

            const secRow = `
              <tr>
                <th>${esc(compareStrings.securityLabel)}</th>
                ${items.map((p) => {
                  if (p.danger) return `<td class="compare-danger-cell"><strong style="color:#ef4444;">⚠ ${esc(compareStrings.dangerBadge)}</strong></td>`;
                  if (p.verified) return `<td class="compare-best-cell"><strong style="color:#22c55e;">✓ ${esc(compareStrings.verifiedBadge)}</strong></td>`;
                  return `<td>—</td>`;
                }).join('')}
              </tr>
            `;

            const codeRow = `
              <tr>
                <th>${esc(compareStrings.licenseLabel)}</th>
                ${items.map((p) => `
                  <td class="${p.isOpenSource ? 'compare-best-cell' : ''}">
                    <strong>${p.isOpenSource ? '✓ ' + esc(compareStrings.openSourceBadge) : esc(compareStrings.proprietaryBadge)}</strong>
                    ${p.isOpenSource ? `<div class="mono" style="font-size:0.74rem;color:var(--ink-muted);">${esc(p.license)}</div>` : ''}
                  </td>
                `).join('')}
              </tr>
            `;

            const verRow = `
              <tr>
                <th>${esc(compareStrings.latestVerLabel)}</th>
                ${items.map((p) => `
                  <td>
                    ${p.releaseTag ? `<span class="gh-release-tag mono">${esc(p.releaseTag)}</span> <div class="mono" style="font-size:0.7rem;color:var(--ink-muted);margin-top:2px;">${esc(p.releaseDate)}</div>` : '—'}
                  </td>
                `).join('')}
              </tr>
            `;

            const platRow = `
              <tr>
                <th>${esc(compareStrings.platformsLabel)}</th>
                ${items.map((p) => `<td>${esc((p.platforms || []).join(', ') || '—')}</td>`).join('')}
              </tr>
            `;

            const countryRow = `
              <tr>
                <th>${esc(compareStrings.countryLabel)}</th>
                ${items.map((p) => `<td>${esc(p.country || '—')}</td>`).join('')}
              </tr>
            `;

            const tagsRow = `
              <tr>
                <th>${esc(compareStrings.tagsLabel)}</th>
                ${items.map((p) => `<td style="font-size:0.75rem;color:var(--ink-muted);">${esc((p.tags || []).map((tg) => '#' + tg).join(' '))}</td>`).join('')}
              </tr>
            `;

            if (tableEl) {
              tableEl.innerHTML = `<tbody>${headRow}${ratingRow}${secRow}${codeRow}${verRow}${platRow}${countryRow}${tagsRow}</tbody>`;
            }
          }

          function openCompareModal() {
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            stepSelect.style.display = '';
            stepResult.style.display = 'none';
            renderCatChips();
            renderPickerGrid();
            saveSelection();
          }

          function closeCompareModal() {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
          }

          fab.onclick = openCompareModal;
          modal.querySelectorAll('[data-close-compare]').forEach((b) => { b.onclick = closeCompareModal; });
          modal.onclick = (e) => { if (e.target === modal) closeCompareModal(); };

          if (searchInput) {
            searchInput.oninput = () => {
              filterQuery = searchInput.value || '';
              renderPickerGrid();
            };
          }
          if (clearBtn) {
            clearBtn.onclick = () => {
              selectedSlugs = [];
              saveSelection();
              renderPickerGrid();
            };
          }
          if (runBtn) {
            runBtn.onclick = () => {
              if (selectedSlugs.length < 2) return;
              renderComparisonResult();
              stepSelect.style.display = 'none';
              stepResult.style.display = '';
            };
          }
          if (backBtn) {
            backBtn.onclick = () => {
              stepResult.style.display = 'none';
              stepSelect.style.display = '';
            };
          }

          saveSelection();
        })();

        // 12. Discord 1-Click Review Modal & Return Toast
        (function initDiscordReviewTool() {
          const modal = document.getElementById('discord-review-modal');
          const closeBtn = document.getElementById('dr-modal-close');
          const form = document.getElementById('discord-review-form');
          const slugInput = document.getElementById('dr-project-slug');
          const projNameEl = document.getElementById('dr-project-name');
          const scoreRange = document.getElementById('dr-score-range');
          const scoreNum = document.getElementById('dr-score-num');
          const textArea = document.getElementById('dr-review-text');
          const charCounter = document.getElementById('dr-char-counter');
          const errBox = document.getElementById('dr-error-box');
          const submitBtn = document.getElementById('dr-submit-btn');
          const submitLabel = document.getElementById('dr-submit-label');
          const toastEl = document.getElementById('dr-toast');

          function showToast(msg, isOk) {
            if (!toastEl || !msg) return;
            toastEl.textContent = msg;
            toastEl.className = 'dr-toast ' + (isOk ? 'is-ok' : 'is-err');
            toastEl.style.display = 'block';
            clearTimeout(window.__drToastTimer);
            window.__drToastTimer = setTimeout(() => {
              toastEl.style.display = 'none';
            }, 6500);
          }

          function errorMsgForCode(code) {
            if (code === 'account_young') return discordStrings.drErrYoung || 'Discord account must be at least 14 days old.';
            if (code === 'cancelled') return discordStrings.drErrCancelled || 'Discord login was cancelled.';
            if (code === 'expired' || code === 'bad_state' || code === 'bad_signature') return discordStrings.drErrExpired || 'Review draft expired, please submit again.';
            if (code === 'text_short') return discordStrings.drErrShort || 'Review text is too short (minimum 3 characters).';
            if (code === 'no_issue') return discordStrings.drErrNoIssue || 'Review thread not found for this project yet.';
            if (code === 'not_configured') return discordStrings.drErrDisabled || 'Discord reviews are not configured on this server yet.';
            const base = discordStrings.drErrGeneric || 'Could not publish review. Please try again.';
            return code ? `${base} [${code}]` : base;
          }

          // Check OAuth callback result in URL (?mlreview=ok|updated|error&mlcode=...)
          try {
            const url = new URL(window.location.href);
            const res = url.searchParams.get('mlreview');
            if (res) {
              const code = url.searchParams.get('mlcode') || '';
              if (res === 'ok') {
                showToast('✅ ' + (discordStrings.drOk || 'Відгук успішно опубліковано!'), true);
              } else if (res === 'updated') {
                showToast('✅ ' + (discordStrings.drUpdated || 'Ваш відгук та оцінку оновлено!'), true);
              } else {
                if (code) console.warn('[MeowLab Discord Review] error:', code);
                showToast('⚠️ ' + errorMsgForCode(code), false);
              }
              url.searchParams.delete('mlreview');
              url.searchParams.delete('mlcode');
              window.history.replaceState({}, '', url.pathname + url.search + url.hash);
            }
          } catch (_) {}

          if (!modal || !form) return;

          function closeDrModal() {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
          }

          function openDrModal(slug, name) {
            if (slugInput) slugInput.value = slug || '';
            if (projNameEl) projNameEl.textContent = name || slug || '';
            if (errBox) {
              errBox.style.display = 'none';
              errBox.textContent = '';
            }
            if (submitBtn) submitBtn.disabled = false;
            if (submitLabel && discordStrings.drSubmit) submitLabel.textContent = discordStrings.drSubmit;
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            setTimeout(() => { if (textArea) textArea.focus(); }, 60);
          }

          document.querySelectorAll('[data-discord-review-btn]').forEach((btn) => {
            btn.addEventListener('click', () => {
              openDrModal(btn.getAttribute('data-discord-review-btn'), btn.getAttribute('data-project-name'));
            });
          });

          if (closeBtn) closeBtn.onclick = closeDrModal;
          modal.addEventListener('click', (e) => {
            if (e.target === modal) closeDrModal();
          });

          if (scoreRange && scoreNum) {
            scoreRange.oninput = () => { scoreNum.value = scoreRange.value; };
            scoreNum.oninput = () => {
              let v = Math.round(Number(scoreNum.value));
              if (isNaN(v)) v = 0;
              v = Math.max(0, Math.min(100, v));
              scoreRange.value = String(v);
            };
          }

          if (textArea && charCounter) {
            textArea.oninput = () => {
              charCounter.textContent = `${(textArea.value || '').length} / 1000`;
            };
          }

          form.onsubmit = async (e) => {
            e.preventDefault();
            if (errBox) errBox.style.display = 'none';
            const slug = (slugInput?.value || '').trim();
            const score = Math.max(0, Math.min(100, Math.round(Number(scoreNum?.value ?? scoreRange?.value ?? 90))));
            const text = (textArea?.value || '').trim();

            if (text.length < 3) {
              if (errBox) {
                errBox.textContent = errorMsgForCode('text_short');
                errBox.style.display = 'block';
              }
              return;
            }

            if (submitBtn) submitBtn.disabled = true;
            const prevLabel = submitLabel ? submitLabel.textContent : '';
            if (submitLabel) submitLabel.textContent = discordStrings.drSending || 'Redirecting to Discord...';

            try {
              const resp = await fetch('/api/review/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  slug,
                  score,
                  text,
                  back: window.location.pathname + window.location.search,
                }),
              });
              let data = null;
              try { data = await resp.json(); } catch (_) {}

              if (resp.ok && data && data.ok && data.url) {
                window.location.href = data.url;
                return;
              }
              const errCode = data?.error || (resp.status === 404 ? 'not_configured' : 'generic');
              if (errBox) {
                errBox.textContent = errorMsgForCode(errCode);
                errBox.style.display = 'block';
              }
            } catch (_) {
              if (errBox) {
                errBox.textContent = errorMsgForCode('generic');
                errBox.style.display = 'block';
              }
            }

            if (submitBtn) submitBtn.disabled = false;
            if (submitLabel) submitLabel.textContent = prevLabel;
          };
        })();
      }

      if (!window.__meowPageLoadBound) {
        window.__meowPageLoadBound = true;
        document.addEventListener('astro:page-load', setupPage);
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupPage, { once: true });
      } else {
        setupPage();
      }
})();
