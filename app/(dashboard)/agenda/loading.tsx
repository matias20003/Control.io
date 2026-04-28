export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl animate-pulse">
      <div className="h-7 w-36 bg-surface-2 rounded-lg" />
      <div className="h-20 bg-surface-2 rounded-xl" />
      {[0,1,2,3,4].map(i => <div key={i} className="h-16 bg-surface-2 rounded-xl" />)}
    </div>
  );
}
