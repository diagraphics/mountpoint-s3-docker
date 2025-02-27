import { env } from "node:process";
import crypto from "node:crypto";
import {
  SignatureV4,
  type ClientSignature,
} from "supa-storage/src/storage/protocols/s3/signature-v4.ts";

import type { SignableRequest } from "./request.ts";

type SignatureRequest = Parameters<SignatureV4["verify"]>[1];
// type ClientSignatureWithHash = ClientSignature & { contentSha: string };

async function* chunks<T>(readable: ReadableStream<T>) {
  const reader = readable.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield value;
  }
}

class RequestSignatureV4 extends SignatureV4 {
  static formatShortDate(longDate: string) {
    return longDate.slice(0, 8);
  }

  static formatLongDate(date: Date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  }

  static async hashBody(request: SignableRequest) {
    const { body } = request.clone();

    if (body == null) {
      return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    }

    const hash = crypto.createHash("sha256");

    for await (const chunk of chunks(body)) {
      hash.update(chunk);
    }

    return hash.digest("hex");
  }

  protected async getClientSignature(
    request: SignableRequest,
    date: Date | string,
    includeContentSha256 = false,
    useUnsignedPayload = false
  ): Promise<ClientSignature> {
    const { accessKey, region, service } = this.serverCredentials;

    const self = this.constructor as typeof RequestSignatureV4;

    const longDate =
      typeof date === "string" ? date : self.formatLongDate(date);

    const shortDate = self.formatShortDate(longDate);

    const signedHeaders = [
      "host",                     // Always required
      "x-amz-content-sha256",     // To be added
      "x-amz-date",               // To be added
      "accept",
      // "content-length"
    ];

    // Push additional headers that are required if they are present
    for (const header of request.headers.keys()) {
      if (header.startsWith("x-amz-") || header === "content-type") {
        signedHeaders.push(header);
      }
    }

    signedHeaders.sort();

    const signature = ""; // Not calculated yet

    let contentSha: string | undefined;

    // TODO get hash from existing header if present
    if (includeContentSha256) {
      if (useUnsignedPayload && request.body == undefined) {
        contentSha = "UNSIGNED-PAYLOAD";
      } else {
        contentSha = await self.hashBody(request);
      }
    }

    return {
      credentials: { accessKey, region, service, shortDate },
      longDate,
      signedHeaders,
      signature,
      contentSha
    };
  }

  protected getSignatureRequest(request: SignableRequest): SignatureRequest & { host: string } {
    const { method, url: rawUrl, body, headers } = request.clone();

    const url = new URL(rawUrl);
    const { searchParams } = url;

    return {
      url: url.pathname,
      host: url.host,
      method,
      body: body ?? undefined,
      headers: Object.fromEntries(headers.entries()),
      query: Object.fromEntries(searchParams.entries()),
    };
  }

  async signRequest(
    request: SignableRequest,
    date: Date | string,
    useUnsignedPayload = false
  ): Promise<string> {
    const { host, ...signatureRequest } = this.getSignatureRequest(request);

    console.log("Signature request is", signatureRequest);
    const clientSignature = await this.getClientSignature(request, date, true, useUnsignedPayload);

    const { longDate, contentSha, credentials } = clientSignature;

    signatureRequest.headers["host"] = host;
    signatureRequest.headers["x-amz-date"] = longDate;
    signatureRequest.headers["x-amz-content-sha256"] = contentSha!;

    const { signature, canonicalRequest } = this.sign(
      clientSignature,
      signatureRequest
    );

    const { shortDate, accessKey, region, service } =
      clientSignature.credentials;

    const credential = `${accessKey}/${shortDate}/${region}/${service}/aws4_request`;
    const signedHeaders = clientSignature.signedHeaders.join(";");

    request.headers.set(
      "Authorization",
      `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    );

    request.headers.set("X-Amz-Date", longDate);
    request.headers.set("X-Amz-Content-Sha256", contentSha!);

    return canonicalRequest;
  }
}

function createRequestSignatureV4() {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = env;

  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
    throw new Error("Missing AWS credentials");
  }

  return new RequestSignatureV4({
    enforceRegion: true,
    credentials: {
      accessKey: AWS_ACCESS_KEY_ID,
      secretKey: AWS_SECRET_ACCESS_KEY,
      region: AWS_REGION,
      service: "s3",
    },
  });
}

export { createRequestSignatureV4, RequestSignatureV4 };
