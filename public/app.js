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
    "/check": "Verify a claim — Fact-Check",
    "/sources": "Source Library — Fact-Check",
    "/method": "The Process — Fact-Check",
    "/about": "Why it matters — Fact-Check",
    "/contact": "Contact Fact-Check",
    "/privacy": "Privacy — Fact-Check",
    "/accessibility": "Accessibility — Fact-Check",
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
  if (window.location.pathname + window.location.search !== pathname) window.history.pushState({}, "", pathname);
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
    accountNav.innerHTML = `<a class="nav-utility-account" href="/account" data-route>Account</a><button class="nav-utility-logout" id="user-logout" type="button">Log out</button>`;
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
  accountNav.innerHTML = `<a class="nav-utility-login" href="/login" data-route>Log in</a><a class="nav-utility-signup" href="/signup" data-route>Sign up</a>`;
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
    const active = link.getAttribute("href") === current;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
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
        <p class="lead">Fact-Check turns uncertainty into an evidence trail. It first routes each question to the relevant trusted-source categories, then checks only those approved domains and links directly to what they support.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="/check" data-route>Check a claim <span aria-hidden="true">→</span></a>
          <a class="btn btn-secondary" href="/sources" data-route>Explore sources</a>
        </div>
        <div class="trust-strip"><div class="trust-avatars" aria-hidden="true"><span>CBU</span><span>WHO</span><span>UN</span><span>NHC</span></div><span>Every result begins with a visible category boundary, never an open-web guess.</span></div>
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
        <article class="stat-card"><strong data-source-count>214</strong><span>reviewed sources to inspect</span></article>
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
        <article class="feature-card glass-card reveal"><span class="feature-number">01 / A clear boundary</span><div class="feature-icon" aria-hidden="true">⌕</div><h3>Routes before it searches</h3><p>Fact-Check selects only the source categories relevant to a question before it requests evidence. It does not quietly pull in random websites or social posts.</p></article>
        <article class="feature-card glass-card reveal"><span class="feature-number">02 / Every answer is inspectable</span><div class="feature-icon" aria-hidden="true">↗</div><h3>Keeps the evidence visible</h3><p>Each result links to the sources used, so users can read the reporting, date, and context for themselves.</p></article>
        <article class="feature-card glass-card reveal"><span class="feature-number">03 / Uncertainty is allowed</span><div class="feature-icon" aria-hidden="true">≈</div><h3>Keeps critical thinking human</h3><p>No supporting source is not the same as “false.” Fact-Check marks results that need more evidence, context, or human review.</p></article>
      </div>
    </div></section>

    <section class="section section-tint"><div class="page how-grid">
      <div class="reveal"><span class="eyebrow">How a check happens</span><h2>A small workflow with a clear responsibility.</h2><p class="lead">AI can help organize evidence. It should not make a hidden decision about what people should believe.</p><div class="steps">
        <article class="step"><span class="step-index">01</span><div><h3>You submit a claim or image context</h3><p>Share what you saw and include the date, place, or original caption when you know it.</p></div></article>
        <article class="step"><span class="step-index">02</span><div><h3>Relevant categories are selected first</h3><p>A dedicated routing request chooses the smallest useful set of source categories; it does not search for evidence or produce an answer.</p></div></article>
        <article class="step"><span class="step-index">03</span><div><h3>A separate request checks selected domains</h3><p>The evidence search receives only those category links. You can open the returned sources and inspect the context yourself.</p></div></article>
      </div></div>
      <div class="method-visual glass-card reveal"><div class="pipeline"><div class="pipeline-node"><strong>Claim / image context</strong><span>Your question</span></div><div class="pipeline-node is-highlight"><strong>Selected-source filter</strong><span>Visible boundary</span></div><div class="pipeline-node"><strong>Evidence comparison</strong><span>AI-assisted</span></div><div class="pipeline-node is-highlight"><strong>Linked result</strong><span>Your judgment remains</span></div></div></div>
    </div></section>

    <section class="section"><div class="page"><div class="callout reveal"><span class="callout-icon" aria-hidden="true">!</span><div><h3>Fact-Check is not a universal truth machine.</h3><p>It reports what selected sources do or do not support at the time of a check. People can inspect the sources, question a conclusion, and take high-stakes claims to qualified human experts.</p></div></div></div></section>

    <section class="page"><div class="cta-panel reveal"><span class="eyebrow">Start with the evidence</span><h2>Make checking before sharing a normal habit.</h2><p>Use the checker for a current claim, an image, or a story you are unsure about. Every result stays within the public source registry and points you back to the original evidence.</p><div class="inline-actions"><a class="btn btn-primary" href="/check" data-route>Check a claim <span aria-hidden="true">→</span></a><a class="btn btn-secondary" href="/method" data-route>Read the method</a></div></div></section>`;
  hydrateSourceCount();
  hydrateRegistryOverview();
}

function renderCheck() {
  app.innerHTML = `${pageHead("Evidence workspace", "Verify a claim. <em>Trace the evidence.</em>", "Fact-Check first identifies the relevant source categories, then runs a separate evidence search only inside those approved domains. The final answer stays short and linked.")}
    <section class="page checker-layout">
      <form class="checker-card glass-card reveal" id="checker-form">
        <span class="checker-kicker">Two-step verification</span>
        <label class="form-label" for="claim">What would you like to verify?</label>
        <span class="form-help">Use the original wording where possible. Add the place, date, or original caption so the source selection is more precise.</span>
        <textarea id="claim" name="claim" maxlength="1800" placeholder="Example: Did a hurricane make landfall in the United States yesterday?"></textarea>
        <div class="upload-row"><label class="upload-label">＋ Attach an image<input id="claim-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label><span class="file-status" id="file-status">Optional · PNG, JPG, WEBP or GIF · up to 4 MB</span></div>
        <button class="btn btn-primary" id="check-submit" type="submit">Verify with trusted sources <span aria-hidden="true">→</span></button>
        <div class="example-row" aria-label="Example claims"><button class="example-btn" type="button" data-example="Did a hurricane make landfall in the United States yesterday?">Hurricane report</button><button class="example-btn" type="button" data-example="Has an official election result been announced for this area?">Election update</button><button class="example-btn" type="button" data-example="Is this health claim supported by official public-health sources?">Health claim</button></div>
      </form>
      <aside class="checker-side reveal"><article class="side-note glass-card"><span class="mini-label">01 · Route</span><h3>Choose the relevant evidence boundary.</h3><p>The first AI request only selects categories. It does not search the web or answer the claim.</p></article><article class="side-note glass-card"><span class="mini-label">02 · Check</span><h3>Search the chosen trusted domains.</h3><p>A new request checks only the sources in those categories, and only validated citations can appear in the result.</p></article><article class="side-note glass-card"><h3>What you receive</h3><ul><li>A concise evidence outcome.</li><li>Direct links to the sources used.</li><li>The source categories and registry version.</li></ul></article></aside>
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
  const selection = result.categorySelection || {};
  const categoryNames = (selection.categories || []).map((category) => category.label || category.key).filter(Boolean);
  const routing = categoryNames.length
    ? `<section class="selection-trace"><div class="selection-trace-head"><span class="mini-label">Evidence boundary</span><span>${escapeHtml(String(selection.selectedDomainCount || 0))} trusted domains</span></div><div class="selection-steps"><div><b>01</b><span><strong>Categories selected</strong><small>${escapeHtml(categoryNames.join(" · "))}</small></span></div><div><b>02</b><span><strong>Evidence search completed</strong><small>${escapeHtml(String(selection.selectedSourceCount || 0))} listed sources were eligible for this check</small></span></div></div>${selection.reason ? `<p class="selection-reason">${escapeHtml(selection.reason)}</p>` : ""}${selection.truncated ? `<p class="selection-reason">The matching set exceeded the search cap, so Fact-Check used the first 100 approved domains in the selected categories.</p>` : ""}</section>`
    : "";
  return `<article class="result-card glass-card reveal visible"><div class="result-head"><div><span class="verdict verdict-${verdict}">${escapeHtml(verdictLabel(result.verdict))}</span><h2>What the selected sources indicate</h2></div><div class="checked-time">Checked ${escapeHtml(formatDate(result.checkedAt, { time: true }))}<br />Registry v${escapeHtml(result.registryVersion || "—")}</div></div>${routing}<p class="result-text">${escapeHtml(result.explanation || "No explanation was returned.")}</p><h3 class="result-sources-title">Sources used for this result</h3>${citations ? `<div class="citation-list">${citations}</div>` : `<div class="info-banner">No displayable selected-source link was returned. This result is shown as incomplete evidence.</div>`}</article>`;
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
    button.innerHTML = `<span class="spinner"></span> Verifying`;
    resultContainer.innerHTML = `<div class="center-loader glass-card"><span class="spinner"></span><span id="check-progress">Step 1 of 2: selecting the relevant trusted-source categories…</span></div>`;
    const progressTimer = window.setTimeout(() => {
      const progress = document.querySelector("#check-progress");
      if (progress) progress.textContent = "Step 2 of 2: searching only the chosen trusted domains…";
    }, 1400);
    try {
      const result = await api("/api/check", { method: "POST", body: JSON.stringify({ claim, imageDataUrl }) });
      resultContainer.innerHTML = renderCheckResult(result);
      observeReveals();
      resultContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      resultContainer.innerHTML = `<div class="warning">${escapeHtml(error.message)}</div>`;
      toast(error.message, "error");
    } finally {
      window.clearTimeout(progressTimer);
      button.disabled = false;
      button.innerHTML = `Verify with trusted sources <span aria-hidden="true">→</span>`;
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

function registryCounts(data) {
  if (Array.isArray(data.categories)) return data.categories;
  const counts = new Map();
  (data.sources || []).forEach((source) => {
    const key = source.categoryKey || source.category;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].map(([key, count]) => ({ key, label: key, description: "A reviewed part of the public Fact-Check source registry.", count }));
}

function homeRegistryCard(item) {
  return '<article class="source-card glass-card reveal visible"><span class="source-tag">' + escapeHtml(String(item.count)) + ' sources</span><h3>' + escapeHtml(item.label || item.key) + '</h3><p>' + escapeHtml(item.description || "A reviewed part of the public Fact-Check source registry.") + '</p><a class="source-link" href="/sources?category=' + encodeURIComponent(item.key || "") + '" data-route>Explore this category &rarr;</a></article>';
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
  app.innerHTML = `${pageHead("Source Library", "A visible evidence boundary. <em>Organized by purpose.</em>", "Browse the exact sources Fact-Check can use. Each source is assigned to a fixed category so the checker can select a focused, relevant boundary for every claim.")}
    <section class="page">
      <div class="source-library-policy glass-card reveal"><span class="mini-label">Admission standard</span><p>Automated checks use first-party official domains. Social-platform accounts are intentionally not included because a domain-level filter cannot distinguish one official account from every other account on the same platform.</p></div>
      <div class="directory-tools reveal"><input id="source-search" type="search" placeholder="Search a source, category, or authority" aria-label="Search trusted sources" /><select id="source-category" aria-label="Filter sources by category"><option value="">All categories</option></select><a class="btn btn-secondary" href="/api/sources.pdf">↓ Download PDF list</a></div>
      <div class="source-summary reveal"><span id="source-summary">Loading trusted sources…</span><span class="mini-label" id="source-version">Registry version —</span></div>
      <div id="source-category-chips" class="source-category-chips" aria-label="Source category filters"></div>
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
  const chips = document.querySelector("#source-category-chips");
  try {
    const data = await loadSourceData();
    const requestedCategory = new URLSearchParams(window.location.search).get("category") || "";
    const validCategory = data.categories.some((item) => item.key === requestedCategory) ? requestedCategory : "";
    category.innerHTML = `<option value="">All categories</option>${data.categories.map((item) => `<option value="${escapeAttr(item.key)}">${escapeHtml(item.label)} (${escapeHtml(item.count)})</option>`).join("")}`;
    category.value = validCategory;
    chips.innerHTML = `<button class="category-chip" type="button" data-category-key="">All <span>${escapeHtml(data.sourceCount)}</span></button>${data.categories.map((item) => `<button class="category-chip" type="button" data-category-key="${escapeAttr(item.key)}">${escapeHtml(item.label)} <span>${escapeHtml(item.count)}</span></button>`).join("")}`;
    version.textContent = `Registry v${data.version}`;
    const update = () => {
      const term = search.value.trim().toLowerCase();
      const categoryValue = category.value;
      const items = data.sources.filter((source) => {
        const matchesCategory = !categoryValue || source.categoryKey === categoryValue;
        const text = `${source.name} ${source.domain} ${source.category} ${source.categoryKey} ${source.rationale}`.toLowerCase();
        return matchesCategory && (!term || text.includes(term));
      });
      summary.textContent = `${items.length} of ${data.sourceCount} active trusted sources · Updated ${formatDate(data.updatedAt, { short: true })}`;
      grid.innerHTML = items.length ? items.map(sourceCard).join("") : `<div class="empty-state glass-card">No selected source matches that search.</div>`;
      chips.querySelectorAll("[data-category-key]").forEach((chip) => {
        const active = chip.dataset.categoryKey === categoryValue;
        chip.classList.toggle("active", active);
        chip.setAttribute("aria-pressed", String(active));
      });
      observeReveals();
    };
    search.addEventListener("input", update);
    category.addEventListener("change", () => {
      const url = new URL(window.location.href);
      if (category.value) url.searchParams.set("category", category.value);
      else url.searchParams.delete("category");
      window.history.replaceState({}, "", url.pathname + url.search);
      update();
    });
    chips.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category-key]");
      if (!button) return;
      category.value = button.dataset.categoryKey || "";
      category.dispatchEvent(new Event("change"));
    });
    update();
  } catch (error) {
    grid.innerHTML = `<div class="warning">${escapeHtml(error.message)}</div>`;
  }
}

function renderMethod() {
  renderMethodV2();
}

function renderAbout() {
  renderAboutV2();
}
function renderMethodV2() {
  app.innerHTML = `${pageHead("The Process", "Two AI steps. <em>One enforced boundary.</em>", "Fact-Check separates source routing from evidence searching so the system cannot answer first and justify itself later.")}
    <section class="page method-grid">
      <div><article class="method-card glass-card reveal"><span class="eyebrow">Step 01 · Category routing</span><h2>Decide where to look before looking.</h2><p>The first request receives the claim and the fixed registry taxonomy. It selects the smallest relevant set of categories — for example, weather and emergencies plus government and law for a report of a hurricane in the United States.</p><p>That routing request has no web-search tool and is not allowed to produce a fact-check verdict.</p></article><article class="method-card glass-card reveal"><span class="eyebrow">Step 02 · Evidence search</span><h2>Search only the selected domain set.</h2><p>A new request receives the selected source catalogue and a server-enforced allowed-domain filter. Returned citations are checked against the same selected domains before they are shown.</p><p>Each evidence search is capped at 100 approved domains. If the selected category set is larger, the platform reports that boundary instead of widening the search.</p></article></div>
      <aside class="quote-card glass-card reveal"><blockquote>“A fast answer is not enough. A trustworthy answer shows where it came from and where its limits are.”</blockquote><cite>Fact-Check evidence standard</cite></aside>
    </section>
    <section class="section section-tint"><div class="page"><div class="section-head reveal"><span class="eyebrow">Built-in safeguards</span><h2>Designed to be inspectable at every step.</h2></div><div class="principles glass-card reveal"><article class="principle"><span>01 / CATEGORY CONTROL</span><h3>Categories are fixed, not invented on the fly.</h3><p>The model can select only categories defined by the platform. It cannot create a vague “general web” category to escape the source boundary.</p></article><article class="principle"><span>02 / DOMAIN CONTROL</span><h3>The second request receives only selected trusted domains.</h3><p>The boundary is applied at the API request level, then citations are validated again on the server before the result is displayed.</p></article><article class="principle"><span>03 / SOURCE ADMISSION</span><h3>New sources require AI analysis and manual confirmation.</h3><p>Administrators submit a first-party HTTPS domain. A high-confidence source assessment and human confirmation are required before it can become active.</p></article><article class="principle"><span>04 / CLEAR LIMITS</span><h3>Uncertainty remains a valid result.</h3><p>If selected sources do not provide enough evidence, Fact-Check says so. It does not treat an empty search as proof that a claim is false.</p></article></div></div></section>
    <section class="page"><div class="callout reveal"><span class="callout-icon" aria-hidden="true">!</span><div><h3>High-stakes claims need more than a single result.</h3><p>For urgent health, safety, legal, financial, or emergency decisions, use the original authorities and qualified experts directly. Fact-Check is an evidence-navigation platform, not a substitute for professional advice.</p></div></div></section>`;
}

function renderAboutV2() {
  app.innerHTML = `${pageHead("Why it matters", "Media literacy needs <em>practical tools.</em>", "AI can make misleading content more convincing and easier to spread. Fact-Check gives people a concrete way to pause, identify relevant authorities, and inspect the evidence before they share.")}
    <section class="page about-grid"><article class="about-card glass-card reveal"><span class="eyebrow">Independent youth-led platform</span><h2>Make verification a normal part of receiving information.</h2><p>Fact-Check is designed as a real, transparent platform for media and information literacy. Instead of presenting a black-box “true” or “false” label, it reveals the category boundary, the linked evidence, and the limits of the result.</p><p>Built for the UNICEF Youth Hackathon 2026, it responds to AI-amplified misinformation by making source-aware verification usable in everyday questions, not only in specialist newsrooms.</p></article><article class="about-card glass-card reveal"><span class="eyebrow">Participation with standards</span><h3>Access should be simple. Evidence standards should stay high.</h3><p>Anyone can verify a claim without an account, inspect the public source library, and download its current version. At the same time, source admission is deliberately strict: broad social-platform domains cannot enter an automated allowed-domain boundary.</p><h3>Trust deserves questions.</h3><p>People can inspect citations, question a result, and suggest first-party public authorities for review. That keeps the platform accountable to the communities it is meant to serve.</p></article></section>
    <section class="section section-tint"><div class="page"><div class="section-head reveal"><span class="eyebrow">Long-term contribution</span><h2>Grow a culture of checking before sharing.</h2></div><div class="feature-grid"><article class="feature-card glass-card reveal"><span class="feature-number">NOW</span><div class="feature-icon" aria-hidden="true">⌕</div><h3>Make the evidence boundary visible</h3><p>Provide a transparent, categorized registry and concise linked results that are easy to inspect.</p></article><article class="feature-card glass-card reveal"><span class="feature-number">NEXT</span><div class="feature-icon" aria-hidden="true">◌</div><h3>Improve local relevance responsibly</h3><p>Expand first-party public authorities through strict review, especially for the languages and communities using the platform.</p></article><article class="feature-card glass-card reveal"><span class="feature-number">LATER</span><div class="feature-icon" aria-hidden="true">↗</div><h3>Measure evidence quality</h3><p>Continuously evaluate citation quality, source freshness, accessibility, and false-verdict risk as the platform grows.</p></article></div></div></section>`;
}

function renderContact() {
  app.innerHTML = `${pageHead("Contact", "Let’s build more <em>informed habits.</em>", "Questions, source suggestions, project feedback, or collaboration ideas are welcome. Fact-Check grows stronger when its source policy is transparent and open to thoughtful challenge.")}
    <section class="page contact-grid"><article class="contact-card glass-card reveal"><span class="eyebrow">Project contact</span><h2>Get in touch.</h2><p class="muted">For research collaboration, source-registry suggestions, or feedback on the project:</p><div class="contact-list"><a class="contact-link" href="mailto:oktabrovumrbek2023@gmail.com"><span aria-hidden="true">@</span><div><strong>Email</strong><small>oktabrovumrbek2023@gmail.com</small></div></a><a class="contact-link" href="https://oktabrov.sbs/" target="_blank" rel="noreferrer"><span aria-hidden="true">↗</span><div><strong>Portfolio</strong><small>oktabrov.sbs</small></div></a><a class="contact-link" href="https://www.linkedin.com/in/umrbek-oktyabrov-abaa56355" target="_blank" rel="noreferrer"><span aria-hidden="true">in</span><div><strong>LinkedIn</strong><small>Umrbek Oktyabrov</small></div></a></div></article><article class="contact-card glass-card reveal"><span class="eyebrow">Suggest a source</span><h3>What makes a good source suggestion?</h3><div class="principles"><article class="principle"><span>PRIMARY WHERE POSSIBLE</span><p>For a hurricane, an official weather agency is stronger evidence than a social-media summary.</p></article><article class="principle"><span>TRANSPARENT METHODS</span><p>Newsrooms and fact-checkers should publish corrections, methodology, ownership, and source links.</p></article><article class="principle"><span>DIVERSE &amp; RELEVANT</span><p>The registry should include local and multilingual sources that represent the people using the tool.</p></article></div><a class="btn btn-primary" href="mailto:oktabrovumrbek2023@gmail.com?subject=Fact-Check%20source%20suggestion">Suggest a source <span aria-hidden="true">→</span></a></article></section>`;
}

function renderPrivacy() {
  app.innerHTML = `${pageHead("Privacy", "Your claim deserves <em>careful handling.</em>", "Fact-Check is designed to minimize personal data while making the evidence boundary visible.")}
    <section class="page about-grid"><article class="about-card glass-card reveal"><span class="eyebrow">What the platform processes</span><h2>A check is sent only to complete that check.</h2><p>When you submit a claim or image, Fact-Check sends it to the configured AI service to route the claim and search the selected trusted-source domains. The application uses a no-store request setting and does not create a claim-history table in its PostgreSQL database.</p><p>Your hosting provider and the AI provider may process technical request data under their own policies. Do not submit passwords, financial account details, personal documents, or other sensitive information.</p></article><article class="about-card glass-card reveal"><span class="eyebrow">Accounts and contact</span><h3>Account data is deliberately limited.</h3><p>Accounts contain a name, email address, and a salted password hash. Administrator credentials remain in the server environment and are never shown in the browser.</p><h3>Questions or removal requests</h3><p>For privacy questions or an account-data request, contact <a href="mailto:oktabrovumrbek2023@gmail.com">oktabrovumrbek2023@gmail.com</a>. This page should be reviewed and adapted to the law that applies before a public production launch.</p></article></section>
    <section class="page"><div class="callout reveal"><span class="callout-icon" aria-hidden="true">!</span><div><h3>Verification is public; personal data should not be.</h3><p>Use the public source library to inspect the evidence boundary. Keep sensitive personal information out of claim text and uploads.</p></div></div></section>`;
}

function renderAccessibility() {
  app.innerHTML = `${pageHead("Accessibility", "Evidence should be <em>available to everyone.</em>", "Fact-Check aims to make source-aware verification usable across devices, input methods, and access needs.")}
    <section class="page about-grid"><article class="about-card glass-card reveal"><span class="eyebrow">Current commitments</span><h2>Designed for clear access.</h2><ul class="policy-list"><li>Keyboard-accessible navigation, forms, account controls, and source filters.</li><li>Semantic headings, labels, descriptive controls, and live feedback for important actions.</li><li>Readable contrast, responsive layouts, and a reduced-motion preference.</li><li>A public source directory and downloadable PDF list for offline reference.</li></ul></article><article class="about-card glass-card reveal"><span class="eyebrow">Help us improve</span><h3>Tell us when a barrier appears.</h3><p>If a task is difficult to complete with a screen reader, keyboard, magnification, translation tool, or another assistive technology, please tell us what happened and which page you were using.</p><a class="btn btn-primary" href="mailto:oktabrovumrbek2023@gmail.com?subject=Fact-Check%20accessibility%20feedback">Send accessibility feedback <span aria-hidden="true">→</span></a></article></section>
    <section class="page"><div class="callout reveal"><span class="callout-icon" aria-hidden="true">?</span><div><h3>Need the source list in another format?</h3><p>The current registry can be downloaded as a PDF. Contact the project team if you need help accessing it or want to suggest a more inclusive format.</p></div></div></section>`;
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
    app.innerHTML = adminDashboardMarkupV2(status, snapshot);
    bindAdminDashboardV2(status, snapshot);
    observeReveals();
  } catch (error) {
    app.innerHTML = `<section class="page"><div class="warning">${escapeHtml(error.message)}</div></section>`;
  }
}

function adminDashboardMarkupV2(status, snapshot) {
  const sourceById = new Map(snapshot.sources.map((source) => [source.id, source]));
  const editing = state.editingSourceId ? sourceById.get(state.editingSourceId) : null;
  const activeCount = snapshot.sources.filter((source) => source.active).length;
  const rows = snapshot.sources.map((source) => `<tr class="${source.active ? "" : "inactive"}"><td><strong>${escapeHtml(source.name)}</strong><br /><a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.domain)}</a></td><td><span class="source-tag">${escapeHtml(source.category)}</span></td><td>${source.active ? `<span class="source-tag">Active</span>` : `<span class="source-tag">Paused</span>`}</td><td><div class="table-actions"><button class="icon-btn" type="button" title="Edit source" data-admin-action="edit" data-source-id="${escapeAttr(source.id)}">✎</button><button class="icon-btn" type="button" title="${source.active ? "Pause" : "Activate"} source" data-admin-action="toggle" data-source-id="${escapeAttr(source.id)}">${source.active ? "Ⅱ" : "▶"}</button><button class="icon-btn danger" type="button" title="Remove source" data-admin-action="delete" data-source-id="${escapeAttr(source.id)}">×</button></div></td></tr>`).join("");
  const categoryText = editing?.category || "Waiting for source analysis";
  return `<section class="page"><div class="admin-shell"><aside class="admin-sidebar glass-card"><strong>Source registry</strong><p>Categories determine which sources are eligible for each individual evidence search.</p><div class="admin-metric"><b>${activeCount}</b><span>active sources</span></div><div class="admin-metric"><b>${status.activeDomains}</b><span>registered domains</span></div><div class="admin-metric"><b>100</b><span>maximum domains per check</span></div><div class="admin-metric"><b>v${snapshot.version}</b><span>registry version</span></div><a class="btn btn-secondary btn-small" href="/api/sources.pdf">Download PDF</a></aside><section class="admin-panel glass-card"><div class="admin-panel-head"><div><span class="eyebrow">Administrator workspace</span><h2>Manage the source boundary</h2><p>Each new or edited source is analyzed for category fit, then requires a high-confidence result and your manual confirmation before it can enter the live registry.</p></div><button class="btn btn-secondary btn-small" id="admin-logout" type="button">Sign out</button></div><form class="admin-form" id="source-form"><input type="hidden" id="source-id" value="${escapeAttr(editing?.id || "")}" /><div><label class="form-label" for="source-name">Source name</label><input id="source-name" value="${escapeAttr(editing?.name || "")}" required maxlength="120" /></div><div><label class="form-label" for="source-url">Official first-party link</label><input id="source-url" type="url" value="${escapeAttr(editing?.url || "https://")}" required maxlength="2048" /><span class="form-help">HTTPS only. Social-platform domains cannot be admitted to automated checks.</span></div><div><label class="form-label" for="source-active">Search status</label><select id="source-active"><option value="true" ${editing?.active !== false ? "selected" : ""}>Active — eligible when its category is selected</option><option value="false" ${editing?.active === false ? "selected" : ""}>Paused — visible to administrators only</option></select></div><div class="source-analysis-card"><span class="mini-label">AI category assignment</span><strong id="source-category-result">${escapeHtml(categoryText)}</strong><span id="source-analysis-status">Analyze the source to receive a category and confidence check.</span><button class="text-action" id="assess-source" type="button">Analyze official source →</button></div><div class="full"><label class="form-label" for="source-rationale">Why does this domain belong in the registry?</label><textarea id="source-rationale" required maxlength="360" placeholder="State the official institution, authority, and evidence scope.">${escapeHtml(editing?.rationale || "")}</textarea></div><label class="source-review-check full"><input id="source-manual-review" type="checkbox" required /><span>I manually confirmed the official ownership and scope of this domain. I understand that a low-confidence or uncertain assessment will not be admitted.</span></label><div class="full inline-actions"><button class="btn btn-primary" type="submit">${editing ? "Re-review and save source" : "Review and add source"} <span aria-hidden="true">→</span></button>${editing ? `<button class="btn btn-secondary" id="cancel-edit" type="button">Cancel edit</button>` : ""}</div></form><div class="admin-panel-head"><div><h3>Registry entries</h3><p>${snapshot.sources.length} entries · Updated ${formatDate(snapshot.updatedAt, { time: true })}</p></div><input id="admin-search" type="search" placeholder="Filter sources" aria-label="Filter all sources" /></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Source</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody id="admin-source-rows">${rows}</tbody></table></div></section></div></section>`;
}

function bindAdminDashboardV2(status, snapshot) {
  const form = document.querySelector("#source-form");
  const sourceMap = new Map(snapshot.sources.map((source) => [source.id, source]));
  const analysisButton = document.querySelector("#assess-source");
  const analysisStatus = document.querySelector("#source-analysis-status");
  const categoryResult = document.querySelector("#source-category-result");
  const formPayload = () => ({
    name: document.querySelector("#source-name").value,
    url: document.querySelector("#source-url").value,
    rationale: document.querySelector("#source-rationale").value,
    active: document.querySelector("#source-active").value === "true",
    manualReviewed: document.querySelector("#source-manual-review").checked,
  });

  document.querySelector("#admin-logout").addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST", body: "{}" });
    state.editingSourceId = null;
    toast("Signed out.");
    render();
  });
  document.querySelector("#cancel-edit")?.addEventListener("click", () => { state.editingSourceId = null; renderAdmin(); });

  analysisButton.addEventListener("click", async () => {
    const analysisInputs = ["#source-name", "#source-url", "#source-rationale"].map((selector) => document.querySelector(selector));
    if (analysisInputs.some((input) => !input.reportValidity())) return;
    analysisButton.disabled = true;
    analysisStatus.textContent = "Checking first-party ownership, reliability, and category…";
    try {
      const response = await api("/api/admin/sources/assess", { method: "POST", body: JSON.stringify(formPayload()) });
      const assessment = response.assessment;
      categoryResult.textContent = response.category?.label || assessment.categoryKey;
      analysisStatus.textContent = assessment.eligible && assessment.confidence === "high"
        ? "High-confidence eligible assessment: " + assessment.reason
        : "Not eligible for admission: " + assessment.reason;
      analysisStatus.classList.toggle("is-approved", assessment.eligible && assessment.confidence === "high");
      analysisStatus.classList.toggle("is-rejected", !assessment.eligible || assessment.confidence !== "high");
    } catch (error) {
      analysisStatus.textContent = error.message;
      analysisStatus.classList.remove("is-approved");
      analysisStatus.classList.add("is-rejected");
      toast(error.message, "error");
    } finally {
      analysisButton.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = document.querySelector("#source-id").value;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Reviewing source`;
    try {
      await api(id ? `/api/admin/sources/${encodeURIComponent(id)}` : "/api/admin/sources", { method: id ? "PATCH" : "POST", body: JSON.stringify(formPayload()) });
      state.sourceData = null;
      state.editingSourceId = null;
      toast(id ? "Source re-reviewed and saved." : "Source admitted to the registry.", "success");
      renderAdmin();
    } catch (error) {
      toast(error.message, "error");
      button.disabled = false;
      button.innerHTML = editingLabel(id);
    }
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

function editingLabel(id) {
  return id ? `Re-review and save source <span aria-hidden="true">→</span>` : `Review and add source <span aria-hidden="true">→</span>`;
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
  const renderers = { "/": renderHome, "/check": renderCheck, "/sources": renderSources, "/method": renderMethodV2, "/about": renderAboutV2, "/contact": renderContact, "/privacy": renderPrivacy, "/accessibility": renderAccessibility, "/login": renderLogin, "/signup": renderSignup, "/account": renderAccount, "/admin": renderAdmin };
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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && nav.classList.contains("open")) {
    closeMenu();
    navToggle.focus();
  }
});

window.addEventListener("popstate", render);
render();
void refreshCurrentUser();
