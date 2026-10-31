import * as React from 'react'
import {createRoot} from 'react-dom/client'
import {CanonicalPracticeEntry} from '../../../src/components/canonical-practice-entry'
import loss from './loss.json'
// Synthetic props exercise only the actual error UI. No GPU is requested.
;(globalThis as any).CANONICAL_GPU_ENTRY_AVAILABLE=true
const state={ready:true,paused:true,canAim:true,routeStatus:'error',canonicalPlayback:{deviceLoss:loss,deviceLost:true}}
createRoot(document.getElementById('root')!).render(<><h1>Synthetic diagnostic UI fixture — not a GPU reproduction</h1><CanonicalPracticeEntry state={state} controller={{}}/></>)
