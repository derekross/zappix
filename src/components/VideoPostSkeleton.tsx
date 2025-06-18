import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function VideoPostSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Video placeholder with vertical aspect ratio */}
        <div className="relative aspect-[9/16] bg-muted">
          <Skeleton className="w-full h-full" />
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <Skeleton className="h-6 w-3/4" />
          
          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>

          {/* Hashtags */}
          <div className="flex flex-wrap gap-1">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-14" />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-6" />
              </div>
              <div className="flex items-center space-x-1">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-6" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}