const express = require("express");
const { 
    registerDoctor, 
    loginDoctor,
    viewProfile,
    updateDetails,
    addAvailability,
    getDoctorAppointments,
    updateAppointment,
    cancelAppointment,
    forgotPasswordDoctor,
    resetPasswordDoctor 
} = require("../controllers/doctorController");
const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerDoctor);
router.post("/login", loginDoctor);
router.get('/profile/:doctorId',authenticate,viewProfile);
router.patch('/update-details',authenticate,updateDetails);
router.post("/add-availability", authenticate, addAvailability);
router.post('/appointments/:doctorId',authenticate,getDoctorAppointments);
router.patch("/update-appointment/:appointmentId", updateAppointment);
router.delete('/delete-appointment/:appointmentId',cancelAppointment);

router.post("/forgot-password", forgotPasswordDoctor);
router.post("/reset-password/:token", resetPasswordDoctor);


module.exports = router;
