import { env, argv } from "node:process";
import { createSignatureV4 } from "./signature-v4.js";

async function main() {
    const signatureV4 = createSignatureV4();

}