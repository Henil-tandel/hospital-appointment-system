const express = require("express");
const { registerDoctor, loginDoctor, addAvailability, searchDoctors } = require("../controllers/doctorController");
const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerDoctor);
router.post("/login", loginDoctor);
router.post("/add-availability", authenticate, addAvailability);

module.exports = router;
