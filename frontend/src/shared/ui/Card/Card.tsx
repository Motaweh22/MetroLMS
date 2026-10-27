import React from 'react';

export type CardVariant = 'default' | 'elevated' | 'interactive';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  children,
  className = '',
  ...rest
}) => {
  const variantClasses = {
    default: 'bg-surface border border-border shadow-sm',
    elevated: 'bg-bg border border-border/70 shadow-md',
    interactive:
      'bg-surface border border-border shadow-sm hover:shadow-md hover:border-primary/60 transition-all duration-200 cursor-pointer',
  }[variant];

  return (
    <div
      className={`rounded-lg overflow-hidden text-text ${variantClasses} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <div className={`p-5 pb-3 ${className}`} {...rest}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <h3 className={`text-base font-bold text-primary-dark leading-snug ${className}`} {...rest}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <p className={`text-xs text-text-muted mt-1 leading-normal ${className}`} {...rest}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <div className={`p-5 pt-2 ${className}`} {...rest}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <div
    className={`p-4 bg-bg-alt/50 border-t border-border flex items-center justify-between text-xs text-text-muted ${className}`}
    {...rest}
  >
    {children}
  </div>
);

export default Card;
