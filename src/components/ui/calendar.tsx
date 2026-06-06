"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";
import { es } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// Días que requieren contacto (4=Jueves, 5=Viernes, 6=Sábado)
const CONTACT_DAYS = [4, 5, 6];

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  locale,
  weekStartsOn,
  onDayClick,
  contactPhones,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
  contactPhones?: { number: string; href?: string }[];
}) {
  const [showContactDialog, setShowContactDialog] = React.useState(false);
  const [activePhones, setActivePhones] = React.useState<{ number: string; href?: string }[]>([]);

  const defaultClassNames = getDefaultClassNames();

  const isContactDay = (date: Date) => CONTACT_DAYS.includes(date.getDay());

  const handleDayClick = (date: Date, modifiers: any, e: React.MouseEvent) => {
    if (isContactDay(date)) {
      setActivePhones(contactPhones ?? []);
      setShowContactDialog(true);
      return;
    }
    onDayClick?.(date, modifiers, e);
  };

  // Intercept onSelect to prevent contact days from being selected
  const originalOnSelect = (props as any).onSelect as ((...args: any[]) => void) | undefined;
  const handleSelect = React.useCallback(
    (...args: any[]) => {
      const selectedDay: Date | undefined = args[1];
      if (selectedDay && isContactDay(selectedDay)) return;
      originalOnSelect?.(...args);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [originalOnSelect],
  );
  const { onSelect: _ignored, ...restProps } = props as any;

  return (
    <>
      <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale ?? es}
      weekStartsOn={weekStartsOn ?? 1}
      onDayClick={handleDayClick}
      onSelect={handleSelect}
      modifiers={{
        contactRequired: (date) => CONTACT_DAYS.includes(date.getDay()),
      }}
      modifiersClassNames={{
        contactRequired: "opacity-70 cursor-pointer border border-dashed border-amber-400",
      }}
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        // ✅ FIX: Eliminado el formatWeekdayName custom — el locale `es` de
        // date-fns ya genera los nombres correctos y alineados con weekStartsOn
        formatMonthDropdown: (date) =>
          date.toLocaleString("es-ES", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        // ... (el resto de tus classNames igual que antes)
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("bg-popover absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label,
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday,
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn("w-(--cell-size) select-none", defaultClassNames.week_number_header),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day,
        ),
        range_start: cn("bg-accent rounded-l-md", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn("text-muted-foreground opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => (
          <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />
        ),
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left")
            return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
          if (orientation === "right")
            return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
          return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => (
          <td {...props}>
            <div className="flex size-(--cell-size) items-center justify-center text-center">
              {children}
            </div>
          </td>
        ),
        ...components,
      }}
      {...restProps}
      />

      <AlertDialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solo reserva por tlf o Whatsapp</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription asChild>
            <div>
              <p>Los jueves, viernes y sábados solo aceptamos reservas por teléfono o WhatsApp.</p>
              <div className="mt-4 flex flex-col gap-2">
                {activePhones.length > 0 ? (
                  activePhones.map((p, i) => {
                    const waHref = `https://wa.me/${p.href?.replace(/[^0-9]/g, "") ?? p.number.replace(/[^0-9]/g, "")}`;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <a href={p.href ?? `tel:${p.number.replace(/\s/g, "")}`} className="font-medium text-foreground hover:underline">
                          📞 {p.number}
                        </a>
                        <a href={waHref} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline text-sm">
                          WhatsApp
                        </a>
                      </div>
                    );
                  })
                ) : (
                  <p className="font-medium">📞 Contacta con nosotros</p>
                )}
              </div>
            </div>
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// CalendarDayButton sin cambios
function CalendarDayButton({ className, day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };