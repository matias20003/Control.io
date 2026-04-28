export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-48 bg-surface-2 rounded-lg" />
        <div className="h-4 w-64 bg-surface-2 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-11 bg-surface-2 rounded-xl" />
        <div className="h-11 bg-surface-2 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-surface-2 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-surface-2 rounded-xl" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-surface-2 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
