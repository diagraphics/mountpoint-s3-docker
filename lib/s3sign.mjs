import { createSignature } from "./signature-v4.mjs";
import { env, argv } from "node:process";

async function main() {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = env;
  //const [amzDate, host, path] = argv.slice(2);

  const [url, amzDate] = argv.slice(2);

  const { host, pathname: path, searchParams } = new URL(url);

  const sig = await createSignature({
    region: AWS_REGION,
    amzDate,
    host,
    searchParams,
    //path: encodeURI(path),
    path,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  });

  console.log(sig);
}

main()
