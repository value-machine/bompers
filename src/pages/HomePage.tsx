import { HarnessOverviewCard } from "@/features/harness-overview/components/HarnessOverviewCard";
import { appScrollContentClassName } from "@/shared/theme/appViewLayout";
import { cn } from "@/shared/utils/cn";

export const HomePage = () => (
  <div className={cn(appScrollContentClassName, "text-center")}>
    <HarnessOverviewCard />
  </div>
);
