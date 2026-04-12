import mongoose from 'mongoose';

const portSchema = new mongoose.Schema({
    subdomain: {
        type: String,
    },
    port: {
        type: Number,
        required: true,
        unique: true
    },
    deployment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deployment',
        required: true
    }
}, {
    timestamps: true
});

portSchema.index({ subdomain: 1, port: 1 });

export default mongoose.model('Port', portSchema);