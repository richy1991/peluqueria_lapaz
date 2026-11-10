import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

function cardPart(part: string, className = "", props: CardProps) {
  return <div className={`${part} ${className}`.trim()} {...props} />;
}

export function Card({ className = "", ...props }: CardProps) {
  return <div className={`ui-card ${className}`.trim()} {...props} />;
}

export function CardHeader({ className = "", ...props }: CardProps) {
  return cardPart("ui-card-header", className, props);
}

export function CardTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`ui-card-title ${className}`.trim()} {...props} />;
}

export function CardDescription({ className = "", ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`ui-card-description ${className}`.trim()} {...props} />;
}

export function CardContent({ className = "", ...props }: CardProps) {
  return cardPart("ui-card-content", className, props);
}

export function CardFooter({ className = "", ...props }: CardProps) {
  return cardPart("ui-card-footer", className, props);
}
