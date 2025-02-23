// Load environment variables
require("dotenv").config();

// Import dependencies
const express = require("express");
const cors = require("cors");
const connectDb = require("./config/db");

// Import routes
const doctorRoutes = require("./routes/doctorRoutes");
const patientRoutes = require("./routes/patientRoutes");

// Initialize Express app
const app = express();

// Middleware
app.use(express.json()); 
app.use(cors()); 

// Connect to MongoDB
connectDb();

// Define routes
app.use("/api/doctors", doctorRoutes);
app.use("/api/patients", patientRoutes);

// Default route
app.get("/", (req, res) => {
    res.send("Hospital Appointment System API is running...");
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
