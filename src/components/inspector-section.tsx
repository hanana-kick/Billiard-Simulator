import * as React from 'react'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'

const sectionState = new Map<string, string[]>()

/** An application section composed entirely from the official Base UI Accordion. */
export function InspectorSection({ title, children, className, id, defaultOpen = true }: {
  title: React.ReactNode; children: React.ReactNode; className?: string; id?: string; defaultOpen?: boolean
}) {
  const key = id || String(title)
  const [value,setValue] = React.useState<string[]>(() => sectionState.get(key) || (defaultOpen ? ["section"] : []))
  return <Accordion className={className} id={id} value={value} onValueChange={next => { const values=next.map(String);sectionState.set(key,values);setValue(values) }}><AccordionItem value="section">
    <AccordionTrigger>{title}</AccordionTrigger><AccordionContent>{children}</AccordionContent>
  </AccordionItem></Accordion>
}
