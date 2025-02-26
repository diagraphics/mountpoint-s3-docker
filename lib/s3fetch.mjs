/**
 * AWS S3 Signature Version 4 Fetch Wrapper
 *
 * This module provides a wrapper around the fetch API that adds the necessary
 * headers for AWS S3 Signature Version 4 authentication.
 */

import { createSignature, authorizationHeader } from "./signature-v4.mjs";

/**
 * Creates a signed fetch function for S3 operations
 * @param {Object} config - Configuration for S3 authentication
 * @param {string} config.accessKeyId - AWS Access Key ID
 * @param {string} config.secretAccessKey - AWS Secret Access Key
 * @param {string} config.region - AWS Region (e.g., 'us-east-1')
 * @param {string} [config.sessionToken] - Optional AWS Session Token for temporary credentials
 * @returns {Function} A fetch wrapper function with S3 Signature v4 authentication
 */
function createS3Fetch(config) {
  const { accessKeyId, secretAccessKey, region, sessionToken } = config;

  /**
   * Wrapped fetch function with S3 Signature v4 authentication
   * @param {string} url - The S3 URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise} Fetch promise
   */
  return async function s3Fetch(url, options = {}) {
    // Parse the URL to get the bucket and object key
    const parsedUrl = new URL(url);
    const { host, pathname: path, searchParams } = parsedUrl;

    // Set up the request
    const method = options.method || "GET";
    const body = options.body || "";
    const headers = options.headers || {};

    // Set up the timestamp and date
    const now = new Date();
    console.log(now);
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");

    const { canonicalHeaders, ...sigData } = await createSignature({
      region,
      method,
      host,
      path,
      searchParams,
      body,
      amzDate,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      headers,
    });

    console.log({
      path,
      amzDate,
      sigData
    });

    const authHeader = authorizationHeader(sigData);

    const fetchHeaders = {
      ...headers,
      ...canonicalHeaders,
      Accept: "*/*",
      Authorization: authHeader,
    };

    // Remove lowercase duplicates (browsers will handle this, but we'll be thorough)
    Object.keys(headers).forEach((key) => {
      if (key.toLowerCase() !== key && fetchHeaders[key.toLowerCase()]) {
        delete fetchHeaders[key.toLowerCase()];
      }
    });

    const request = new Request(url, {
      method,
      ...options,
      headers: fetchHeaders,
    });

    // body

    return fetch(request);
  };
}



// Example usage
/*
const s3Fetch = createS3Fetch({
  accessKeyId: 'YOUR_ACCESS_KEY_ID',
  secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
  region: 'us-east-1',
  // sessionToken: 'OPTIONAL_SESSION_TOKEN'
});

// Use it like regular fetch
s3Fetch('https://my-bucket.s3.amazonaws.com/my-object.jpg')
  .then(response => response.blob())
  .then(blob => {
    // Process the blob
  })
  .catch(error => {
    console.error('Error:', error);
  });

// For PUT requests
const fileContent = 'Hello, World!';
s3Fetch('https://my-bucket.s3.amazonaws.com/hello.txt', {
  method: 'PUT',
  body: fileContent,
  headers: {
    'Content-Type': 'text/plain',
    'Content-Length': fileContent.length.toString()
  }
})
  .then(response => {
    if (response.ok) {
      console.log('Upload successful');
    } else {
      console.error('Upload failed');
    }
  })
  .catch(error => {
    console.error('Error:', error);
  });
*/

const s3Fetch = createS3Fetch({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

s3Fetch(process.argv[2])
  .then((response) => response.text())
  .then((data) => console.log(data));
