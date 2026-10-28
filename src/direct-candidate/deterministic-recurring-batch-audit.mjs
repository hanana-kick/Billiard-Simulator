/** Source pin for the 29 locally bounded-index kernels audited at 8e55403.
 * The lift is NOT a general arbitrary-WGSL address validator: an original OOB
 * index could otherwise wrap across candidate banks. Any upstream source change
 * requires a renewed bounds/ownership audit and updated pinned source digest.
 * Phase9 was independently re-audited for the original-position derivative
 * release gate; see docs/deterministic-recurring-batch.md (2026-10-27 addendum).
 */
export const RECURRING_AUDITED_SOURCE_SHA256=Object.freeze([
  "d21c387714fd91a52ed67dacf242483d44436a08b4eb8eb329f57c9c6fb9a4c2",
  "cb332ccadd6a932ed7c0c52a307e1dfc030770a0cc702f95749045ac2f203c5a",
  "50ae862de9d1201244b216408f620bba43ec10411acab0dc53cf0535fa391462",
  "bd9540d589fb8ae0dab9aad92314afb34d4cd245ffa4db652346b8155dcbce50",
  "3f023498d69def9ef5dd6b03f4beb8742918125cc4124cc51a5bc04f39c6d9b9",
  "19c19eda25ae445f611235f9650459babd36af0bdf9fdae2bb91deec4cfa8617",
  "56e8348606d7f2f787305498ab2c98151fb7aabb1365f973bc8944e4941fbc28",
  "43a205fc33ec4dd139f2e1e5e7488af406a0dee5fe9817bbcdcfa59f0eb1d4f1",
  "64441c37774ee19ed497a5739d9491bf59b645eb98a0d27b59cc97802d930c8f",
  "99b9af1f06f184155e63fffaaee5d39ede1a341fb60a0263213896783efd5c74",
  "5add2146496d9efdede83aaf5c5a52b44aa0b28446a60034f1a17563e0c3e1db",
  "8b179a8865b68a74aae0d094195779ac03532cd5be5a001dec65abf64677731d",
  "e1e53847cf778b328fb834883ae547af493828e86354165c1b9c32627e04aa1a",
  "3b5a6c4ebc8f54a4cdebcaa7bd9e5df1abf79086260493cdb0c688b8f5294487",
  "c50706ed5b4e9b20879c92a66be013ea79c26e9466fc50ecaea6ccab1ae622e1",
  "03f642aba114f1b0b58180913f46a5c0835abe710e7c8a2a7236da6d205d5edd",
  "9a1655edd4ca85842bf26196e6860732aa5f036d38b29c2a9470af7015c217ef",
  "91aa4db80a2247da4fef76fd925b05fa25442410bd758f5e52764a569544ae23",
  "ae175b63debb252e19254237cdf3e81eb996098ad2550f6efa8db59adeb044f6",
  "b52dd5d58fe8a4ff061dd36d96592bb71d912a675138ea215d30e4c289d03c64",
  "73c365aa62776649d35252f1e65727b5751ad76e766405d1358005836717e5a6",
  "732729a85116c36a449cdb8f55976b06b49c929d485fb0eb87e0155fb923dd4c",
  "f5479360764ece3fa1bac2fc79dd95f6336fbd5f08d370ae9b93a250e4e0c10a",
  "19860115100c9e954e7aec9d4f1f7e5e510578d3b333e3543a2f02da850b6a68",
  "df573a994cd36db1b1c3e838d7368b77621ad55a3a5711065de332d21b13935a",
  "3d42c2ff0ff430a63cac7b98121a84dfb947221ca648492fe940ccbf18ae7e7d",
  "cb606edb294e901ee274f9bb0fac78654f116577f68edb92d96f91d6ad86a92e",
  "157384d0554fdf7fdf1db8d26bffb3baadbf916aeaddd1a42f9712ca81163de8",
  "ade245b6ea24c08fdf445a25596db5f0f4f23536b516d76c715b384fcba389ea"
]);
export async function verifyRecurringBatchSources(specs){
 if(!globalThis.crypto?.subtle)throw Error('Web Crypto required for audited batch source verification');
 const digests=await Promise.all(specs.map(async s=>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s.source));return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}));
 for(let i=0;i<specs.length;i++)if(digests[i]!==RECURRING_AUDITED_SOURCE_SHA256[specs[i].sourceIndex])throw Error('Prepared batch kernel source changed; renewed local-address audit required at phase '+i);
 return true;
}
