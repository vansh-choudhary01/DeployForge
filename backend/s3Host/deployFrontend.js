import { executeSSHCommands } from "../helpers/ssh.js";
import { getStableSubdomain } from "../helpers/subdomains.js";
import Service from "../models/Service.js";
import { createS3Bucket } from "./bucketInit.js";

export async function deployFrontend(service, pushLog) {
    const appName = `app-${service._id}`;
    const appDir = `/home/ubuntu/apps/${appName}`;
    const bucketName = `naaspeeti-app-${service._id}`;

    // Step 1 - create S3 bucket if not exists
    try {
        await createS3Bucket(service._id);
    } catch (err) {
        if (err.name !== 'BucketAlreadyOwnedByYou') throw err;
    }

    let relativeRootDirectory = '.';
    // Navigate to rootDirectory if specified
    if (service.rootDirectory && service.rootDirectory !== '/') {
        const relativeDir = service.rootDirectory.startsWith('/') ? '.' + service.rootDirectory : service.rootDirectory;
        relativeRootDirectory = relativeDir;
    }
    console.log(service);

    // Step 2 - clone and build on EC2
    pushLog(`[${new Date().toISOString()}] Cloning and building...`);
    await executeSSHCommands([
        `sudo rm -rf ${appDir} || true`,
        `git clone --branch ${service.gitBranch} ${service.gitRepositoryUrl} ${appDir}`,
        `cd ${appDir} && ${service.rootDirectory ? `cd ${relativeRootDirectory} &&` : ''}`,
        `${service.preDeployCommand || 'cd .'}`,
        `${service.buildCommand || 'cd .'}`,

        // sync directly from EC2 to S3 (handles binary files, much faster)
        `aws s3 sync ${appDir}/${relativeRootDirectory}/${service.buildDirectory || 'build'} s3://${bucketName} --delete`,

        // cleanup
        `sudo rm -rf ${appDir}`
    ], [], pushLog, process.env.EC2_HOST);

    // Step 5 - save S3 URL in DB
    const s3Url = `http://${bucketName}.s3-website.${process.env.AWS_REGION}.amazonaws.com`;
    await Service.updateOne({ _id: service._id }, {
        status: 'running',
        s3Url,
        bucketName
    });

    pushLog(`[${new Date().toISOString()}] Deployment successful! App is live, now setting up subdomain...`);
}