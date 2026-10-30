import {files,headers,buildId} from '../.wrangler/static-assets.mjs';
export {buildId};
export function bundledAsset(request) {
  const path=new URL(request.url).pathname;
  const privateRoute=path==='/admin'||path.startsWith('/admin/');
  const responseHeaders={...headers,'Cache-Control':privateRoute?'private, no-store':'no-cache','X-Frame-Options':'DENY'};
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...responseHeaders,Allow:'GET, HEAD'}});
  if(path==='/admin')return new Response(null,{status:303,headers:{...responseHeaders,Location:'/admin/'}});
  const key=({'/':'/index.html','/admin/':'/admin/index.html','/privacy':'/privacy.html'})[path]??path;
  if(!Object.hasOwn(files,key))return new Response('Not found',{status:404,headers:responseHeaders});
  const file=files[key];
  return new Response(request.method==='HEAD'?null:file.body,{headers:{...responseHeaders,'Content-Type':file.type}});
}
export function staticAsset(request,env) { return env.ASSETS?env.ASSETS.fetch(request):bundledAsset(request); }
