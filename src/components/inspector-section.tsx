import * as React from 'react'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'

/** An application section composed entirely from the official Base UI Accordion. */
export function InspectorSection({ title, children, className, id, defaultOpen = true }: {
  title: React.ReactNode; children: React.ReactNode; className?: string; id?: string; defaultOpen?: boolean
}) {
  return <Accordion className={className} id={id} defaultValue={defaultOpen ? ["section"] : []}><AccordionItem value="section">
    <AccordionTrigger>{title}</AccordionTrigger><AccordionContent>{children}</AccordionContent>
  </AccordionItem></Accordion>
}
