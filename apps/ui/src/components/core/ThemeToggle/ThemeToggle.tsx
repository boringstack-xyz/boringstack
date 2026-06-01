import type { FC } from "react";

import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/classnames";

import { Button } from "@/components/ui/button";

import { THEME_TOGGLE_TEST_ID } from "./ThemeToggle.constants";
import { useThemeToggle } from "./ThemeToggle.hooks";
import type { IThemeToggleProps } from "./ThemeToggle.types";

const ThemeToggle: FC<IThemeToggleProps> = (props) => {
  const { className, theme, ariaLabel, onToggle } = useThemeToggle(props);

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      onClick={onToggle}
      aria-label={ariaLabel}
      className={cn(className)}
      data-testid={THEME_TOGGLE_TEST_ID}
    >
      {theme === "dark" ? (
        <Sun aria-hidden='true' className='h-4 w-4' />
      ) : (
        <Moon aria-hidden='true' className='h-4 w-4' />
      )}
    </Button>
  );
};

ThemeToggle.displayName = "ThemeToggle";

export default ThemeToggle;
export { ThemeToggle };
