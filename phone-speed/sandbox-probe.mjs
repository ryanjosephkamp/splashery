import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const result={at:new Date().toISOString(),executable:'/usr/bin/chromium',chromiumSandbox:true};
try{const b=await chromium.launch({executablePath:result.executable,chromiumSandbox:true,args:['--disable-gpu'],timeout:20000});result.browser=b.version();await b.close();result.ok=true;}catch(e){result.ok=false;result.error=e.message;}
await fs.writeFile('.cache/phone-speed/sandbox-probe.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
