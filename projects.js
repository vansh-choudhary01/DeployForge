import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
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