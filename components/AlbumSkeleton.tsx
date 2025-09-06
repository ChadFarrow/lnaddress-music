'use client';

interface AlbumSkeletonProps {
  count?: number;
  viewMode?: 'grid' | 'list';
}

export default function AlbumSkeleton({ count = 6, viewMode = 'grid' }: AlbumSkeletonProps) {
  const skeletonItems = Array.from({ length: count }, (_, i) => i);

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {skeletonItems.map((index) => (
          <div key={index} className="flex items-center gap-4 p-3 bg-black/20 border border-white/10 rounded-lg animate-pulse">
            {/* Album cover skeleton */}
            <div className="w-12 h-12 bg-gray-600 rounded border border-white/10"></div>
            
            {/* Album info skeleton */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-4 bg-gray-600 rounded w-3/4"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2"></div>
            </div>
            
            {/* Track count and year skeleton */}
            <div className="text-right space-y-1">
              <div className="h-3 bg-gray-700 rounded w-16"></div>
              <div className="h-3 bg-gray-700 rounded w-12"></div>
            </div>
            
            {/* Play button skeleton */}
            <div className="w-8 h-8 bg-gray-600 rounded-full"></div>
          </div>
        ))}
      </div>
    );
  }

  // Grid view skeleton
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
      {skeletonItems.map((index) => (
        <div key={index} className="group animate-pulse">
          {/* Album cover skeleton */}
          <div className="aspect-square relative overflow-hidden rounded-lg border border-white/10 bg-gray-600">
            <div className="absolute inset-0 bg-gradient-to-t from-gray-700 to-transparent opacity-50"></div>
          </div>
          
          {/* Album info skeleton */}
          <div className="mt-2 px-1 space-y-1">
            <div className="h-4 bg-gray-600 rounded w-full"></div>
            <div className="h-3 bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Separate skeleton for individual album page
export function AlbumDetailSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header skeleton */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-black/50 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-6 h-6 bg-gray-600 rounded"></div>
            <div className="h-4 bg-gray-600 rounded w-16"></div>
            <div className="w-2 h-4 bg-gray-700"></div>
            <div className="h-4 bg-gray-600 rounded w-32"></div>
          </div>
        </div>
      </header>

      {/* Album info skeleton */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 animate-pulse">
          {/* Album cover skeleton */}
          <div className="md:col-span-1">
            <div className="aspect-square relative overflow-hidden rounded-xl border border-white/10 bg-gray-600"></div>
          </div>

          {/* Album details skeleton */}
          <div className="md:col-span-2 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="h-10 bg-gray-600 rounded w-3/4"></div>
              <div className="h-6 bg-gray-700 rounded w-1/2"></div>
              <div className="flex items-center gap-4">
                <div className="h-4 bg-gray-700 rounded w-12"></div>
                <div className="w-1 h-4 bg-gray-700"></div>
                <div className="h-4 bg-gray-700 rounded w-20"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-700 rounded w-5/6"></div>
                <div className="h-4 bg-gray-700 rounded w-4/6"></div>
              </div>
            </div>

            {/* Play controls skeleton */}
            <div className="flex items-center gap-4">
              <div className="h-12 bg-gray-600 rounded-full w-32"></div>
              <div className="h-12 w-12 bg-gray-600 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Track list skeleton */}
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden animate-pulse">
          <div className="p-4 border-b border-white/10">
            <div className="h-6 bg-gray-600 rounded w-20"></div>
          </div>
          
          <div className="divide-y divide-white/5">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                {/* Track number skeleton */}
                <div className="w-10 text-center">
                  <div className="h-4 bg-gray-700 rounded w-6 mx-auto"></div>
                </div>

                {/* Track title skeleton */}
                <div className="flex-1 min-w-0">
                  <div className="h-5 bg-gray-600 rounded w-3/4"></div>
                </div>

                {/* Duration skeleton */}
                <div className="h-4 bg-gray-700 rounded w-12"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}