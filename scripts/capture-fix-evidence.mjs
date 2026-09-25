import puppeteer from "puppeteer-core";
import fs from "fs";

const outDir = "/cursor/stores/self/media";
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900"],
  defaultViewport: { width: 1280, height: 900 },
});

try {
  const page = await browser.newPage();
  // Bust CDN cache
  await page.goto("https://deepakbitqit29333.github.io/vue-virt-drag/?v=9e93781", {
    waitUntil: "networkidle0",
    timeout: 60000,
  });
  await page.waitForSelector(".row, .cell", { timeout: 20000 });

  // Ensure list mode
  const tabs = await page.$$("button.tab");
  if (tabs[0]) await tabs[0].click();
  await new Promise((r) => setTimeout(r, 400));

  await page.screenshot({
    path: `${outDir}/fix-list-first-draggable.png`,
    fullPage: true,
  });

  // First handle should NOT be disabled
  const firstDisabled = await page.$eval(
    ".row .handle",
    (el) => (el).disabled
  );
  console.log("firstHandleDisabled:", firstDisabled);

  // Drag first row down a bit
  const handle = await page.$(".row .handle");
  const box = await handle.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await new Promise((r) => setTimeout(r, 80));
  await page.mouse.move(x, y + 160, { steps: 20 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 500));
  const log = await page
    .$eval(".event-log", (el) => el.textContent || "")
    .catch(() => "");
  console.log("shortDragLog:", log.trim());
  await page.screenshot({
    path: `${outDir}/fix-after-short-drag.png`,
    fullPage: true,
  });

  // Long distance: start drag then wheel scroll
  await page.click("button.btn"); // shuffle? first btn might be shuffle - skip
  // Reset first
  const buttons = await page.$$("button.btn");
  // disabled checkbox, shuffle, jump mid, jump 2000, reset - find Reset
  for (const b of buttons) {
    const t = await page.evaluate((el) => el.textContent, b);
    if ((t || "").includes("Reset")) await b.click();
  }
  await new Promise((r) => setTimeout(r, 300));

  const h2 = await page.$(".row .handle");
  const b2 = await h2.boundingBox();
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.mouse.down();
  await new Promise((r) => setTimeout(r, 50));
  // Wheel while dragging toward ~2000
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel({ deltaY: 800 });
    await new Promise((r) => setTimeout(r, 16));
  }
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 600));
  const log2 = await page
    .$eval(".event-log", (el) => el.textContent || "")
    .catch(() => "");
  console.log("longDragLog:", log2.trim());
  await page.screenshot({
    path: `${outDir}/fix-after-long-scroll-drag.png`,
    fullPage: true,
  });

  console.log("done");
} finally {
  await browser.close();
}
