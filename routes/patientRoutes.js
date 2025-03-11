const express = require("express");
const { 
    registerPatient, 
    loginPatient, 
    viewProfile,
    updateDetails,
    searchDoctors,
    searchDoctorsBySpecialization,
    searchDoctorsByLocation,
    rateDoctor,
    getDoctorsByRating,
    bookAppointment, 
    getAppointments,
    cancelAppointment,
    forgotPasswordPatient,
    resetPasswordPatient 
} = require("../controllers/patientController");
const authenticate = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/register", registerPatient);
router.post("/login", loginPatient);
router.get('/profile/:patientId',authenticate,viewProfile);
router.patch('/update-details',authenticate,updateDetails);
router.get("/search-doctors", searchDoctors);
router.get("/specialization", searchDoctorsBySpecialization);
router.post('/rate-doctor',authenticate,rateDoctor);
router.get('/rating',getDoctorsByRating);
router.get('/location',searchDoctorsByLocation);
router.post("/book-appointment", authenticate, bookAppointment);
router.get("/appointments/:patientId", authenticate, getAppointments);
router.delete("/delete-appointment/:appointmentId", authenticate, cancelAppointment);
router.post("/forgot-password", forgotPasswordPatient);
router.post("/reset-password/:token", resetPasswordPatient);

module.exports = router;
