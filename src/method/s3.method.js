import {PutObjectCommand, S3Client, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command} from "@aws-sdk/client-s3";
import {config} from "../../config/env.js";

const bucketName = config.bucket_name;
const bucketRegion = config.bucket_region;
const accessKey = config.aws_access_key;
const secretKey = config.aws_secret_key;

const s3 = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
    },
    region: bucketRegion
})


export const getFile = async (key) => {
    const params = {
        Bucket: bucketName,
        Key: key,
    }
    console.log('Accessing S3 with params:', params)
    const command = new GetObjectCommand(params);
    const response = await s3.send(command);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
        chunks.push(chunk);
    }

    return {
        buffer: Buffer.concat(chunks),
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified
    };
}