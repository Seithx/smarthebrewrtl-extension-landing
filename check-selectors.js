// Automated selector health check for Smart Hebrew RTL
// Runs via GitHub Actions weekly. Checks if key CSS selectors
// still exist on each supported site's DOM.
//
// Limitations:
// - Sites behind Cloudflare (ChatGPT, Claude) can't be checked headlessly
// - Sites requiring login show login page, not chat UI
// - We check what's accessible without auth and skip blocked sites

const { chromium } = require("playwright");

// Baseline selectors per platform.
// checkable: false = Cloudflare-blocked or login-gated, skip gracefully
const SITES = [
  {
    name: "ChatGPT",
    url: "https://chatgpt.com",
    checkable: false, // Cloudflare blocks headless browsers
    selectors: [],
    customTags: [],
  },
  {
    name: "Claude.ai",
    url: "https://claude.ai",
    checkable: false, // Cloudflare blocks headless browsers
    selectors: [],
    customTags: [],
  },
  {
    name: "Google AI Studio",
    url: "https://aistudio.google.com",
    checkable: true,
    selectors: [],
    customTags: ["app-root", "ms-app", "ms-toolbar"],
  },
  {
    name: "Gemini",
    url: "https://gemini.google.com",
    checkable: true,
    selectors: [],
    customTags: ["bard-sidenav", "chat-window"],
  },
  {
    name: "NotebookLM",
    url: "https://notebooklm.google.com",
    checkable: false, // Requires Google login
    selectors: [],
    customTags: [],
  },
];

const CLOUDFLARE_TITLES = ["just a moment", "attention required", "checking your browser"];

async function checkSite(browser, site) {
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const results = { name: site.name, url: site.url, passed: true, skipped: false, details: [] };

  try {
    await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);

    const title = (await page.title()).toLowerCase();

    // Detect Cloudflare or login redirect
    if (CLOUDFLARE_TITLES.some(function(t) { return title.includes(t); })) {
      results.skipped = true;
      results.details.push("[SKIP] Cloudflare protection detected: " + title);
      return results;
    }
    if (title.includes("sign in") || title.includes("log in")) {
      results.skipped = true;
      results.details.push("[SKIP] Login required: " + title);
      return results;
    }

    results.details.push("Page title: " + title);

    // Check CSS selectors
    for (const sel of site.selectors) {
      try {
        const count = await page.locator(sel).count();
        if (count === 0) {
          results.details.push("[MISSING] selector: " + sel);
          results.passed = false;
        } else {
          results.details.push("[OK] selector: " + sel + " (" + count + " matches)");
        }
      } catch (e) {
        results.details.push("[ERROR] selector: " + sel + " -- " + e.message);
        results.passed = false;
      }
    }

    // Check custom HTML tags
    for (const tag of site.customTags) {
      try {
        const count = await page.locator(tag).count();
        if (count === 0) {
          results.details.push("[MISSING] tag: " + tag);
          results.passed = false;
        } else {
          results.details.push("[OK] tag: " + tag + " (" + count + " matches)");
        }
      } catch (e) {
        results.details.push("[ERROR] tag: " + tag + " -- " + e.message);
        results.passed = false;
      }
    }

  } catch (e) {
    results.passed = false;
    results.details.push("[ERROR] Failed to load: " + e.message);
  } finally {
    await context.close();
  }

  return results;
}

async function main() {
  console.log("=".repeat(60));
  console.log("SMART HEBREW RTL -- SELECTOR HEALTH CHECK");
  console.log("=".repeat(60));
  console.log("Date:", new Date().toISOString());
  console.log();

  const browser = await chromium.launch({ headless: true });
  var allPassed = true;
  var failures = [];
  var skipped = [];

  for (const site of SITES) {
    if (!site.checkable) {
      console.log("Skipping: " + site.name + " (not checkable headlessly)");
      skipped.push(site.name);
      console.log();
      continue;
    }

    console.log("Checking: " + site.name + " (" + site.url + ")");
    const result = await checkSite(browser, site);

    for (const detail of result.details) {
      console.log("  " + detail);
    }

    if (result.skipped) {
      skipped.push(site.name);
      console.log("  [SKIPPED]");
    } else if (!result.passed) {
      allPassed = false;
      failures.push({ name: site.name, details: result.details });
      console.log("  >>> FAILED <<<");
    } else {
      console.log("  [PASSED]");
    }
    console.log();
  }

  await browser.close();

  console.log("=".repeat(60));
  console.log("Checked: " + (SITES.length - skipped.length) + " | Skipped: " + skipped.length + " | Failed: " + failures.length);

  if (skipped.length > 0) {
    console.log("Skipped (Cloudflare/login): " + skipped.join(", "));
  }

  if (allPassed) {
    console.log("ALL CHECKABLE SITES PASSED");
  } else {
    console.log();
    console.log("FAILURES:");
    for (const f of failures) {
      console.log("  " + f.name + ":");
      for (const d of f.details) {
        console.log("    " + d);
      }
    }
    // Output failure summary for GitHub Actions
    console.log();
    console.log("::error::Selector check failed for: " + failures.map(function(f) { return f.name; }).join(", "));
    process.exit(1);
  }
}

main().catch(function(e) {
  console.error("Fatal error:", e);
  process.exit(1);
});
