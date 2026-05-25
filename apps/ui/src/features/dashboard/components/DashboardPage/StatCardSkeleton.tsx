import type { FC } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const StatCardSkeleton: FC = () => (
  <Card>
    <CardHeader>
      <Skeleton className='h-4 w-24' />
    </CardHeader>
    <CardContent>
      <Skeleton className='h-9 w-16' />
    </CardContent>
  </Card>
);

StatCardSkeleton.displayName = "StatCardSkeleton";

export { StatCardSkeleton };
