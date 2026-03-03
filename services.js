import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
    commitMessage: String,
    commitUrl: String,
}, {
    timestamps: true
});

const serviceSchema = new mongoose.Schema({
    serviceId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    publicUrl: {
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
        default: 'npm install && npm run build'
    },
    publishDirectory: {
        type: String,
        default: 'build'
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
        enum: ['pending', 'running', 'success', 'failed', 'deploying'],
        default: 'pending'
    },
    logs: {
        type: [String],
        default: []
    },
    // environment variables
    environmentVariables: {
        type: [{
            key: String,
            value: String
        }],
        default: []
    },
}, {
    timestamps: true
});

export default mongoose.model('Service', serviceSchema);