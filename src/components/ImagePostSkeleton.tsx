import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";

export function ImagePostSkeleton() {
  const isMobile = useIsMobile();
  
  return (
    <Card className={cn(isMobile && "mx-0 rounded-none border-x-0")}>
      <CardHeader className={cn("space-y-4", isMobile && "px-2")}>
        <div className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-3 w-[100px]" />
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("space-y-4", isMobile && "px-2")}>
        <Skeleton className="h-[400px] w-full rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex items-center space-x-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
