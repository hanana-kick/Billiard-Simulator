import * as React from 'react'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
export { Separator } from '@/components/ui/separator'

// App value adapters only. All pointer, keyboard, focus and popup behavior is
// implemented by the official shadcn components and the real Base UI package.
export function SliderField({ value, min, max, step, onChange, id, label, disabled = false }: {
  value: number; min: number; max: number; step: number; onChange: (value: number) => void;
  id?: string; label: string; disabled?: boolean
}) {
  const labelId = React.useId()
  return <><span id={labelId} className="sr-only">{label}</span><Slider id={id} value={[value]} min={min} max={max} step={step} aria-labelledby={labelId}
    onValueChange={value => onChange(Array.isArray(value) ? value[0] : value)} aria-label={label} disabled={disabled} /></>
}
export function SwitchField({ checked, onChange, label, id, disabled = false }: {
  checked: boolean; onChange: (value: boolean) => void; label: string; id?: string; disabled?: boolean
}) {
  const generated = React.useId(), key = id || generated
  return <div className="flex items-center gap-2"><Switch id={key} checked={checked}
    onCheckedChange={onChange} aria-label={label} disabled={disabled} size="default" /><Label htmlFor={key}>{label}</Label></div>
}
export function OptionGroup({ value, onChange, options, label, id, disabled = false }: {
  value: string; onChange: (value: string) => void;
  options: { value: string; label: React.ReactNode; title?: string }[];
  label: string; id?: string; disabled?: boolean
}) {
  return <ToggleGroup value={[value]} onValueChange={values => { if (values[0]) onChange(String(values[0])) }}
    aria-label={label} id={id} disabled={disabled} variant="outline" size="sm" spacing={0} className="option-group">
    {options.map(option => <ToggleGroupItem key={option.value} value={option.value} title={option.title}>{option.label}</ToggleGroupItem>)}
  </ToggleGroup>
}
export function SelectField({ value, onChange, children, id, className, disabled, ...props }: any) {
  const options = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<any>[]
  const items = options.map(option => ({ value: String(option.props.value), label: option.props.children }))
  return <Select items={items} value={value == null ? null : String(value)}
    onValueChange={value => { if (value != null) onChange?.({ target: { value } }) }} disabled={disabled}>
    <SelectTrigger id={id} className={className} aria-label={props['aria-label']}><SelectValue /></SelectTrigger>
    <SelectContent><SelectGroup>
      {options.map(option => <SelectItem key={option.props.value} value={String(option.props.value)}
        disabled={option.props.disabled}>{option.props.children}</SelectItem>)}
    </SelectGroup></SelectContent>
  </Select>
}
