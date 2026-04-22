import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
    commitMessage: String,
    commitUrl: String,
}, {
    timestamps: true
});

const serviceSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    subdomain: {
        type: String,
    },
    publicUrl: {
        type: String,
    },
    imageUrl: {
        type: String,
    },
    events: {
        type: [eventSchema],
        default: []
    },
    // service details like environment variables, build commands, etc. can be added here
    region: {
        type: String,
        default: 'us-east-1'
    },
    instanceType: {
        type: {
            type: String,
            enum: ['free', 'paid'],
            default: 'free'
        },
        cpus: {
            type: Number,
            default: 0.1
        },
        memory: {
            type: Number,
            default: 512
        },
        memoryType: {
            type: String,
            enum: ['GB', 'MB'],
            default: 'MB'
        }
    },

    // build and deploy details
    gitRepositoryUrl: {
        type: String,
        required: true
    },
    gitBranch: {
        type: String,
        default: 'master'
    },
    rootDirectory: {
        type: String,
        default: '/'
    },
    buildCommand: {
        type: String,
        default: ''
    },
    preDeployCommand: {
        type: String,
        default: ''
    },
    startCommand: {
        type: String,
        default: 'npm start'
    },
    healthCheckPath: {
        type: String,
        default: '/'
    },
    status: {
        type: String,
        enum: ['pending', 'building', 'deploying', 'running', 'sleeping', 'failed', 'stopped', 'waking'],
        default: 'pending'
    },
    logs: [{
        message: String,
        timestamp: Date
    }],
    // environment variables
    environmentVariables: {
        type: [{
            key: String,
            value: String
        }],
        default: []
    },
    port: {
        type: Number
    },
    servicePort: {
        type: Number
    },
    currentDeployment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Deployment"
    },
    deploymentNumber: {
        type: Number,
        default: 0
    },
    lastRequestAt: {
        type: Date,
        default: Date.now
    },
    ec2Host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ec2Registry'
    }
}, {
    timestamps: true
});

export default mongoose.model('Service', serviceSchema);