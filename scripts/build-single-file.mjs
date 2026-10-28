import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const output=process.argv[2]||'/workspace/The-Candleman-Descent.html';
const files=await readdir('dist/assets');
const main=files.find(f=>f.startsWith('index-')&&f.endsWith('.js'));
let js=await readFile(path.join('dist/assets',main),'utf8');
for(const file of files.filter(f=>f.endsWith('.js')&&f!==main)){
 const data=await readFile(path.join('dist/assets',file));
 js=js.replaceAll(`./${file}`,`data:text/javascript;base64,${data.toString('base64')}`);
}
let html=await readFile('dist/index.html','utf8');
html=html.replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/g,'').replace(/<link[^>]*rel="modulepreload"[^>]*>/g,'');
const css=await readFile(path.join('dist/assets',files.find(f=>f.endsWith('.css'))),'utf8');
html=html.replace(/<link[^>]*rel="stylesheet"[^>]*>/g,()=>`<style>${css}</style>`);
html=html.replace('</body>',()=>`<script type="module">${js.replaceAll('</script','<\\/script')}</script></body>`);
await writeFile(output,html);console.log(output);
