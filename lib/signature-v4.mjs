import crypto from "crypto";

async function createSignature({
  region,
  method = "GET",
  host,
  path,
  searchParams = new URLSearchParams(),
  body = "",
  amzDate,
  accessKeyId,
  secretAccessKey,
  sessionToken = null,
  headers = {},
}) {
  const dateStamp = amzDate.slice(0, 8);

  // Create canonical request
  const canonicalHeaders = {
    host: host,
    "x-amz-date": amzDate,
  };

  // Add session token if provided
  if (sessionToken) {
    canonicalHeaders["x-amz-security-token"] = sessionToken;
  }

  // Add content type if provided in options
  if (headers["Content-Type"]) {
    canonicalHeaders["content-type"] = headers["Content-Type"];
  }

  // Add content-md5 if provided in options
  if (headers["Content-MD5"]) {
    canonicalHeaders["content-md5"] = headers["Content-MD5"];
  }

  // Calculate payload hash
  const payloadHash = await sha256(body);
  canonicalHeaders["x-amz-content-sha256"] = payloadHash;

  const canonicalHeaderNames = Object.keys(canonicalHeaders).sort();

  // Create canonical headers string
  const canonicalHeadersString = canonicalHeaderNames
    .sort()
    .map((key) => `${key}:${canonicalHeaders[key]}\n`)
    .join("");

  // Create signed headers string
  const signedHeaders = canonicalHeaderNames.join(";");

  // Properly handle the query string parameters
  const queryKeys = Array.from(searchParams.keys()).sort();

  const canonicalQueryString = queryKeys
    .map((key) => {
      const values = searchParams.getAll(key);
      return values
        .sort() // Sort values for keys with multiple values
        .map((value) => {
          // Properly URI encode both key and value according to AWS specs
          return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        })
        .join("&");
    })
    .join("&");

  // Create canonical request
  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    canonicalHeadersString,
    signedHeaders,
  ].join("\n");

  // Create credential scope
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  // Create string to sign
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  // Calculate signature
  const signingKey = await getSignatureKey(
    secretAccessKey,
    dateStamp,
    region,
    "s3"
  );

  const signature = await hmacSha256Hex(signingKey, stringToSign);

  return {
    accessKeyId,
    canonicalHeaders,
    credentialScope,
    signedHeaders,
    signature,
  };
}

function authorizationHeader({
  accessKeyId,
  credentialScope,
  signedHeaders,
  signature,
}) {
  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

/**
 * Calculate SHA256 hash of a string
 * @param {string} message - String to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
async function sha256(message) {
  return crypto.createHash("sha256").update(message).digest("hex");
}

/**
 * Calculate HMAC SHA256 of a message using a key
 * @param {ArrayBuffer} key - Key for HMAC
 * @param {string} message - Message to sign
 * @returns {Promise<ArrayBuffer>} HMAC result
 */
async function hmacSha256(key, message) {
  const hmac = crypto.createHmac(
    "sha256",
    key instanceof Uint8Array ? Buffer.from(key) : key
  );
  hmac.update(message);
  const digest = hmac.digest();
  return digest;
}

/**
 * Calculate HMAC SHA256 and return as hex string
 * @param {ArrayBuffer} key - Key for HMAC
 * @param {string} message - Message to sign
 * @returns {Promise<string>} Hex-encoded HMAC
 */
async function hmacSha256Hex(key, message) {
  const hashBuffer = await hmacSha256(key, message);

  // Handle Node.js Buffer or browser ArrayBuffer
  if (Buffer.isBuffer(hashBuffer)) {
    return hashBuffer.toString("hex");
  } else {
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

/**
 * Derive signing key for AWS Signature v4
 * @param {string} key - Secret access key
 * @param {string} dateStamp - Date in format YYYYMMDD
 * @param {string} region - AWS region
 * @param {string} service - AWS service (e.g., 's3')
 * @returns {Promise<ArrayBuffer>} Signing key
 */
async function getSignatureKey(key, dateStamp, region, service) {
  const kSecret = `AWS4${key}`;
  const kDate = await hmacSha256(kSecret, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

export { createSignature, authorizationHeader };
