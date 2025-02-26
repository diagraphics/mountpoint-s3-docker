import  { createSignatureV4, SignatureV4 } from './signature-v4';


function createS3Fetch() {
    const signatureV4 = createSignatureV4();

    return async function s3fetch(url: string, init?: RequestInit) {

        const parsedUrl = new URL(url);

        SignatureV4.


    }
}