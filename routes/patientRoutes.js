const express = require("express");
const { registerPatient, loginPatient, searchDoctors,searchDoctorsBySpecialzation, bookAppointment, getAppointments,forgotPasswordPatient,resetPasswordPatient } 
= require("../controllers/patientController");
const authenticate = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/register", registerPatient);
router.post("/login", loginPatient);
router.get("/search-doctors", searchDoctors);
router.get("/specialization",searchDoctorsBySpecialzation);
router.post("/book-appointment", authenticate, bookAppointment);
router.get("/appointments/:patientId", authenticate, getAppointments);

router.post("/forgot-password", forgotPasswordPatient);
router.post("/reset-password/:token", resetPasswordPatient);

module.exports = router;
