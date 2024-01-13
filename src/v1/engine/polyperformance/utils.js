const fs = require("fs");
const path = require("path");

exports.get_progress = async () => {
  let progress = {
    brands: 0.0,
    metadata: 0.0,
    details: 0.0,
  };

  // get brands process
  let numberofbrands = 0;
  if (fs.existsSync(path.join(__dirname, "./assets/brands.json"))) {
    progress["brands"] = 100.0;
    numberofbrands = JSON.parse(
      fs.readFileSync(path.join(__dirname, "./assets/brands.json"), "utf8")
    ).length;
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
