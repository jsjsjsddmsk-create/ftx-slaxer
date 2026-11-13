'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const dns = require('node:dns').promises, net = require('node:net');

const PORT = Number(process.env.PORT || 3000);
const INDEX = path.join(__dirname, 'index.html');
const DB_FILE = path.join(__dirname, 'database.json');

const MAX_BODY = 12000, MAX_BYTES = 2 * 1024 * 1024, TIMEOUT = 10000, MAX_ASSETS = 12;
const limits = new Map();

// قاعدة البيانات
let db = { keys: {}, blacklist: [] };
if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { console.log("DB Read Error", e); }
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

// الحماية (SSRF)
function private4(ip){const p=ip.split('.').map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return true;const[a,b]=p;return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===192&&b===0)||(a===198&&(b===18||b===19));}
function private6(ip){const x=ip.toLowerCase().split('%')[0];return x==='::'||x==='::1'||x.startsWith('fc')||x.startsWith('fd')||/^fe[89ab]/.test(x)||x.startsWith('ff')||x.startsWith('::ffff:');}
async function publicOnly(u){if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Only public HTTP/HTTPS URLs without credentials are allowed.');const h=u.hostname.toLowerCase().replace(/^\[|\]$/g,'');if(!h||h==='localhost'||h.endsWith('.local')||h.endsWith('.localhost'))throw Error('Local destinations are blocked.');const f=net.isIP(h);if(f===4&&private4(h)||f===6&&private6(h))throw Error('Private or reserved IP blocked.');if(!f){const rs=await dns.lookup(h,{all:true});if(!rs.length||rs.some(r=>r.family===4?private4(r.address):private6(r.address)))throw Error('Hostname resolves to a private address.');}}

function send(res,s,obj){res.writeHead(s,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));}
function rate(req,res){const k=req.socket.remoteAddress||'unknown',n=Date.now();let v=limits.get(k)||{start:n,count:0};if(n-v.start>60000)v={start:n,count:0};v.count++;limits.set(k,v);if(v.count>30){send(res,429,{error:'Rate limit reached. Try again in one minute.'});return true;}return false;}
async function fetchText(raw){let u=new URL(raw);for(let i=0;i<=4;i++){await publicOnly(u);const c=new AbortController(),timer=setTimeout(()=>c.abort(),TIMEOUT);let r;try{r=await fetch(u,{redirect:'manual',signal:c.signal,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/javascript,text/css,application/json,text/plain;q=0.9'}});}finally{clearTimeout(timer);}if([301,302,303,307,308].includes(r.status)){if(i===4)throw Error('Redirect limit reached.');const loc=r.headers.get('location');if(!loc)throw Error('Redirect location missing.');u=new URL(loc,u);continue;}if(!r.ok)throw Error('Remote HTTP '+r.status);const type=r.headers.get('content-type')||'';if(!/(text\/|javascript|json|xml|svg)/i.test(type))throw Error('Unsupported content type: '+type);if(Number(r.headers.get('content-length')||0)>MAX_BYTES)throw Error('Resource exceeds 2 MB.');const rd=r.body.getReader(),parts=[];let size=0;while(true){const{done,value}=await rd.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await rd.cancel();throw Error('Resource exceeds 2 MB.');}parts.push(Buffer.from(value));}return{text:Buffer.concat(parts).toString('utf8'),url:u.href,status:r.status,type};}throw Error('Redirect failed.');}
function readBody(req){return new Promise((ok,no)=>{let s='';req.on('data',c=>{s+=c.toString();if(Buffer.byteLength(s)>MAX_BODY){no(Error('Request too large.'));req.destroy();}});req.on('end',()=>ok(s));req.on('error',no);});}
function assetsOf(html,base){const set=new Set(),re=/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']|<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;let m;while((m=re.exec(html))&&set.size<MAX_ASSETS){try{const u=new URL(m[1]||m[2],base);if(u.origin===new URL(base).origin&&/\.(js|mjs|css)(?:$|\?)/i.test(u.pathname+u.search))set.add(u.href);}catch{}}return[...set];}

const app = http.createServer(async (req, res) => {
    const p = new URL(req.url, 'http://localhost').pathname;

    // 1. الواجهة
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
        return fs.readFile(INDEX, (e, b) => {
            if (e) { res.writeHead(500); return res.end('index.html missing'); }
            res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(b);
        });
    }

    // 2. الفحص الحقيقي
    if (req.method === 'POST' && p === '/api/site') {
        if (rate(req, res)) return;
        try {
            const x = JSON.parse(await readBody(req) || '{}');
            if (typeof x.url !== 'string' || x.url.length > 2048) return send(res, 400, {error: 'Enter a valid public URL.'});
            let u; try { u = new URL(x.url); } catch { return send(res, 400, {error: 'Invalid URL.'}); }
            const page = await fetchText(u.href);
            const assets = [];
            for (const link of assetsOf(page.text, page.url)) {
                try { assets.push(await fetchText(link)); } catch (e) { assets.push({url: link, error: e.message}); }
            }
            return send(res, 200, {page, assets});
        } catch (e) {
            return send(res, e.name === 'AbortError' ? 504 : 502, {error: e.name === 'AbortError' ? 'Remote site timed out.' : e.message});
        }
    }

    // 3. تسجيل الدخول
    if (req.method === 'POST' && p === '/api/auth') {
        try {
            const { key } = JSON.parse(await readBody(req) || '{}');
            if (!key) return send(res, 400, { error: 'Key required' });
            const OWNER_KEY = "!LRZ X !MARAWAN-976&$";
            if (key === OWNER_KEY) return send(res, 200, { success: true, role: 'owner' });
            if (db.blacklist.includes(key)) return send(res, 403, { error: 'This key is BLACKLISTED.' });
            if (db.keys[key]) {
                if (Date.now() < db.keys[key].expiry) return send(res, 200, { success: true, role: 'user' });
                else { delete db.keys[key]; saveDB(); return send(res, 403, { error: 'This key has EXPIRED.' }); }
            }
            return send(res, 403, { error: 'Invalid Key.' });
        } catch (e) { return send(res, 500, { error: 'Server error.' }); }
    }

    // 4. توليد المفاتيح
    if (req.method === 'POST' && p === '/api/generate') {
        try {
            const { type, amount, hwid } = JSON.parse(await readBody(req) || '{}');
            let expiry = Date.now();
            if (type === 'DAYS') expiry += (amount * 24 * 60 * 60 * 1000);
            else if (type === 'HOURS') expiry += (amount * 60 * 60 * 1000);
            else if (type === 'LIFETIME') expiry += (99 * 365 * 24 * 60 * 60 * 1000);
            const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
            const hwidTag = hwid ? "LOCK" : "FREE";
            const fullKey = `http://lrz-x-marawan.com/key?auth=LRZ_X_MARAWAN_${randomStr}_${hwidTag}`;
            db.keys[fullKey] = { expiry, type: type === 'LIFETIME' ? 'LIFETIME' : `${amount} ${type}`, hwid: hwidTag };
            saveDB();
            return send(res, 200, { success: true, key: fullKey, expiry });
        } catch (e) { return send(res, 500, { error: 'Server error.' }); }
    }

    // 5. البلاك ليست
    if (req.method === 'POST' && p === '/api/blacklist') {
        const { key } = JSON.parse(await readBody(req) || '{}');
        if (key && !db.blacklist.includes(key)) { db.blacklist.push(key); saveDB(); }
        return send(res, 200, { success: true, blacklist: db.blacklist });
    }
    if (req.method === 'POST' && p === '/api/unblacklist') {
        const { key } = JSON.parse(await readBody(req) || '{}');
        db.blacklist = db.blacklist.filter(k => k !== key); saveDB();
        return send(res, 200, { success: true, blacklist: db.blacklist });
    }
    if (req.method === 'GET' && p === '/api/blacklist') {
        return send(res, 200, { blacklist: db.blacklist });
    }

    res.writeHead(404); res.end('Not Found');
});

app.listen(PORT, '0.0.0.0', () => console.log('🚀 Server running on port ' + PORT));
