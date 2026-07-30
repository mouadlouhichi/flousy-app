/** Loading skeleton shown in the content area while month data loads. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-md py-xl">
      <div className="h-40 w-full skeleton-loader rounded-3xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        <div className="h-32 w-full skeleton-loader rounded-2xl" />
        <div className="h-32 w-full skeleton-loader rounded-2xl" />
        <div className="h-32 w-full skeleton-loader rounded-2xl" />
      </div>
    </div>
  );
}
