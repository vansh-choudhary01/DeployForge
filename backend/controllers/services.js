import Deployment from "../models/Deployment.js";
import Service from "../models/Service.js";
import Project from "../models/Project.js";
import { executeSSHCommands } from "../helpers/ssh.js";
import { ensureDockerContainerRunning } from "../helpers/docker.js";
import { getBestEc2 } from "../ec2Host/ec2_deployment.js";
import { migrateService } from "../ec2Host/ec2_consolidation.js";
import { sendToQueue } from "../RabbitMQ/queue.js";

export async function validateRepo(req, res) {
  try {
    const { repo } = req.body;

    if (!repo) {
      return res.status(400).json({ message: 'Repository URL is required' });
    }

    // Validate GitHub URL format
    const githubUrlRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:\.git)?\/?$/;
    if (!githubUrlRegex.test(repo)) {
      return res.status(400).json({ message: 'Invalid GitHub URL format' });
    }

    try {
      const match = repo.match(/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/);
      if (!match) {
        return res.status(400).json({ message: 'Invalid GitHub URL format' });
      }

      const [, owner, repoName] = match;
      const apiUrl = `https://api.github.com/repos/${owner}/${repoName}`;

      const response = await fetch(apiUrl);
      
      if (response.status === 404) {
        return res.status(404).json({ message: 'Repository not found. Please verify the URL is correct and the repository is public.' });
      }
      
      if (!response.ok) {
        return res.status(500).json({ message: 'Failed to verify repository. Please try again.' });
      }

      const repoData = await response.json();

      if (repoData.private) {
        return res.status(403).json({ message: 'Repository is private. Only public repositories are supported.' });
      }

      return res.json({
        message: 'Repository verified successfully',
        repo: {
          name: repoData.name,
          url: repoData.html_url,
          isPublic: !repoData.private,
          description: repoData.description,
        }
      });
    } catch (err) {
      console.error('GitHub API error:', err);
      return res.status(500).json({ message: 'Failed to verify repository with GitHub' });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function getServices(req, res) {
  try {
    const userId = req.userId;

    const projects = await Project.find({ user: userId });
    if (!projects || projects.length === 0) {
      return res.status(200).json({ message: 'No services found', services: [] });
    }

    const services = await Service.find({ project: { $in: projects.map(p => p._id) } }).populate('project');

    return res.json({
      message: 'Services found',
      services
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function deployService(req, res) {
  try {
    const {
      repo,
      branch,
      rootDirectory,
      buildCommand,
      preDeployCommand,
      startCommand,
      healthCheckPath,
      projectId,
      environmentVariables,
    } = req.body;
    if (
      !repo ||
      !branch ||
      !preDeployCommand ||
      !startCommand ||
      !healthCheckPath
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const userId = req.userId;

    const user = req.user;

    const service = await Service.create({
      project: projectId,
      user: userId,
      name: repo.split('/').pop().split('.git').shift(),
      gitRepositoryUrl: repo,
      gitBranch: branch,
      rootDirectory,
      buildCommand,
      preDeployCommand,
      startCommand,
      healthCheckPath,
      status: "pending",
      environmentVariables: environmentVariables || [],
      logs: [],
    });

    await Project.findByIdAndUpdate(projectId, { $addToSet: { services: service._id } });

    const deployment = await Deployment.create({
      service: service._id,
      status: "queued",
      commitHash: "",
      commitMessage: "",
      logs: [],
      dockerImage: "",
      containerId: "",
      deployedUrl: "",
    });

    await sendToQueue(deployment._id.toString());

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

export async function getService(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const service = await Service.findById(id).populate('project');
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = service.project;
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const deployments = await Deployment.find({ service: id }).sort({ createdAt: -1 });

    return res.json({
      message: 'Service found',
      service,
      deployments
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function redeployService(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const deployment = await Deployment.create({
      service: service._id,
      status: 'queued',
      logs: [],
      dockerImage: '',
      containerId: '',
      deployedUrl: '',
    });

    await sendToQueue(deployment._id.toString());

    service.status = 'pending';
    await service.save();

    return res.json({
      message: 'Redeployment queued',
      deployment
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function deleteService(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (project) {
      project.services = project.services.filter(sId => sId.toString() !== id);
      await project.save();
    }

    await Deployment.deleteMany({ service: id });

    await Service.findByIdAndDelete(id);

    return res.json({
      message: 'Service deleted successfully'
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function getServiceLogs(req, res) {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const deployment = await Deployment.findOne({ service: id }).sort({ createdAt: -1 });

    if (!deployment) {
      return res.json({
        message: 'No deployment logs found',
        logs: [],
        status: 'No deployments'
      });
    }

    return res.json({
      message: 'Service logs retrieved',
      logs: deployment.logs,
      status: deployment.status,
      deploymentId: deployment._id
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}
export async function setServiceEnv(req, res) {
  try {
    const { id } = req.params;
    const { key, value } = req.body;
    const userId = req.userId;

    if (!key || value === undefined) {
      return res.status(400).json({ message: 'Key and value are required' });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const updatedService = await Service.findOneAndUpdate(
      { _id: id, 'environmentVariables.key': key },
      { $set: { 'environmentVariables.$.value': value } },
      { new: true }
    );

    let resultService;
    if (updatedService) {
      resultService = updatedService;
    } else {
      resultService = await Service.findByIdAndUpdate(
        id,
        { $push: { environmentVariables: { key, value } } },
        { new: true }
      );
    }

    return res.json({
      message: 'Environment variable set successfully',
      service: resultService
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function updateServiceConfig(req, res) {
  try {
    const { id } = req.params;
    const {
      gitRepositoryUrl,
      gitBranch,
      rootDirectory,
      buildCommand,
      preDeployCommand,
      startCommand,
      healthCheckPath
    } = req.body;
    const userId = req.userId;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (gitRepositoryUrl !== undefined) service.gitRepositoryUrl = gitRepositoryUrl;
    if (gitBranch !== undefined) service.gitBranch = gitBranch;
    if (rootDirectory !== undefined) service.rootDirectory = rootDirectory;
    if (buildCommand !== undefined) service.buildCommand = buildCommand;
    if (preDeployCommand !== undefined) service.preDeployCommand = preDeployCommand;
    if (startCommand !== undefined) service.startCommand = startCommand;
    if (healthCheckPath !== undefined) service.healthCheckPath = healthCheckPath;

    service.status = 'pending';
    await service.save();

    return res.json({
      message: 'Service configuration updated successfully',
      service
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function deleteServiceEnv(req, res) {
  try {
    const { id, key } = req.params;
    const userId = req.userId;

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const project = await Project.findById(service.project);
    if (!project || project.user.toString() !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const resultService = await Service.findByIdAndUpdate(
      id,
      { $pull: { environmentVariables: { key } } },
      { new: true }
    );

    return res.json({
      message: 'Environment variable deleted successfully',
      service: resultService
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
}

export async function wakeUpService(req, res) {
  try {
    const { subdomain } = req.params;
    const service = await Service.findOne({ subdomain }).populate('ec2Host');

    if (!service) {
      return res.status(404).message("service not found");
    }
    if (service.status === 'sleeping') {
      await WakeServiceSubDomain(service);
      return res.status(200).message("successfully wake the service");
    }

    return res.status(200).message(`service isn't in sleep mode, current service status : ${service.status}`);
  } catch (err) {
    console.log(err);
    return res.status(500).message(`ERROR : while wakeing up the service -> ${err}`);
  }
}

async function WakeServiceSubDomain(service) {
  const appName = `app-${service._id}`;
  service.status = 'waking';
  await service.save();

  const bestEc2 = await getBestEc2();
  if (bestEc2.ip !== service.ec2Host?.ip) {
    console.log(`Migrating service ${service._id} from EC2 ${service.ec2Host?.ip} to EC2 ${bestEc2.ip}`);
    await migrateService(service, service.ec2Host, bestEc2);
  }

  await executeSSHCommands([`docker start ${appName}`], [], () => {}, service.ec2Host?.ip);

  // wait for container to start
  await new Promise(resolve => setTimeout(resolve, 5000));
  await ensureDockerContainerRunning(appName, () => {});

  service.status = 'running';
  await service.save();
}