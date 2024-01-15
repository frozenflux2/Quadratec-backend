const { spawn } = require("child_process");
const path = require("path");
const process = require("process");
const utils = require("../engine/quadratec/utils");
const globalVariable = require("../global/global");

let core_path = path.join(__dirname, "../engine/quadratec/quadratec.core.js");

exports.start = async (req, res) => {
  try {
    if (globalVariable.child) {
      process.kill(-child.pid);
      globalVariable.child = null;
      globalVariable.site = null;
    }
    globalVariable.child = spawn("node", [core_path], { detached: true });
    globalVariable.site = "quadratec";

    // Listen for any response from the child process
    globalVariable.child.stdout.on("data", function (data) {
      console.log("stdout: " + data);
    });

    // Listen for any errors:
    globalVariable.child.stderr.on("data", function (data) {
      console.log("stderr: " + data);
    });

    // Listen for any exit code:
    globalVariable.child.on("close", function (code) {
      console.log("closing code: " + code);
      globalVariable.child = null;
      globalVariable.site = null;
    });

    process.on("exit", function () {
      try {
        if (globalVariable.child) {
          process.kill(-globalVariable.child.pid);
          globalVariable.child = null;
        }
      } catch (error) {}
    });

    process.on("SIGINT", function () {
      // for Ctrl+C interruption
      try {
        if (globalVariable.child) {
          process.kill(-globalVariable.child.pid);
          globalVariable.child = null;
        }
      } catch (error) {}
      process.exit(); // optional, if you want the parent process to exit irrespective of any still running child processes
    });

    process.on("uncaughtException", function () {
      // for uncaught exceptions
      try {
        if (globalVariable.child) {
          process.kill(-globalVariable.child.pid);
          globalVariable.child = null;
        }
      } catch (error) {}
      process.exit();
    });

    res.status(201).json({ result: "started quadratec scraping!" });
  } catch (err) {
    console.log("start err: ", err);
    res.status(500).json(err);
  }
};

exports.progress = async (req, res) => {
  try {
    const progress = await utils.get_progress();
    res.status(201).json({ result: progress });
  } catch (err) {
    console.log("get progress: ", err);
    res.status(500).json(err);
  }
};

exports.download = async (req, res) => {
  try {
    const downloadPath = await utils.getCSV();
    res.download(downloadPath);
  } catch (error) {
    console.log("download err: ", error);
    res.status(400).json({ result: "Can't download!!" });
  }
};
