const router = require("express").Router();
const quadratecController = require("../controllers/quadratec.controller");

router.get("/start", quadratecController.start);
router.get("/progress", quadratecController.progress);
router.get("/download", quadratecController.download);

module.exports = router;
