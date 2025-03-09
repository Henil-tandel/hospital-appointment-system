const express = require("express");
const { registerPatient, loginPatient, searchDoctors,searchDoctorsBySpecialization, bookAppointment, getAppointments,cancelAppointment,forgotPasswordPatient,resetPasswordPatient } 
= require("../controllers/patientController");
const authenticate = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/register", registerPatient);
router.post("/login", loginPatient);
router.get("/search-doctors", searchDoctors);
router.get("/specialization", searchDoctorsBySpecialization);
router.post("/book-appointment", authenticate, bookAppointment);
router.get("/appointments/:patientId", authenticate, getAppointments);
router.delete("/delete-appointment/:appointmentId", authenticate, cancelAppointment);

router.post("/forgot-password", forgotPasswordPatient);
router.post("/reset-password/:token", resetPasswordPatient);

module.exports = router;
