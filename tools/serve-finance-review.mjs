/* Serves only the generated synthetic review, fixture and acceptance notes on loopback. */
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]||'../../../output/finance-review-20261119');
const port=Number(process.env.FINANCE_REVIEW_PORT||4220);
const routes=new Map([
 ['/', ['index.html','text/html; charset=utf-8']],
 ['/index.html',['index.html','text/html; charset=utf-8']],
 ['/虚拟数据.json',['虚拟数据.json','application/json; charset=utf-8']],
 ['/验收说明.md',['验收说明.md','text/plain; charset=utf-8']]
]);
createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 let route;
 try{route=routes.get(decodeURIComponent(url.pathname))}catch{}
 if(!route||req.method!=='GET'){res.writeHead(404);res.end();return}
 try{
  const body=readFileSync(resolve(root,route[0]));
  const headers={'Content-Type':route[1],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(route[0].endsWith('.json'))headers['Content-Disposition']="attachment; filename*=UTF-8''"+encodeURIComponent(route[0]);
  res.writeHead(200,headers);res.end(body);
 }catch{res.writeHead(404);res.end()}
}).listen(port,'127.0.0.1',()=>console.log('FINANCE_REVIEW http://127.0.0.1:'+port+'/#expense-analysis'));
