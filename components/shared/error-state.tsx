import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  details?: string[];
  className?: string;
};

export function ErrorState({ title, description, details, className }: Props) {
  return (
    <Alert variant="destructive" className={cn("border-status-expired-dot/30 bg-status-expired-bg", className)}>
      <TriangleAlertIcon />
      <AlertTitle>{title}</AlertTitle>
      {description || details?.length ? (
        <AlertDescription>
          {description ? <p>{description}</p> : null}
          {details?.length ? (
            <ul className="list-disc pl-4">
              {details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </AlertDescription>
      ) : null}
    </Alert>
  );
}
