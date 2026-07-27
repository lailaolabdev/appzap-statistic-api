/**
 * S3 upload for support ticket attachments (images/videos).
 * Same bucket + credentials as appzap_v2_pos_api menu images.
 */

const AWS = require('aws-sdk');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'ap-southeast-1',
});

const s3 = new AWS.S3();

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'appzap-v2-restaurant-menu-images';

const getEnvironment = () => {
    const env = process.env.NODE_ENV || 'development';
    return ['production', 'staging', 'test'].includes(env) ? env : 'development';
};

/**
 * Upload a multer memory-storage file to S3 under support/{env}/.
 * Returns { url, key }.
 */
const uploadSupportAttachment = async (file) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`;
    const key = `support/${getEnvironment()}/${filename}`;

    const result = await s3
        .upload({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        })
        .promise();

    return { url: result.Location, key: result.Key };
};

module.exports = { s3, BUCKET_NAME, uploadSupportAttachment };
