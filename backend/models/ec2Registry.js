import mongoose from "mongoose";

const ec2RegistrySchema = new mongoose.Schema({
    ip: { type: String, required: true, unique: true },
    region: { type: String, required: true },
    instanceId: { type: String, required: true, unique: true },
    
    // Resource Stats (updated by monitor every 30s)
    cpu: { type: Number, default: 0 }, // percentage
    ram: { type: Number, default: 0 }, // percentage
    disk: { type: Number, default: 0 }, // percentage

    status: {
        type: String,
        enum: ['active', 'full', 'offline', 'stopped'],
        default: 'active',
    },

    // Capacity
    totalServices: { type: Number, default: 0 },

    maxServices: { type: Number, default: process.env.MAX_SERVICES_PER_EC2 || 10 },

    // Timestamps
    lastCheckedAt: Date,
}, {
    timestamps: true,
})

export const Ec2Registry = mongoose.model("Ec2Registry", ec2RegistrySchema);