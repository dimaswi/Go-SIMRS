import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface OrderDetailInfoButtonProps {
  title: string;
  children: ReactNode;
  tooltip?: string;
  className?: string;
}

export function OrderDetailInfoButton({
  title,
  children,
  tooltip,
  className,
}: OrderDetailInfoButtonProps) {
  return (
    <Dialog>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "h-7 w-7 rounded-full border-border/70 text-muted-foreground",
                  className,
                )}
                aria-label={tooltip || title}
                title={tooltip || title}
              >
                <Info className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{tooltip || title}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}