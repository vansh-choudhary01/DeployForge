import Deployment from "../models/Deployment.js";
import Service from "../models/Service.js";

export async function deployService(req, res) {
  try {
    const {
      owner,
      repo,
      branch,
      private: isPrivate,
      rootDirectory,
      buildCommand,
      publishDirectory,
      preDeployCommand,
      startCommand,
      healthCheckPath,
      commitHash,
      commitMessage,
    } = req.body;
    if (
      !owner ||
      !repo ||
      !branch ||
      !buildCommand ||
      !publishDirectory ||
      !preDeployCommand ||
      !startCommand ||
      !healthCheckPath
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const userId = req.userId;

    const user = req.user;

    let cloneUrl;

    if (isPrivate) {
      const token = user?.gitDeploymentCredentials?.token;
      if (!token) {
        return res.status(400).json({ message: "GitHub not connected" });
      }

      cloneUrl = `https://${token}@github.com/${owner}/${repo}.git`;
    } else {
      cloneUrl = `https://github.com/${owner}/${repo}.git`;
    }

    const service = await Service.create({
      project: req.projectId,
      serviceId: `${owner}-${repo}-${branch}`,
      name: repo,
      gitRepositoryUrl: cloneUrl,
      gitBranch: branch,
      rootDirectory,
      buildCommand,
      publishDirectory,
      preDeployCommand,
      startCommand,
      healthCheckPath,
      status: "pending",
      environmentVariables: [],
      port: 3000,
      logs: [],
    });

    // create deployment job
    const deployment = await Deployment.create({
      service: service._id,
      status: "queued",
      commitHash,
      commitMessage,
      logs: [],
      dockerImage: "",
      containerId: "",
      port: 3000,
      deployedUrl: "",
    });

    return res.json({
      message: "Deployment queued",
      service,
      deployment,
    });
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
}

export function getService(req, res) {}

export function redeployService(req, res) {}

export function deleteService(req, res) {}

export function getServiceLogs(req, res) {}

export function setServiceEnv(req, res) {}

export function deleteServiceEnv(req, res) {}
