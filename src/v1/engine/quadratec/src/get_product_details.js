const puppeteer = require("puppeteer");
const fs = require("fs");
const { JSDOM } = require("jsdom");
const path = require("path");
const { randomUUID } = require("crypto");
const { exec } = require("child_process");
require("events").EventEmitter.defaultMaxListeners = 20;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get_images(product) {
  let images = [];
  if (Array.isArray(product.options)) {
    // get images from options
    product.options.forEach((op) => {
      images = images.concat(op.imgs);
    });
  }
  return images;
}

async function get_body(page, description, details, options) {
  // get youtube embeddings
  const videos = await page.evaluate(() => {
    let videos = [];
    document
      .querySelectorAll('iframe[class="embed-player slide-media"]')
      .forEach((ele) => {
        videos.push(ele.outerHTML.trim());
      });
    return videos;
  });

  // write Body
  const dom = new JSDOM(details.replace("h2", "h3"));
  const document = dom.window.document;

  // add videos
  videos.forEach((vd) => {
    document.getElementById("learn").innerHTML =
      vd + "<br>" + document.getElementById("learn").innerHTML;
  });

  // add tabs
  document.querySelectorAll('a[role="tab"]').forEach((tab) => {
    const detailDiv = document.getElementById(tab.href.split("#")[1]);
    if (tab.href.split("#")[1] === "learn") {
      // get first element
      const elementHandle = Array.from(detailDiv.children);

      // get the lastest div in LEARN MORE
      let oldelement = undefined;
      elementHandle.forEach((element) => {
        if (oldelement && element.className === "row") {
          const tagName = oldelement.tagName.toLowerCase();
          if (tagName === "p" || tagName === "ul") {
            const newelement = document.createElement("span");
            newelement.innerHTML = oldelement.innerHTML;
            oldelement.parentNode.replaceChild(newelement, oldelement);
          }
        }

        oldelement = element;
      });
      // const lastelement = elementHandle[elementHandle.length - 1];

      // // add space
      // console.log("last tag Name:  ", lastelement.tagName);
      // if (lastelement.tagName.toLowerCase() !== "span") {
      // }
    }
    if (detailDiv)
      detailDiv.innerHTML =
        `<br><h2>${tab.textContent}</h2>` + detailDiv.innerHTML;
  });

  // enhance headings
  document.querySelectorAll('div[class="heading"]').forEach((heading) => {
    // if (heading.textContent.trim() === "Installation Notes")
    heading.innerHTML = "<br><h3>" + heading.innerHTML + "</h3>";
    // else heading.innerHTML = "<h3>" + heading.innerHTML + "</h3>";
  });

  // remove 'add to cart'
  document.querySelectorAll('div[class="add-cart-link"]').forEach((td) => {
    td.innerHTML = "";
  });

  // add specs on tab
  let specs_content = "";
  options.forEach((op, idx) => {
    let space = "<br>";
    if (idx === 0) space = "";
    if (op.specs) {
      if (op.values) {
        specs_content += `${space}<p>For ${op.values.join(" & ")}:</p>${op.specs
          .replace('id="product-specs"', "")
          .replace("ul", "span")}`;
      } else {
        specs_content += `${space}<p>For:</p>${op.specs
          .replace('id="product-specs"', "")
          .replace("ul", "span")}`;
      }
    }
  });

  if (specs_content.length > 1)
    document.getElementById("specs").innerHTML =
      "<br><h2>Specs</h2>" + specs_content;
  else if (document.getElementById("specs"))
    document.getElementById("specs").innerHTML = document
      .getElementById("specs")
      .innerHTML.replace("ul", "span");

  // control Fitment
  const fitmentDiv = document.getElementById("vehicles");
  if (fitmentDiv) {
    let fitment_content = "<br /><h2>Fitment</h2>";
    // convert ul to span
    // fitmentDiv.innerHTML = fitmentDiv.innerHTML.trim().replaceAll("ul", "span");

    // contorl h3 tag
    fitmentDiv
      .querySelectorAll('ul[class="list-unstyled"]')
      .forEach((div, idx) => {
        div.querySelector("li").outerHTML = div.querySelector("li").innerHTML;

        // add space
        let space = "<br>";
        if (idx === 0) space = "";
        fitment_content += space + div.outerHTML;
      });

    fitmentDiv.innerHTML = fitment_content.replaceAll("ul", "span");
  }

  // control skill
  document.querySelectorAll('span[class="skill-icon"]').forEach((ele) => {
    const newBr = document.createElement("br");
    ele.parentNode.insertBefore(newBr, ele.nextSibling);
  });
  document.querySelectorAll('span[class="field-value-sub"]').forEach((ele) => {
    ele.innerHTML = " " + ele.innerHTML;
  });

  // control pdf
  document.querySelectorAll('a[target="_blank"]').forEach(function (element) {
    element.innerHTML =
      '<br/><span style="color: blue; text-decoration: underline;">Installation Instructions</span>';
  });

  // add space before timeline
  document
    .querySelectorAll('div[class="installation-time field"]')
    .forEach((ele) => {
      const newBr = document.createElement("br");
      ele.parentNode.insertBefore(newBr, ele);
    });

  // add space before pdf
  document.querySelectorAll('div[class="instruction-set"]').forEach((ele) => {
    const newBr = document.createElement("br");
    ele.parentNode.insertBefore(newBr, ele);
  });

  // add space after 'Parts Included'
  document
    .querySelectorAll('div[class="col-sm-4 parts-included sub-section"]')
    .forEach((ele) => {
      // get last li tag
      const elementHandle = Array.from(ele.children);
      const lastelement = elementHandle[elementHandle.length - 1];

      // convert to span
      if (lastelement.tagName.toLowerCase() !== "span") {
        const newelement = document.createElement("span");
        newelement.innerHTML = lastelement.innerHTML;
        lastelement.parentNode.replaceChild(newelement, lastelement);
      }
      // else lastelement.insertAdjacentHTML("afterend", "<br />");
    });

  return dom
    .serialize()
    .replace(/<ul id="product-tabs"[^]*?<\/ul>/gi, description)
    .replace(/class=".*?"/g, "")
    .replace(/aria-labelledby=".*?"/g, "")
    .replace(/role=".*?"/g, "")
    .replace(/itemtype=".*?"/g, "")
    .replace(/itemscope=".*?"/g, "")
    .replace(/itemprop=".*?"/g, "");
}

async function get_details(page, optionname) {
  console.log(page.url());
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
    let weight = "";
    if (detailsDiv) {
      details = detailsDiv
        .querySelector('div[class="product-section"]')
        .querySelector('div[class="section-content"]')
        .innerHTML.trim();

      if (detailsDiv.querySelector('div[id="product-specs"]'))
        detailsDiv
          .querySelector('div[id="product-specs"]')
          .querySelectorAll("li")
          .forEach((li) => {
            if (li.textContent.trim().includes("Shipping Weight"))
              weight = li.querySelector("span").textContent.trim();
          });
    }

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
      weight: weight,
      imgs: imgs,
      description: description,
      details: details
        .replaceAll('"/sites/', '"https://www.quadratec.com/sites/')
        .replaceAll("data-src", "src"),
    };
    return product;
  }, elements[0]);
  product["values"] = [optionname];
  return product;
}

async function get_option_details(nid, product_id, values) {
  const baseURL = `https://www.quadratec.com/nocache/product_ajax/${nid}/${product_id}/`;

  // get image
  const img = await fetch(`${baseURL}images`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Image Fetch Error! status: ${response.status}`);
      }
      // Parse the JSON response
      return response.json();
    })
    .then((data) => {
      return data.img;
    })
    .catch((error) => {
      console.log("Empty Image");
      return "";
    });

  // get weight
  const specs_content = await fetch(`${baseURL}specs`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Image Fetch Error! status: ${response.status}`);
      }
      // Parse the JSON response
      return response.text();
    })
    .then((data) => {
      return data;
    });
  // Create a specs instance of the DOMParser
  const specs_dom = new JSDOM(specs_content);
  let weight = "";
  specs_dom.window.document.querySelectorAll("li").forEach((li) => {
    if (li.textContent.trim().includes("Shipping Weight"))
      weight = li.querySelector("span").textContent.trim();
  });

  // get details
  const details_content = await fetch(`${baseURL}details_json`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Details Fetch Error! status: ${response.status}`);
      }
      // Parse the JSON response
      return response.json();
    })
    .then((data) => {
      return data;
    });

  // Create a new instance of the DOMParser
  const details_dom = new JSDOM(details_content);

  const catalogDiv = details_dom.window.document.querySelector(
    'div[class="part-num catalog"]'
  );
  let catalognumber = "";
  if (catalogDiv)
    catalognumber = catalogDiv
      .querySelector('span[class="num-value"]')
      .textContent.trim();

  const mfgDiv = details_dom.window.document.querySelector(
    'div[class="part-num mfg"]'
  );
  let mfgnumber = "";
  if (mfgDiv) {
    mfgnumber = mfgDiv
      .querySelector('span[class="num-value"]')
      .textContent.trim();
  }

  const msrpDiv = details_dom.window.document.querySelector(
    'div[class="pricing-row msrp"]'
  );
  let oldprice = "";
  if (msrpDiv) oldprice = msrpDiv.textContent.trim().slice(5);

  const priceDiv = details_dom.window.document.querySelector(
    'div[class="best-price"]'
  );
  let finalprice = "";
  if (priceDiv) finalprice = priceDiv.textContent.trim().slice(1);

  const instockDiv = details_dom.window.document.querySelector(
    'div[class*="stock-status"]'
  );
  let instock = "";
  if (instockDiv) instock = instockDiv.textContent.trim();

  const details = {
    catalognumber: catalognumber,
    mfgnumber: mfgnumber,
    oldprice: oldprice,
    finalprice: finalprice,
    instock: instock,
    weight: weight,
    imgs: [img],
    specs: specs_content
      .replaceAll('"/sites/', '"https://www.quadratec.com/sites/')
      .replaceAll("data-src", "src"),
    values: values,
  };

  return details;
}

async function get_options(page) {
  const optionmetadata = await page.evaluate(() => {
    const optionmetadata = { nid: "", names: [], values: [] };

    const nidDiv = document.querySelector('div[id="nid"]');
    if (nidDiv) optionmetadata.nid = nidDiv.textContent.trim();

    const optionnameDivs = document.querySelectorAll(
      'label[class="control-label"]'
    );
    optionnameDivs.forEach((div) => {
      optionmetadata.names.push(div.innerText);
    });

    const v2jsonDiv = document.querySelector('div[id="v2json"]');
    if (v2jsonDiv) {
      console.log("v2jsonDiv founded...");
      const v2json = JSON.parse(v2jsonDiv.textContent.trim());
      for (const om of Object.values(v2json)) {
        optionmetadata.values.push({
          product_id: om["product_id"],
          values: om["values"],
        });
      }
      return optionmetadata;
    }

    const jsonselectDiv = document.querySelector(
      'span[id="json-select-boxes"]'
    );
    if (jsonselectDiv) {
      console.log("jsonselectDiv founded...");
      const jsonselect = JSON.parse(jsonselectDiv.textContent.trim());

      const get_select = (om, data) => {
        if (Object.keys(data).length === 0) {
          optionmetadata.values.push(om);
          return;
        } else {
          for (const key of Object.keys(data)) {
            let localom = {
              product_id: data[key]["product_id"],
              values: om["values"].slice(),
            };
            localom["values"].push(key);
            get_select(localom, data[key]["next_step"]);
          }
          return;
        }
      };

      get_select({ product_id: "", values: [] }, jsonselect["init"]);
      return optionmetadata;
    }
    return optionmetadata;
  });

  return optionmetadata;
}

async function get_product(page, metadata) {
  const count = metadata["url"].split("/").length - 1;
  if (count > 5 || metadata["url"].includes[".htm/"]) {
    // metadata['options'] = 'duplicated';
    console.log("duplicated  ", metadata["url"]);

    return {
      options: "duplicated",
      brand: metadata["brand"],
      title: metadata["title"],
      url: metadata["url"],
    };
  }
  // Navigate to the specified URL
  await page.goto(metadata["url"]);
  await sleep(1000);

  // If product is empty
  const cancelDiv = await page.evaluate(() => {
    const cancelDiv = document.querySelector('div[class="cancelled-banner"]');
    return cancelDiv;
  });

  if (cancelDiv) {
    console.log("empty  ", metadata["url"]);

    return {
      options: "empty",
      brand: metadata["brand"],
      title: metadata["title"],
      url: metadata["url"],
    };
  }
  const optionData = [];

  // get original options
  let original_option = await get_details(page, "original");
  while (original_option.imgs[0].includes("data:image/gif;")) {
    console.log("Image Error..   ", metadata.url);
    await page.goto(metadata.url);
    await sleep(1000);
    original_option = await get_details(page, "original");
  }
  optionData.push(original_option);

  // get variants
  const optionmetadata = await get_options(page);

  for (const md of optionmetadata.values) {
    optionData.push(
      await get_option_details(
        optionmetadata["nid"],
        md["product_id"],
        md["values"]
      )
    );
  }

  product = {
    options: optionData,
    optionnames: optionmetadata.names,
    brand: metadata["brand"],
    category: metadata["category"],
    title: metadata["title"],
    // url: page.url(),
    url: metadata["url"],
  };

  // add body
  const body = await get_body(
    page,
    optionData[0].description,
    optionData[0].details,
    optionData.slice(1)
  );
  product["body"] = body;

  return product;
}

async function get_product_details(numberofprocess = 4) {
  exec("killall chrome");
  await sleep(1000);

  const brands = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../assets/brands.json"), "utf8")
  );
  let image_table = {};
  if (fs.existsSync(path.join(__dirname, "../assets/image_table.json")))
    image_table = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../assets/image_table.json"),
        "utf8"
      )
    );
  const chunksize = Math.ceil(brands.length / numberofprocess);

  // create directory if data doesn't exist
  if (!fs.existsSync(path.join(__dirname, "../assets/data")))
    fs.mkdirSync(path.join(__dirname, "../assets/data"), { recursive: true });

  // create directory if images doesn't exist
  if (!fs.existsSync("./assets/images"))
    fs.mkdirSync("./assets/images", { recursive: true });

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
        // Open a page to download
        const download_page = await browser.newPage();
        // Set the navigation timeout (in milliseconds)
        await download_page.setDefaultNavigationTimeout(300000); // Timeout after 300 seconds

        let download_flag = false;
        download_page.on("response", async (response) => {
          if (
            response.url().includes("https://www.quadratec.com/sites/") &&
            response.request().method() === "GET"
          ) {
            download_flag = true;
            const imgurl = response.url();
            const format = imgurl.split(".")[imgurl.split(".").length - 1];

            const buffer = await response.buffer(); // Gets the response body as a buffer

            if (!image_table.hasOwnProperty(imgurl) && format !== "pdf") {
              const uid = randomUUID(); // Gets the UUID
              try {
                fs.writeFileSync(`./assets/images/${uid}.${format}`, buffer); // Write the buffer to a file
              } catch (error) {
                console.log(page.url());
                console.log(imgurl);
                throw new Error("Page error caught:");
              }

              image_table[imgurl] = `${uid}.${format}`;
              jsonContent = JSON.stringify(image_table, null, 2);
              fs.writeFileSync(
                `./assets/image_table.json`,
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

            download_flag = false;
          }
        });

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
          const savedFilename = path.join(
            __dirname,
            `../assets/data/data${processnumber}/${brandname}.json`
          );
          try {
            data = JSON.parse(fs.readFileSync(savedFilename, "utf8"));
          } catch (error) {
            console.log("New Brand:    ", brandname);
            data = [];
            fs.writeFileSync(savedFilename, "[]", "utf8", (err) => {
              if (err) {
                console.error("An error occurred:", err);
                return;
              }
              console.log("JSON file has been saved.");
            });
          }

          for (const mt of meta.slice(data.length)) {
            let product = await get_product(page, mt);

            // handle brand error
            while (brandname !== product.brand)
              product = await get_product(page, mt);

            data.push(product);
            // download images
            const images = await get_images(product);
            for (const img of images) {
              if (img) {
                const format = img.split(".")[img.split(".").length - 1];
                if (format !== "pdf") {
                  // wait by download page is ready
                  while (download_flag) await sleep(300);

                  await sleep(100);
                  await download_page.goto(img);
                }
              }
            }

            const jsonContent = JSON.stringify(data, null, 2);
            fs.writeFileSync(savedFilename, jsonContent, "utf8", (err) => {
              if (err) {
                console.error("An error occurred:", err);
                return;
              }
              console.log("JSON file has been saved.");
            });
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
