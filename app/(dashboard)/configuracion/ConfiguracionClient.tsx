"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Tag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  createCategoryAction,
  deleteCategoryAction,
} from "@/app/actions/categories";
import type { SerializedCategory } from "@/lib/db/categories";

type Tab = "categorias" | "perfil";

interface Props {
  initialCategories: SerializedCategory[];
  profileName: string | null;
  profileEmail: string;
}

export function ConfiguracionClient({
  initialCategories,
  profileName,
  profileEmail,
}: Props) {
  const [tab, setTab] = useState<Tab>("categorias");
  const [categories, setCategories] =
    useState<SerializedCategory[]>(initialCategories);
  const [isOpen, setIsOpen] = useState(false);
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
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted mt-0.5">
          Personalizá categorías y tu perfil
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 rounded-xl p-1 w-fit">
        {(
          [
            { id: "categorias", label: "Categorías", icon: Tag },
            { id: "perfil", label: "Perfil", icon: User },
          ] as { id: Tab; label: string; icon: React.ElementType }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Categories tab */}
      {tab === "categorias" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {categories.length} categorías en total
            </p>
            <Button size="sm" onClick={() => setIsOpen(true)}>
              <Plus size={15} className="mr-1" />
              Nueva
            </Button>
          </div>

          {/* Expense categories */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Gastos ({expenseCategories.length})
            </h3>
            {expenseCategories.length === 0 ? (
              <p className="text-sm text-muted py-3 text-center">
                Sin categorías de gasto
              </p>
            ) : (
              <div className="space-y-1.5">
                {expenseCategories.map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
                    onDelete={handleDelete}
                    deletingId={deletingId}
                    isPending={isPending}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Income categories */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Ingresos ({incomeCategories.length})
            </h3>
            {incomeCategories.length === 0 ? (
              <p className="text-sm text-muted py-3 text-center">
                Sin categorías de ingreso
              </p>
            ) : (
              <div className="space-y-1.5">
                {incomeCategories.map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
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
      )}

      {/* Profile tab */}
      {tab === "perfil" && (
        <div className="space-y-4 max-w-sm">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">
                  {(profileName || profileEmail)[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {profileName || "Sin nombre"}
                  </p>
                  <p className="text-sm text-muted">{profileEmail}</p>
                </div>
              </div>

              <div className="pt-1 border-t border-border">
                <p className="text-xs text-muted">
                  Para cambiar tu email o contraseña, usá las opciones de
                  Supabase Auth en la configuración de tu cuenta.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create category dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent title="Nueva categoría">
          <form action={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nombre *</Label>
              <Input
                id="cat-name"
                name="name"
                placeholder="Ej: Ropa, Delivery, Freelance"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-type">Tipo *</Label>
              <Select
                id="cat-type"
                name="type"
                defaultValue="EXPENSE"
                required
              >
                <option value="EXPENSE">💸 Gasto</option>
                <option value="INCOME">💰 Ingreso</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-icon">Ícono (emoji)</Label>
                <Input
                  id="cat-icon"
                  name="icon"
                  placeholder="📦"
                  maxLength={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-color">Color</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="cat-color"
                    name="color"
                    type="color"
                    defaultValue="#94a3b8"
                    className="h-10 w-12 p-1 cursor-pointer"
                  />
                  <span className="text-xs text-muted">Opcional</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? "Creando..." : "Crear"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryRow({
  category,
  onDelete,
  deletingId,
  isPending,
}: {
  category: SerializedCategory;
  onDelete: (id: string) => void;
  deletingId: string | null;
  isPending: boolean;
}) {
  return (
    <Card className="group">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Icon / color dot */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
            style={{
              backgroundColor: category.color ? `${category.color}25` : "var(--color-surface-2)",
            }}
          >
            {category.icon || "📦"}
          </div>

          <span className="flex-1 text-sm font-medium text-foreground">
            {category.name}
          </span>

          {/* Color swatch */}
          {category.color && (
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: category.color }}
            />
          )}

          <button
            onClick={() => onDelete(category.id)}
            disabled={deletingId === category.id || isPending}
            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
