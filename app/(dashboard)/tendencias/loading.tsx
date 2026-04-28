export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl animate-pulse">
      <div className="h-7 w-40 bg-surface-2 rounded-lg" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 bg-surface-2 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-surface-2 rounded-xl" />
      <div className="h-48 bg-surface-2 rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-surface-2 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
