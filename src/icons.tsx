import * as React from 'react'
import {Minus,Play,Pause,Undo2,RotateCcw,Expand,Box,Crosshair,Move,RotateCw,ChevronRight,Info,Target,Plus,Trash2,ArrowRight,Grip,Scan,Check,X,Settings2} from 'lucide-react'
const icons={minus:Minus,play:Play,pause:Pause,undo:Undo2,reset:RotateCcw,expand:Expand,cube:Box,crosshair:Crosshair,move:Move,rotate:RotateCw,chevron:ChevronRight,info:Info,target:Target,plus:Plus,trash:Trash2,arrow:ArrowRight,grip:Grip,frame:Scan,check:Check,x:X,settings:Settings2}
export function Icon({name,...props}:React.SVGProps<SVGSVGElement>&{name:string}){const Component=icons[name as keyof typeof icons]||Target;return <Component aria-hidden="true" {...props}/>}
