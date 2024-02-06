const router = require("express").Router();
const utilsController = require("../controllers/utils.controller");

router.get("/status", utilsController.status);
router.get("/stop", utilsController.stop);
router.get("/pause", utilsController.pause);

module.exports = router;
