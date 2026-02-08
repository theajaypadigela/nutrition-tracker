import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { VariantProps } from 'tailwind-variants';
import { tv } from 'tailwind-variants';
import { cn } from '@/src/lib/utils';

const buttonStyles = tv({
  slots: {
    base: 'flex-row items-center justify-center rounded-lg',
    text: 'font-medium',
  },
  variants: {
    variant: {
      solid: {
        base: 'bg-blue-600',
        text: 'text-white',
      },
      outline: {
        base: 'border-2 border-blue-600 bg-transparent',
        text: 'text-blue-600',
      },
      ghost: {
        base: 'bg-transparent',
        text: 'text-blue-600',
      },
    },
    size: {
      sm: {
        base: 'px-3 py-2', 
        text: 'text-sm',
      },
      md: {
        base: 'px-4 py-3',
        text: 'text-base',
      },
      lg: {
        base: 'px-6 py-4',
        text: 'text-lg',
      },
    },
    disabled: {
      true: {
        base: 'opacity-50',
      },
    },
  },
  defaultVariants: {
    variant: 'solid',
    size: 'md',
  },
});

export interface ButtonProps extends VariantProps<typeof buttonStyles> {
  onPress?: () => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Button({
  variant,
  size,
  disabled,
  onPress,
  children,
  className,
}: ButtonProps) {
  const { base, text } = buttonStyles({ variant, size, disabled });

  return (
    <Pressable
      className={cn(base(), className)}
      onPress={onPress}
      disabled={disabled}
    >
      {typeof children === 'string' ? (
        <Text className={text()}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
