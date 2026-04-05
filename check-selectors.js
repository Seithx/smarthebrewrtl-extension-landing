// Automated selector health check for Smart Hebrew RTL
// Runs via GitHub Actions weekly. Checks if key CSS selectors
// still exist on each supported site's DOM.
//
// NOTE: These sites require login for chat content, so we only
// check if the framework components/selectors exist on the
// initial page (login/landing page still loads the framework).

const { chromium } = require("playwright");

// Baseline selectors per platform.
// If any of these disappear from the DOM, the extension likely broke.
const SITES = [
  {
    name: "ChatGPT",
    url: "https://chatgpt.com",
    // These exist even on the login page (React framework loads)
    selectors: [
      "[data-testid]",
      ".ProseMirror",
    ],
    customTags: [],
  },
  {
    name: "Claude.ai",
    url: "https://claude.ai",
    selectors: [
      "[data-testid]",
    ],
    customTags: [],
  },
  {
    name: "Google AI Studio",
    url: "https://aistudio.google.com",
    selectors: [],
    customTags: [
      "ms-chat-turn",
      "ms-text-chunk",
      "ms-cmark-node",
      "app-root",
    ],
  },
  {
    name: "Gemini",
    url: "https://gemini.google.com",
    selectors: [],
    customTags: [
      "ms-chat-turn",
      "ms-text-chunk",
    ],
  },
  {
    name: "NotebookLM",
    url: "https://notebooklm.google.com",
    selectors: [
      ".chat-message-pair",
      ".message-text-content",
    ],
    // These might only appear after login
    customTags: [],
  },
];

async function checkSite(browser, site) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const results = { name: site.name, url: site.url, passed: true, details: [] };

  try {
    await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Wait for SPA framework to initialize
    await page.waitForTimeout(5000);

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
          // Custom tags might not exist on login page -- warn, don't fail
          results.details.push("[WARNING] tag not found: " + tag + " (may need login)");
        } else {
          results.details.push("[OK] tag: " + tag + " (" + count + " matches)");
        }
      } catch (e) {
        results.details.push("[ERROR] tag: " + tag + " -- " + e.message);
      }
    }

    // Extract page title and check it loaded correctly
    const title = await page.title();
    results.details.push("Page title: " + title);

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
  let allPassed = true;

  for (const site of SITES) {
    console.log("Checking: " + site.name + " (" + site.url + ")");
    const result = await checkSite(browser, site);

    for (const detail of result.details) {
      console.log("  " + detail);
    }

    if (!result.passed) {
      allPassed = false;
      console.log("  >>> FAILED <<<");
    }
    console.log();
  }

  await browser.close();

  console.log("=".repeat(60));
  if (allPassed) {
    console.log("ALL CHECKS PASSED");
  } else {
    console.log("SOME CHECKS FAILED -- extension selectors may be broken");
    process.exit(1); // Triggers the email notification in GitHub Actions
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
