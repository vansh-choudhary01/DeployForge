import mongoose from 'mongoose';

const portSchema = new mongoose.Schema({
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

export default mongoose.model('Port', portSchema);