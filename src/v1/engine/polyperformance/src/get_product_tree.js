const puppeteer = require("puppeteer");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_tree(page, category) {
  await page.goto(`${category["url"]}?product_list_limit=all`, {
    timeout: 60000,
  });

  await sleep(3000);

  let metadata = {
    "category name": category["name"],
    "category url": category["url"],
  };
  const products = await page.evaluate(() => {
    let products = [];
    const brandDivs = document.querySelectorAll(
      'strong[class="product name product-item-name"]'
    );
    if (brandDivs) {
      brandDivs.forEach((div) => {
        const productname = div.textContent.trim();
        const producturl = div.querySelector("a").href;

        products.push({
          name: productname,
          url: producturl,
        });
      });
    }
    return products;
  });

  metadata["products"] = products;
  return metadata;
}

async function get_product_tree() {
  let finished = false;
  while (!finished) {
    try {
      await sleep(1000);
      exec("killall chrome");
      await sleep(1000);
      exec(
        '/opt/google/chrome/chrome --profile-directory="Default" --guest --remote-debugging-port=9222'
      );
      await sleep(5000);

      const browserURL = "http://127.0.0.1:9222";

      const browser = await puppeteer.connect({ browserURL });
      const page = (await browser.pages())[0];

      let data = [];
      // check if the mata file exists
      if (fs.existsSync(path.join(__dirname, "../assets/tree.json")))
        data = JSON.parse(
          fs.readFileSync(path.join(__dirname, "../assets/tree.json"), "utf8")
        );
      const categories = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, "../assets/categories.json"),
          "utf8"
        )
      );

      for (const ct of categories.slice(data.length)) {
        product = await get_tree(page, ct);
        // if (product["products"].length === 0)
        //   throw new Error("Forced exception: No products!");

        data.push(product);

        jsonContent = JSON.stringify(data, null, 2);
        fs.writeFileSync(
          path.join(__dirname, "../assets/tree.json"),
          jsonContent,
          "utf8"
        );
      }

      // get tree table
      const tree_table = {};
      data.forEach((category) => {
        category.products.forEach((pd) => {
          if (!tree_table.hasOwnProperty(pd.name))
            tree_table[pd.name] = {
              tree: category["category name"],
              url: pd.url,
            };
        });
      });
      jsonContent = JSON.stringify(tree_table, null, 2);
      fs.writeFileSync(
        path.join(__dirname, "../assets/tree_table.json"),
        jsonContent,
        "utf8"
      );

      finished = true;
      exec("killall chrome");
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = get_product_tree;
