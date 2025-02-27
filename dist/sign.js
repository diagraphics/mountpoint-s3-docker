// node_modules/supa-storage/src/storage/protocols/s3/signature-v4.ts
import crypto from "node:crypto";

// node_modules/supa-storage/src/internal/errors/codes.ts
var ERRORS = {
  BucketNotEmpty: (bucket, e) => new StorageBackendError({
    code: "InvalidRequest" /* InvalidRequest */,
    resource: bucket,
    httpStatusCode: 409,
    message: `The bucket you tried to delete is not empty`,
    originalError: e
  }),
  NoSuchBucket: (bucket, e) => new StorageBackendError({
    code: "NoSuchBucket" /* NoSuchBucket */,
    resource: bucket,
    error: "Bucket not found",
    httpStatusCode: 404,
    message: `Bucket not found`,
    originalError: e
  }),
  NoSuchUpload: (uploadId, e) => new StorageBackendError({
    code: "NoSuchUpload" /* NoSuchUpload */,
    resource: uploadId,
    httpStatusCode: 404,
    message: `Upload not found`,
    originalError: e
  }),
  NoSuchKey: (resource, e) => new StorageBackendError({
    code: "NoSuchKey" /* NoSuchKey */,
    resource,
    error: "not_found",
    httpStatusCode: 404,
    message: `Object not found`,
    originalError: e
  }),
  MissingParameter: (parameter, e) => new StorageBackendError({
    code: "MissingParameter" /* MissingParameter */,
    httpStatusCode: 400,
    message: `Missing Required Parameter ${parameter}`,
    originalError: e
  }),
  InvalidParameter: (parameter, e) => new StorageBackendError({
    code: "MissingParameter" /* MissingParameter */,
    httpStatusCode: 400,
    message: `Invalid Parameter ${parameter}`,
    originalError: e
  }),
  InvalidJWT: (e) => new StorageBackendError({
    code: "InvalidJWT" /* InvalidJWT */,
    httpStatusCode: 400,
    message: e?.message || "Invalid JWT"
  }),
  MissingContentLength: (e) => new StorageBackendError({
    code: "MissingContentLength" /* MissingContentLength */,
    httpStatusCode: 400,
    message: e?.message || "You must provide the Content-Length HTTP header."
  }),
  AccessDenied: (action, e) => new StorageBackendError({
    error: "Unauthorized",
    code: "AccessDenied" /* AccessDenied */,
    httpStatusCode: 403,
    message: action || "Access denied",
    originalError: e
  }),
  ResourceAlreadyExists: (e) => new StorageBackendError({
    error: "Duplicate",
    code: "ResourceAlreadyExists" /* ResourceAlreadyExists */,
    httpStatusCode: 409,
    message: "The resource already exists",
    originalError: e
  }),
  MetadataRequired: (e) => new StorageBackendError({
    code: "InvalidRequest" /* InvalidRequest */,
    httpStatusCode: 400,
    message: "Metadata header is required",
    originalError: e
  }),
  SignatureDoesNotMatch: (message) => new StorageBackendError({
    code: "SignatureDoesNotMatch" /* SignatureDoesNotMatch */,
    httpStatusCode: 403,
    message: message || "Signature does not match"
  }),
  InvalidSignature: (message, e) => new StorageBackendError({
    code: "InvalidSignature" /* InvalidSignature */,
    httpStatusCode: 400,
    message: message || "Invalid signature",
    originalError: e
  }),
  ExpiredSignature: (e) => new StorageBackendError({
    code: "ExpiredToken" /* ExpiredToken */,
    httpStatusCode: 400,
    message: "The provided token has expired.",
    originalError: e
  }),
  InvalidXForwardedHeader: (message, e) => new StorageBackendError({
    code: "InvalidRequest" /* InvalidRequest */,
    httpStatusCode: 400,
    message: message || "Invalid X-Forwarded-Host header",
    originalError: e
  }),
  InvalidTenantId: (e) => new StorageBackendError({
    code: "TenantNotFound" /* TenantNotFound */,
    httpStatusCode: 400,
    message: e?.message || "Invalid tenant id",
    originalError: e
  }),
  InvalidUploadId: (message, e) => new StorageBackendError({
    code: "InvalidUploadId" /* InvalidUploadId */,
    httpStatusCode: 400,
    message: message || "Invalid upload id",
    originalError: e
  }),
  TusError: (message, statusCode) => new StorageBackendError({
    code: "TusError" /* TusError */,
    httpStatusCode: statusCode,
    message
  }),
  MissingTenantConfig: (tenantId) => new StorageBackendError({
    code: "TenantNotFound" /* TenantNotFound */,
    httpStatusCode: 400,
    message: `Missing tenant config for tenant ${tenantId}`
  }),
  InvalidMimeType: (mimeType) => new StorageBackendError({
    error: "invalid_mime_type",
    code: "InvalidMimeType" /* InvalidMimeType */,
    httpStatusCode: 415,
    message: `mime type ${mimeType} is not supported`
  }),
  InvalidRange: () => new StorageBackendError({
    error: "invalid_range",
    code: "InvalidRange" /* InvalidRange */,
    httpStatusCode: 400,
    message: `invalid range provided`
  }),
  EntityTooLarge: (e, entity = "object") => new StorageBackendError({
    error: "Payload too large",
    code: "EntityTooLarge" /* EntityTooLarge */,
    httpStatusCode: 413,
    message: `The ${entity} exceeded the maximum allowed size`,
    originalError: e
  }),
  InternalError: (e, message) => new StorageBackendError({
    code: "InternalError" /* InternalError */,
    httpStatusCode: 500,
    message: message || "Internal server error",
    originalError: e
  }),
  ImageProcessingError: (statusCode, message, e) => new StorageBackendError({
    code: statusCode > 499 ? "InternalError" /* InternalError */ : "InvalidRequest" /* InvalidRequest */,
    httpStatusCode: statusCode,
    message,
    originalError: e
  }),
  InvalidBucketName: (bucket, e) => new StorageBackendError({
    error: "Invalid Input",
    code: "InvalidBucketName" /* InvalidBucketName */,
    resource: bucket,
    httpStatusCode: 400,
    message: `Bucket name invalid`,
    originalError: e
  }),
  InvalidFileSizeLimit: (e) => new StorageBackendError({
    code: "InvalidRequest" /* InvalidRequest */,
    httpStatusCode: 400,
    message: e?.message || "Invalid file size format, hint: use 20GB / 20MB / 30KB / 3B",
    originalError: e
  }),
  InvalidUploadSignature: (e) => new StorageBackendError({
    code: "InvalidUploadSignature" /* InvalidUploadSignature */,
    httpStatusCode: 400,
    message: e?.message || "Invalid upload Signature",
    originalError: e
  }),
  InvalidKey: (key, e) => new StorageBackendError({
    code: "InvalidKey" /* InvalidKey */,
    resource: key,
    httpStatusCode: 400,
    message: `Invalid key: ${key}`,
    originalError: e
  }),
  KeyAlreadyExists: (key, e) => new StorageBackendError({
    code: "KeyAlreadyExists" /* KeyAlreadyExists */,
    resource: key,
    error: "Duplicate",
    httpStatusCode: 409,
    message: `The resource already exists`,
    originalError: e
  }),
  BucketAlreadyExists: (bucket, e) => new StorageBackendError({
    code: "BucketAlreadyExists" /* BucketAlreadyExists */,
    resource: bucket,
    error: "Duplicate",
    httpStatusCode: 409,
    message: `The resource already exists`,
    originalError: e
  }),
  NoContentProvided: (e) => new StorageBackendError({
    code: "InvalidRequest" /* InvalidRequest */,
    httpStatusCode: 400,
    message: e?.message || "No content provided",
    originalError: e
  }),
  DatabaseTimeout: (e) => StorageBackendError.withStatusCode(544, {
    code: "DatabaseTimeout" /* DatabaseTimeout */,
    httpStatusCode: 544,
    message: "The connection to the database timed out",
    originalError: e
  }),
  ResourceLocked: (e) => new StorageBackendError({
    code: "ResourceLocked" /* ResourceLocked */,
    httpStatusCode: 423,
    message: `The resource is locked`,
    originalError: e
  }),
  RelatedResourceNotFound: (e) => new StorageBackendError({
    code: "InvalidRequest" /* InvalidRequest */,
    httpStatusCode: 404,
    message: `The related resource does not exist`,
    originalError: e
  }),
  DatabaseError: (message, err) => new StorageBackendError({
    code: "DatabaseError" /* DatabaseError */,
    httpStatusCode: 500,
    message,
    originalError: err
  }),
  LockTimeout: (err) => new StorageBackendError({
    error: "acquiring_lock_timeout",
    code: "LockTimeout" /* LockTimeout */,
    httpStatusCode: 503,
    message: "acquiring lock timeout",
    originalError: err
  }),
  MissingS3Credentials: () => new StorageBackendError({
    code: "InvalidAccessKeyId" /* S3InvalidAccessKeyId */,
    httpStatusCode: 403,
    message: "The Access Key Id you provided does not exist in our records."
  }),
  MaximumCredentialsLimit: () => new StorageBackendError({
    code: "MaximumCredentialsLimit" /* S3MaximumCredentialsLimit */,
    httpStatusCode: 400,
    message: "You have reached the maximum number of credentials allowed"
  }),
  InvalidChecksum: (message) => new StorageBackendError({
    code: "InvalidChecksum" /* InvalidChecksum */,
    httpStatusCode: 400,
    message
  }),
  MissingPart: (partNumber, uploadId) => new StorageBackendError({
    code: "MissingPart" /* MissingPart */,
    httpStatusCode: 400,
    message: `Part ${partNumber} is missing for upload id ${uploadId}`
  }),
  Aborted: (message, originalError) => new StorageBackendError({
    code: "Aborted" /* Aborted */,
    httpStatusCode: 500,
    message,
    originalError
  }),
  AbortedTerminate: (message, originalError) => new StorageBackendError({
    code: "AbortedTerminate" /* AbortedTerminate */,
    httpStatusCode: 500,
    message,
    originalError
  })
};

// node_modules/supa-storage/src/internal/errors/storage-error.ts
var StorageBackendError = class _StorageBackendError extends Error {
  httpStatusCode;
  originalError;
  userStatusCode;
  resource;
  code;
  metadata = {};
  error;
  // backwards compatible error
  constructor(options) {
    super(options.message);
    this.code = options.code;
    this.httpStatusCode = options.httpStatusCode;
    this.userStatusCode = options.httpStatusCode === 500 ? 500 : 400;
    this.message = options.message;
    this.originalError = options.originalError;
    this.resource = options.resource;
    this.error = options.error;
    Object.setPrototypeOf(this, _StorageBackendError.prototype);
  }
  static withStatusCode(statusCode, options) {
    const error = new _StorageBackendError(options);
    error.userStatusCode = statusCode;
    return error;
  }
  static fromError(error) {
    let oldErrorMessage;
    let httpStatusCode;
    let message;
    let code;
    if (isS3Error(error)) {
      code = "S3Error" /* S3Error */;
      oldErrorMessage = error.message;
      httpStatusCode = error.$metadata.httpStatusCode ?? 500;
      message = error.name;
    } else if (error instanceof Error) {
      code = "InternalError" /* InternalError */;
      oldErrorMessage = error.name;
      httpStatusCode = 500;
      message = error.message;
    } else {
      code = "InternalError" /* InternalError */;
      oldErrorMessage = "Internal server error";
      httpStatusCode = 500;
      message = "Internal server error";
    }
    return new _StorageBackendError({
      error: oldErrorMessage,
      code,
      httpStatusCode,
      message,
      originalError: error
    });
  }
  withMetadata(metadata) {
    this.metadata = metadata;
    return this;
  }
  render() {
    return {
      statusCode: this.httpStatusCode.toString(),
      code: this.code,
      error: this.code,
      message: this.message
    };
  }
  getOriginalError() {
    return this.originalError;
  }
};
function isS3Error(error) {
  return !!error && typeof error === "object" && "$metadata" in error;
}

// node_modules/supa-storage/src/storage/protocols/s3/signature-v4.ts
var ALWAYS_UNSIGNABLE_HEADERS = {
  authorization: true,
  connection: true,
  expect: true,
  from: true,
  "keep-alive": true,
  "max-forwards": true,
  pragma: true,
  referer: true,
  te: true,
  trailer: true,
  "transfer-encoding": true,
  upgrade: true,
  "user-agent": true,
  "x-amzn-trace-id": true
};
var ALWAYS_UNSIGNABLE_QUERY_PARAMS = {
  "X-Amz-Signature": true
};
var SignatureV4 = class {
  serverCredentials;
  enforceRegion;
  allowForwardedHeader;
  nonCanonicalForwardedHost;
  constructor(options) {
    this.serverCredentials = options.credentials;
    this.enforceRegion = options.enforceRegion;
    this.allowForwardedHeader = options.allowForwardedHeader;
    this.nonCanonicalForwardedHost = options.nonCanonicalForwardedHost;
  }
  static parseAuthorizationHeader(headers) {
    const clientSignature = headers.authorization;
    if (typeof clientSignature !== "string") {
      throw ERRORS.InvalidSignature("Missing authorization header");
    }
    const parts = clientSignature.split(" ");
    if (parts[0] !== "AWS4-HMAC-SHA256") {
      throw ERRORS.InvalidSignature("Unsupported authorization type");
    }
    const params = this.extractClientSignature(clientSignature);
    const credentialPart = params.get("Credential");
    const signedHeadersPart = params.get("SignedHeaders");
    const signature = params.get("Signature");
    const longDate = headers["x-amz-date"];
    const contentSha = headers["x-amz-content-sha256"];
    const sessionToken = headers["x-amz-security-token"];
    if (!validateTypeOfStrings(credentialPart, signedHeadersPart, signature, longDate)) {
      throw ERRORS.InvalidSignature("Invalid signature format");
    }
    const signedHeaders = signedHeadersPart?.split(";") || [];
    const credentialsPart = credentialPart?.split("/") || [];
    if (credentialsPart.length !== 5) {
      throw ERRORS.InvalidSignature("Invalid credentials");
    }
    const [accessKey, shortDate, region, service] = credentialsPart;
    return {
      credentials: { accessKey, shortDate, region, service },
      signedHeaders,
      signature,
      longDate,
      contentSha,
      sessionToken
    };
  }
  static parseQuerySignature(query) {
    const credentialPart = query["X-Amz-Credential"];
    const signedHeaders = query["X-Amz-SignedHeaders"];
    const signature = query["X-Amz-Signature"];
    const longDate = query["X-Amz-Date"];
    const contentSha = query["X-Amz-Content-Sha256"];
    const sessionToken = query["X-Amz-Security-Token"];
    const expires = query["X-Amz-Expires"];
    if (!validateTypeOfStrings(credentialPart, signedHeaders, signature, longDate)) {
      throw ERRORS.InvalidSignature("Invalid signature format");
    }
    if (expires) {
      this.checkExpiration(longDate, expires);
    }
    const credentialsPart = credentialPart.split("/");
    if (credentialsPart.length !== 5) {
      throw ERRORS.InvalidSignature("Invalid credentials");
    }
    const [accessKey, shortDate, region, service] = credentialsPart;
    return {
      credentials: { accessKey, shortDate, region, service },
      signedHeaders: signedHeaders.split(";"),
      signature,
      longDate,
      contentSha,
      sessionToken
    };
  }
  static parseMultipartSignature(form) {
    const credentialPart = form.get("X-Amz-Credential");
    const signature = form.get("X-Amz-Signature");
    const longDate = form.get("X-Amz-Date");
    const contentSha = form.get("X-Amz-Content-Sha256");
    const sessionToken = form.get("X-Amz-Security-Token");
    const policy = form.get("Policy");
    if (!validateTypeOfStrings(credentialPart, signature, policy, longDate)) {
      throw ERRORS.InvalidSignature("Invalid signature format");
    }
    const xPolicy = JSON.parse(Buffer.from(policy, "base64").toString("utf-8"));
    if (xPolicy.expiration) {
      this.checkExpiration(longDate, xPolicy.expiration);
    }
    const credentialsPart = credentialPart.split("/");
    if (credentialsPart.length !== 5) {
      throw ERRORS.InvalidSignature("Invalid credentials");
    }
    const [accessKey, shortDate, region, service] = credentialsPart;
    return {
      credentials: { accessKey, shortDate, region, service },
      signedHeaders: [],
      signature,
      longDate,
      contentSha,
      sessionToken,
      policy: {
        raw: policy,
        value: xPolicy
      }
    };
  }
  static checkExpiration(longDate, expires) {
    const expiresSec = parseInt(expires, 10);
    if (isNaN(expiresSec) || expiresSec < 0) {
      throw ERRORS.InvalidSignature("Invalid expiration");
    }
    const isoLongDate = longDate.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
      "$1-$2-$3T$4:$5:$6Z"
    );
    const requestDate = new Date(isoLongDate);
    const expirationDate = new Date(requestDate.getTime() + expiresSec * 1e3);
    const isExpired = expirationDate < /* @__PURE__ */ new Date();
    if (isExpired) {
      throw ERRORS.ExpiredSignature();
    }
  }
  static extractClientSignature(clientSignature) {
    return clientSignature.replace("AWS4-HMAC-SHA256 ", "").split(",").reduce((values, value) => {
      const [k, v] = value.split("=");
      values.set(k.trim(), v);
      return values;
    }, /* @__PURE__ */ new Map());
  }
  /**
   * Verify if client signature and server signature matches
   * @param clientSignature
   * @param request
   */
  verify(clientSignature, request) {
    if (typeof clientSignature.policy?.raw === "string") {
      return this.verifyPostPolicySignature(clientSignature, clientSignature.policy.raw);
    }
    const serverSignature = this.sign(clientSignature, request);
    return crypto.timingSafeEqual(
      Buffer.from(clientSignature.signature),
      Buffer.from(serverSignature.signature)
    );
  }
  /**
   * Verifies signature for POST upload requests
   * @param clientSignature
   * @param policy
   */
  verifyPostPolicySignature(clientSignature, policy) {
    const serverSignature = this.signPostPolicy(clientSignature, policy);
    return crypto.timingSafeEqual(
      Buffer.from(clientSignature.signature),
      Buffer.from(serverSignature)
    );
  }
  signPostPolicy(clientSignature, policy) {
    const serverCredentials = this.serverCredentials;
    this.validateCredentials(clientSignature.credentials);
    const selectedRegion = this.getSelectedRegion(clientSignature.credentials.region);
    const signingKey = this.signingKey(
      serverCredentials.secretKey,
      clientSignature.credentials.shortDate,
      selectedRegion,
      serverCredentials.service
    );
    return this.hmac(signingKey, policy).toString("hex");
  }
  /**
   * Sign the server side signature
   * @param clientSignature
   * @param request
   */
  sign(clientSignature, request) {
    const serverCredentials = this.serverCredentials;
    this.validateCredentials(clientSignature.credentials);
    const longDate = clientSignature.longDate;
    if (!longDate) {
      throw ERRORS.AccessDenied("No date provided");
    }
    const selectedRegion = this.getSelectedRegion(clientSignature.credentials.region);
    const canonicalRequest = this.constructCanonicalRequest(
      clientSignature,
      request,
      clientSignature.signedHeaders
    );
    const stringToSign = this.constructStringToSign(
      longDate,
      clientSignature.credentials.shortDate,
      selectedRegion,
      serverCredentials.service,
      canonicalRequest
    );
    const signingKey = this.signingKey(
      serverCredentials.secretKey,
      clientSignature.credentials.shortDate,
      selectedRegion,
      serverCredentials.service
    );
    return { signature: this.hmac(signingKey, stringToSign).toString("hex"), canonicalRequest };
  }
  getPayloadHash(clientSignature, request) {
    const body = request.body;
    if (request.query && request.query["X-Amz-Signature"] && request.method === "GET") {
      return "UNSIGNED-PAYLOAD";
    }
    if (clientSignature.contentSha) {
      return clientSignature.contentSha;
    }
    if (body == void 0) {
      return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    }
    if (typeof body === "string" || ArrayBuffer.isView(body)) {
      return crypto.createHash("sha256").update(typeof body === "string" ? body : Buffer.from(body.buffer)).digest("hex");
    }
    return "UNSIGNED-PAYLOAD";
  }
  constructCanonicalRequest(clientSignature, request, signedHeaders) {
    const method = request.method;
    const canonicalUri = new URL(`http://localhost:8080${request.prefix || ""}${request.url}`).pathname;
    const canonicalQueryString = this.constructCanonicalQueryString(request.query || {});
    const canonicalHeaders = this.constructCanonicalHeaders(request, signedHeaders);
    const signedHeadersString = signedHeaders.sort().join(";");
    const payloadHash = this.getPayloadHash(clientSignature, request);
    return `${method}
${canonicalUri}
${canonicalQueryString}
${canonicalHeaders}
${signedHeadersString}
${payloadHash}`;
  }
  constructCanonicalQueryString(query) {
    return Object.keys(query).filter((key) => !(key in ALWAYS_UNSIGNABLE_QUERY_PARAMS)).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`).join("&");
  }
  constructCanonicalHeaders(request, signedHeaders) {
    return signedHeaders.filter(
      (header) => request.headers[header] !== void 0 && !(header.toLowerCase() in ALWAYS_UNSIGNABLE_HEADERS)
    ).sort().map((header) => {
      if (header === "host") {
        return this.getHostHeader(request);
      }
      if (header === "content-length") {
        const headerValue = this.getHeader(request, header) ?? "0";
        return `${header}:${headerValue}`;
      }
      return `${header}:${this.getHeader(request, header)}`;
    }).join("\n") + "\n";
  }
  getHostHeader(request) {
    if (this.allowForwardedHeader) {
      const forwarded = this.getHeader(request, "forwarded");
      if (forwarded) {
        const extractedHost = /host="?([^";]+)/.exec(forwarded)?.[1];
        if (extractedHost) {
          return `host:${extractedHost.toLowerCase()}`;
        }
      }
    }
    if (this.nonCanonicalForwardedHost) {
      const xForwardedHost2 = this.getHeader(request, this.nonCanonicalForwardedHost.toLowerCase());
      if (xForwardedHost2) {
        return `host:${xForwardedHost2.toLowerCase()}`;
      }
    }
    const xForwardedHost = this.getHeader(request, "x-forwarded-host");
    if (xForwardedHost) {
      const port = this.getHeader(request, "x-forwarded-port");
      const host = `host:${xForwardedHost.toLowerCase()}`;
      if (port && !["443", "80"].includes(port)) {
        if (!xForwardedHost.includes(":")) {
          return host + ":" + port;
        } else {
          return "host:" + xForwardedHost.replace(/:\d+$/, `:${port}`);
        }
      }
      return host;
    }
    return `host:${this.getHeader(request, "host")}`;
  }
  validateCredentials(credentials) {
    if (credentials.accessKey !== this.serverCredentials.accessKey) {
      throw ERRORS.AccessDenied("Invalid Access Key");
    }
    if (this.enforceRegion && credentials.region !== this.serverCredentials.region) {
      throw ERRORS.AccessDenied("Invalid Region");
    }
    if (credentials.service !== this.serverCredentials.service) {
      throw ERRORS.AccessDenied("Invalid Service");
    }
  }
  getSelectedRegion(clientRegion) {
    if (!this.enforceRegion && ["auto", "us-east-1", this.serverCredentials.region, ""].includes(clientRegion)) {
      return clientRegion;
    }
    return this.serverCredentials.region;
  }
  constructStringToSign(date, dateStamp, region, service, canonicalRequest) {
    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const hashedCanonicalRequest = crypto.createHash("sha256").update(canonicalRequest).digest("hex");
    return `${algorithm}
${date}
${credentialScope}
${hashedCanonicalRequest}`;
  }
  signingKey(key, dateStamp, regionName, serviceName) {
    const kDate = this.hmac(`AWS4${key}`, dateStamp);
    const kRegion = this.hmac(kDate, regionName);
    const kService = this.hmac(kRegion, serviceName);
    return this.hmac(kService, "aws4_request");
  }
  hmac(key, data) {
    return crypto.createHmac("sha256", key).update(data).digest();
  }
  getHeader(request, name) {
    const item = request.headers[name];
    if (Array.isArray(item)) {
      return item.join(",");
    }
    return item;
  }
};
function validateTypeOfStrings(...values) {
  return values.every((value) => typeof value === "string");
}

// src/sign.ts
var sig = new SignatureV4({
  enforceRegion: true,
  credentials: {
    accessKey: "",
    secretKey: "",
    region: "",
    service: ""
  }
});
export {
  sig
};
