const fs = require("fs");
const path = require("path");
const Papa = require("papaparse"); // Including papaparse for CSV operations
const JSZip = require("jszip");
const puppeteer = require("puppeteer");
const { randomUUID } = require("crypto");
const XLSX = require("xlsx");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function arraysEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function countElementInList(target, elemntList) {
  let count = 0;

  elemntList.forEach((ele) => {
    if (ele === target) count++;
  });

  return count;
}

async function count_files(dir) {
  let count = 0;
  const subdirs = fs.readdirSync(dir);

  for (const sd of subdirs) {
    const fullPath = `${dir}/${sd}`;
    if (fs.statSync(fullPath).isFile()) {
      count += 1;
    } else {
      count += fs.readdirSync(fullPath).length;
    }
  }

  return count;
}

async function clean_file(file) {
  if (!file["completed"]) {
    file["completed"] = true;

    let data = [];
    for (const subcat of categories["data"]) data = data.concat(subcat);
    file["data"] = data;

    const jsonContent = JSON.stringify(file, null, 2);

    fs.writeFileSync(
      path.join(__dirname, "./assets/categories.json"),
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

async function clean_dir(dir) {
  const subdirs = fs.readdirSync(dir);

  for (const sd of subdirs) {
    const fullPath = `${dir}/${sd}`;
    if (!fs.statSync(fullPath).isFile()) {
      const files = fs.readdirSync(fullPath);

      for (const f of files) {
        fs.renameSync(`${fullPath}/${f}`, `${dir}/${f}`);
      }
      fs.rmdirSync(fullPath);
    }
  }
}

exports.get_progress = async () => {
  let progress = {
    brands: 0.0,
    categories: 0.0,
    metadata: 0.0,
    details: 0.0,
  };

  // get brands process
  let numberofbrands = 0;
  if (fs.existsSync(path.join(__dirname, `./assets/brands.json`))) {
    progress["brands"] = 100.0;
    numberofbrands = JSON.parse(
      fs.readFileSync(path.join(__dirname, "./assets/brands.json"), "utf8")
    ).length;
  } else {
    return progress;
  }

  if (fs.existsSync(path.join(__dirname, `./assets/categories.json`))) {
    // get categories process
    const categories = JSON.parse(
      fs.readFileSync(path.join(__dirname, "./assets/categories.json"), "utf8")
    );
    if (categories["completed"])
      progress["categories"] =
        (categories["data"].length / numberofbrands) * 100;
    else {
      let count = 0;
      for (const subcat of categories["data"]) count += subcat.length;
      progress["categories"] = (count / numberofbrands) * 100;
    }
  } else {
    return progress;
  }

  // get metadata process
  if (
    fs.existsSync(path.join(__dirname, `./assets/metadata`)) &&
    progress["categories"] == 100.0
  ) {
    const categories = JSON.parse(
      fs.readFileSync(path.join(__dirname, "./assets/categories.json"), "utf8")
    );
    await clean_file(categories);
    progress["metadata"] =
      ((await count_files(path.join(__dirname, "./assets/metadata"))) /
        numberofbrands) *
      100;
  }

  // get details process
  if (
    fs.existsSync(path.join(__dirname, `./assets/data`)) &&
    progress["metadata"] == 100.0
  ) {
    await clean_dir(path.join(__dirname, `./assets/metadata`));
    progress["details"] =
      ((await count_files(path.join(__dirname, "./assets/data"))) /
        numberofbrands) *
      100;
  }

  // if (progress["details"] == 100)
  //   await clean_dir(path.join(__dirname, "./assets/data"));

  return progress;
};

function parseWeight(input) {
  if (input === "") return "";
  const weightPattern = /([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)/;

  let matches = input.match(weightPattern);

  if (matches && matches.length > 1) {
    // If unit is not provided (empty string), return weight with an empty string as the unit
    return parseFloat(matches[1]) * 453.59237;
  } else {
    throw new Error("Input format is incorrect");
  }
}

function getAllData() {
  const subdirs = fs.readdirSync(path.join(__dirname, "./assets/data"));

  data = [];
  for (const sd of subdirs) {
    const fullPath = path.join(__dirname, `./assets/data/${sd}`);
    if (!fs.statSync(fullPath).isFile()) {
      const filenames = fs.readdirSync(fullPath);
      for (const fn of filenames) {
        const path = `${fullPath}/${fn}`;
        data = data.concat(JSON.parse(fs.readFileSync(path, "utf8")));
      }
    } else {
      data = data.concat(JSON.parse(fs.readFileSync(fullPath, "utf8")));
    }
  }

  return data;
}

function getNewData(data) {
  const new_data = [];
  for (let dt of data) {
    if (
      Array.isArray(dt["options"]) &&
      dt["url"].split("/").length <= 6 &&
      !dt["url"].includes[".htm/"]
    ) {
      let new_options = [];
      for (const op of dt["options"]) {
        if (op["details"] != "not found" && op["details"] != "403 Forbidden") {
          // check if duplicated variations
          let duplicated_flag = false;
          for (const nop of new_options) {
            if (arraysEqual(nop["values"], op["values"])) {
              console.log(dt.url, op["values"]);
              duplicated_flag = true;
              if (nop.finalprice < op.finalprice) {
                console.log("higher", nop["values"]);
                nop.catalognumber = op.catalognumber;
                nop.mfgnumber = op.mfgnumber;
                nop.oldprice = op.oldprice;
                nop.finalprice = op.finalprice;
                nop.suffix = op.suffix;
                nop.instock = op.instock;
                nop.weight = op.weight;
                nop.imgs = op.imgs;
                nop.specs = op.specs;
                nop.values = op.values;
              }
            }
          }
          if (!duplicated_flag) new_options.push(op);
        }
      }
      // if (new_options.length > 1) new_options = new_options.slice(1);
      let new_body = dt.body
        .replace(
          '<html><head></head><body>\n<div >\n<div   id="learn" ><br><h2>Learn More</h2>',
          '<html><head></head><body>\n<div >\n<div   id="learn" ><h2>Learn More</h2>'
        )
        .replace('<div   id="vehicles" ><br><h2>Fitment</h2></div>', "");

      if (
        dt.body.includes(
          '<div   id="learn" ><br><h2>Learn More</h2>\n<div >\n<div >\n'
        )
      )
        new_body = new_body.replace("<div ><br><h3>", "<div ><h3>");

      const counts = new Map(); // This will track the count for each item

      const new_optionnames = [];
      for (const item of dt["optionnames"]) {
        // Get the current count for this item, defaulting to 0 if not yet present
        const count = counts.get(item) || 0;

        // Determine the suffix; if count is 0, we don't add a suffix.
        let suffix = "";
        if (count > 0 || countElementInList(item, dt["optionnames"]) > 1) {
          // ASCII 65 is 'A', so 65 + count is 'A', 'B', 'C', etc.
          suffix = " " + String.fromCharCode(65 + count);
        }

        // Add the updated item to the new_optionnames array
        new_optionnames.push(item + suffix);

        // Update the count for this item in the map
        counts.set(item, count + 1);
      }

      new_data.push({
        options: new_options,
        optionnames: new_optionnames,
        brand: dt["brand"],
        category: dt["category"],
        tree: dt.options[0].tree,
        title: dt["title"],
        url: dt["url"],
        body: new_body,
        body_changed: dt["body_changed"],
      });
    }
  }
  return new_data;
}

function addImages(data) {
  const new_data = [];
  for (const dt of data) {
    let new_options = [];

    let original_images = undefined;
    let new_images = undefined;
    dt.options.forEach((option, oid) => {
      if (oid === 0) {
        original_images = option.imgs.filter((item, index, self) => {
          return self.indexOf(item) === index;
        });
        new_images = original_images.slice();
      } else {
        new_images = original_images.slice();
        if (option.imgs[0] !== "") {
          new_images[0] = option.imgs[0];
        }
      }
      new_options.push({
        catalognumber: option.catalognumber,
        mfgnumber: option.mfgnumber,
        oldprice: option.oldprice,
        finalprice: option.finalprice,
        suffix: option.suffix,
        instock: option.instock,
        weight: option.weight,
        imgs: new_images,
        values: option.values,
      });
    });

    if (new_options.length > 1) new_options = new_options.slice(1);
    new_data.push({
      options: new_options,
      optionnames: dt["optionnames"],
      brand: dt["brand"],
      category: dt["category"],
      tree: dt.tree,
      title: dt["title"],
      url: dt["url"],
      body: dt["body"],
      body_changed: dt["body_changed"],
    });
  }

  return new_data;
}

async function convertImages(data) {
  const image_table = JSON.parse(
    fs.readFileSync(path.join(__dirname, "./assets/image_table.json"), "utf8")
  );

  const browser = await puppeteer.launch({ headless: false });

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
          fs.writeFileSync(`./public/images/${uid}.${format}`, buffer); // Write the buffer to a file
        } catch (error) {
          console.log(page.url());
          console.log(imgurl);
          throw new Error("Page error caught:");
        }

        image_table[imgurl] = `${uid}.${format}`;
        jsonContent = JSON.stringify(image_table, null, 2);
        fs.writeFileSync(
          path.join(__dirname, "./assets/image_table.json"),
          jsonContent,
          "utf8"
        );
      }

      download_flag = false;
    }
  });

  const new_data = [];

  let empty_imgs = 0;
  for (const dt of data) {
    const new_options = [];
    // convert images from options
    for (const option of dt.options) {
      const new_images = [];

      for (const img of option.imgs) {
        if (!img.includes("data:image/gif;")) {
          if (
            !image_table[img] ||
            !fs.existsSync(`./public/images/${image_table[img]}`)
          ) {
            if (empty_imgs > 100) {
              await browser.close();
              throw new Error(
                "Image not found exception: Too many images are empty"
              );
            }
            console.log("image not found", img, dt.url, option.imgs, dt.brand);
            // wait by download page is ready
            while (download_flag) await sleep(300);

            await sleep(100);
            await download_page.goto(img);
            await sleep(1000);

            empty_imgs++;
          }
          new_images.push(`https://gof.ngrok.app/images/${image_table[img]}`);
          // new_images.push(image_table[img]);
        }
      }
      new_options.push({
        catalognumber: option.catalognumber,
        mfgnumber: option.mfgnumber,
        oldprice: option.oldprice,
        finalprice: option.finalprice,
        suffix: option.suffix,
        instock: option.instock,
        weight: option.weight,
        imgs: new_images,
        values: option.values,
      });
    }

    new_data.push({
      options: new_options,
      optionnames: dt["optionnames"],
      brand: dt["brand"],
      tree: dt.tree,
      category: dt["category"],
      title: dt["title"],
      url: dt["url"],
      body: dt.body,
      body_changed: dt.body_changed,
    });
  }

  await browser.close();
  return new_data;
}

function refactor(data) {
  let refactoredData = [];
  let count = 0;

  data.forEach((dt) => {
    const seperatedurl = dt.url.split("/");
    const handle = seperatedurl[seperatedurl.length - 1];
    const title = dt.title;
    const body = dt.body
      .replaceAll("“", '"')
      .replaceAll("”", '"')
      .replaceAll("‘", "'")
      .replaceAll("’", "'")
      .replaceAll("–", "-")
      .replaceAll("—", "-")
      .replaceAll("″", '"');
    if (body.length > 32767) console.log("body characters over", dt.url);
    const type = dt.tree[dt.tree.length - 2];

    const tags =
      "Quadratec," +
      dt.tree
        .slice(1, dt.tree.length - 1)
        .map((ele) => ele.replaceAll(",", ""))
        .join(",")
        .replace("Jeep ", "");
    const vendor = dt.brand;
    const optionnames = dt.optionnames;

    const body_changed = dt["body_changed"];
    let status = "active";
    if (body_changed) {
      console.log("body changed", dt.url);
      status = "draft";
    }

    dt.options.forEach((option, oid) => {
      const mfgnumber = option.mfgnumber;
      const catalognumber = "QUA-" + option.catalognumber;
      const weight = parseWeight(option.weight);
      let finalprice = option.finalprice;
      if (finalprice === "") console.log(dt.url);
      let oldprice = option.oldprice;
      if (oldprice === "") oldprice = finalprice;

      let inventorytracker = "";
      let inventorypolicy = "";
      if (
        option["instock"] === "In Stock" ||
        option["instock"] === "Ships from 3rd Party"
      )
        inventorypolicy = "continue";
      else {
        inventorytracker = "shopify";
        inventorypolicy = "deny";
      }
      const optionvalues = option.values;

      const optionsuffix = option["suffix"];
      const suffixtags = tags + `${optionsuffix ? `,${optionsuffix}` : ""}`;

      option.imgs.forEach((img, i) => {
        let tempPd = {
          Handle: handle,
          Title: title,
          "Body (HTML)": body,
          Vendor: vendor,
          "Product Category": "Vehicles & Parts > Vehicle Parts & Accessories",
          Type: type,
          Tags: suffixtags,
          Published: "",
          "Option1 Name": "",
          "Option1 Value": "",
          "Option2 Name": "",
          "Option2 Value": "",
          "Option3 Name": "",
          "Option3 Value": "",
          "Variant SKU": catalognumber,
          "Variant Grams": weight,
          "Variant Weight Unit": "lbs",
          "Variant Inventory Tracker": inventorytracker,
          "Variant Inventory Policy": inventorypolicy,
          "Variant Fulfillment Service": "manual",
          "Variant Price": finalprice,
          "Variant Compare At Price": oldprice,
          "Variant Requires Shipping": "TRUE",
          "Variant Taxable": "TRUE",
          "Variant Barcode": mfgnumber,
          "Image Src": img,
          "Image Position": i + 1,
          "Image Alt Text": "",
          "Gift Card": "FALSE",
          "SEO Title": "",
          "SEO Description": "",
          "Google Shopping / Google Product Category": "",
          "Google Shopping / Gender": "",
          "Google Shopping / Age Group": "",
          "Google Shopping / MPN": "",
          "Google Shopping / Condition": "",
          "Google Shopping / Custom Product": "",
          "Google Shopping / Custom Label 0": "",
          "Google Shopping / Custom Label 1": "",
          "Google Shopping / Custom Label 2": "",
          "Google Shopping / Custom Label 3": "",
          "Google Shopping / Custom Label 4": "",
          "Variant Image": i === 0 ? option.imgs[0] : "",
          "Variant Tax Code": "",
          "Cost per item": "",
          "Included / United States": "TRUE",
          "Price / United States": "",
          "Compare At Price / United States": "",
          "Included / International": "TRUE",
          "Price / International": "",
          "Compare At Price / International": "",
          Status: status,
        };

        // options logic
        if (
          optionvalues == ["original"] ||
          dt.options.length === 1 ||
          oid + i > 0
        ) {
          tempPd["Option1 Name"] = "";
          tempPd["Option1 Value"] = "";
          tempPd["Option2 Name"] = "";
          tempPd["Option2 Value"] = "";
          tempPd["Option3 Name"] = "";
          tempPd["Option3 Value"] = "";
        }

        if (i !== 0) {
          tempPd.Title = "";
          tempPd["Body (HTML)"] = "";
          tempPd.Vendor = "";
          tempPd.Type = "";
          tempPd.Tags = "";
          tempPd["Variant SKU"] = "";
          tempPd["Variant Inventory Tracker"] = "";
          tempPd["Variant Inventory Policy"] = "";
          tempPd["Variant Fulfillment Service"] = "";
          tempPd["Variant Price"] = "";
          tempPd["Variant Compare At Price"] = "";
          tempPd["Product Category"] = "";
          tempPd["Option1 Name"] = "";
          tempPd["Option2 Name"] = "";
          tempPd["Option3 Name"] = "";
          tempPd["Variant Requires Shipping"] = "";
          tempPd["Variant Taxable"] = "";
          tempPd["Variant Barcode"] = "";
          tempPd["Gift Card"] = "";
          tempPd["Variant Grams"] = "";
          tempPd["Variant Weight Unit"] = "";
          tempPd["Included / United States"] = "";
          tempPd["Included / International"] = "";
          tempPd["Status"] = "";
        }

        if (oid > 0) {
          tempPd.Title = "";
          tempPd["Body (HTML)"] = "";
          tempPd.Vendor = "";
          tempPd.Type = "";
          tempPd["Option1 Name"] = "";
          tempPd["Option2 Name"] = "";
          tempPd["Option3 Name"] = "";
        }
        try {
          if (i === 0 && optionvalues[0] != ["original"]) {
            for (let i = 0; i < optionvalues.length; i++) {
              if (i > 2) {
                tempPd["Option3 Name"] += ` and ${optionnames[i]}`;
                tempPd["Option3 Value"] += ` and ${optionvalues[i]}`;
              } else {
                tempPd[`Option${i + 1} Name`] = optionnames[i];
                tempPd[`Option${i + 1} Value`] = optionvalues[i];
              }
            }
          }
        } catch (error) {
          console.log("empty values", dt.url);
        }
        refactoredData.push(tempPd);
      });
    });
  });

  console.log(count);
  return refactoredData;
}

function convertToCSV(data, outputPath) {
  // Here you would implement or use a library to write the CSV.
  // Since papaparse is a popular choice, this example will use it.

  const csv = "\ufeff" + Papa.unparse(data);
  fs.writeFileSync(outputPath, csv, "utf8");
  console.log(
    `The JSON data has been successfully converted to '${outputPath}'.`
  );
}

const zipFile = (filePath, outputZipPath, compressionLevel = "DEFLATE") => {
  const zip = new JSZip();
  const fileName = path.basename(filePath);

  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      } else {
        zip.file(fileName, data, { compression: compressionLevel });

        // Generate the zip file as a buffer
        zip
          .generateAsync({ type: "nodebuffer", compression: compressionLevel })
          .then((content) => {
            // Wrap fs.writeFile in another Promise
            fs.writeFile(outputZipPath, content, (writeErr) => {
              if (writeErr) {
                reject(writeErr);
              } else {
                console.log(`Zipped file saved to ${outputZipPath}`);
                resolve(); // Resolve the outer Promise
              }
            });
          })
          .catch(reject); // Reject the outer Promise on error here
      }
    });
  });
};

exports.getCSV = async () => {
  console.log("=============================================");
  const data = getAllData();
  const new_data = getNewData(data);
  const addedData = addImages(new_data);
  const convertedData = await convertImages(addedData);
  console.log(data.length);
  console.log(new_data.length);
  console.log(addedData.length);
  console.log(convertedData.length);

  const refactoredData = refactor(convertedData);
  // const worksheet = XLSX.utils.json_to_sheet(refactoredData);
  // const workbook = XLSX.utils.book_new();
  // XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  // Convert the workbook to a binary buffer
  // const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

  // Use fs to write the file to your system
  // console.log(path.join(__dirname, "./assets/output.xlsx"));
  // fs.writeFileSync(path.join(__dirname, "./assets/output.xlsx"), buffer);
  convertToCSV(refactoredData, path.join(__dirname, "./assets/output.csv"));

  try {
    await zipFile(
      path.join(__dirname, "./assets/output.csv"),
      "./public/output.zip"
    );
    console.log("Done zipping");
    return "./public/output.zip";
  } catch (error) {
    console.log("Error on zipping: ", error);
    return null;
  }
};
