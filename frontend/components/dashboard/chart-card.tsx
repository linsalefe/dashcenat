"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
  actions?: React.ReactNode;
}

export function ChartCard({ title, description, children, loading, className, actions }: ChartCardProps) {
  if (loading) {
    return (
      <Card className={cn("p-[var(--card-pad,16px)]", className)}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className={cn("p-[var(--card-pad,16px)] shadow-[var(--shadow-xs)] border border-border", className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-[var(--font-size-body)] font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-[var(--font-size-caption)] text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="w-full">{children}</div>
    </Card>
  );
}
