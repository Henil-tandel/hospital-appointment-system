const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const moment = require('moment');
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
        const { doctorId, date, slots, maxBookingsPerSlot } = req.body; // Allow doctors to set max bookings per slot
        const currentTime = moment();
        const availabilityDate = moment(date, "YYYY-MM-DD");

        // Ensure availability is for today or a future date
        if (availabilityDate.isBefore(currentTime, "day")) {
            return errorResponse(res, 400, "Availability must be for today or a future date");
        }

        // Find the doctor
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return errorResponse(res, 404, "Doctor not found");

        let existingAvailability = doctor.availability.find(avail => 
            moment(avail.date).format("YYYY-MM-DD") === date
        );

        const newSlots = slots.filter(slot => {
            const newSlotStartTime = moment(slot.startTime, "HH:mm");

            // If adding availability for today, enforce a 1-hour gap from the current time
            if (availabilityDate.isSame(currentTime, "day") && newSlotStartTime.isBefore(currentTime.add(1, "hour"))) {
                return false;
            }

            // Check for duplicate slots
            if (existingAvailability) {
                return !existingAvailability.slots.some(existingSlot =>
                    moment(existingSlot.startTime, "HH:mm").isSame(newSlotStartTime)
                );
            }

            return true;
        });

        if (newSlots.length === 0) {
            return errorResponse(res, 400, "All requested slots are either duplicates or invalid");
        }

        if (existingAvailability) {
            // Update existing availability with new slots & maxBookingsPerSlot
            await Doctor.updateOne(
                { _id: doctorId, "availability.date": new Date(date) },
                { 
                    $push: { "availability.$.slots": { $each: newSlots } },
                    "availability.$.maxBookingsPerSlot": maxBookingsPerSlot || 5 // Default to 5 if not provided
                }
            );
        } else {
            // Create new availability entry
            await Doctor.findByIdAndUpdate(doctorId, {
                $push: { 
                    availability: { 
                        date: new Date(date), 
                        slots: newSlots, 
                        maxBookingsPerSlot: maxBookingsPerSlot || 5 // Default to 5
                    } 
                }
            });
        }

        return successResponse(res, 200, "Availability added successfully", doctor);
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
        const currentTime = moment();

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return errorResponse(res, 404, "Appointment not found");
        }

        if (date) {
            const newDate = moment(date, "YYYY-MM-DD");

            if (newDate.isBefore(currentTime, "day")) {
                return errorResponse(res, 400, "Updated date must be today or a future date");
            }

            appointment.date = date;
        }

        if (time) {
            const newTime = moment(time, "HH:mm");

            if (moment(appointment.date).isSame(currentTime, "day") && newTime.isBefore(currentTime.add(1, "hour"))) {
                return errorResponse(res, 400, "Updated time must be at least 1 hour ahead of the current time");
            }

            appointment.timeSlot = time;
        }

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
        const { appointmentId } = req.body;

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

// Cancel Availability
exports.cancelAvailability = async (req, res) => {
    try {
        const { doctorId, date } = req.body;
        const availabilityDate = moment(date, "YYYY-MM-DD");

        if (!doctorId || !date) {
            return errorResponse(res, 400, "Doctor ID and date are required");
        }

        // Ensure date is in valid format
        if (!availabilityDate.isValid()) {
            return errorResponse(res, 400, "Invalid date format. Use YYYY-MM-DD");
        }

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return errorResponse(res, 404, "Doctor not found");
        }

        // Remove availability for the given date
        const updatedDoctor = await Doctor.findByIdAndUpdate(
            doctorId,
            { $pull: { availability: { date: new Date(date) } } },
            { new: true }
        );

        return successResponse(res, 200, "Availability canceled successfully", updatedDoctor);
    } catch (error) {
        console.error("Error canceling availability:", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};

// Update Availability
exports.updateAvailability = async (req, res) => {
    try {
        const { doctorId, date, slots } = req.body;
        const availabilityDate = moment(date, "YYYY-MM-DD");
        const currentTime = moment();

        if (!doctorId || !date || !slots || !Array.isArray(slots)) {
            return errorResponse(res, 400, "Doctor ID, date, and valid slots array are required");
        }

        // Ensure date is valid and not in the past
        if (!availabilityDate.isValid() || availabilityDate.isBefore(currentTime, "day")) {
            return errorResponse(res, 400, "Availability date must be today or a future date");
        }

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return errorResponse(res, 404, "Doctor not found");

        let existingAvailability = doctor.availability.find(avail => 
            moment(avail.date).format("YYYY-MM-DD") === date
        );

        const updatedSlots = slots.filter(slot => {
            const slotStartTime = moment(slot.startTime, "HH:mm");

            // If updating availability for today, enforce a 1-hour gap from the current time
            if (availabilityDate.isSame(currentTime, "day") && slotStartTime.isBefore(currentTime.add(1, "hour"))) {
                return false;
            }

            return true;
        });

        if (updatedSlots.length === 0) {
            return errorResponse(res, 400, "All updated slots are either invalid or conflict with timing restrictions");
        }

        if (existingAvailability) {
            // Update existing slots
            await Doctor.updateOne(
                { _id: doctorId, "availability.date": new Date(date) },
                { $set: { "availability.$.slots": updatedSlots } }
            );
        } else {
            // Create new availability if not found
            await Doctor.findByIdAndUpdate(doctorId, {
                $push: { availability: { date: new Date(date), slots: updatedSlots } }
            });
        }

        return successResponse(res, 200, "Availability updated successfully");
    } catch (error) {
        console.error("Error updating availability:", error);
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
