export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl animate-pulse">
      <div className="h-8 w-44 bg-surface-2 rounded-lg" />
      <div className="h-10 bg-surface-2 rounded-xl" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-surface-2 rounded-xl" />)}
      </div>
    </div>
  );
}
