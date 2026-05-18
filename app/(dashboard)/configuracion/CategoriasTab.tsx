"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/app/actions/categories";
import { CategoryRow } from "./CategoryRow";
import type { SerializedCategory } from "@/lib/db/categories";

export function CategoriasTab({ initialCategories }: { initialCategories: SerializedCategory[] }) {
  const [categories, setCategories] = useState<SerializedCategory[]>(initialCategories);
  const [isOpen, setIsOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SerializedCategory | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");
  const incomeCategories = categories.filter((c) => c.type === "INCOME");

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      const result = await createCategoryAction(formData);
      if (result.error) {
        toast.error(result.error);
      } else if (result.success && result.category) {
        setCategories((prev) => [...prev, result.category!]);
        setIsOpen(false);
        toast.success("Categoría creada");
      }
    });
  };

  const handleEdit = (formData: FormData) => {
    if (!editingCategory) return;
    startTransition(async () => {
      const result = await updateCategoryAction(editingCategory.id, formData);
      if (result.error) {
        toast.error(result.error);
      } else if (result.success && result.category) {
        setCategories((prev) => prev.map((c) => (c.id === result.category!.id ? result.category! : c)));
        setEditingCategory(null);
        toast.success("Categoría actualizada");
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        toast.success("Categoría eliminada");
      }
      setDeletingId(null);
    });
  };

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{categories.length} categorías en total</p>
          <Button size="sm" onClick={() => setIsOpen(true)}>
            <Plus size={15} className="mr-1" />
            Nueva
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Gastos ({expenseCategories.length})
          </h3>
          {expenseCategories.length === 0 ? (
            <p className="text-sm text-muted py-3 text-center">Sin categorías de gasto</p>
          ) : (
            <div className="space-y-1.5">
              {expenseCategories.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  onEdit={setEditingCategory}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                  isPending={isPending}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Ingresos ({incomeCategories.length})
          </h3>
          {incomeCategories.length === 0 ? (
            <p className="text-sm text-muted py-3 text-center">Sin categorías de ingreso</p>
          ) : (
            <div className="space-y-1.5">
              {incomeCategories.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  onEdit={setEditingCategory}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                  isPending={isPending}
                />
              ))}
            </div>
          )}
        </div>

        {categories.length === 0 && (
          <EmptyState
            icon={Tag}
            title="Sin categorías"
            description="Creá tu primera categoría para organizar tus movimientos."
            action={
              <Button onClick={() => setIsOpen(true)}>
                <Plus size={16} className="mr-1.5" />
                Nueva categoría
              </Button>
            }
          />
        )}
      </div>

      <Dialog open={!!editingCategory} onOpenChange={(o) => !o && setEditingCategory(null)}>
        <DialogContent title="Editar categoría">
          <form action={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre *</Label>
              <Input id="edit-name" name="name" defaultValue={editingCategory?.name} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-icon">Ícono (emoji)</Label>
                <Input id="edit-icon" name="icon" placeholder="📦" maxLength={4} defaultValue={editingCategory?.icon ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-color">Color</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="edit-color"
                    name="color"
                    type="color"
                    defaultValue={editingCategory?.color ?? "#94a3b8"}
                    className="h-10 w-12 p-1 cursor-pointer"
                  />
                  <span className="text-xs text-muted">Opcional</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setEditingCategory(null)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent title="Nueva categoría">
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nombre *</Label>
              <Input id="cat-name" name="name" placeholder="Ej: Ropa, Delivery, Freelance" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-type">Tipo *</Label>
              <Select id="cat-type" name="type" defaultValue="EXPENSE" required>
                <option value="EXPENSE">💸 Gasto</option>
                <option value="INCOME">💰 Ingreso</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-icon">Ícono (emoji)</Label>
                <Input id="cat-icon" name="icon" placeholder="📦" maxLength={4} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-color">Color</Label>
                <div className="flex gap-2 items-center">
                  <Input id="cat-color" name="color" type="color" defaultValue="#94a3b8" className="h-10 w-12 p-1 cursor-pointer" />
                  <span className="text-xs text-muted">Opcional</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Creando..." : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
