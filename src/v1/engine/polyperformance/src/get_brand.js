const puppeteer = require("puppeteer");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_brands() {
  if (
    fs.existsSync(path.join(__dirname, "../assets/brands.json")) &&
    fs.existsSync(path.join(__dirname, "../assets/categories.json"))
  )
    return;

  // if not exists
  await sleep(1000);
  exec("killall chrome");
  await sleep(1000);
  exec(
    '/opt/google/chrome/chrome --profile-directory="Default" --guest --remote-debugging-port=9222'
  );
  await sleep(3000);

  const browserURL = "http://127.0.0.1:9222";

  const browser = await puppeteer.connect({ browserURL });
  const page = (await browser.pages())[0];

  await page.goto("https://www.polyperformance.com/brands", { timeout: 60000 });

  await sleep(3000);

  // get brands
  const brands = await page.evaluate(() => {
    let brands = [];
    const brandDivs = document.querySelectorAll(
      'li[class="ambrands-brand-item "]'
    );
    if (brandDivs) {
      brandDivs.forEach((div) => {
        const brandname = div.textContent.trim();
        const brandurl = div.querySelector("a").href;

        brands.push({
          name: brandname,
          url: brandurl,
        });
      });
    }
    return brands;
  });

  // get categories
  const categories = await page.evaluate(() => {
    const categories = [];
    document
      .querySelectorAll('li[class*="ui-menu-item level0"]')
      .forEach((div) => {
        const categoryname = div.querySelector("a").title;
        const categoryurl = div.querySelector("a").href;

        // if it has sub categories
        if (div.querySelector('div[class="level0 submenu"]'))
          div
            .querySelectorAll('li[class*="ui-menu-item level1"]')
            .forEach((subdiv) => {
              categories.push({
                name: [categoryname, subdiv.querySelector("a").title],
                url: subdiv.querySelector("a").href,
              });
            });
        // else it doesn't have sub categories
        else
          categories.push({
            name: [categoryname],
            url: [categoryurl],
          });
      });

    return categories.slice(2, categories.length - 3);
  });

  exec("killall chrome");
  jsonContent = JSON.stringify(brands, null, 2);
  fs.writeFileSync(
    path.join(__dirname, "../assets/brands.json"),
    jsonContent,
    "utf8"
  );

  jsonContent = JSON.stringify(categories, null, 2);
  fs.writeFileSync(
    path.join(__dirname, "../assets/categories.json"),
    jsonContent,
    "utf8"
  );
}

module.exports = get_brands;
