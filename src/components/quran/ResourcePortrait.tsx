'use client'
import {useState} from 'react'
import {UserRound} from 'lucide-react'
export default function ResourcePortrait({image,large=false}:{image?:{src:string;alt:string};large?:boolean}){
 const [failed,setFailed]=useState<string|null>(null)
 const valid=image&&failed!==image.src&&/^\/(?!\/)/.test(image.src)
 return <span className={large?'resource-profile-picture':'resource-portrait'}>{valid?<img src={image.src} alt={image.alt} width={large?72:36} height={large?72:36} loading="lazy" onError={()=>setFailed(image.src)}/>:<UserRound size={large?32:20} aria-hidden="true"/>}</span>
}
