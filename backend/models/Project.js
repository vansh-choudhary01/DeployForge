import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
    projectId: {
        type: String,
        required: true,
        unique: true
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
    services: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Service',
        required: true,
        default: []
    }
});

projectSchema.index({ "projectId": 1 });
projectSchema.index({ "user": 1 });

export default mongoose.model('Project', projectSchema);