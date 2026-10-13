/* Contrat JS dans un vrai navigateur + CSP. Ce contrôle ne prouve PAS le
   téléchargement Android : UpdateContractTest exerce séparément le plugin natif.
   Usage : node scripts/verif-maj.mjs [--published]
   Sans --published, on intercepte uniquement le manifeste avec le fichier local.
   Avec --published, le vrai manifeste public doit égaler le manifeste local. */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/PC/AppData/Local/hermes/hermes-agent/package.json');
const {chromium}=require('playwright-core');
const root=path.resolve(import.meta.dirname,'..');
const www=path.join(root,'www');
const manifestUrl='https://raw.githubusercontent.com/Arthefacte/fractal-arena-mobile/main/app-bundle.json';
const manifest=JSON.parse(fs.readFileSync(path.join(root,'app-bundle.json'),'utf8'));
const checksum=createHash('sha256').update(fs.readFileSync(path.join(root,'dist',path.basename(new URL(manifest.url).pathname)))).digest('hex');
assert.equal(manifest.checksum,checksum);
const published=process.argv.includes('--published');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const f=path.resolve(www,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
 if(!f.startsWith(www+path.sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
try{
 for(const version of ['0',manifest.version,'999999']){
  const page=await browser.newPage({viewport:{width:412,height:915}});
  await page.addInitScript(({expected})=>{
   window.__update={ready:0,downloads:[],next:[],sets:[],rejected:[],reloads:[],ordre:[]};
   window.Capacitor={Plugins:{CapacitorUpdater:{
    notifyAppReady:()=>{window.__update.ready++;return Promise.resolve();},
    download:o=>{
     window.__update.ordre.push('download');
     window.__update.downloads.push(o);
     if(!o.checksum||o.checksum!==expected.checksum||o.url!==expected.url||o.version!==expected.version){window.__update.rejected.push(o);return Promise.reject(new Error('Native checksum contract violated'));}
     return Promise.resolve({id:'contract-only'});
    },
    next:o=>{window.__update.ordre.push('next');window.__update.next.push(o);return Promise.resolve();},
    // Le reload du plugin applique le paquet en attente (Java 6.51.23) : c'est
    // le chemin qu'on veut voir, à la place d'un `set` qui recharge sans prévenir.
    reload:()=>{window.__update.ordre.push('reload');window.__update.reloads.push({t:Date.now()});return Promise.resolve();},
    set:o=>{window.__update.ordre.push('set');window.__update.sets.push(o);return Promise.reject(new Error('set would interrupt the game'));}
   }}};
  },{expected:manifest});
  await page.route('**/*',route=>{
   const r=route.request(),u=new URL(r.url());
   if(r.method()!=='GET')return route.abort();
   if(u.pathname==='/app-env.json')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({versionWeb:version})});
   if(u.href.startsWith(manifestUrl)&&!published)return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(manifest)});
   if(u.hostname==='127.0.0.1'||u.href.startsWith(manifestUrl))return route.continue();
   return route.abort();
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
  const live=await page.evaluate(async m=>{const r=await fetch(m+'?probe='+Date.now(),{cache:'no-store'});return {status:r.status,data:await r.json()};},manifestUrl);
  assert.equal(live.status,200);assert.deepEqual(live.data,manifest);
  await page.waitForTimeout(14000);
  const actual=await page.evaluate(()=>window.__update);
  assert.ok(actual.ready>0);assert.deepEqual(errors,[]);assert.deepEqual(actual.rejected,[]);
  assert.deepEqual(actual.downloads,version==='0'?[manifest]:[]);
  assert.deepEqual(actual.next,version==='0'?[{id:'contract-only'}]:[]);
  assert.deepEqual(actual.sets,[]);
  // Nouveau : le paquet téléchargé est appliqué TOUT DE SUITE (reload), après
  // next(), et jamais pour une version égale ou plus ancienne.
  assert.equal(actual.reloads.length,version==='0'?1:0,
   'la mise à jour doit s\'appliquer sans deuxième lancement manuel, et seulement quand il y a quelque chose à appliquer');
  assert.deepEqual(actual.ordre,version==='0'?['download','next','reload']:[],
   'ordre attendu : télécharger, programmer la bascule, puis appliquer');
  console.log(JSON.stringify({version,source:published?'public manifest':'local manifest',actual,errors}));
  await page.close();
 }
}finally{await browser.close();server.close();}
