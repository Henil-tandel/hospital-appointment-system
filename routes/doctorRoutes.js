const express = require("express");
const { registerDoctor, loginDoctor, addAvailability,forgotPasswordDoctor,resetPasswordDoctor } = require("../controllers/doctorController");
const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerDoctor);
router.post("/login", loginDoctor);
router.post("/add-availability", authenticate, addAvailability);


router.post("/forgot-password", forgotPasswordDoctor);
router.post("/reset-password/:token", resetPasswordDoctor);


module.exports = router;
