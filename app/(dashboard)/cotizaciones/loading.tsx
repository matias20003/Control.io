export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl animate-pulse">
      <div className="h-7 w-48 bg-surface-2 rounded-lg" />
      <div className="h-20 bg-surface-2 rounded-xl" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[0,1,2,3,4,5].map(i => <div key={i} className="h-28 bg-surface-2 rounded-xl" />)}
      </div>
    </div>
  );
}
