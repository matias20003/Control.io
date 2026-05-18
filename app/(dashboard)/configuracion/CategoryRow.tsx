"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SerializedCategory } from "@/lib/db/categories";

export function CategoryRow({
  category,
  onEdit,
  onDelete,
  deletingId,
  isPending,
}: {
  category: SerializedCategory;
  onEdit: (cat: SerializedCategory) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  isPending: boolean;
}) {
  return (
    <Card className="group">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
            style={{
              backgroundColor: category.color ? `${category.color}25` : "var(--color-surface-2)",
            }}
          >
            {category.icon || "📦"}
          </div>

          <span className="flex-1 text-sm font-medium text-foreground">{category.name}</span>

          {category.color && (
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color }}
            />
          )}

          <button
            onClick={() => onEdit(category)}
            disabled={isPending}
            className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(category.id)}
            disabled={deletingId === category.id || isPending}
            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
