const fs = require("fs");
const path = require("path");
const Papa = require("papaparse"); // Including papaparse for CSV operations
const JSZip = require("jszip");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

exports.get_progress = async () => {
  let progress = {
    brands: 0.0,
    metadata: 0.0,
    details: 0.0,
  };

  // get brands process
  let numberofbrands = 0;
  if (fs.existsSync(path.join(__dirname, "./assets/brands.json"))) {
    numberofbrands = JSON.parse(
      fs.readFileSync(path.join(__dirname, "./assets/brands.json"), "utf8")
    ).length;

    progress["brands"] =
      (JSON.parse(
        fs.readFileSync(path.join(__dirname, "./assets/tree.json"), "utf8")
      ).length /
        JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "./assets/categories.json"),
            "utf8"
          )
        ).length) *
      100;
  } else {
    return progress;
  }

  // get metadata process
  if (fs.existsSync(path.join(__dirname, "./assets/metadata.json"))) {
    progress["metadata"] =
      (JSON.parse(
        fs.readFileSync(path.join(__dirname, "./assets/metadata.json"), "utf8")
      ).length /
        numberofbrands) *
      100;
  } else {
    return progress;
  }

  // get details process
  if (
    fs.existsSync(path.join(__dirname, "./assets/data")) &&
    progress["metadata"] == 100.0
  )
    progress["details"] =
      (fs.readdirSync(path.join(__dirname, "./assets/data")).length /
        numberofbrands) *
      100;

  return progress;
};

function getNewData(data) {
  const producturls = data.map((x) => x["url"]);

  const new_data = [];
  for (let dt of data) {
    let new_options = dt["options"];
    if (new_options.length > 1) {
      new_options = new_options.slice(1);
    }

    if (dt["url"] !== dt["parent_url"] && dt["parent_url"] !== "") {
      try {
        const id = producturls.indexOf(dt["parent_url"]);
        new_data.push({
          options: new_options,
          brand: dt["brand"],
          tree: data[id].tree,
          name: data[id]["name"],
          url: dt["url"],
          description: dt["description"],
        });
      } catch (error) {
        new_data.push({
          options: new_options,
          brand: dt["brand"],
          tree: dt.tree,
          name: dt["name"],
          url: dt["url"],
          description: dt["description"],
        });
      }
    } else {
      new_data.push({
        options: new_options,
        brand: dt["brand"],
        tree: dt.tree,
        name: dt["name"],
        url: dt["url"],
        description: dt["description"],
      });
    }
  }

  return new_data;
}

function removeDuplicatedData(data) {
  const skus = {};
  const new_data = [];

  for (let dt of data) {
    skus[dt["name"]] = [];
  }

  for (let dt of data) {
    const new_options = dt["options"].filter((op) => {
      if (!skus[dt["name"]].includes(op["skuNumber"])) {
        skus[dt["name"]].push(op["skuNumber"]);
        return true;
      }
      return false;
    });

    if (new_options.length > 0) {
      new_data.push({
        options: new_options,
        brand: dt["brand"],
        tree: dt.tree,
        name: dt["name"],
        url: dt["url"],
        description: dt["description"],
      });
    }
  }

  return new_data;
}

function refactor(data) {
  let refactoredData = [];
  let count = 0;

  data.forEach((dt) => {
    const handle = dt.url.split("https://www.polyperformance.com/")[1];
    const title = dt.name;
    const body = dt.description
      .replaceAll("“", '"')
      .replaceAll("”", '"')
      .replaceAll("‘", "'")
      .replaceAll("’", "'")
      .replaceAll("–", "-")
      .replaceAll("—", "-")
      .replaceAll("″", '"')
      .replaceAll(
        "<a href=",
        '<a style="color: blue; text-decoration: underline;" href='
      );

    let tree = "";
    try {
      tree = dt.tree.split("/");
    } catch (err) {
      console.log(dt);
    }
    const type = tree[tree.length - 1];
    const tags = "Poly Performance," + tree.join(",");
    const vendor = dt.brand;

    dt.options.forEach((option, oid) => {
      const skunumber = "POL-" + option.skuNumber;
      let finalprice = option.finalprice;
      let oldprice = option.oldprice || "0";

      let num_finalprice = parseFloat(finalprice.replace(/,/g, ""));
      let num_oldprice = parseFloat(oldprice.replace(/,/g, ""));
      if (isNaN(num_finalprice)) num_finalprice = 0;

      if (num_oldprice > num_finalprice * 1.7) {
        oldprice = finalprice;
        count++;
      }
      if (num_oldprice === 0 || num_oldprice < num_finalprice) {
        oldprice = finalprice;
      }
      const optionname = option.skuNumber;

      option.images.forEach((img, i) => {
        let tempPd = {
          Handle: handle,
          Title: title,
          "Body (HTML)": body,
          Vendor: vendor,
          "Product Category": "Vehicles & Parts > Vehicle Parts & Accessories",
          Type: type,
          Tags: tags,
          Published: "",
          "Option1 Name": "Part #",
          "Option1 Value": optionname,
          "Variant SKU": skunumber,
          "Variant Price": finalprice,
          "Variant Compare At Price": oldprice,
          "Variant Requires Shipping": "TRUE",
          "Variant Taxable": "TRUE",
          "Variant Barcode": "",
          "Image Src": img,
          "Image Position": i + 1,
          "Image Alt Text": "",
          "Gift Card": "",
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
          "Variant Image": i === 0 ? option.images[0] : "",
          "Variant Weight Unit": "",
          "Variant Tax Code": "",
          "Cost per item": "",
          "Included / United States": "",
          "Price / United States": "",
          "Compare At Price / United States": "",
          "Included / International": "",
          "Price / International": "",
          "Compare At Price / International": "",
          Status: "active",
        };

        // options logic
        if (
          optionname === "original" ||
          dt.options.length === 1 ||
          oid !== 0 ||
          i !== 0
        ) {
          tempPd["Option1 Name"] = "";
        }

        if (dt.options.length === 1) tempPd["Option1 Value"] = "";

        if (oid !== 0) {
          tempPd.Title = "";
          tempPd["Body (HTML)"] = "";
          tempPd.Vendor = "";
          tempPd.Type = "";
        }

        if (i !== 0) {
          tempPd.Title = "";
          tempPd["Body (HTML)"] = "";
          tempPd.Vendor = "";
          tempPd.Type = "";
          tempPd.Tags = "";
          tempPd["Option1 Value"] = "";
          tempPd["Variant SKU"] = "";
          tempPd["Variant Price"] = "";
          tempPd["Variant Compare At Price"] = "";
          tempPd["Product Category"] = "";
          tempPd["Variant Requires Shipping"] = "";
          tempPd["Variant Taxable"] = "";
          tempPd["Status"] = "";
        }

        refactoredData.push(tempPd);
      });
    });
  });

  console.log(count);
  return refactoredData;
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

function convertToCSV(data, outputPath) {
  // Here you would implement or use a library to write the CSV.
  // Since papaparse is a popular choice, this example will use it.

  const csv = "\ufeff" + Papa.unparse(data);
  fs.writeFileSync(outputPath, csv, "utf8");
  console.log(
    `The JSON data has been successfully converted to '${outputPath}'.`
  );
}

exports.getCSV = async () => {
  const brands = JSON.parse(
    fs.readFileSync(path.join(__dirname, "./assets/brands.json"), "utf8")
  );
  let data = [];
  for (let bd of brands) {
    if (
      fs.existsSync(path.join(__dirname, `./assets/data/${bd["name"]}.json`))
    ) {
      const brandData = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, `./assets/data/${bd["name"]}.json`),
          "utf8"
        )
      );
      data = data.concat(brandData);
    }
  }
  const newData = getNewData(data);
  const removedData = removeDuplicatedData(newData);
  const refactoredData = refactor(removedData);
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
