const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult, check } = require("express-validator");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const nodemailer = require("nodemailer");
const { successResponse, errorResponse } = require('../utils/responseFormatter')

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Register Doctor
exports.registerDoctor = async (req, res) => {
    try {
        await check("email", "Valid email is required").isEmail().run(req);
        await check("password", "Password must be at least 6 characters long").isLength({ min: 6 }).run(req);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return errorResponse(res, 422, "Validation failed", errors.array());
        }

        const { name, email, password, specialization, experience, location } = req.body;
        const existingDoctor = await Doctor.findOne({ email });
        if (existingDoctor) {
            return errorResponse(res, 409, "Doctor already registered with this email");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const doctor = new Doctor({ name, email, password: hashedPassword, specialization, experience, location });
        await doctor.save();

        return successResponse(res, 201, "Doctor registered successfully", doctor);
    } catch (error) {
        console.error("Error registering doctor:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Doctor Login
exports.loginDoctor = async (req, res) => {
    try {
        await check("email", "Valid email is required").isEmail().run(req);
        await check("password", "Password is required").notEmpty().run(req);
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return errorResponse(res, 422, "Validation failed", errors.array());
        }

        const { email, password } = req.body;
        const doctor = await Doctor.findOne({ email });
        if (!doctor || !(await bcrypt.compare(password, doctor.password))) {
            return errorResponse(res, 401, "Invalid email or password");
        }

        const token = jwt.sign({ id: doctor._id, role: "doctor" }, process.env.JWT_SECRET, { expiresIn: "1d" });

        return successResponse(res, 200, "Login successful", { token, id: doctor._id, name: doctor.name });
    } catch (error) {
        console.error("Error logging in:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Get Doctor Profile
exports.viewProfile = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const doctor = await Doctor.findById(doctorId).select("-password");
        if (!doctor) {
            return errorResponse(res, 404, "Doctor not found");
        }
        return successResponse(res, 200, "Doctor profile retrieved", doctor);
    } catch (error) {
        console.error("Error fetching profile:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Update Doctor Details
exports.updateDetails = async (req, res) => {
    try {
        const { doctorId, name, specialization, experience, location } = req.body;

        const updatedDoctor = await Doctor.findByIdAndUpdate(
            doctorId,
            { name, specialization, experience, location },
            { new: true, runValidators: true }
        );

        if (!updatedDoctor) {
            return errorResponse(res, 404, "Doctor not found");
        }

        return successResponse(res, 200, "Doctor details updated successfully", updatedDoctor);
    } catch (error) {
        console.error("Error updating details:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Add Availability
exports.addAvailability = async (req, res) => {
    try {
        const { doctorId, date, slots } = req.body;

        const formattedSlots = slots.map(slot => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            booked: slot.booked || false
        }));

        await Doctor.findByIdAndUpdate(doctorId, {
            $push: { availability: { date: new Date(date), slots: formattedSlots } }
        });

        return successResponse(res, 200, "Availability updated successfully");
    } catch (error) {
        console.error("Error updating availability:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Fetch Doctor's Appointments
exports.getDoctorAppointments = async (req, res) => {
    try {
        const { doctorId } = req.params;

        const appointments = await Appointment.find({ doctorId }).populate("patientId", "name age gender");
        return successResponse(res, 200, "Appointments retrieved successfully", appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Update Appointment
exports.updateAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { date, time, status } = req.body;

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return errorResponse(res, 404, "Appointment not found");
        }

        if (date) appointment.date = date;
        if (time) appointment.time = time;
        if (status) appointment.status = status;

        await appointment.save();
        return successResponse(res, 200, "Appointment updated successfully");
    } catch (error) {
        console.error("Error updating appointment:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Cancel Appointment
exports.cancelAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return errorResponse(res, 404, "Appointment not found");
        }

        await Appointment.findByIdAndDelete(appointmentId);
        return successResponse(res, 200, "Appointment cancelled successfully");
    } catch (error) {
        console.error("Error cancelling appointment:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Forgot Password
exports.forgotPasswordDoctor = async (req, res) => {
    try {
        const { email } = req.body;
        const doctor = await Doctor.findOne({ email });
        if (!doctor) return errorResponse(res, 404, "Doctor not found");

        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: "Password Reset Request",
            text: `Click on the link to reset your password: http://localhost:5000/api/doctors/reset-password/${token}`
        };

        await transporter.sendMail(mailOptions);
        return successResponse(res, 200, "Password reset link sent successfully");
    } catch (error) {
        console.error("Error sending email:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Reset Password
exports.resetPasswordDoctor = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const doctor = await Doctor.findOne({ email: decoded.email });
        if (!doctor) return errorResponse(res, 404, "Doctor not found");

        doctor.password = await bcrypt.hash(password, 10);
        await doctor.save();

        return successResponse(res, 200, "Password reset successfully");
    } catch (error) {
        console.error("Error resetting password:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};
