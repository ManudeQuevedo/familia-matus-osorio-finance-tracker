import fs from "node:fs";

const files = [
  {
    path: "node_modules/next-themes/dist/index.mjs",
    old:
      'scriptProps:w})=>{let p=JSON.stringify([s,i,a,e,h,l,u,m]).slice(1,-1);return t.createElement("script",{...w,suppressHydrationWarning:!0,nonce:typeof window=="undefined"?d:"",dangerouslySetInnerHTML:{__html:`(${M.toString()})(${p})`}})}',
    neu:
      'scriptProps:w})=>{if(typeof window!=="undefined")return null;let p=JSON.stringify([s,i,a,e,h,l,u,m]).slice(1,-1);return t.createElement("script",{...w,suppressHydrationWarning:!0,nonce:d,dangerouslySetInnerHTML:{__html:`(${M.toString()})(${p})`}})}',
  },
  {
    path: "node_modules/next-themes/dist/index.js",
    old:
      'scriptProps:w})=>{let p=JSON.stringify([n,s,d,e,h,u,l,o]).slice(1,-1);return t.createElement("script",{...w,suppressHydrationWarning:!0,nonce:typeof window=="undefined"?m:"",dangerouslySetInnerHTML:{__html:`(${I.toString()})(${p})`}})}',
    neu:
      'scriptProps:w})=>{if(typeof window!=="undefined")return null;let p=JSON.stringify([n,s,d,e,h,u,l,o]).slice(1,-1);return t.createElement("script",{...w,suppressHydrationWarning:!0,nonce:m,dangerouslySetInnerHTML:{__html:`(${I.toString()})(${p})`}})}',
  },
];

for (const { path, old, neu } of files) {
  const content = fs.readFileSync(path, "utf8");
  if (content.includes('if(typeof window!=="undefined")return null;let p=JSON.stringify')) {
    console.log(`${path}: already patched`);
    continue;
  }
  if (!content.includes(old)) {
    console.error(`${path}: pattern not found`);
    process.exit(1);
  }
  fs.writeFileSync(path, content.replace(old, neu));
  console.log(`${path}: patched`);
}
