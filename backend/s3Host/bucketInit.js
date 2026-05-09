import { S3Client, CreateBucketCommand, PutBucketWebsiteCommand, PutBucketPolicyCommand, DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, PutPublicAccessBlockCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export async function createS3Bucket(serviceId) {
    const bucketName = `naaspeeti-app-${serviceId}`;

    // create bucket
    await s3Client.send(new CreateBucketCommand({
        Bucket: bucketName,
        CreateBucketConfiguration: {
            LocationConstraint: process.env.AWS_REGION
        }
    }));

    // disable block public access first (must be done before setting public policy)
    await s3Client.send(new PutPublicAccessBlockCommand({
        Bucket: bucketName,
        PublicAccessBlockConfiguration: {
            BlockPublicAcls: false,
            IgnorePublicAcls: false,
            BlockPublicPolicy: false,
            RestrictPublicBuckets: false
        }
    }));

    // enable static website hosting
    await s3Client.send(new PutBucketWebsiteCommand({
        Bucket: bucketName,
        WebsiteConfiguration: {
            IndexDocument: { Suffix: 'index.html' },
            ErrorDocument: { Key: 'index.html' } // SPA fallback
        }
    }));

    // make bucket public
    await s3Client.send(new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
                Sid: 'PublicReadGetObject',
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: `arn:aws:s3:::${bucketName}/*`
            }]
        })
    }));

    console.log(`S3 bucket created: ${bucketName}`);
    return bucketName;
}