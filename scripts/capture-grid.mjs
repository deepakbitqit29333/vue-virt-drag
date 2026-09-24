import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900"],
  defaultViewport: { width: 1280, height: 900 },
});

try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:43127/", {
    waitUntil: "networkidle0",
    timeout: 30000,
  });
  await page.waitForSelector(".cell, .row");

  // Default mode is grid
  await page.screenshot({
    path: "/cursor/stores/self/media/demo-grid.png",
    fullPage: true,
  });

  // Drag a grid cell
  const handle = await page.$(".cell:not(.muted) .handle");
  if (handle) {
    const box = await handle.boundingBox();
    if (box) {
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await new Promise((r) => setTimeout(r, 100));
      await page.mouse.move(x + 160, y + 20, { steps: 18 });
      await page.mouse.up();
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const log = await page
    .$eval(".event-log", (el) => el.textContent || "")
    .catch(() => "(no log)");
  console.log("grid eventLog:", log.trim());

  await page.screenshot({
    path: "/cursor/stores/self/media/demo-grid-after-drag.png",
    fullPage: true,
  });

  // Jump mid on grid
  const buttons = await page.$$("button.btn");
  await buttons[1].click();
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({
    path: "/cursor/stores/self/media/demo-grid-scrolled.png",
    fullPage: true,
  });

  console.log("grid screenshots written");
} finally {
  await browser.close();
}
