const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_details(page, optionname) {
  console.log(optionname, page.url());

  const notfoundDiv = await page.evaluate(() => {
    const notfoundDiv = document.querySelector(
      'div[class="col-sm-5 not-found-message"]'
    );
    return notfoundDiv;
  });
  if (notfoundDiv) {
    console.log("Not found    ", page.url());
    return {
      details: "not found",
      optionname: optionname,
      optionurl: page.url(),
    };
  }

  const title = await page.evaluate(() => {
    const title = document.querySelector("title").textContent.trim();
    return title;
  });
  if (title === "403 Forbidden") {
    console.log("403 Forbidden    ", page.url());
    return {
      details: "403 Forbidden",
      optionname: optionname,
      optionurl: page.url(),
    };
  }

  // To get all div elements with class 'pricing-block'
  const elements = await page.$$(".pricing-block"); // Note the use of `$$` for multiple elements

  const product = await page.evaluate((ele) => {
    const catalogDiv = ele.querySelector('div[class="part-num catalog"]');
    let catalognumber = "";
    if (catalogDiv)
      catalognumber = catalogDiv
        .querySelector('span[class="num-value"]')
        .textContent.trim();

    const mfgDiv = ele.querySelector('div[class="part-num mfg"]');
    let mfgnumber = "";
    if (mfgDiv) {
      mfgnumber = mfgDiv
        .querySelector('span[class="num-value"]')
        .textContent.trim();
    }

    const msrpDiv = ele.querySelector('div[class="pricing-row msrp"]');
    let oldprice = "";
    if (msrpDiv) oldprice = msrpDiv.textContent.trim().slice(5);

    const priceDiv = ele.querySelector('div[class="best-price"]');
    let finalprice = "";
    if (priceDiv) finalprice = priceDiv.textContent.trim().slice(1);

    const instockDiv = ele.querySelector('div[class*="stock-status"]');
    let instock = "";
    if (instockDiv) instock = instockDiv.textContent.trim();

    const descriptionDiv = document.querySelector(
      'div[class="product-section description"]'
    );
    let description = "";
    if (descriptionDiv)
      description = descriptionDiv
        .querySelector('div[class="section-content"]')
        .textContent.trim();

    const detailsDiv = document.querySelector('div[class="col-md-8"]');
    let details = "";
    if (detailsDiv)
      details = detailsDiv
        .querySelector('div[class="product-section"]')
        .querySelector('div[class="section-content"]')
        .innerHTML.trim();

    const imgDivs = document.querySelectorAll(
      'div[class="media media--image media--loaded"]'
    );
    let imgs = [];
    imgDivs.forEach((div) => {
      imgs.push(div.querySelector("img").src);
    });

    product = {
      catalognumber: catalognumber,
      mfgnumber: mfgnumber,
      oldprice: oldprice,
      finalprice: finalprice,
      instock: instock,
      imgs: imgs,
      description: description,
      details: details,
    };
    return product;
  }, elements[0]);
  if (typeof optionname === "string" || optionname instanceof String)
    product["optionname"] = [optionname];
  else product["optionname"] = optionname;
  product["optionurl"] = page.url();
  return product;
}

async function get_product(page, metadata) {
  const count = metadata["url"].split("/").length - 1;
  if (count > 5) {
    // metadata['options'] = 'duplicated';
    console.log("duplicated  ", metadata["url"]);

    return {
      options: "duplicated",
      title: metadata["title"],
      url: metadata["url"],
    };
  }

  let options = [];
  // Navigate to the specified URL
  await page.goto(metadata["url"]);

  await sleep(1000);

  const cancelDiv = await page.evaluate(() => {
    const cancelDiv = document.querySelector('div[class="cancelled-banner"]');
    return cancelDiv;
  });

  if (cancelDiv) {
    console.log("empty  ", metadata["url"]);

    return {
      options: "empty",
      title: metadata["title"],
      url: metadata["url"],
    };
  }

  options.push(await get_details(page, "original"));

  let optionmetadata = await page.evaluate(() => {
    const v2jsonDiv = document.querySelector('div[id="v2json"]');
    let v2json = [];
    if (v2jsonDiv) v2json = JSON.parse(v2jsonDiv.textContent.trim());

    return v2json;
  });

  if (Object.values(optionmetadata).length > 0) {
    console.log("V2Json is existing...");

    for (const om of Object.values(optionmetadata)) {
      await page.goto(`https://www.quadratec.com${om["path"]}`);
      await sleep(1000);

      options.push(await get_details(page, om["values"]));
    }
  } else {
    optionmetadata = await page.evaluate(() => {
      let optionmetadata = [];
      const divOptions = document.querySelector(
        'select[class="option-box btn-success form-control form-select final-selection form-control form-select"]'
      );
      if (divOptions) {
        const optionElements = divOptions.querySelectorAll("option");
        optionElements.forEach((option, index) => {
          if (index > 0) {
            optionmetadata.push({
              name: option.textContent.trim(),
              value: option.value,
            });
            // const value = option.value;
            // console.log(value);
            // divOptions.value = value;
            // divOptions
          }
        });
      }
      return optionmetadata;
    });

    if (optionmetadata.length > 0) {
      console.log("Options select is existing...");
      console.log(optionmetadata);
      for (const om of optionmetadata) {
        await page.select(
          'select[class="option-box btn-success form-control form-select final-selection form-control form-select"]',
          om["value"]
        );
        await sleep(1000);

        options.push(await get_details(page, om["name"]));
      }
    }
  }

  product = {
    options: options,
    brand: metadata["brand"],
    category: metadata["category"],
    title: metadata["title"],
    url: metadata["url"],
  };

  return product;
}

async function get_product_details(numberofprocess = 4) {
  const brands = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../assets/brands.json"), "utf8")
  );
  const chunksize = Math.ceil(brands.length / numberofprocess);

  // create directory if data doesn't exist
  if (!fs.existsSync(path.join(__dirname, "../assets/data")))
    fs.mkdirSync(path.join(__dirname, "../assets/data"), { recursive: true });

  const browsers = [];

  const singleProcess = async (processnumber) => {
    let finished = false;
    while (!finished) {
      // Launch a new browser session
      const browser = await puppeteer.launch({ headless: false });
      browsers.push(browser);
      // Open a new page
      const page = await browser.newPage();
      // Set the navigation timeout (in milliseconds)
      await page.setDefaultNavigationTimeout(300000); // Timeout after 30 seconds

      try {
        // create directory if data doesn't exist
        if (
          !fs.existsSync(
            path.join(__dirname, `../assets/data/data${processnumber}`)
          )
        )
          fs.mkdirSync(
            path.join(__dirname, `../assets/data/data${processnumber}`),
            {
              recursive: true,
            }
          );
        let numberoffiles = fs.readdirSync(
          path.join(__dirname, `../assets/data/data${processnumber}`)
        ).length;
        if (numberoffiles === 0) numberoffiles++;

        for (const brand of brands.slice(
          chunksize * processnumber + numberoffiles - 1,
          chunksize * (processnumber + 1)
        )) {
          const brandname = brand["name"];
          let meta = JSON.parse(
            fs.readFileSync(
              path.join(__dirname, `../assets/metadata/${brandname}.json`),
              "utf8"
            )
          );

          let data = [];
          try {
            data = JSON.parse(
              fs.readFileSync(
                path.join(
                  __dirname,
                  `../assets/data/data${processnumber}/${brandname}.json`
                ),
                "utf8"
              )
            );
          } catch (error) {
            console.log("New Brand:    ", brandname);
            data = [];
            fs.writeFileSync(
              path.join(
                __dirname,
                `../assets/data/data${processnumber}/${brandname}.json`
              ),
              "[]",
              "utf8",
              (err) => {
                if (err) {
                  console.error("An error occurred:", err);
                  return;
                }
                console.log("JSON file has been saved.");
              }
            );
          }

          for (const mt of meta.slice(data.length)) {
            const product = await get_product(page, mt);
            data.push(product);

            const jsonContent = JSON.stringify(data, null, 2);
            fs.writeFileSync(
              path.join(
                __dirname,
                `../assets/data/data${processnumber}/${brandname}.json`
              ),
              jsonContent,
              "utf8",
              (err) => {
                if (err) {
                  console.error("An error occurred:", err);
                  return;
                }
                console.log("JSON file has been saved.");
              }
            );
          }
        }

        browser.close();
        finished = true;
      } catch (error) {
        console.log(error);
        browser.close();
      }
    }
  };

  const processes = [];
  for (
    let processnumber = 0;
    processnumber < numberofprocess;
    processnumber++
  ) {
    processes.push(singleProcess(processnumber)); // Assuming the process numbers start from 0 and increment by 1
  }

  // Assuming browsers is an array containing your Puppeteer browser instances
  process.on("SIGINT", () => {
    Promise.all(browsers.map((browser) => browser.close()))
      .then(() => process.exit())
      .catch(() => process.exit());
  });

  process.on("SIGTERM", () => {
    Promise.all(browsers.map((browser) => browser.close()))
      .then(() => process.exit())
      .catch(() => process.exit());
  });

  await Promise.all(processes).then(() => {
    const dir = path.join(__dirname, "../assets/data");
    const subdirs = fs.readdirSync(dir);

    for (const sd of subdirs) {
      const fullPath = `${dir}/${sd}`;
      const files = fs.readdirSync(fullPath);

      for (const f of files) {
        fs.renameSync(`${fullPath}/${f}`, `${dir}/${f}`);
      }
      fs.rmdirSync(fullPath);
    }
  });
}

module.exports = get_product_details;
