const app = document.querySelector("#app");
const nav = document.querySelector("#primary-nav");
const navToggle = document.querySelector(".nav-toggle");
const toastRegion = document.querySelector("#toast-region");

const state = {
  sourceData: null,
  sourcePromise: null,
  editingSourceId: null,
  currentUser: null,
};

document.querySelector("#year").textContent = new Date().getFullYear();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function formatDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: options.short ? "medium" : "long",
    timeStyle: options.time ? "short" : undefined,
  }).format(date);
}

function titleFor(pathname) {
  const titles = {
    "/": "Fact-Check — Evidence, not noise",
    "/check": "Check a claim — Fact-Check",
    "/sources": "Trusted sources — Fact-Check",
    "/method": "How it works — Fact-Check",
    "/about": "About Fact-Check",
    "/contact": "Contact Fact-Check",
    "/login": "Log in — Fact-Check",
    "/signup": "Sign up — Fact-Check",
    "/account": "Your account — Fact-Check",
    "/admin": "Fact-Check Admin",
  };
  return titles[pathname] || "Fact-Check";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Something went wrong. Please try again.");
  return payload;
}

function toast(message, kind = "") {
  const item = document.createElement("div");
  item.className = `toast ${kind}`;
  item.textContent = message;
  toastRegion.append(item);
  window.setTimeout(() => item.remove(), 4600);
}

function closeMenu() {
  nav.classList.remove("open");
  navToggle.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
}

function navigate(pathname) {
  if (window.location.pathname !== pathname) window.history.pushState({}, "", pathname);
  closeMenu();
  render();
}

function observeReveals() {
  const items = app.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach((item) => observer.observe(item));
}

function renderAccountNav() {
  const accountNav = document.querySelector("#account-nav");
  if (!accountNav) return;
  if (state.currentUser) {
    accountNav.innerHTML = `<a class="nav-login" href="/account" data-route>Account</a><button class="nav-logout" id="user-logout" type="button">Log out</button>`;
    document.querySelector("#user-logout")?.addEventListener("click", async () => {
      try {
        await api("/api/auth/logout", { method: "POST", body: "{}" });
        state.currentUser = null;
        renderAccountNav();
        if (window.location.pathname === "/account") navigate("/");
        toast("You have been logged out.");
      } catch (error) {
        toast(error.message, "error");
      }
    });
    return;
  }
  accountNav.innerHTML = `<a class="nav-login" href="/login" data-route>Log in</a><a class="nav-signup" href="/signup" data-route>Sign up</a>`;
}

async function refreshCurrentUser() {
  try {
    const response = await api("/api/auth/status");
    state.currentUser = response.user || null;
  } catch {
    state.currentUser = null;
  }
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  if (state.currentUser && (pathname === "/login" || pathname === "/signup")) {
    navigate("/account");
    return state.currentUser;
  }
  updateNav();
  return state.currentUser;
}

function updateNav() {
  renderAccountNav();
  const current = window.location.pathname;
  document.querySelectorAll(".primary-nav a[data-route]").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === current);
  });
}

function pageHead(eyebrow, heading, lead) {
  return `
    <section class="page page-hero reveal">
      <span class="eyebrow">${escapeHtml(eyebrow)}</span>
      <h1>${heading}</h1>
      <p class="lead">${escapeHtml(lead)}</p>
    </section>`;
}

function renderHome() {
  app.innerHTML = `
    <section class="page hero">
      <div class="hero-copy reveal">
        <span class="eyebrow">Evidence-led media and information literacy</span>
        <h1>Check the evidence. <em>Think before you share.</em></h1>
        <p class="lead">Fact-Check helps people turn uncertainty into a verification habit. It checks a claim or image context only against a transparent source list, then links to the evidence so you can make an informed decision.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="/check" data-route>Check a claim <span aria-hidden="true">→</span></a>
          <a class="btn btn-secondary" href="/sources" data-route>Explore sources</a>
        </div>
        <div class="trust-strip"><div class="trust-avatars" aria-hidden="true"><span>WHO</span><span>UN</span><span>CDC</span><span>IFCN</span></div><span>Every result begins with a visible source boundary, not a hidden web search.</span></div>
      </div>
      <div class="hero-proof reveal" aria-label="A visual summary of the Fact-Check evidence process">
        <div class="orbital"></div><div class="orbital orbital-two"></div>
        <div class="evidence-core">
          <div class="core-top"><span>EVIDENCE CHECK</span><span>TRACEABLE</span></div>
          <div class="core-check" aria-hidden="true">✓</div>
          <div><div class="core-title">Evidence first</div><div class="core-meta"><span>Source linked</span><span>Scope clear</span></div></div>
        </div>
        <div class="floating-proof proof-1"><span class="proof-icon" aria-hidden="true">↗</span><span><b>Selected sources</b><small>Only the public registry</small></span></div>
        <div class="floating-proof proof-2"><span class="proof-icon" aria-hidden="true">✓</span><span><b>Clear outcome</b><small>Evidence, context, uncertainty</small></span></div>
      </div>
    </section>

    <section class="section section-tint"><div class="page">
      <div class="stat-grid reveal">
        <article class="stat-card"><strong data-source-count>100</strong><span>starter sources to inspect</span></article>
        <article class="stat-card"><strong>0</strong><span>unlisted domains used in checks</span></article>
        <article class="stat-card"><strong>5</strong><span>careful evidence outcomes</span></article>
      </div>
    </div></section>

    <section class="section"><div class="page">
      <div class="section-head reveal"><span class="eyebrow">The trusted-source registry</span><h2>A public source boundary, <em>not an open-web guess.</em></h2><p>Every Fact-Check result is limited to the active sources in our public registry. See who is included, why they are included, and open the original reporting yourself.</p></div>
      <div class="source-summary reveal"><span id="home-registry-summary">Loading the trusted-source registry...</span><span class="mini-label" id="home-registry-version">Registry version -</span></div>
      <div id="home-registry-grid" class="source-grid" aria-live="polite"><div class="center-loader glass-card"><span class="spinner"></span><span>Loading source groups...</span></div></div>
      <div class="inline-actions reveal"><a class="btn btn-primary" id="home-sources-link" href="/sources" data-route>View all trusted sources <span aria-hidden="true">→</span></a><a class="btn btn-secondary" href="/api/sources.pdf">Download the current list (PDF)</a></div>
    </div></section>

    <section class="section"><div class="page">
      <div class="section-head reveal"><span class="eyebrow">Verification is a habit</span><h2>Move from “is it true?” to “what is the evidence?”</h2><p>Fact-Check makes the source boundary visible so people can pause, inspect the context, and decide what deserves their trust.</p></div>
      <div class="feature-grid">
        <article class="feature-card glass-card reveal"><span class="feature-number">01 / A clear boundary</span><div class="feature-icon" aria-hidden="true">⌕</div><h3>Searches only the selected registry</h3><p>The source list is managed openly. Fact-Check does not quietly pull in random websites, social posts, or search snippets.</p></article>
        <article class="feature-card glass-card reveal"><span class="feature-number">02 / Every answer is inspectable</span><div class="feature-icon" aria-hidden="true">↗</div><h3>Keeps the evidence visible</h3><p>Each result links to the sources used, so users can read the reporting, date, and context for themselves.</p></article>
        <article class="feature-card glass-card reveal"><span class="feature-number">03 / Uncertainty is allowed</span><div class="feature-icon" aria-hidden="true">≈</div><h3>Keeps critical thinking human</h3><p>No supporting source is not the same as “false.” Fact-Check marks results that need more evidence, context, or human review.</p></article>
      </div>
    </div></section>

    <section class="section section-tint"><div class="page how-grid">
      <div class="reveal"><span class="eyebrow">How a check happens</span><h2>A small workflow with a clear responsibility.</h2><p class="lead">AI can help organize evidence. It should not make a hidden decision about what people should believe.</p><div class="steps">
        <article class="step"><span class="step-index">01</span><div><h3>You submit a claim or image context</h3><p>Share what you saw and include the date, place, or original caption when you know it.</p></div></article>
        <article class="step"><span class="step-index">02</span><div><h3>Fact-Check searches selected sources</h3><p>The public registry is applied by the server, not simply suggested in an AI prompt.</p></div></article>
        <article class="step"><span class="step-index">03</span><div><h3>You inspect an evidence-led result</h3><p>Open the linked sources, compare their context, and see whether the evidence is supported, mixed, misleading, contradicted, or incomplete.</p></div></article>
      </div></div>
      <div class="method-visual glass-card reveal"><div class="pipeline"><div class="pipeline-node"><strong>Claim / image context</strong><span>Your question</span></div><div class="pipeline-node is-highlight"><strong>Selected-source filter</strong><span>Visible boundary</span></div><div class="pipeline-node"><strong>Evidence comparison</strong><span>AI-assisted</span></div><div class="pipeline-node is-highlight"><strong>Linked result</strong><span>Your judgment remains</span></div></div></div>
    </div></section>

    <section class="section"><div class="page"><div class="callout reveal"><span class="callout-icon" aria-hidden="true">!</span><div><h3>Fact-Check is not a universal truth machine.</h3><p>It reports what selected sources do or do not support at the time of a check. People can inspect the sources, question a conclusion, and take high-stakes claims to qualified human experts.</p></div></div></div></section>

    <section class="page"><div class="cta-panel reveal"><span class="eyebrow">Start with the evidence</span><h2>Make checking before sharing a normal habit.</h2><p>Use the checker for a current claim, an image, or a story you are unsure about. Every result stays within the public source registry and points you back to the original evidence.</p><div class="inline-actions"><a class="btn btn-primary" href="/check" data-route>Check a claim <span aria-hidden="true">→</span></a><a class="btn btn-secondary" href="/method" data-route>Read the method</a></div></div></section>`;
  hydrateSourceCount();
  hydrateRegistryOverview();
}

function renderCheck() {
  app.innerHTML = `${pageHead("Evidence checker", "Check the evidence. <em>Keep your judgment.</em>", "Fact-Check searches only its active, selected sources. It makes the evidence visible and never turns a missing result into a false verdict.")}
    <section class="page checker-layout">
      <form class="checker-card glass-card reveal" id="checker-form">
        <label class="form-label" for="claim">What claim or image context would you like to verify?</label>
        <span class="form-help">Include the original wording, place, date, or source when you can. Specific context produces a more useful evidence trail.</span>
        <textarea id="claim" name="claim" maxlength="1800" placeholder="Example: Did a hurricane make landfall in Florida yesterday? What do selected sources report?"></textarea>
        <div class="upload-row"><label class="upload-label">＋ Attach an image<input id="claim-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label><span class="file-status" id="file-status">Optional · PNG, JPG, WEBP or GIF · up to 4 MB</span></div>
        <button class="btn btn-primary" id="check-submit" type="submit">Check selected sources <span aria-hidden="true">→</span></button>
        <div class="example-row" aria-label="Example claims"><button class="example-btn" type="button" data-example="Did a hurricane make landfall in the United States yesterday?">Hurricane report</button><button class="example-btn" type="button" data-example="Is this health claim supported by selected public-health sources?">Health claim</button><button class="example-btn" type="button" data-example="What do selected sources say about this climate claim?">Climate claim</button></div>
      </form>
      <aside class="checker-side reveal"><article class="side-note glass-card"><h3>What you will get</h3><ul><li>An evidence outcome, not a prediction.</li><li>Direct links to sources used.</li><li>The time and source-registry version of the check.</li></ul></article><article class="side-note glass-card"><h3>Image checks are careful</h3><p>Vision can help identify a caption, landmark, or claimed event. It cannot prove that an arbitrary picture is “real” or AI-made from pixels alone.</p></article><article class="side-note glass-card"><h3>Need a source listed?</h3><p>Source additions are managed by the administrator with a stated rationale. Browse the current public registry at any time.</p><a class="source-link" href="/sources" data-route>Browse trusted sources →</a></article></aside>
    </section>
    <section class="page result-wrap" id="check-result" aria-live="polite"></section>`;
  bindChecker();
}

function verdictLabel(verdict) {
  return ({ SUPPORTED: "Supported by selected sources", CONTRADICTED: "Contradicted by selected sources", MISLEADING: "Context missing or misleading framing", MIXED: "Mixed selected-source evidence", INSUFFICIENT: "Not enough evidence in selected sources" }[verdict] || "Not enough evidence in selected sources");
}

function renderCheckResult(result) {
  const verdict = String(result.verdict || "INSUFFICIENT").toLowerCase();
  const citations = (result.sources || []).map((source) => `
    <a class="citation" href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer"><div><strong>${escapeHtml(source.title || "Selected source")}</strong><small>${escapeHtml(source.url)}</small></div><span class="citation-arrow" aria-hidden="true">↗</span></a>`).join("");
  return `<article class="result-card glass-card reveal visible"><div class="result-head"><div><span class="verdict verdict-${verdict}">${escapeHtml(verdictLabel(result.verdict))}</span><h2>What the selected sources indicate</h2></div><div class="checked-time">Checked ${escapeHtml(formatDate(result.checkedAt, { time: true }))}<br />Registry v${escapeHtml(result.registryVersion || "—")}</div></div><p class="result-text">${escapeHtml(result.explanation || "No explanation was returned.")}</p><h3 class="result-sources-title">Sources used for this result</h3>${citations ? `<div class="citation-list">${citations}</div>` : `<div class="info-banner">No displayable selected-source link was returned. This result is shown as incomplete evidence.</div>`}</article>`;
}

function bindChecker() {
  const form = document.querySelector("#checker-form");
  const fileInput = document.querySelector("#claim-image");
  const fileStatus = document.querySelector("#file-status");
  const resultContainer = document.querySelector("#check-result");
  let imageDataUrl = "";

  document.querySelectorAll("[data-example]").forEach((button) => button.addEventListener("click", () => {
    document.querySelector("#claim").value = button.dataset.example || "";
    document.querySelector("#claim").focus();
  }));

  fileInput.addEventListener("change", () => {
    const [file] = fileInput.files || [];
    imageDataUrl = "";
    if (!file) { fileStatus.textContent = "Optional · PNG, JPG, WEBP or GIF · up to 4 MB"; return; }
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 4 * 1024 * 1024) {
      fileInput.value = "";
      fileStatus.textContent = "Please choose a supported image under 4 MB.";
      toast("That image is not supported or is larger than 4 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { imageDataUrl = String(reader.result || ""); fileStatus.textContent = `${file.name} · ready to check`; };
    reader.readAsDataURL(file);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const claim = document.querySelector("#claim").value.trim();
    if (!claim && !imageDataUrl) { toast("Enter a claim or attach an image first.", "error"); return; }
    const button = document.querySelector("#check-submit");
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Checking evidence`;
    resultContainer.innerHTML = `<div class="center-loader glass-card"><span class="spinner"></span><span>Searching only selected sources…</span></div>`;
    try {
      const result = await api("/api/check", { method: "POST", body: JSON.stringify({ claim, imageDataUrl }) });
      resultContainer.innerHTML = renderCheckResult(result);
      observeReveals();
      resultContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      resultContainer.innerHTML = `<div class="warning">${escapeHtml(error.message)}</div>`;
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = `Check selected sources <span aria-hidden="true">→</span>`;
    }
  });
}

async function loadSourceData(force = false) {
  if (state.sourceData && !force) return state.sourceData;
  if (state.sourcePromise && !force) return state.sourcePromise;
  state.sourcePromise = api("/api/sources").then((data) => {
    state.sourceData = data;
    state.sourcePromise = null;
    return data;
  }).catch((error) => { state.sourcePromise = null; throw error; });
  return state.sourcePromise;
}

async function hydrateSourceCount() {
  try {
    const data = await loadSourceData();
    document.querySelectorAll("[data-source-count]").forEach((element) => { element.textContent = data.sourceCount; });
  } catch { /* Decorative counter: source directory remains available after a retry. */ }
}

const registryCategoryDetails = {
  "International authority": {
    title: "International authorities",
    description: "Global and regional bodies covering health, education, humanitarian affairs, climate, and public information.",
    examples: "WHO, the UN, UNICEF, and UNESCO",
  },
  "Official public authority": {
    title: "Official public authorities",
    description: "Public agencies and services for health, weather, emergencies, and safety alerts.",
    examples: "CDC, the National Hurricane Center, and Uzhydromet",
  },
  "Fact-checking / verification": {
    title: "Fact-checking and verification",
    description: "Organizations that publish evidence-led claim checks and explain their verification methods.",
    examples: "IFCN, Reuters Fact Check, and AFP Fact Check",
  },
  "News / public-interest journalism": {
    title: "Public-interest journalism",
    description: "Selected public-service and international newsrooms with contextual reporting and source attribution.",
    examples: "NPR, Deutsche Welle, and CBC News",
  },
};

function registryCounts(data) {
  if (Array.isArray(data.categoryCounts)) return data.categoryCounts;
  const counts = new Map();
  (data.sources || []).forEach((source) => counts.set(source.category, (counts.get(source.category) || 0) + 1));
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

function homeRegistryCard(item) {
  const detail = registryCategoryDetails[item.name] || {
    title: item.name,
    description: "A reviewed part of the public Fact-Check source registry.",
    examples: "Open the public directory to inspect the sources.",
  };
  return '<article class="source-card glass-card reveal visible"><span class="source-tag">' + escapeHtml(String(item.count)) + ' sources</span><h3>' + escapeHtml(detail.title) + '</h3><p>' + escapeHtml(detail.description) + '</p><p class="registry-examples">' + escapeHtml(detail.examples) + '</p></article>';
}

async function hydrateRegistryOverview() {
  const grid = document.querySelector("#home-registry-grid");
  const summary = document.querySelector("#home-registry-summary");
  const version = document.querySelector("#home-registry-version");
  const sourceLink = document.querySelector("#home-sources-link");
  if (!grid || !summary || !version || !sourceLink) return;
  try {
    const data = await loadSourceData();
    const counts = registryCounts(data);
    const order = Object.keys(registryCategoryDetails);
    counts.sort((left, right) => {
      const leftIndex = order.indexOf(left.name);
      const rightIndex = order.indexOf(right.name);
      return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
    });
    summary.textContent = data.sourceCount + " active sources across " + counts.length + " source groups";
    version.textContent = "Registry v" + data.version;
    sourceLink.innerHTML = "View all " + data.sourceCount + " sources <span aria-hidden=\"true\">→</span>";
    grid.innerHTML = counts.map(homeRegistryCard).join("");
  } catch {
    grid.innerHTML = '<div class="empty-state glass-card">The source overview is unavailable right now. You can still open the full public source directory.</div>';
    summary.textContent = "Public source registry";
  }
}

function sourceCard(source) {
  return `<article class="source-card glass-card"><span class="source-tag">${escapeHtml(source.category)}</span><h3>${escapeHtml(source.name)}</h3><p>${escapeHtml(source.rationale)}</p><a class="source-link" href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.domain)} ↗</a></article>`;
}

function renderSources() {
  app.innerHTML = `${pageHead("Transparent source governance", "Sources you can inspect. <em>Rules you can question.</em>", "This public directory is the exact source boundary used by Fact-Check. Sources can be added, paused, or removed with a stated rationale, and every result records its registry version.")}
    <section class="page">
      <div class="directory-tools reveal"><input id="source-search" type="search" placeholder="Search a source, category, or topic" aria-label="Search trusted sources" /><select id="source-category" aria-label="Filter sources by category"><option value="">All categories</option></select><a class="btn btn-secondary" href="/api/sources.pdf">↓ Download PDF list</a></div>
      <div class="source-summary reveal"><span id="source-summary">Loading selected sources…</span><span class="mini-label" id="source-version">Registry version —</span></div>
      <div id="source-grid" class="source-grid" aria-live="polite"><div class="center-loader glass-card"><span class="spinner"></span><span>Loading the registry…</span></div></div>
    </section>`;
  bindSources();
}

async function bindSources() {
  const grid = document.querySelector("#source-grid");
  const search = document.querySelector("#source-search");
  const category = document.querySelector("#source-category");
  const summary = document.querySelector("#source-summary");
  const version = document.querySelector("#source-version");
  try {
    const data = await loadSourceData();
    category.innerHTML = `<option value="">All categories</option>${data.categories.map((item) => `<option value="${escapeAttr(item)}">${escapeHtml(item)}</option>`).join("")}`;
    version.textContent = `Registry v${data.version}`;
    const update = () => {
      const term = search.value.trim().toLowerCase();
      const categoryValue = category.value;
      const items = data.sources.filter((source) => {
        const matchesCategory = !categoryValue || source.category === categoryValue;
        const text = `${source.name} ${source.domain} ${source.category} ${source.rationale}`.toLowerCase();
        return matchesCategory && (!term || text.includes(term));
      });
      summary.textContent = `${items.length} of ${data.sourceCount} active selected sources · Updated ${formatDate(data.updatedAt, { short: true })}`;
      grid.innerHTML = items.length ? items.map(sourceCard).join("") : `<div class="empty-state glass-card">No selected source matches that search.</div>`;
      observeReveals();
    };
    search.addEventListener("input", update);
    category.addEventListener("change", update);
    update();
  } catch (error) {
    grid.innerHTML = `<div class="warning">${escapeHtml(error.message)}</div>`;
  }
}

function renderMethod() {
  app.innerHTML = `${pageHead("How Fact-Check works", "AI should explain its evidence, <em>not hide it.</em>", "Fact-Check keeps the search boundary visible. It reports only what the active source registry supports and gives people a direct path back to the evidence.")}
    <section class="page method-grid">
      <div><article class="method-card glass-card reveal"><span class="eyebrow">The evidence rule</span><h2>The source boundary is enforced, not merely requested.</h2><p>The source list is more than an instruction in an AI prompt. Each check passes the active registry as an allowed-domain boundary, and returned citations are validated before they can appear in a result.</p><p>If a citation does not point to an active source, it is excluded. If the selected sources do not provide enough usable evidence, Fact-Check says so clearly.</p></article><article class="method-card glass-card reveal"><h3>What an outcome means</h3><p><b>Supported</b> means selected sources provide evidence for the claim. <b>Contradicted</b> means they provide evidence against it. <b>Mixed</b> or <b>misleading</b> means the context matters. <b>Not enough evidence</b> means the current registry did not provide a reliable answer at that time.</p></article></div>
      <aside class="quote-card glass-card reveal"><blockquote>“An AI explanation is useful only when people can inspect the evidence behind it.”</blockquote><cite>Fact-Check commitment to media and information literacy</cite></aside>
    </section>
    <section class="section section-tint"><div class="page"><div class="section-head reveal"><span class="eyebrow">Principles</span><h2>Designed for careful decisions.</h2></div><div class="principles glass-card reveal"><article class="principle"><span>01 / TRANSPARENCY</span><h3>The source list is public.</h3><p>Anyone can browse the current registry, download it as a PDF, and see why a source is included.</p></article><article class="principle"><span>02 / HUMILITY</span><h3>A missing result is not a false claim.</h3><p>Uncertainty is a valid outcome. The registry has limits, and the tool should be honest about them.</p></article><article class="principle"><span>03 / CONTEXT</span><h3>An image is not proof by itself.</h3><p>Image analysis can help investigate a caption, place, or claimed event. It cannot prove that an arbitrary image is authentic or AI-made from appearance alone.</p></article><article class="principle"><span>04 / ACCOUNTABILITY</span><h3>People remain in the loop.</h3><p>People can open sources, question a result, and request changes to the registry through the project contact channels.</p></article></div></div></section>
    <section class="page"><div class="callout reveal"><span class="callout-icon" aria-hidden="true">!</span><div><h3>High-stakes claims need more than one tool.</h3><p>For health, safety, legal, or urgent situations, Fact-Check should be a starting point for investigation, not a substitute for qualified experts or emergency guidance.</p></div></div></section>`;
}

function renderAbout() {
  app.innerHTML = `${pageHead("About Fact-Check", "Verification should feel <em>possible.</em>", "When AI makes misinformation faster and more convincing to create, people need practical ways to investigate it. Fact-Check makes the evidence trail easier to find, read, and question.")}
    <section class="page about-grid"><article class="about-card glass-card reveal"><span class="eyebrow">Independent youth-built prototype</span><h2>Make verification a habit before misinformation becomes a belief.</h2><p>Fast, convincing content can spread before anyone asks where it came from. Fact-Check slows that moment down: people submit a claim, see what selected sources say, and open the original reporting for themselves.</p><p>Created for the UNESCO Youth Hackathon 2026, the project responds to the challenge of AI-amplified misinformation with a simple principle: an AI answer is not evidence unless people can inspect the sources behind it.</p></article><article class="about-card glass-card reveal"><span class="eyebrow">Built for participation</span><h3>Verification should not be limited to experts.</h3><p>Fact-Check is designed to make a careful first step available without an account, specialist vocabulary, or a hidden source list. The registry can grow through transparent review so local, regional, and multilingual evidence sources have a path to be included.</p><h3>Trust needs room for questions</h3><p>People can inspect the current registry, download it, suggest sources, and question a result. That keeps the tool useful as a learning companion rather than an authority users must blindly accept.</p></article></section>
    <section class="section section-tint"><div class="page"><div class="section-head reveal"><span class="eyebrow">A responsible path forward</span><h2>Start small. Learn locally. Grow with evidence.</h2></div><div class="feature-grid"><article class="feature-card glass-card reveal"><span class="feature-number">NOW</span><div class="feature-icon" aria-hidden="true">⌕</div><h3>A practical evidence boundary</h3><p>Use a transparent source registry and linked results to help people practice checking before sharing.</p></article><article class="feature-card glass-card reveal"><span class="feature-number">NEXT</span><div class="feature-icon" aria-hidden="true">◌</div><h3>Listen to real users</h3><p>Pilot with students, teachers, and community partners to improve language, accessibility, and local source coverage.</p></article><article class="feature-card glass-card reveal"><span class="feature-number">LATER</span><div class="feature-icon" aria-hidden="true">↗</div><h3>Measure what matters</h3><p>Evaluate citation quality, source freshness, accessibility, and harmful false verdicts before expanding the tool.</p></article></div></div></section>`;
}

function renderContact() {
  app.innerHTML = `${pageHead("Contact", "Let’s build more <em>informed habits.</em>", "Questions, source suggestions, project feedback, or collaboration ideas are welcome. Fact-Check grows stronger when its source policy is transparent and open to thoughtful challenge.")}
    <section class="page contact-grid"><article class="contact-card glass-card reveal"><span class="eyebrow">Project contact</span><h2>Get in touch.</h2><p class="muted">For research collaboration, source-registry suggestions, or feedback on the project:</p><div class="contact-list"><a class="contact-link" href="mailto:oktabrovumrbek2023@gmail.com"><span aria-hidden="true">@</span><div><strong>Email</strong><small>oktabrovumrbek2023@gmail.com</small></div></a><a class="contact-link" href="https://oktabrov.sbs/" target="_blank" rel="noreferrer"><span aria-hidden="true">↗</span><div><strong>Portfolio</strong><small>oktabrov.sbs</small></div></a><a class="contact-link" href="https://www.linkedin.com/in/umrbek-oktyabrov-abaa56355" target="_blank" rel="noreferrer"><span aria-hidden="true">in</span><div><strong>LinkedIn</strong><small>Umrbek Oktyabrov</small></div></a></div></article><article class="contact-card glass-card reveal"><span class="eyebrow">Suggest a source</span><h3>What makes a good source suggestion?</h3><div class="principles"><article class="principle"><span>PRIMARY WHERE POSSIBLE</span><p>For a hurricane, an official weather agency is stronger evidence than a social-media summary.</p></article><article class="principle"><span>TRANSPARENT METHODS</span><p>Newsrooms and fact-checkers should publish corrections, methodology, ownership, and source links.</p></article><article class="principle"><span>DIVERSE &amp; RELEVANT</span><p>The registry should include local and multilingual sources that represent the people using the tool.</p></article></div><a class="btn btn-primary" href="mailto:oktabrovumrbek2023@gmail.com?subject=Fact-Check%20source%20suggestion">Suggest a source <span aria-hidden="true">→</span></a></article></section>`;
}

function legacyAdminLoginMarkup({ setupAllowed, configured }) {
  const setup = setupAllowed;
  return `<section class="page"><form class="login-box glass-card reveal visible" id="admin-auth-form"><a class="brand" href="/" data-route><span class="brand-mark" aria-hidden="true"><i></i></span><span>Fact<span>-Check</span></span></a><span class="eyebrow">Administrator area</span><h2>${setup ? "Create the first admin password" : "Sign in to manage sources"}</h2><p class="muted">${setup ? "This first-time setup is available only on this computer. Use a long, unique password." : configured ? "Add, edit, pause, and remove sources from the active registry." : "Set ADMIN_PASSWORD in environment.env before accessing this deployed admin area."}</p>${setup || configured ? `<label class="form-label" for="admin-password">Password</label><input id="admin-password" type="password" autocomplete="current-password" minlength="12" required /><span class="form-help">${setup ? "At least 12 characters." : "Your password is never sent to the browser after sign-in."}</span><button class="btn btn-primary" type="submit">${setup ? "Secure this admin area" : "Sign in"} <span aria-hidden="true">→</span></button>` : `<div class="warning">For security, remote first-time setup is disabled. Add a strong ADMIN_PASSWORD to environment.env and restart the server.</div>`}</form></section>`;
}

function adminLoginMarkup({ setupAllowed, configured, usernameRequired }) {
  const setup = setupAllowed;
  const usernameInput = !setup && usernameRequired
    ? `<div><label class="form-label" for="admin-username">Administrator username</label><input id="admin-username" type="text" autocomplete="username" required /></div>`
    : "";
  const introduction = setup
    ? "This first-time setup is available only on this computer. Use a long, unique password."
    : configured
      ? "Use the administrator credentials stored securely in the server environment."
      : "Set ADMIN_USER and ADMIN_PASSWORD in environment.env before accessing this deployed administrator area.";
  const credentialInputs = setup || configured
    ? `${usernameInput}<div><label class="form-label" for="admin-password">Password</label><input id="admin-password" type="password" autocomplete="current-password" minlength="12" required /></div><span class="form-help">${setup ? "At least 12 characters." : "Administrator credentials are never displayed in the browser."}</span><button class="btn btn-primary" type="submit">${setup ? "Secure this admin area" : "Sign in"} <span aria-hidden="true">→</span></button>`
    : `<div class="warning">For security, remote first-time setup is disabled. Add a strong ADMIN_USER and ADMIN_PASSWORD to environment.env and restart the server.</div>`;
  return `<section class="page"><form class="login-box auth-box glass-card reveal visible" id="admin-auth-form"><a class="brand" href="/" data-route><span class="brand-mark" aria-hidden="true"><i></i></span><span>Fact<span>-Check</span></span></a><span class="eyebrow">Administrator area</span><h1>${setup ? "Create the first admin password" : "Administrator sign in"}</h1><p class="lead">${introduction}</p><div class="auth-form">${credentialInputs}</div></form></section>`;
}

function adminDashboardMarkup(status, snapshot) {
  const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
  const editing = state.editingSourceId ? sourceById.get(state.editingSourceId) : null;
  const activeCount = snapshot.sources.filter((source) => source.active).length;
  const rows = snapshot.sources.map((source) => `<tr class="${source.active ? "" : "inactive"}"><td><strong>${escapeHtml(source.name)}</strong><br /><a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.domain)}</a></td><td>${escapeHtml(source.category)}</td><td>${source.active ? `<span class="source-tag">Active</span>` : `<span class="source-tag">Paused</span>`}</td><td><div class="table-actions"><button class="icon-btn" type="button" title="Edit source" data-admin-action="edit" data-source-id="${escapeAttr(source.id)}">✎</button><button class="icon-btn" type="button" title="${source.active ? "Pause" : "Activate"} source" data-admin-action="toggle" data-source-id="${escapeAttr(source.id)}">${source.active ? "Ⅱ" : "▶"}</button><button class="icon-btn danger" type="button" title="Remove source" data-admin-action="delete" data-source-id="${escapeAttr(source.id)}">×</button></div></td></tr>`).join("");
  return `<section class="page"><div class="admin-shell"><aside class="admin-sidebar glass-card"><strong>Source registry</strong><p>Only active domains are available to the fact-checking search.</p><div class="admin-metric"><b>${activeCount}</b><span>active sources</span></div><div class="admin-metric"><b>${status.activeDomains}</b><span>active domains / 100 max</span></div><div class="admin-metric"><b>v${snapshot.version}</b><span>registry version</span></div><a class="btn btn-secondary btn-small" href="/api/sources.pdf">Download PDF</a></aside><section class="admin-panel glass-card"><div class="admin-panel-head"><div><span class="eyebrow">Admin panel</span><h2>Manage trusted sources</h2><p>Every edit creates a new registry version. Add a reason for each source so the public directory remains transparent.</p></div><button class="btn btn-secondary btn-small" id="admin-logout" type="button">Sign out</button></div>${status.activeDomains > 100 ? `<div class="warning">Fact checks are paused because ${status.activeDomains} active domains exceed the strict 100-domain limit. Pause or remove a source before running checks.</div>` : ""}<form class="admin-form" id="source-form"><input type="hidden" id="source-id" value="${escapeAttr(editing?.id || "")}" /><div><label class="form-label" for="source-name">Source name</label><input id="source-name" value="${escapeAttr(editing?.name || "")}" required maxlength="120" /></div><div><label class="form-label" for="source-url">Official link</label><input id="source-url" type="url" value="${escapeAttr(editing?.url || "https://")}" required maxlength="2048" /></div><div><label class="form-label" for="source-category">Category</label><input id="source-category" value="${escapeAttr(editing?.category || "Official public authority")}" required maxlength="90" /></div><div><label class="form-label" for="source-active">Search status</label><select id="source-active"><option value="true" ${editing?.active !== false ? "selected" : ""}>Active — included in checks</option><option value="false" ${editing?.active === false ? "selected" : ""}>Paused — listed only in admin</option></select></div><div class="full"><label class="form-label" for="source-rationale">Why is this source trusted?</label><textarea id="source-rationale" required maxlength="360" placeholder="Explain its authority, evidence standards, or public value.">${escapeHtml(editing?.rationale || "")}</textarea></div><div class="full inline-actions"><button class="btn btn-primary" type="submit">${editing ? "Save source changes" : "Add trusted source"} <span aria-hidden="true">→</span></button>${editing ? `<button class="btn btn-secondary" id="cancel-edit" type="button">Cancel edit</button>` : ""}</div></form><div class="admin-panel-head"><div><h3>All sources</h3><p>${snapshot.sources.length} entries · Updated ${formatDate(snapshot.updatedAt, { time: true })}</p></div><input id="admin-search" type="search" placeholder="Filter sources" aria-label="Filter all sources" /></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Source</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody id="admin-source-rows">${rows}</tbody></table></div></section></div></section>`;
}

async function renderAdmin() {
  app.innerHTML = `<section class="page"><div class="center-loader glass-card"><span class="spinner"></span><span>Loading the administrator area…</span></div></section>`;
  try {
    const status = await api("/api/admin/status");
    if (!status.authenticated) {
      app.innerHTML = adminLoginMarkup(status);
      bindAdminAuth(status);
      observeReveals();
      return;
    }
    const snapshot = await api("/api/admin/sources");
    app.innerHTML = adminDashboardMarkup(status, snapshot);
    bindAdminDashboard(status, snapshot);
    observeReveals();
  } catch (error) {
    app.innerHTML = `<section class="page"><div class="warning">${escapeHtml(error.message)}</div></section>`;
  }
}

function bindAdminAuth(status) {
  const form = document.querySelector("#admin-auth-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#admin-password").value;
    const username = document.querySelector("#admin-username")?.value || "";
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await api(status.setupAllowed ? "/api/admin/setup" : "/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) });
      toast(status.setupAllowed ? "Admin password created." : "Signed in.", "success");
      render();
    } catch (error) {
      toast(error.message, "error");
    } finally { button.disabled = false; }
  });
}

function bindAdminDashboard(status, snapshot) {
  const form = document.querySelector("#source-form");
  const sourceMap = new Map(snapshot.sources.map((source) => [source.id, source]));
  document.querySelector("#admin-logout").addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST", body: "{}" });
    state.editingSourceId = null;
    toast("Signed out.");
    render();
  });
  document.querySelector("#cancel-edit")?.addEventListener("click", () => { state.editingSourceId = null; renderAdmin(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = document.querySelector("#source-id").value;
    const payload = {
      name: document.querySelector("#source-name").value,
      url: document.querySelector("#source-url").value,
      category: document.querySelector("#source-category").value,
      rationale: document.querySelector("#source-rationale").value,
      active: document.querySelector("#source-active").value === "true",
    };
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await api(id ? `/api/admin/sources/${encodeURIComponent(id)}` : "/api/admin/sources", { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      state.sourceData = null;
      state.editingSourceId = null;
      toast(id ? "Source updated." : "Source added.", "success");
      renderAdmin();
    } catch (error) { toast(error.message, "error"); }
    finally { button.disabled = false; }
  });
  document.querySelectorAll("[data-admin-action]").forEach((button) => button.addEventListener("click", async () => {
    const id = button.dataset.sourceId;
    const source = sourceMap.get(id);
    if (!source) return;
    const action = button.dataset.adminAction;
    if (action === "edit") { state.editingSourceId = id; renderAdmin(); return; }
    if (action === "delete" && !window.confirm(`Remove ${source.name} from the registry?`)) return;
    button.disabled = true;
    try {
      if (action === "delete") await api(`/api/admin/sources/${encodeURIComponent(id)}`, { method: "DELETE", body: "{}" });
      if (action === "toggle") await api(`/api/admin/sources/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ active: !source.active }) });
      state.sourceData = null;
      toast(action === "delete" ? "Source removed." : source.active ? "Source paused." : "Source activated.", "success");
      renderAdmin();
    } catch (error) { toast(error.message, "error"); button.disabled = false; }
  }));
  document.querySelector("#admin-search").addEventListener("input", (event) => {
    const term = event.target.value.trim().toLowerCase();
    document.querySelectorAll("#admin-source-rows tr").forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(term); });
  });
}

function renderLogin() {
  if (state.currentUser) {
    navigate("/account");
    return;
  }
  app.innerHTML = `<section class="page page-narrow"><form class="login-box auth-box glass-card reveal visible" id="user-login-form"><span class="eyebrow">Welcome back</span><h1>Keep building your verification habit.</h1><p class="lead">Log in to access your Fact-Check account. Fact-checking remains available to everyone, with or without an account.</p><div class="auth-form"><div><label class="form-label" for="login-email">Email address</label><input id="login-email" name="email" type="email" autocomplete="email" required maxlength="254" /></div><div><label class="form-label" for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required /></div><button class="btn btn-primary" type="submit">Log in <span aria-hidden="true">→</span></button></div><p class="auth-switch">New to Fact-Check? <a href="/signup" data-route>Create an account</a></p></form></section>`;
  bindUserLogin();
}

function bindUserLogin() {
  const form = document.querySelector("#user-login-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Logging in...";
    try {
      const response = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.querySelector("#login-email").value,
          password: document.querySelector("#login-password").value,
        }),
      });
      state.currentUser = response.user;
      toast("Welcome back.", "success");
      navigate("/account");
    } catch (error) {
      toast(error.message, "error");
      button.disabled = false;
      button.innerHTML = `Log in <span aria-hidden="true">→</span>`;
    }
  });
}

function renderSignup() {
  if (state.currentUser) {
    navigate("/account");
    return;
  }
  app.innerHTML = `<section class="page page-narrow"><form class="login-box auth-box glass-card reveal visible" id="user-signup-form"><span class="eyebrow">Create your account</span><h1>Make checking before sharing a habit.</h1><p class="lead">Create a Fact-Check account in a few seconds. Your account never gives access to the administrator area.</p><div class="auth-form"><div><label class="form-label" for="signup-name">Your name</label><input id="signup-name" name="name" type="text" autocomplete="name" required minlength="2" maxlength="80" /></div><div><label class="form-label" for="signup-email">Email address</label><input id="signup-email" name="email" type="email" autocomplete="email" required maxlength="254" /></div><div><label class="form-label" for="signup-password">Password</label><input id="signup-password" name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="256" /><span class="form-help">Use at least 12 characters.</span></div><div><label class="form-label" for="signup-confirm-password">Confirm password</label><input id="signup-confirm-password" type="password" autocomplete="new-password" required /></div><button class="btn btn-primary" type="submit">Create account <span aria-hidden="true">→</span></button></div><p class="auth-switch">Already have an account? <a href="/login" data-route>Log in</a></p></form></section>`;
  bindUserSignup();
}

function bindUserSignup() {
  const form = document.querySelector("#user-signup-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#signup-password").value;
    const confirmation = document.querySelector("#signup-confirm-password").value;
    if (password !== confirmation) {
      toast("The password confirmation does not match.", "error");
      return;
    }
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = "Creating account...";
    try {
      const response = await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name: document.querySelector("#signup-name").value,
          email: document.querySelector("#signup-email").value,
          password,
        }),
      });
      state.currentUser = response.user;
      toast("Your account is ready.", "success");
      navigate("/account");
    } catch (error) {
      toast(error.message, "error");
      button.disabled = false;
      button.innerHTML = `Create account <span aria-hidden="true">→</span>`;
    }
  });
}

async function renderAccount() {
  app.innerHTML = `<section class="page"><div class="center-loader glass-card"><span class="spinner"></span><span>Loading your account...</span></div></section>`;
  try {
    const response = await api("/api/auth/status");
    state.currentUser = response.user || null;
    updateNav();
    if (!state.currentUser) {
      app.innerHTML = `<section class="page page-narrow"><div class="login-box auth-box glass-card reveal visible"><span class="eyebrow">Your account</span><h1>Log in to continue.</h1><p class="lead">You need a Fact-Check account to view this page.</p><div class="inline-actions"><a class="btn btn-primary" href="/login" data-route>Log in <span aria-hidden="true">→</span></a><a class="btn btn-secondary" href="/signup" data-route>Create account</a></div></div></section>`;
      observeReveals();
      return;
    }
    const user = state.currentUser;
    app.innerHTML = `<section class="page page-narrow"><article class="account-card glass-card reveal visible"><span class="eyebrow">Your Fact-Check account</span><h1>Hello, ${escapeHtml(user.name)}.</h1><p class="account-email">${escapeHtml(user.email)}</p><div class="callout"><span class="callout-icon" aria-hidden="true">✓</span><div><h3>Your account is separate from the administrator area.</h3><p>It does not grant access to source management. Fact-checking remains open to everyone, and the public source list is always available.</p></div></div><div class="account-actions"><a class="btn btn-primary" href="/check" data-route>Check a claim <span aria-hidden="true">→</span></a><a class="btn btn-secondary" href="/sources" data-route>Browse sources</a></div></article></section>`;
    observeReveals();
  } catch (error) {
    app.innerHTML = `<section class="page"><div class="warning">${escapeHtml(error.message)}</div></section>`;
  }
}

function renderNotFound() {
  app.innerHTML = `<section class="page page-narrow"><div class="login-box glass-card reveal visible"><span class="eyebrow">404</span><h1>That page is not in the evidence file.</h1><p class="lead">Return home or explore the trusted source directory.</p><div class="inline-actions"><a class="btn btn-primary" href="/" data-route>Back home</a><a class="btn btn-secondary" href="/sources" data-route>Trusted sources</a></div></div></section>`;
}

function render() {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  document.title = titleFor(pathname);
  const renderers = { "/": renderHome, "/check": renderCheck, "/sources": renderSources, "/method": renderMethod, "/about": renderAbout, "/contact": renderContact, "/login": renderLogin, "/signup": renderSignup, "/account": renderAccount, "/admin": renderAdmin };
  (renderers[pathname] || renderNotFound)();
  updateNav();
  observeReveals();
  window.requestAnimationFrame(() => app.focus({ preventScroll: true }));
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-route]");
  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target) return;
  const href = link.getAttribute("href");
  if (!href || !href.startsWith("/")) return;
  event.preventDefault();
  navigate(href);
});

navToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  navToggle.classList.toggle("open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

window.addEventListener("popstate", render);
render();
void refreshCurrentUser();
