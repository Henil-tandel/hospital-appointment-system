const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { validationResult, check } = require("express-validator");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

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
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, age, gender } = req.body;
        const existingPatient = await Patient.findOne({ email });
        if (existingPatient) {
            return res.status(400).json({ message: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const patient = new Patient({ name, email, password: hashedPassword, age, gender });
        await patient.save();

        res.status(201).json({ message: "Patient registered successfully" });
    } catch (error) {
        console.error("Error registering patient:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Patient Login
exports.loginPatient = async (req, res) => {
    try {
        await check("email", "Valid email is required").isEmail().run(req);
        await check("password", "Password is required").notEmpty().run(req);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        const patient = await Patient.findOne({ email });
        if (!patient || !(await bcrypt.compare(password, patient.password))) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign({ id: patient._id, role: "patient" }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ message: "Login successful", token });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Search for Doctors by Specialization & Availability
exports.searchDoctors = async (req, res) => {
    try {
        const { specialization, date, timeSlot } = req.query;
        if (!specialization || !date || !timeSlot) {
            return res.status(400).json({ message: "Specialization, date, and timeSlot are required" });
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
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Search for Doctors by Specialization
exports.searchDoctorsBySpecialization = async (req, res) => {
    try {
        const { specialization } = req.query;
        if (!specialization) {
            return res.status(400).json({ message: "Specialization is required" });
        }

        const doctors = await Doctor.find({ specialization });
        res.json(doctors);
    } catch (error) {
        console.error("Error fetching doctors:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Book an Appointment
exports.bookAppointment = async (req, res) => {
    try {
        await check("patientId", "Patient ID is required").notEmpty().run(req);
        await check("doctorId", "Doctor ID is required").notEmpty().run(req);
        await check("date", "Valid date is required").isISO8601().run(req);
        await check("timeSlot", "Time slot is required").notEmpty().run(req);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { patientId, doctorId, date, timeSlot } = req.body;
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

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

        if (!slotFound) return res.status(400).json({ message: "Time slot not available" });
        await doctor.save();

        const appointment = new Appointment({ patientId, doctorId, date, timeSlot });
        await appointment.save();

        res.status(201).json({ message: "Appointment booked successfully" });
    } catch (error) {
        console.error("Error booking appointment:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// View Patient's Appointments
exports.getAppointments = async (req, res) => {
    try {
        const { patientId } = req.params;
        if (!patientId) return res.status(400).json({ message: "Patient ID is required" });

        const appointments = await Appointment.find({ patientId }).populate("doctorId", "name specialization");
        res.json(appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Cancel Appointment
exports.cancelAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        if (!appointmentId) return res.status(400).json({ message: "Appointment ID is required" });

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) return res.status(404).json({ message: "Appointment not found" });

        const doctor = await Doctor.findById(appointment.doctorId);
        if (!doctor) return res.status(404).json({ message: "Doctor not found" });

        doctor.availability.forEach(avail => {
            if (avail.date.toISOString().split("T")[0] === appointment.date.toISOString().split("T")[0]) {
                avail.slots.forEach(slot => {
                    if (slot.startTime === appointment.timeSlot) {
                        slot.booked = false;
                    }
                });
            }
        });

        await doctor.save();
        await Appointment.findByIdAndDelete(appointmentId);
        res.json({ message: "Appointment cancelled successfully" });
    } catch (error) {
        console.error("Error cancelling appointment:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Forgot Password
exports.forgotPasswordPatient = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const patient = await Patient.findOne({ email });
        if (!patient) return res.status(404).json({ message: "Patient not found" });

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
        res.status(500).json({ message: "Internal Server Error" });
    }
};


// Reset Password
exports.resetPasswordPatient = async (req, res) => {
    try {
        await check("password", "Password must be at least 6 characters long").isLength({ min: 6 }).run(req);

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { token } = req.params;
        const { password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: "Token and new password are required" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) return res.status(400).json({ message: "Invalid or expired token" });

        const patient = await Patient.findOne({ email: decoded.email });
        if (!patient) return res.status(404).json({ message: "Patient not found" });

        // Hash and update password
        const hashedPassword = await bcrypt.hash(password, 10);
        patient.password = hashedPassword;
        await patient.save();

        res.json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
