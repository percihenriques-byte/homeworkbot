import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Usa o ThemeContext local (o projeto usa contexts/ThemeContext, não
// next-themes). Antes o Toaster caia em "system" e ficava com o
// tema errado — sobretudo notavel agora que o dark theme e cyberpunk.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--primary)",
          "--success-text": "var(--primary-foreground)",
          "--error-bg": "var(--destructive)",
          "--error-text": "var(--destructive-foreground)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
