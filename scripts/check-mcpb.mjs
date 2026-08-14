// Strict-parse gate for the packed bundle, run on every `npm run mcpb`.
// Claude Desktop's zip reader (yauzl) rejects archives whose
// end-of-central-directory record is inconsistent, while lenient tools
// (unzip -t, mcpb's own extractor) pass them, so only a strict parse
// catches that failure class before a release.
//
// Signing is deliberately absent from the `mcpb` script chain:
// @anthropic-ai/mcpb 2.1.2's `sign` appends its PKCS#7 signature block
// after the EOCD record without updating the 2-byte comment-length field
// (sign.js: Buffer.concat([mcpbContent, signatureBlock])), so every signed
// bundle fails this exact check with "Invalid comment length. Expected:
// <signature size>. Found: 0." and Claude Desktop refuses to install it.
// A self-signed signature also buys nothing in practice, because
// `mcpb verify` reports any certificate absent from the OS trust store as
// "not signed". Restore `npm run mcpb:sign` to the chain once the upstream
// bug is fixed, and keep this check either way.
import yauzl from 'yauzl';
import process from 'node:process';

const path = process.argv[2];
if (!path) {
  console.error('usage: node scripts/check-mcpb.mjs <bundle.mcpb>');
  process.exit(2);
}
yauzl.open(path, { lazyEntries: true }, (err, zip) => {
  if (err) {
    console.error(`FAIL strict zip parse of ${path}: ${err.message}`);
    process.exit(1);
  }
  console.log(`OK strict zip parse of ${path}: ${zip.entryCount} entries`);
  zip.close();
});
