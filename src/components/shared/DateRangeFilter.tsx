import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Support both the new unified pattern and the legacy pattern
interface DateRangeFilterPropsNew {
  from: Date;
  to: Date;
  onChange: (range: DateRange) => void;
  className?: string;
}

interface DateRangeFilterPropsLegacy {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  onClear?: () => void;
  className?: string;
}

type DateRangeFilterProps = DateRangeFilterPropsNew | DateRangeFilterPropsLegacy;

function isNewPattern(props: DateRangeFilterProps): props is DateRangeFilterPropsNew {
  return 'from' in props;
}

export function DateRangeFilter(props: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);

  // Normalize to unified internal state
  const from = isNewPattern(props) ? props.from : props.startDate;
  const to = isNewPattern(props) ? props.to : props.endDate;
  
  const handleChange = (range: DateRange) => {
    if (isNewPattern(props)) {
      props.onChange(range);
    } else {
      if (range.from) props.onStartDateChange(range.from);
      if (range.to) props.onEndDateChange(range.to);
    }
  };

  const handleClear = () => {
    if (!isNewPattern(props) && props.onClear) {
      props.onClear();
    }
  };

  const presets = [
    { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: 'Este mês', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: 'Este ano', getValue: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
  ];

  const handlePresetChange = (value: string) => {
    const preset = presets.find((p) => p.label === value);
    if (preset) {
      handleChange(preset.getValue());
    }
  };

  return (
    <div className={cn('flex flex-col sm:flex-row gap-2', props.className)}>
      <Select onValueChange={handlePresetChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Período rápido" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.label} value={preset.label}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full sm:w-auto justify-start text-left font-normal',
              !from && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {from ? (
              to ? (
                <>
                  {format(from, 'dd/MM/yyyy', { locale: ptBR })} -{' '}
                  {format(to, 'dd/MM/yyyy', { locale: ptBR })}
                </>
              ) : (
                format(from, 'dd/MM/yyyy', { locale: ptBR })
              )
            ) : (
              <span>Selecionar período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={from}
            selected={{ from, to }}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                handleChange(range);
                setOpen(false);
              } else if (range?.from) {
                handleChange({ from: range.from, to: range.from });
              }
            }}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      {!isNewPattern(props) && props.onClear && (
        <Button variant="ghost" size="icon" onClick={handleClear}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}