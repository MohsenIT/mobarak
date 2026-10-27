/** Generate bundled, offline PNG media covers from the app's Arabic font and Quran metadata. */
const fs=require('node:fs'),path=require('node:path')
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
 const root=path.resolve(__dirname,'..'),{surahs}=JSON.parse(fs.readFileSync(path.join(root,'public/data/meta.json'))),brand=JSON.parse(fs.readFileSync(path.join(root,'public/data/branding.json')))
 const font=fs.readFileSync(path.join(root,'public/data/fonts/hafs.woff2')).toString('base64'),uiFont=fs.readFileSync(path.join(root,'public/data/fonts/vazirmatn-400.woff2')).toString('base64')
 const output=path.join(root,'public/images/surahs');fs.mkdirSync(output,{recursive:true})
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']})
 try{
  const page=await browser.newPage()
  await page.setContent(`<style>@font-face{font-family:Hafs;src:url(data:font/woff2;base64,${font})}@font-face{font-family:UI;src:url(data:font/woff2;base64,${uiFont})}</style>`)
  await page.evaluate(()=>Promise.all([document.fonts.load('100px Hafs'),document.fonts.load('32px UI')]))
  for(const surah of surahs){
   const png=await page.evaluate(({surah,brand})=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')
    c.fillStyle='#10342b';c.fillRect(0,0,512,512)
    c.strokeStyle='#c8b777';c.lineWidth=2;c.beginPath();c.roundRect(26,26,460,460,54);c.stroke()
    c.globalAlpha=.35;c.lineWidth=1;c.beginPath();c.roundRect(36,36,440,440,46);c.stroke();c.globalAlpha=1
    c.textAlign='center';c.textBaseline='middle';c.direction='rtl';c.fillStyle='#bdcbb4';c.font='30px UI';c.fillText(brand.APP_NAME,256,104)
    c.strokeStyle='#c8b777';c.lineWidth=1;c.beginPath();c.moveTo(170,151);c.lineTo(342,151);c.stroke()
    let size=132;c.font=`${size}px Hafs`;while(c.measureText(surah.ar).width>360){size-=2;c.font=`${size}px Hafs`}
    c.fillStyle='#eee3b6';c.fillText(surah.ar,256,277)
    c.strokeStyle='#c8b777';c.beginPath();c.moveTo(170,365);c.lineTo(342,365);c.stroke()
    c.font='38px UI';c.fillStyle='#c8b777';c.fillText(new Intl.NumberFormat('ar-u-nu-arab',{useGrouping:false}).format(surah.n),256,415)
    return canvas.toDataURL('image/png').split(',')[1]
   },{surah,brand})
   fs.writeFileSync(path.join(output,`${String(surah.n).padStart(3,'0')}.png`),Buffer.from(png,'base64'))
  }
 }finally{await browser.close()}
 console.log(`Generated ${surahs.length} 512px Quran surah covers`)
}
main().catch(e=>{console.error(e);process.exitCode=1})
