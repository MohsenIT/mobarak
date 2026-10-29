const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/e2e',timeout:45000,expect:{timeout:10000},fullyParallel:false,workers:2,
 reporter:process.env.CI?[['list'],['html',{open:'never'}]]:'list',
 use:{baseURL:process.env.READER_URL||'http://127.0.0.1:3009',serviceWorkers:'block',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[
  {name:'chromium-phone',use:{browserName:'chromium',viewport:{width:360,height:800}}},
  {name:'chromium-narrow',use:{browserName:'chromium',viewport:{width:320,height:700}}},
  {name:'chromium-landscape',use:{browserName:'chromium',viewport:{width:740,height:390}}},
  {name:'chromium-desktop',use:{browserName:'chromium',viewport:{width:1280,height:900}}},
  {name:'android-bridge-phone',use:{browserName:'chromium',viewport:{width:400,height:850}}},
  {name:'webkit-phone',use:{browserName:'webkit',viewport:{width:390,height:844}}},
  {name:'firefox-desktop',use:{browserName:'firefox',viewport:{width:1280,height:900}}},
 ],
});
