import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const script=fs.readFileSync(path.join(root,'www/native-env.js'),'utf8');
const start=script.indexOf('  function comparerVersions(');
const end=script.indexOf('  var PLUGINS',start);
assert.ok(start>=0&&end>start);
const functions=script.slice(start,end);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'app-bundle.json'),'utf8'));
const zip=fs.readFileSync(path.join(root,'dist',path.basename(new URL(manifest.url).pathname)));
const checksum=createHash('sha256').update(zip).digest('hex');

async function run(local,remote,failDownload=false){
 const calls={downloads:[],next:[],set:[],messages:[],storage:new Map()};
 const context={
  Date,parseInt,Math,String,Error,console:{warn(){}},
  localStorage:{getItem:k=>calls.storage.get(k),setItem:(k,v)=>calls.storage.set(k,v),removeItem:k=>calls.storage.delete(k)},
  message:t=>calls.messages.push(t),
  fetch:async url=>({ok:true,json:async()=>url==='app-env.json'?{versionWeb:local}:remote}),
  U:{
   download:async o=>{calls.downloads.push(o);assert.equal(o.checksum,checksum,'native contract: exact SHA-256 is mandatory');if(failDownload)throw Error('network failed');return{id:'verified-bundle'};},
   next:async o=>calls.next.push(o),
   set:async o=>{calls.set.push(o);throw Error('set reloads immediately: forbidden');}
  }
 };
 vm.runInNewContext(functions+'\nverifierMiseAJour(U);',context);
 await new Promise(r=>setImmediate(r));
 return calls;
}
test('published checksum hashes the actual ZIP',()=>assert.equal(manifest.checksum,checksum));
test('older client passes mandatory native checksum then schedules next',async()=>{
 const r=await run('335.2',manifest);
 assert.equal(r.downloads.length,1);assert.equal(r.downloads[0].version,manifest.version);assert.equal(r.downloads[0].url,manifest.url);
 assert.equal(r.next.length,1);assert.equal(r.next[0].id,'verified-bundle');assert.equal(r.set.length,0);
});
for(const v of [manifest.version,'999999'])test('never download when local is '+v,async()=>{const r=await run(v,manifest);assert.equal(r.downloads.length,0);assert.equal(r.next.length,0);});
for(const value of [undefined,'','not-a-sha256',checksum.toUpperCase()])test('reject invalid checksum '+String(value).slice(0,20),async()=>{
 const r=await run('335.2',{...manifest,checksum:value});assert.equal(r.downloads.length,0);assert.equal(r.next.length,0);assert.equal(r.storage.size,0);
 assert.ok(r.messages.some(s=>s.includes('empreinte')));
});
test('failed download is retryable and does not activate a bundle',async()=>{
 const r=await run('335.2',manifest,true);assert.equal(r.downloads.length,1);assert.equal(r.storage.size,0);assert.equal(r.next.length,0);assert.ok(r.messages.some(s=>s.includes('network failed')));
});
test('installed upstream native contract requires checksum and set reloads',()=>{
 const native=fs.readFileSync(path.join(root,'node_modules/@capgo/capacitor-updater/android/src/main/java/ee/forgr/capacitor_updater/CapacitorUpdaterPlugin.java'),'utf8');
 const download=native.slice(native.indexOf('private BundleInfo downloadBundle('),native.indexOf('public void download(final PluginCall'));
 assert.match(download,/checksum == null \|\| checksum\.isEmpty\(\)/);assert.match(download,/throw new IOException\("Checksum required"\)/);
 const set=native.slice(native.indexOf('public void set(final PluginCall'),native.indexOf('private boolean preparePreviewFallbackIfNeeded'));
 assert.match(set,/this\._reload\(\)/);
 const hash=fs.readFileSync(path.join(root,'node_modules/@capgo/capacitor-updater/android/src/main/java/ee/forgr/capacitor_updater/CryptoCipher.java'),'utf8');
 assert.match(hash,/MessageDigest\.getInstance\("SHA-256"\)/);
});
