import { argv } from "node:process";
import { createRequestSignatureV4 } from "../dist/signature-v4.js"

async function main() {
    const signatureV4 = createRequestSignatureV4();

    const [url, amzDate] = argv.slice(2);

    const request = new Request(url, {
      method: "GET",
      headers: {
        "Accept": "application/xml",
        "Content-Length": "0"
      }
    });

    const canonicalRequest = await signatureV4.signRequest(
      request,
      amzDate ?? new Date(),
      true
    );

    console.log('Canonical Request:\n', canonicalRequest);

    const response = await fetch(request);

    console.log('Response:');
    console.log(await response.text());
  }

  main();