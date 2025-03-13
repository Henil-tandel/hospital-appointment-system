const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { validationResult, check } = require("express-validator");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const { successResponse , errorResponse } = require("../utils/responseFormatter");
const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Register Patient
exports.registerPatient = async (req, res) => {
    try {
        await check("email", "Valid email is required").isEmail().run(req);
        await check("password", "Password must be at least 6 characters").isLength({ min: 6 }).run(req);
        await check("age", "Age must be a number").isNumeric().run(req);
        await check("gender", "Gender is required").notEmpty().run(req);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return errorResponse(res, 422, "Validation failed", errors.array());
        }

        const { name, email, password, age, gender } = req.body;
        const existingPatient = await Patient.findOne({ email });
        if (existingPatient) {
            return errorResponse(res, 409, "Patient already registered with this email");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const patient = new Patient({ name, email, password: hashedPassword, age, gender });
        await patient.save();

        return successResponse(res, 201, "Patient registered successfully");
    } catch (error) {
        console.error("Error registering patient:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Patient Login
exports.loginPatient = async (req, res) => {
    try {
        await check("email", "Valid email is required").isEmail().run(req);
        await check("password", "Password is required").notEmpty().run(req);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return errorResponse(res, 422, "Validation failed", errors.array());
        }

        const { email, password } = req.body;
        const patient = await Patient.findOne({ email });
        if (!patient || !(await bcrypt.compare(password, patient.password))) {
            return errorResponse(res, 400, "Invalid email or password");
        }

        const token = jwt.sign({ id: patient._id, role: "patient" }, process.env.JWT_SECRET, { expiresIn: "1d" });
        return successResponse(res, 200, "Login successful", { token, id: patient._id, name: patient.name });
    } catch (error) {
        console.error("Error logging in:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

//Get Profile
exports.viewProfile = async(req,res) => {
    try { 
        const { patientId } = req.params;
        const patient = await Patient.findById(patientId).select("-password");
        if(!patient) { 
            return errorResponse(res, 404, "Patient not found");
        }
        return successResponse(res, 200, "Patient profile retrieved", patient);
    }
    catch (error) {
        console.error("Error updating details:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
} 

// Update Patient Details
exports.updateDetails = async (req, res) => {
    try {
        await check("patientId", "Patient ID is required").notEmpty().run(req);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return errorResponse(res, 422, "Validation failed", errors.array());
        }

        const { patientId, name, age, gender } = req.body;

        const updatedPatient = await Patient.findByIdAndUpdate(
            patientId,
            { name, age , gender },
            { new: true, runValidators: true }
        );

        if (!updatedPatient) {
            return errorResponse(res, 404, "Patient not found");
        }

        return successResponse(res, 200, "Patient details updated successfully", updatedPatient);
    } catch (error) {
        console.error("Error updating details:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};


exports.searchDoctors = async (req, res) => {
    try {
        const { specialization, date, timeSlot } = req.query;
        if (!specialization || !date || !timeSlot) {
            return errorResponse(res, 400, "Specialization, date, and timeSlot are required");
        }

        const availableDoctors = await Doctor.find({
            specialization,
            "availability.date": date,
            "availability.slots.startTime": timeSlot,
            "availability.slots.booked": false
        });

        res.json(availableDoctors);
    } catch (error) {
        console.error("Error fetching doctors:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

//Search by specialization
exports.searchDoctorsBySpecialization = async (req, res) => {
    try {
        const { specialization } = req.query;
        if (!specialization) return errorResponse(res, 400, "Specialization is required");

        const doctors = await Doctor.find({ specialization });
        res.json(doctors);
    } catch (error) {
        console.error("Error fetching doctors:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

//Search doctors by location 

exports.searchDoctorsByLocation = async (req, res) => {
    try {
        const { location } = req.query;
        if (!location) return errorResponse(res, 400, "Location is required");

        const doctors = await Doctor.find({ location });
        if (!doctors.length) return errorResponse(res, 404, "No doctors found in this location");

        res.json(doctors);
    } catch (error) {
        console.error("Error fetching doctors:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Rate a doctor 
exports.rateDoctor = async (req, res) => {
    try {
        const { patientId, doctorId, rating, comment } = req.body;

        if (!patientId || !doctorId || rating === undefined) {
            return errorResponse(res, 400, "Patient ID, Doctor ID, and rating are required");
        }

        if (rating < 0 || rating > 5) return errorResponse(res, 400, "Rating must be between 0 and 5");

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return errorResponse(res, 404, "Doctor not found");

        doctor.rating = ((doctor.rating * doctor.ratingCount) + rating) / (doctor.ratingCount + 1);
        doctor.ratingCount += 1;
        await doctor.save();

        res.json({ message: "Doctor rated successfully", doctor });
    } catch (error) {
        console.error("Error rating doctor:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

//Get doctors by rating 
exports.getDoctorsByRating = async (req, res) => {
    try {
        const { rating } = req.query;
        if (!rating) return errorResponse(res, 400, "Rating is required");

        const doctors = await Doctor.find({ rating: { $gte: rating } }).sort({ rating: -1 });
        res.json(doctors);
    } catch (error) {
        console.error("Error fetching doctors by rating:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Book an appointment 
exports.bookAppointment = async (req, res) => {
    try {
        const { patientId, doctorId, date, timeSlot } = req.body;
        if (!patientId || !doctorId || !date || !timeSlot) {
            return errorResponse(res, 400, "All fields are required");
        }

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return errorResponse(res, 404, "Doctor not found");

        let slotFound = false;
        doctor.availability.forEach(avail => {
            if (avail.date.toISOString().split("T")[0] === date) {
                avail.slots.forEach(slot => {
                    if (slot.startTime === timeSlot && !slot.booked) {
                        slot.booked = true;
                        slotFound = true;
                    }
                });
            }
        });

        if (!slotFound) return errorResponse(res, 400, "Time slot not available");
        await doctor.save();

        const appointment = new Appointment({ patientId, doctorId, date, timeSlot });
        await appointment.save();

        res.status(201).json({ message: "Appointment booked successfully" });
    } catch (error) {
        console.error("Error booking appointment:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// View patient's appointments 
exports.getAppointments = async (req, res) => {
    try {
        const { patientId } = req.params;
        if (!patientId) return errorResponse(res, 400, "Patient ID is required");

        const appointments = await Appointment.find({ patientId }).populate("doctorId", "name specialization");
        res.json(appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

//Cancel an appointment 
exports.cancelAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        if (!appointmentId) return errorResponse(res, 400, "Appointment ID is required");

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) return errorResponse(res, 404, "Appointment not found");

        await Appointment.findByIdAndDelete(appointmentId);
        res.json({ message: "Appointment cancelled successfully" });
    } catch (error) {
        console.error("Error cancelling appointment:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

//Forgot password 
exports.forgotPasswordPatient = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return errorResponse(res, 400, "Email is required");

        const patient = await Patient.findOne({ email });
        if (!patient) return errorResponse(res, 404, "Patient not found");

        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: "Password Reset Request",
            text: `Reset your password: http://localhost:5000/api/patients/reset-password/${token}`
        });

        res.json({ message: "Password reset link sent" });
    } catch (error) {
        console.error("Error sending reset email:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};  

//Reset password
exports.resetPasswordPatient = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token || !password) {
            return errorResponse(res, 400, "Token and new password are required");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) return errorResponse(res, 400, "Invalid or expired token");

        const patient = await Patient.findOne({ email: decoded.email });
        if (!patient) return errorResponse(res, 404, "Patient not found");

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);
        patient.password = hashedPassword;
        await patient.save();

        res.json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("Error resetting password:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};
