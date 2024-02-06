const fs = require("fs-extra");
const path = require("path");
const globalVariable = require("../global/global");

exports.status = async (req, res) => {
  if (globalVariable.child) {
    res.status(201).json({ result: true, site: globalVariable.site });
  } else {
    res.status(201).json({ result: false, site: "" });
  }
};

exports.pause = async (req, res) => {
  try {
    if (globalVariable.child) {
      process.kill(-globalVariable.child.pid);
      globalVariable.child = null;
      res.status(201).json({ result: "paused scraping!" });
    } else {
      res.status(400).json({ result: "scraping is not running!" });
    }
  } catch (err) {
    console.log("stop error: ", err);
    res.status(500).json(err);
  }
};

exports.stop = async (req, res) => {
  try {
    if (globalVariable.child) {
      process.kill(-globalVariable.child.pid);
      globalVariable.child = null;
      await fs.emptydir(
        path.join(__dirname, `../engine/${globalVariable.site}/assets`)
      );
      res.status(201).json({ result: "stopped scraping!" });
    } else {
      res.status(400).json({ result: "scraping is not running!" });
    }
  } catch (err) {
    console.log("stop error: ", err);
    res.status(500).json(err);
  }
};
