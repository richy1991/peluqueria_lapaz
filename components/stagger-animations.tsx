import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

type StaggerItemProps = { children: ReactNode; index: number };
type StaggerContainerProps = { children: ReactNode; className: string };
type AnimatedProps = { className?: string; style?: CSSProperties };

/** Adds the stagger delay to the card itself, without inserting layout wrappers. */
export function StaggerItem({ children, index }: StaggerItemProps) {
  if (!isValidElement<AnimatedProps>(children)) return children;
  const className = [children.props.className, "lc-stagger-item"].filter(Boolean).join(" ");
  const style = {
    ...children.props.style,
    "--lc-stagger-delay": `${index * 85}ms`,
  } as CSSProperties;
  return cloneElement(children as ReactElement<AnimatedProps>, { className, style });
}

/** Staggers direct cards in the container, including cards grouped in fragments. */
export function StaggerContainer({ children, className }: StaggerContainerProps) {
  let index = 0;

  function addStagger(items: ReactNode): ReactNode {
    return Children.map(items, (child) => {
      if (!isValidElement(child)) return child;
      if (child.type === Fragment) {
        const fragment = child as ReactElement<{ children?: ReactNode }>;
        return cloneElement(fragment, undefined, addStagger(fragment.props.children));
      }
      return <StaggerItem key={child.key ?? index} index={index++}>{child}</StaggerItem>;
    });
  }

  return <div className={`lc-stagger-container ${className}`}>{addStagger(children)}</div>;
}
