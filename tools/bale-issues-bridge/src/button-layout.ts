/** Bale supplies no viewport width. Pair only short labels; preserve order and payloads. */
export function layoutButtons<T extends {text:string}>(rows:T[][]):T[][] {
 const result:T[][]=[];
 for(const button of rows.flat()){
  const short=Array.from(button.text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'')).length<=12;
  const previous=result.at(-1);
  if(short&&previous?.length===1&&Array.from(previous[0].text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'')).length<=12)previous.push(button);
  else result.push([button]);
 }
 return result;
}
