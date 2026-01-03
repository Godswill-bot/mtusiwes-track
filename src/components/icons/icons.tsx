import { LucideIcon, LucideProps } from "lucide-react";
import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

// Animated icon wrapper with hover effects
export const AnimatedIcon = ({
  Icon,
  className = "",
  size = 20,
  ...props
}: {
  Icon: LucideIcon;
  className?: string;
  size?: number;
} & Omit<LucideProps, "size">) => {
  return (
    <motion.div
      whileHover={{ 
        scale: 1.1,
        rotate: 2,
      }}
      transition={{ duration: 0.2 }}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon 
        size={size}
        className="transition-shadow duration-200 hover:drop-shadow-md"
        {...props}
      />
    </motion.div>
  );
};

// Icon with text wrapper
export const IconWithText = ({
  Icon,
  text,
  className = "",
  iconSize = 20,
  iconClassName = "",
  textClassName = "",
  ...props
}: {
  Icon: LucideIcon;
  text: ReactNode;
  className?: string;
  iconSize?: number;
  iconClassName?: string;
  textClassName?: string;
} & Omit<HTMLMotionProps<"div">, "children">) => {
  return (
    <motion.div
      className={`flex items-center gap-2 ${className}`}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      {...props}
    >
      <AnimatedIcon 
        Icon={Icon} 
        size={iconSize}
        className={iconClassName}
      />
      <span className={textClassName}>{text}</span>
    </motion.div>
  );
};

// Heading with icon
export const HeadingWithIcon = ({
  Icon,
  title,
  className = "",
  iconSize = 24,
  ...props
}: {
  Icon: LucideIcon;
  title: string;
  className?: string;
  iconSize?: number;
} & Omit<HTMLMotionProps<"div">, "children">) => {
  return (
    <motion.div
      className={`flex items-center gap-2 ${className}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      {...props}
    >
      <AnimatedIcon Icon={Icon} size={iconSize} />
      <h2 className="text-2xl font-bold">{title}</h2>
    </motion.div>
  );
};

// Menu item with icon
export const MenuItemWithIcon = ({
  Icon,
  label,
  onClick,
  className = "",
  iconSize = 20,
  active = false,
  ...props
}: {
  Icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
  iconSize?: number;
  active?: boolean;
} & Omit<HTMLMotionProps<"div">, "children" | "onClick">) => {
  return (
    <motion.div
      onClick={onClick}
      className={`flex items-center gap-2 cursor-pointer p-2 rounded-md transition-colors ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
      } ${className}`}
      whileHover={{ scale: 1.05, x: 4 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
      {...props}
    >
      <AnimatedIcon 
        Icon={Icon} 
        size={iconSize}
        className={active ? "text-primary-foreground" : ""}
      />
      <span>{label}</span>
    </motion.div>
  );
};
















