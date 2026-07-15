import mongoose from "mongoose";

const deploymentSchema = new mongoose.Schema({

  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true
  },

  status: {
    type: String,
    enum: ["queued", "building", "deploying", "running", "failed"],
    default: "queued"
  },

  commitHash: String,

  commitMessage: String,

  logs: [String],

  dockerImage: String,

  containerId: String,

  port: Number,

  deployedUrl: String,

  duration: Number, // in seconds

  error: String,

  diagnosis: {
    summary: String,
    likelyCause: String,
    suggestedSteps: [String],
    retryable: Boolean,
    source: String
  },

}, { timestamps: true });

export default mongoose.model("Deployment", deploymentSchema);