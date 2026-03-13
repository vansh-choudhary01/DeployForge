import Deployment from "../models/Deployment.js";
import Service from "../models/Service.js";
import Project from "../models/Project.js";

export async function getDeployment(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({ message: 'Deployment not found' });
    }

    const service = await Service.findById(deployment.service);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    return res.json({
      message: 'Deployment found',
      data: deployment
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function getDeploymentLogs(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return res.status(404).json({ message: 'Deployment not found' });
    }

    const service = await Service.findById(deployment.service);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    return res.json({
      message: 'Deployment logs retrieved',
      data: deployment.logs,
      status: deployment.status,
      deploymentId: deployment._id
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}
