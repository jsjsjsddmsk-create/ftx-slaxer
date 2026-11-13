'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const dns = require('node:dns').promises;
const net = require('node:net');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'db.json');
const MAX_BODY = 4096;
const MAX_RESPONSE = 3 * 1024 * 1024;
const TIMEOUT_MS = 15000;
const rate = new Map();

// --- Database (Keys & Blacklist) ---
let db = { keys: {}, blacklist: [] };
if (fs.existsSync(DB_FILE)) { try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch(e) {} }
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

function getClientIp(req) {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  return ip.replace(/^.*:/, ''); 
}

function isPrivateIPv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a,b] = p;
  return a===0 || a===10 || a===127 || a>=224 || (a===100 && b>=64 && b<=127) || (a===169 && b===254) || (a===172 && b>=16 && b<=31) || (a===192 && b===168) || (a===192 && b===0) || (a===198 && (b===18 || b===19));
}
function isPrivateIPv6(ip) {
  const x = ip.toLowerCase().split('%')[0];
  return x==='::' || x==='::1' || x.startsWith('fc') || x.startsWith('fd') || /^fe[89ab]/.test(x) || x.startsWith('ff') || x.startsWith('::ffff:');
}
async function assertPublicHost(url) {
  if (!['http:','https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are allowed.');
  if (url.username || url.password) throw new Error('URLs containing credentials are not allowed.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g,'');
  
  // حماية الموقع بتاعك
  if (host === 'lrz-x-marawan.onrender.com') throw new Error('THIS WAS OWNER APP');

  if (!host || host==='localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('Blocked host.');
  const kind = net.isIP(host);
  if (kind===4 && isPrivateIPv4(host)) throw new Error('Blocked host: private IP.');
  if (kind===6 && isPrivateIPv6(host)) throw new Error('Blocked host: private IPv6.');
  if (!kind) {
    const records = await dns.lookup(host, {all:true, verbatim:true});
    if (!records.length || records.some(r => r.family===4 ? isPrivateIPv4(r.address) : isPrivateIPv6(r.address))) throw new Error('Blocked host: DNS resolves to private IP.');
  }
}

function limited(req, res) {
  const ip = getClientIp(req);
  const now = Date.now(), entry = rate.get(ip) || {start:now,count:0};
  if (now-entry.start > 60000) { entry.start=now; entry.count=0; }
  entry.count++; rate.set(ip,entry);
  if (entry.count > 45) { send(res,429,{error:'Too many requests. Wait one minute.'}); return true; }
  return false;
}

function send(res,status,obj) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(obj));
}

async function fetchPublic(raw) {
  let current = new URL(raw);
  for (let hop=0; hop<=4; hop++) {
    await assertPublicHost(current);
    const controller = new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    let response;
    try {
      response=await fetch(current,{ method:'GET', redirect:'manual', signal:controller.signal, headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64)','Accept':'text/html,*/*;q=0.8'} });
    } finally { clearTimeout(timer); }
    
    if ([301,302,303,307,308].includes(response.status)) {
      if (hop===4) throw new Error('Too many redirects.');
      const loc=response.headers.get('location'); if(!loc) throw new Error('Redirect missing.');
      current=new URL(loc,current); continue;
    }
    if (!response.ok) { const e=new Error(`Remote HTTP ${response.status}.`); e.status=response.status; throw e; }
    const declared=Number(response.headers.get('content-length')||0);
    if (declared>MAX_RESPONSE) throw new Error('Exceeds 3 MB limit.');
    const reader=response.body.getReader(); const chunks=[]; let total=0;
    while (true) {
      const {done,value}=await reader.read(); if(done)break;
      total+=value.byteLength;
      if(total>MAX_RESPONSE) { await reader.cancel(); throw new Error('Exceeds 3 MB limit.'); }
      chunks.push(Buffer.from(value));
    }
    return { text: Buffer.concat(chunks).toString('utf8'), status:response.status, finalUrl:current.href, contentType:response.headers.get('content-type')||'' };
  }
  throw new Error('Redirect chain failed.');
}

const server=http.createServer(async(req,res)=>{
  if(req.method==='POST' && req.url==='/api/fetch'){
    if(limited(req,res))return;
    let body='';
    req.on('data',chunk=>{ body+=chunk; if(body.length>MAX_BODY){req.destroy();} });
    req.on('end',async()=>{
      try {
        const parsed=JSON.parse(body||'{}');
        if(typeof parsed.url!=='string'||parsed.url.length>2048) return send(res,400,{error:'Invalid URL.'});
        
        // حماية إضافية في السيرفر
        if (parsed.url.includes('lrz-x-marawan.onrender.com')) return send(res, 403, { error: 'THIS WAS OWNER APP' });

        let url; try { url=new URL(parsed.url); } catch { return send(res,400,{error:'Invalid URL.'}); }
        const result=await fetchPublic(url.href);
        send(res,200,result);
      } catch(e) { send(res, e.status||502, {error: e.name==='AbortError'?'Timeout.':e.message}); }
    });
    return;
  }

  if(req.method==='POST' && req.url==='/api/auth'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',()=>{
      try {
        const { key } = JSON.parse(body||'{}');
        const clientIp = getClientIp(req);
        const OWNER_KEY = "!LRZ X !MARAWAN-976&$";
        
        if (key === OWNER_KEY) return send(res, 200, { success: true, role: 'owner' });
        if (db.blacklist.includes(key)) return send(res, 403, { error: 'BLACKLISTED' });
        
        if (db.keys[key]) {
          const keyData = db.keys[key];
          if (Date.now() > keyData.expiry) { delete db.keys[key]; saveDB(); return send(res, 403, { error: 'EXPIRED' }); }
          if (keyData.hwid !== "FREE" && keyData.ip !== clientIp) return send(res, 403, { error: 'HWID MISMATCH' });
          return send(res, 200, { success: true });
        }
        return send(res, 403, { error: 'Invalid Key' });
      } catch(e) { return send(res, 500, { error: 'Server Error' }); }
    });
    return;
  }

  if(req.method==='POST' && req.url==='/api/generate'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',()=>{
      try {
        const { type, amount, hwid } = JSON.parse(body||'{}');
        const clientIp = getClientIp(req);
        let expiry = Date.now();
        if (type === 'DAYS') expiry += (amount * 86400000);
        else if (type === 'HOURS') expiry += (amount * 3600000);
        else expiry += (99 * 31536000000);
        
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        const hwidTag = hwid ? "LOCK" : "FREE";
        const fullKey = `https://lrz-x-marawan.onrender.com/key?auth=LRZ_X_MARAWAN_${randomStr}_${hwidTag}`;
        
        db.keys[fullKey] = { expiry, hwid: hwidTag, ip: hwid ? clientIp : null };
        saveDB();
        return send(res, 200, { success: true, key: fullKey });
      } catch(e) { return send(res, 500, { error: 'Server Error' }); }
    });
    return;
  }

  if(req.method==='POST' && req.url==='/api/blacklist'){
    let body=''; req.on('data',c=>body+=c);
    req.on('end',()=>{
      const { key } = JSON.parse(body||'{}');
      if (key && !db.blacklist.includes(key)) { db.blacklist.push(key); saveDB(); }
      return send(res, 200, { success: true, blacklist: db.blacklist });
    });
    return;
  }
  if(req.method==='GET' && req.url==='/api/blacklist') return send(res, 200, { blacklist: db.blacklist });
  if(req.method==='GET' && req.url==='/api/health') return send(res,200,{ok:true, service:'V24', node:process.version});

  if(req.method==='GET'){
    const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
    const target=pathname==='/'?'index.html':pathname.replace(/^\/+/,'');
    const file=path.resolve(ROOT,target);
    if(!file.startsWith(ROOT+path.sep)){ res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file,(err,data)=>{
      if(err){ res.writeHead(404); return res.end('Not found'); }
      const ext=path.extname(file);
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8'};
      res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});
      res.end(data);
    });
    return;
  }
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(PORT,'0.0.0.0',()=>console.log(`V24 listening on ${PORT}`));
