/// <reference types="njs-types/ngx_http_js_module.d.ts" />

/**
 * AWS Signature v4 Proxy for Nginx
 *
 * This NJS script for Nginx takes requests that are already signed with AWS Signature v4,
 * removes content-length from the signed headers list, and re-signs the request with
 * the remaining headers and the upstream host before proxying.
 */

import crypto from "crypto";

ngx.log(ngx.INFO, "Loading AWS Signature v4 NJS script");

// Configuration from environment variables
var config = {
  region: process.env.AWS_REGION || "us-east-1",
  service: process.env.AWS_SERVICE || "s3",
  accessKey: process.env.AWS_ACCESS_KEY_ID,
  secretKey: process.env.AWS_SECRET_ACCESS_KEY,
  upstreamHost: process.env.AWS_UPSTREAM_HOST,
};

ngx.log(ngx.INFO, "Using upstream host: " + config.upstreamHost);
ngx.log(ngx.INFO, "AWS region: " + config.region);
ngx.log(ngx.INFO, "AWS service: " + config.service);

/**
 * @param {string} authHeader
 */
function parseAuthHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith("AWS4-HMAC-SHA256 ")) {
    return null;
  }

  /** @type {Record<string, string>} */
  var parts = {};
  var elements = authHeader.substring("AWS4-HMAC-SHA256 ".length).split(", ");

  for (var i = 0; i < elements.length; i++) {
    var element = elements[i];
    var keyValue = element.split("=");
    var key = keyValue[0];
    var value = keyValue[1];
    parts[key] = value;
  }

  if (parts.Credential) {
    var credParts = parts.Credential.split("/");
    parts.accessKey = credParts[0];
    parts.date = credParts[1];
    parts.region = credParts[2];
    parts.service = credParts[3];
    parts.requestType = credParts[4];
  }

  return parts;
}

/**
 * @param {Record<string, string>} authHeaderParts
 */
function getSignedHeaders(authHeaderParts) {
  if (!authHeaderParts || !authHeaderParts.SignedHeaders) {
    return [];
  }

  return authHeaderParts.SignedHeaders.split(";");
}

/**
 * @param {Array<string>} signedHeaders
 */
function removeContentLengthFromSignedHeaders(signedHeaders) {
  var result = [];
  for (var i = 0; i < signedHeaders.length; i++) {
    var normalizedHeader = signedHeaders[i].toLowerCase();

    if (
      normalizedHeader !== "content-length" &&
      normalizedHeader !== "accept"
    ) {
      result.push(signedHeaders[i]);
    }
  }
  return result;
}

/**
 * @param {NjsStringOrBuffer} key
 * @param {NjsStringOrBuffer} message
 */
function hmacSha256(key, message) {
  return crypto.createHmac("sha256", key).update(message).digest();
}

/**
 * @param {string} key
 * @param {string} dateStamp
 * @param {string} regionName
 * @param {string} serviceName
 * @returns
 */
function getSignatureKey(key, dateStamp, regionName, serviceName) {
  var kDate = hmacSha256("AWS4" + key, dateStamp);
  var kRegion = hmacSha256(kDate, regionName);
  var kService = hmacSha256(kRegion, serviceName);
  var kSigning = hmacSha256(kService, "aws4_request");
  return kSigning;
}

/**
 * @param {string} timestamp
 * @param {string} region
 * @param {string} service
 * @param {string} canonicalRequest
 */
function createStringToSign(timestamp, region, service, canonicalRequest) {
  var hashedCanonicalRequest = crypto
    .createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");

  return [
    "AWS4-HMAC-SHA256",
    timestamp,
    timestamp.substring(0, 8) + "/" + region + "/" + service + "/aws4_request",
    hashedCanonicalRequest,
  ].join("\n");
}

/**
 * @param {string} secretKey
 * @param {string} timestamp
 * @param {string} region
 * @param {string} service
 * @param {string} stringToSign
 */
function calculateSignature(
  secretKey,
  timestamp,
  region,
  service,
  stringToSign
) {
  var signingKey = getSignatureKey(
    secretKey,
    timestamp.substring(0, 8),
    region,
    service
  );
  return crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
}

/**
 * @param {string} accessKey
 * @param {string} timestamp
 * @param {string} region
 * @param {string} service
 * @param {Array<string>} signedHeaders
 * @param {string} signature
 */
function createAuthorizationHeader(
  accessKey,
  timestamp,
  region,
  service,
  signedHeaders,
  signature
) {
  return (
    "AWS4-HMAC-SHA256 " +
    "Credential=" +
    accessKey +
    "/" +
    timestamp.substring(0, 8) +
    "/" +
    region +
    "/" +
    service +
    "/aws4_request, " +
    "SignedHeaders=" +
    signedHeaders.join(";") +
    ", " +
    "Signature=" +
    signature
  );
}

/**
 * @param {NginxHTTPRequest} r
 */
function generateNewAuthHeader(r) {
  try {
    // Parse the original authorization header
    var authHeader = r.headersIn.Authorization || "";
    r.log("Original Authorization header: " + authHeader);

    var amzDate = r.headersIn["x-amz-date"];

    if (!amzDate) {
        r.error("Missing x-amz-date header");
        return "";
    }

    var authHeaderParts = parseAuthHeader(authHeader);

    if (!authHeaderParts) {
      r.error("Invalid or missing AWS Signature v4 Authorization header");
      return "";
    }

    // Get signed headers and remove content-length
    var originalSignedHeaders = getSignedHeaders(authHeaderParts);
    var newSignedHeaders = removeContentLengthFromSignedHeaders(
      originalSignedHeaders
    );

    // Get request attributes
    var method = r.method;
    var url = r.uri;
    var queryString = "";

    if (r.args) {
      var queryParams = [];
      var sortedKeys = Object.keys(r.args).sort();
      for (var i = 0; i < sortedKeys.length; i++) {
        var key = sortedKeys[i];
        if (r.args.hasOwnProperty(key)) {
          queryParams.push(encodeURIComponent(key) + "=" + encodeURIComponent(r.args[key]));
        }
      }
      queryString = queryParams.join("&");
    }

    // Collect headers for canonical request

    /** @type {Record<string,string>} */
    var headers = {};
    for (var i = 0; i < newSignedHeaders.length; i++) {
      var headerName = newSignedHeaders[i].toLowerCase();
      var headerValue = r.headersIn[headerName];

      if (headerValue) {
        headers[headerName] = headerValue;
      }
    }

    // Update host header to upstream host
    headers["host"] = config.upstreamHost;

    // Use the original payload hash from the request
    var payloadHash =
      r.headersIn["x-amz-content-sha256"] ||
      crypto.createHash("sha256").update("").digest("hex");

    // Get timestamp from existing signature
    var timestamp = amzDate;

    // Create canonical request using the original payload hash
    var canonicalHeadersStr = "";
    for (var i = 0; i < newSignedHeaders.length; i++) {
      var headerName = newSignedHeaders[i].toLowerCase();
      var headerValue = headers[headerName] ? headers[headerName].trim() : "";
      canonicalHeadersStr += headerName + ":" + headerValue + "\n";
    }

    var canonicalRequest = [
      method,
      url,
      queryString,
      canonicalHeadersStr,
      newSignedHeaders.join(";"),
      payloadHash,
    ].join("\n");

    r.log("Generated new canonical request: " + canonicalRequest);

    var stringToSign = createStringToSign(
      timestamp,
      authHeaderParts.region || config.region,
      authHeaderParts.service || config.service,
      canonicalRequest
    );

    r.log("Generated new string to sign: " + stringToSign);

    // Calculate new signature
    var signature = calculateSignature(
      config.secretKey,
      timestamp,
      authHeaderParts.region || config.region,
      authHeaderParts.service || config.service,
      stringToSign
    );

    // Create new authorization header
    var newAuthHeader = createAuthorizationHeader(
      authHeaderParts.accessKey || config.accessKey,
      timestamp,
      authHeaderParts.region || config.region,
      authHeaderParts.service || config.service,
      newSignedHeaders,
      signature
    );

    r.log("Generated new Authorization header: " + newAuthHeader);
    return newAuthHeader;
  } catch (e) {
    // @ts-ignore
    r.error("Error generating new auth header: " + e.message);
    // @ts-ignore
    r.error("Stack trace: " + (e.stack || "No stack trace available"));
    return "";
  }
}

/**
 * @param {NginxHTTPRequest} r
 */
function getUpstreamHost(r) {
  r.log("Using upstream host: " + config.upstreamHost);
  return config.upstreamHost;
}

/**
 * @param {NginxHTTPRequest} r
 */
function getUpstreamUrl(r) {
  r.log("Using upstream host: " + config.upstreamHost);
  return "https://" + config.upstreamHost;
}

export default { generateNewAuthHeader, getUpstreamHost, getUpstreamUrl };
