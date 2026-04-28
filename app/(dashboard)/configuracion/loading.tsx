export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl animate-pulse">
      <div className="h-8 w-44 bg-surface-2 rounded-lg" />
      <div className="flex gap-2">
        <div className="h-9 w-28 bg-surface-2 rounded-lg" />
        <div className="h-9 w-28 bg-surface-2 rounded-lg" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-surface-2 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
