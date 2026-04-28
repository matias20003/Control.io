export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl animate-pulse">
      <div className="h-8 w-32 bg-surface-2 rounded-lg" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-surface-2 rounded-xl" />)}
      </div>
    </div>
  );
}
