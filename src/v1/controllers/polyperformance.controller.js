const { spawn } = require("child_process");
const path = require("path");
const process = require("process");
const utils = require("../engine/polyperformance/utils");

let core_path = path.join(
  __dirname,
  "../engine/polyperformance/polyperformance.core.js"
);
let child = null;

exports.start = async (req, res) => {
  try {
    if (child) {
      res.status(201).json({ result: "already scraping polyperformance!" });
    } else {
      child = spawn("node", [core_path], { detached: true });

      res.status(201).json({ result: "started polyperformance scraping!" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.progress = async (req, res) => {
  try {
    const progress = await utils.get_progress();
    res.status(201).json({ result: progress });
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.status = async (req, res) => {
  if (child) {
    res.status(201).json({ result: true });
  } else {
    res.status(201).json({ result: false });
  }
};

exports.stop = async (req, res) => {
  try {
    if (child) {
      process.kill(-child.pid);
      child = null;
      res.status(201).json({ result: "stopped polyperformance scraping!" });
    } else {
      res
        .status(400)
        .json({ result: "polyperformance scraping is not running!" });
    }
  } catch (err) {
    res.status(500).json(err);
  }
};
