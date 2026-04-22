import { ECRClient, CreateRepositoryCommand } from "@aws-sdk/client-ecr";

export const ecrClient = new ECRClient({ region: process.env.AWS_REGION || "ap-south-1" });

export async function createEcrRepo(serviceId) {
    try {
        await ecrClient.send(new CreateRepositoryCommand({
            repositoryName: `app-${serviceId}`,
        }));
        console.log(`ECR repository for service ${serviceId} created successfully.`);
    } catch (err) {
        if (err.name === 'RepositoryAlreadyExistsException') return;
        throw err;
    }
}