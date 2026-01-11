/**
 * SuccessAnimation - Animated visual feedback for successful actions
 * Uses motion/react for smooth animations
 */

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Check, Copy, Download, FileText, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

type AnimationType = "success" | "create" | "delete" | "copy" | "download";

interface SuccessAnimationProps {
  show: boolean;
  type?: AnimationType;
  message?: string;
  onComplete?: () => void;
  duration?: number;
  /** Custom icon for the create animation type */
  createIcon?: LucideIcon;
}

const iconMap: Record<AnimationType, LucideIcon> = {
  success: Check,
  create: FileText,
  delete: Trash2,
  copy: Copy,
  download: Download,
};

const colorMap: Record<AnimationType, string> = {
  success: "bg-green-500",
  create: "bg-primary",
  delete: "bg-destructive",
  copy: "bg-blue-500",
  download: "bg-emerald-500",
};

export function SuccessAnimation({
  show,
  type = "success",
  message,
  onComplete,
  duration = 1500,
  createIcon,
}: SuccessAnimationProps) {
  const Icon = type === "create" && createIcon ? createIcon : iconMap[type];
  const bgColor = colorMap[type];

  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [show, onComplete, duration]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [0, 1.2, 1],
              opacity: 1,
            }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              className={cn(
                "flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg",
                bgColor
              )}
              initial={{ rotate: -180 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Icon className="h-10 w-10" />
            </motion.div>
            {message && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg font-medium"
              >
                {message}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook to manage the success animation state
 */
export function useSuccessAnimation() {
  const [state, setState] = useState<{
    show: boolean;
    type: AnimationType;
    message?: string;
  }>({
    show: false,
    type: "success",
  });

  const trigger = (type: AnimationType = "success", message?: string) => {
    setState({ show: true, type, message });
  };

  const hide = () => {
    setState((prev) => ({ ...prev, show: false }));
  };

  return {
    ...state,
    trigger,
    hide,
  };
}

export type { AnimationType, SuccessAnimationProps };
