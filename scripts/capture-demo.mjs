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
  await page.waitForSelector(".row");

  // Drag near the top (skip locked row 0)
  const handles = await page.$$(".row:not(.muted) .handle");
  const handle = handles[0];
  if (!handle) throw new Error("no drag handle");
  const box = await handle.boundingBox();
  if (!box) throw new Error("no bbox");

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // hold briefly then move several row heights
  await new Promise((r) => setTimeout(r, 120));
  await page.mouse.move(startX, startY + 52 * 3, { steps: 20 });
  await new Promise((r) => setTimeout(r, 80));
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 600));

  const log = await page
    .$eval(".event-log", (el) => el.textContent || "")
    .catch(() => "(no log)");
  const footer = await page.$eval(".footer-note", (el) => el.textContent || "");
  console.log("eventLog:", log.trim());
  console.log("footer:", footer.trim());

  await page.screenshot({
    path: "/cursor/stores/self/media/demo-after-drag.png",
    fullPage: true,
  });

  // scrolled mid shot
  const buttons = await page.$$("button.btn");
  await buttons[1].click();
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({
    path: "/cursor/stores/self/media/demo-scrolled.png",
    fullPage: true,
  });

  console.log("screenshots written");
} finally {
  await browser.close();
}
