import * as React from "react";
import { Input } from "./input";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";
import { ScrollArea } from "./scroll-area";

export interface TimeInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ className, value = "", onChange, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);

    // Array for hours (00-23) and minutes (00-59)
    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

    const valStr = typeof value === "string" ? value : "";
    const currentHour = valStr.length >= 2 ? valStr.slice(0, 2) : "12";
    const currentMinute = valStr.length === 5 ? valStr.slice(3, 5) : "00";

    const triggerChange = (newVal: string) => {
      if (onChange) {
        const syntheticEvent = {
          target: { value: newVal },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/[^0-9:]/g, "");

      if (val.length === 2 && !val.includes(":")) {
        if (e.nativeEvent && (e.nativeEvent as InputEvent).inputType === "deleteContentBackward") {
          // Allow backspace
        } else {
          val = val + ":";
        }
      }

      if (val.length > 5) {
        val = val.slice(0, 5);
      }

      if (val.length >= 2) {
        const h = parseInt(val.slice(0, 2));
        if (h > 23) val = "23" + val.slice(2);
      }
      if (val.length === 5) {
        const m = parseInt(val.slice(3, 5));
        if (m > 59) val = val.slice(0, 3) + "59";
      }

      triggerChange(val);
    };

    return (
      <div className="relative flex items-center">
        <Input
          type="text"
          placeholder="HH:mm"
          value={value}
          onChange={handleChange}
          className={`pr-10 ${className}`}
          ref={ref}
          {...props}
        />
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <Clock className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="end">
            <div className="flex gap-2">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-semibold text-muted-foreground mb-1">Jam</span>
                <ScrollArea className="h-48 w-14">
                  <div className="flex flex-col gap-1 pr-3">
                    {hours.map((h) => (
                      <Button
                        key={h}
                        type="button"
                        variant={currentHour === h ? "default" : "ghost"}
                        size="sm"
                        className="h-7 w-full text-xs"
                        onClick={() => triggerChange(`${h}:${currentMinute}`)}
                      >
                        {h}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-semibold text-muted-foreground mb-1">Menit</span>
                <ScrollArea className="h-48 w-14">
                  <div className="flex flex-col gap-1 pr-3">
                    {minutes.map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant={currentMinute === m ? "default" : "ghost"}
                        size="sm"
                        className="h-7 w-full text-xs"
                        onClick={() => triggerChange(`${currentHour}:${m}`)}
                      >
                        {m}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);
TimeInput.displayName = "TimeInput";
