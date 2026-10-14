import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavItems } from "@/components/layout/nav-items";
import { cn } from "cn";

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-20 hidden flex-col border-r bg-background transition-[width] duration-200 ease-in-out lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-3">
        <div
          className={cn(
            "min-w-0 flex-1 font-semibold tracking-tight",
            collapsed && "flex-1 text-center",
          )}
          title="GardenPay Облік садового товариства"
        >
          <span className="block truncate">
            {collapsed ? "GP" : 'СТ "Усмішка"'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          aria-label={collapsed ? "Розгорнути меню" : "Згорнути меню"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>
      <div className={cn("flex-1 overflow-y-auto p-3", collapsed && "p-2")}>
        <NavItems collapsed={collapsed} />
      </div>
    </aside>
  );
}
